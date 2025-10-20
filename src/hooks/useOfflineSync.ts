import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cacheManager } from '@/utils/cache';

interface PendingOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  table: string;
  data: any;
  timestamp: number;
  retryCount: number;
}

interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingOperations: PendingOperation[];
  lastSyncTime: number | null;
  conflicts: Conflict[];
}

interface Conflict {
  id: string;
  operation: PendingOperation;
  serverData: any;
  localData: any;
  resolved: boolean;
}

export const useOfflineSync = () => {
  const [syncState, setSyncState] = useState<SyncState>({
    isOnline: navigator.onLine,
    isSyncing: false,
    pendingOperations: [],
    lastSyncTime: null,
    conflicts: [],
  });

  const syncInProgressRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load pending operations from IndexedDB
  const loadPendingOperations = useCallback(async () => {
    try {
      const operations = await cacheManager.get<PendingOperation[]>('pending_operations');
      if (operations) {
        setSyncState(prev => ({ ...prev, pendingOperations: operations }));
      }
    } catch (error) {
      console.warn('Failed to load pending operations:', error);
    }
  }, []);

  // Save pending operations to IndexedDB
  const savePendingOperations = useCallback(async (operations: PendingOperation[]) => {
    try {
      await cacheManager.set('pending_operations', operations, { ttl: 24 * 60 * 60 * 1000 }); // 24 hours
    } catch (error) {
      console.warn('Failed to save pending operations:', error);
    }
  }, []);

  // Add operation to queue
  const addPendingOperation = useCallback(async (operation: Omit<PendingOperation, 'id' | 'timestamp' | 'retryCount'>) => {
    const newOperation: PendingOperation = {
      ...operation,
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0,
    };

    setSyncState(prev => ({
      ...prev,
      pendingOperations: [...prev.pendingOperations, newOperation],
    }));

    await savePendingOperations([...syncState.pendingOperations, newOperation]);

    // Try to sync immediately if online
    if (syncState.isOnline && !syncInProgressRef.current) {
      syncPendingOperations();
    }
  }, [syncState.isOnline, syncState.pendingOperations, savePendingOperations]);

  // Execute operation
  const executeOperation = useCallback(async (operation: PendingOperation): Promise<{ success: boolean; data?: any; error?: any }> => {
    try {
      let result: any;

      switch (operation.type) {
        case 'create':
          result = await (supabase as any).from(operation.table).insert(operation.data);
          break;
        case 'update':
          const { id, ...updateData } = operation.data;
          result = await (supabase as any).from(operation.table).update(updateData).eq('id', id);
          break;
        case 'delete':
          result = await (supabase as any).from(operation.table).delete().eq('id', operation.data.id);
          break;
        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }

      if (result.error) {
        throw result.error;
      }

      return { success: true, data: result.data };
    } catch (error) {
      return { success: false, error };
    }
  }, []);

  // Resolve conflict
  const resolveConflict = useCallback(async (conflictId: string, resolution: 'local' | 'server' | 'merge') => {
    setSyncState(prev => ({
      ...prev,
      conflicts: prev.conflicts.map(conflict => {
        if (conflict.id === conflictId) {
          return { ...conflict, resolved: true };
        }
        return conflict;
      }),
    }));

    // Implement conflict resolution logic based on resolution type
    const conflict = syncState.conflicts.find(c => c.id === conflictId);
    if (!conflict) return;

    let resolvedData;
    switch (resolution) {
      case 'local':
        resolvedData = conflict.localData;
        break;
      case 'server':
        resolvedData = conflict.serverData;
        break;
      case 'merge':
        // Implement merge logic (this would be custom per data type)
        resolvedData = { ...conflict.serverData, ...conflict.localData };
        break;
    }

    // Re-queue the operation with resolved data
    await addPendingOperation({
      type: conflict.operation.type,
      table: conflict.operation.table,
      data: resolvedData,
    });
  }, [syncState.conflicts, addPendingOperation]);

  // Sync pending operations
  const syncPendingOperations = useCallback(async () => {
    if (syncInProgressRef.current || !syncState.isOnline) return;

    syncInProgressRef.current = true;
    abortControllerRef.current = new AbortController();

    setSyncState(prev => ({ ...prev, isSyncing: true }));

    try {
      const operations = [...syncState.pendingOperations];
      const successfulOps: string[] = [];
      const conflicts: Conflict[] = [];

      for (const operation of operations) {
        if (abortControllerRef.current?.signal.aborted) break;

        const result = await executeOperation(operation);

        if (result.success) {
          successfulOps.push(operation.id);
        } else {
          // Check if it's a conflict (e.g., version mismatch)
          if (result.error?.code === 'PGRST116') { // Example conflict error code
            conflicts.push({
              id: `conflict_${Date.now()}_${operation.id}`,
              operation,
              serverData: result.error.details?.server_data,
              localData: operation.data,
              resolved: false,
            });
          } else if (operation.retryCount < 3) {
            // Retry failed operations up to 3 times
            operation.retryCount++;
            setSyncState(prev => ({
              ...prev,
              pendingOperations: prev.pendingOperations.map(op =>
                op.id === operation.id ? operation : op
              ),
            }));
          }
        }
      }

      // Remove successful operations
      const remainingOps = syncState.pendingOperations.filter(
        op => !successfulOps.includes(op.id)
      );

      setSyncState(prev => ({
        ...prev,
        pendingOperations: remainingOps,
        conflicts: [...prev.conflicts, ...conflicts],
        lastSyncTime: Date.now(),
      }));

      await savePendingOperations(remainingOps);

    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      syncInProgressRef.current = false;
      setSyncState(prev => ({ ...prev, isSyncing: false }));
      abortControllerRef.current = null;
    }
  }, [syncState.isOnline, syncState.pendingOperations, executeOperation, savePendingOperations]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setSyncState(prev => ({ ...prev, isOnline: true }));
      if (!syncInProgressRef.current) {
        syncPendingOperations();
      }
    };

    const handleOffline = () => {
      setSyncState(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncPendingOperations]);

  // Load pending operations on mount
  useEffect(() => {
    loadPendingOperations();
  }, [loadPendingOperations]);

  // Periodic sync when online
  useEffect(() => {
    if (!syncState.isOnline) return;

    const interval = setInterval(() => {
      if (!syncInProgressRef.current && syncState.pendingOperations.length > 0) {
        syncPendingOperations();
      }
    }, 30000); // Sync every 30 seconds

    return () => clearInterval(interval);
  }, [syncState.isOnline, syncState.pendingOperations.length, syncPendingOperations]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    syncState,
    addPendingOperation,
    syncPendingOperations,
    resolveConflict,
    clearPendingOperations: () => {
      setSyncState(prev => ({ ...prev, pendingOperations: [] }));
      savePendingOperations([]);
    },
  };
};

