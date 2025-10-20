import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Users, Save, Undo, Redo } from 'lucide-react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';
import Editor, { Monaco } from '@monaco-editor/react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface CollaborativeEditorProps {
  documentId: string;
  documentType: 'bubble_description' | 'event_details' | 'story_content';
  initialContent?: string;
  onSave?: (content: string) => void;
  readOnly?: boolean;
}

interface Collaborator {
  id: string;
  name: string;
  avatar?: string;
  color: string;
  cursor?: { line: number; column: number };
}

export const CollaborativeEditor: React.FC<CollaborativeEditorProps> = ({
  documentId,
  documentType,
  initialContent = '',
  onSave,
  readOnly = false,
}) => {
  const { user } = useAuth();
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Initialize Yjs document and WebSocket provider
  useEffect(() => {
    if (!user || !documentId) return;

    // Create Yjs document
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // Create text type for collaborative editing
    const ytext = ydoc.getText('monaco');

    // Initialize with existing content
    if (initialContent && ytext.length === 0) {
      ytext.insert(0, initialContent);
    }

    // Create WebSocket provider for real-time sync
    const provider = new WebsocketProvider(
      import.meta.env.VITE_YJS_WS_URL || 'ws://localhost:1234',
      `proximity-play-${documentType}-${documentId}`,
      ydoc,
      {
        connect: true,
      }
    );
    providerRef.current = provider;

    // Handle connection status
    provider.on('status', (event: any) => {
      setIsConnected(event.status === 'connected');
    });

    // Handle awareness (collaborator presence)
    provider.awareness.on('change', () => {
      const states = Array.from(provider.awareness.getStates().values());
      const collabStates = states
        .filter((state: any) => state.user)
        .map((state: any) => ({
          id: state.user.id,
          name: state.user.name,
          avatar: state.user.avatar,
          color: state.user.color || '#6366f1',
          cursor: state.cursor,
        }));
      setCollaborators(collabStates);
    });

    // Set user awareness
    provider.awareness.setLocalStateField('user', {
      id: user.id,
      name: user.user_metadata?.first_name || 'Anonymous',
      avatar: user.user_metadata?.profile_photo_url,
      color: getRandomColor(),
    });

    return () => {
      if (bindingRef.current) {
        bindingRef.current.destroy();
      }
      provider.destroy();
      ydoc.destroy();
    };
  }, [user, documentId, documentType, initialContent]);

  // Handle editor mount
  const handleEditorDidMount = (editor: any, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    if (ydocRef.current && providerRef.current) {
      // Create Monaco binding for collaborative editing
      const ytext = ydocRef.current.getText('monaco');
      const binding = new MonacoBinding(
        ytext,
        editor.getModel(),
        new Set([editor]),
        providerRef.current.awareness
      );
      bindingRef.current = binding;

      // Track undo/redo state
      const updateUndoRedoState = () => {
        setCanUndo(editor.getModel().canUndo());
        setCanRedo(editor.getModel().canRedo());
      };

      editor.onDidChangeModelContent(() => {
        setHasUnsavedChanges(true);
        updateUndoRedoState();
      });

      updateUndoRedoState();
    }
  };

  // Generate random color for collaborator cursors
  const getRandomColor = (): string => {
    const colors = [
      '#ef4444', '#f97316', '#eab308', '#22c55e',
      '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  // Handle save
  const handleSave = async () => {
    if (!ydocRef.current || !onSave) return;

    setIsSaving(true);
    try {
      const ytext = ydocRef.current.getText('monaco');
      const content = ytext.toString();

      await onSave(content);
      setHasUnsavedChanges(false);

      // Update document in database (using existing tables)
      const tableName = documentType === 'bubble_description' ? 'bubbles' :
                       documentType === 'event_details' ? 'meetups' :
                       'messages';

      const updateData = documentType === 'bubble_description' ?
        { description: content } :
        documentType === 'event_details' ?
        { description: content } :
        { content };

      await (supabase as any).from(tableName).update(updateData).eq('id', documentId);

    } catch (error) {
      console.error('Failed to save document:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle undo/redo
  const handleUndo = () => {
    if (editorRef.current && canUndo) {
      editorRef.current.trigger('keyboard', 'undo');
    }
  };

  const handleRedo = () => {
    if (editorRef.current && canRedo) {
      editorRef.current.trigger('redo');
    }
  };

  return (
    <Card className="w-full h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Collaborative Editor
            {isConnected && (
              <Badge variant="secondary" className="text-xs">
                Live
              </Badge>
            )}
          </CardTitle>

          <div className="flex items-center gap-2">
            {/* Collaborators */}
            <div className="flex -space-x-2">
              {collaborators.slice(0, 3).map((collab) => (
                <Avatar key={collab.id} className="h-6 w-6 border-2 border-background">
                  <AvatarImage src={collab.avatar} />
                  <AvatarFallback
                    className="text-xs"
                    style={{ backgroundColor: collab.color }}
                  >
                    {collab.name[0]}
                  </AvatarFallback>
                </Avatar>
              ))}
              {collaborators.length > 3 && (
                <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs">
                  +{collaborators.length - 3}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={handleUndo}
                disabled={!canUndo}
              >
                <Undo className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRedo}
                disabled={!canRedo}
              >
                <Redo className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!hasUnsavedChanges || isSaving}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
          <span>{collaborators.length} collaborator{collaborators.length !== 1 ? 's' : ''}</span>
          {hasUnsavedChanges && (
            <Badge variant="outline" className="text-orange-600">
              Unsaved changes
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0">
        <Editor
          height="100%"
          defaultLanguage="markdown"
          theme="vs-light"
          options={{
            readOnly,
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            wordWrap: 'on',
            automaticLayout: true,
            scrollBeyondLastLine: false,
            renderWhitespace: 'selection',
            bracketPairColorization: { enabled: true },
            guides: {
              bracketPairs: true,
              indentation: true,
            },
          }}
          onMount={handleEditorDidMount}
        />
      </CardContent>
    </Card>
  );
};

// Collaborative cursor component
export const CollaborativeCursor: React.FC<{
  collaborator: Collaborator;
  editor: any;
}> = ({ collaborator, editor }) => {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!collaborator.cursor || !editor) return;

    const updatePosition = () => {
      try {
        const coords = editor.getScrolledVisiblePosition(collaborator.cursor);
        if (coords) {
          setPosition({
            top: coords.top,
            left: coords.left,
          });
        }
      } catch (error) {
        // Handle position calculation errors
      }
    };

    updatePosition();
    const interval = setInterval(updatePosition, 100);

    return () => clearInterval(interval);
  }, [collaborator.cursor, editor]);

  if (!position) return null;

  return (
    <div
      className="absolute pointer-events-none z-50"
      style={{
        top: position.top,
        left: position.left,
        transform: 'translateY(-100%)',
      }}
    >
      <div
        className="flex items-center gap-1 px-2 py-1 rounded text-xs text-white"
        style={{ backgroundColor: collaborator.color }}
      >
        <div
          className="w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent"
          style={{
            borderBottomColor: collaborator.color,
            position: 'absolute',
            bottom: '-4px',
            left: '4px',
          }}
        />
        {collaborator.name}
      </div>
    </div>
  );
};