// Hook for optimistic updates with conflict resolution
export const useOptimisticUpdate = <T>(
  table: string,
  options: {
    onConflict?: (serverData: T, localData: T) => T;
    enabled?: boolean;
  } = {}
) => {
  const { addPendingOperation } = useOfflineSync();
  const { onConflict, enabled = true } = options;

  const optimisticUpdate = useCallback(async (
    operation: 'create' | 'update' | 'delete',
    data: any,
    optimisticData?: T
  ) => {
    if (!enabled) return;

    // Add to pending operations queue
    await addPendingOperation({
      type: operation,
      table,
      data,
    });

    // Return optimistic data for immediate UI update
    return optimisticData;
  }, [table, enabled, addPendingOperation]);

  return { optimisticUpdate };
};

// Hook for offline data management
export const useOfflineData = <T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    enabled?: boolean;
    staleTime?: number;
  } = {}
) => {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { syncState } = useOfflineSync();
  const { isOnline } = syncState;

  const { enabled = true, staleTime = 5 * 60 * 1000 } = options; // 5 minutes

  const fetchData = useCallback(async (force = false) => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      // Try to get from cache first
      if (!force) {
        const cached = await cacheManager.get<T>(key);
        if (cached) {
          setData(cached);
          setIsLoading(false);
          return;
        }
      }

      // Fetch fresh data
      const freshData = await fetcher();

      // Cache the data
      await cacheManager.set(key, freshData, { ttl: staleTime });

      setData(freshData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [key, fetcher, enabled, staleTime]);

  // Fetch data on mount or when coming online
  useEffect(() => {
    if (enabled && (isOnline || !data)) {
      fetchData();
    }
  }, [enabled, isOnline, data, fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch: () => fetchData(true),
    isStale: !isOnline,
  };
};