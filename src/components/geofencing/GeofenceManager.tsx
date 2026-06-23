import React, { useState } from 'react';
import { useGeofenceStore } from '../../stores/useGeofenceStore';
import { useAppStore } from '../../stores/useAppStore';

interface GeofenceManagerProps {
  onClose: () => void;
}

export const GeofenceManager: React.FC<GeofenceManagerProps> = ({ onClose }) => {
  const addGeofence = useGeofenceStore((state) => state.addGeofence);
  const removeGeofence = useGeofenceStore((state) => state.removeGeofence);
  const geofences = useGeofenceStore((state) => state.geofences);
  const userLocation = useAppStore((state) => state.userLocation);
  const userId = useAppStore((state) => state.user?.id);

  const [name, setName] = useState('');
  const [radius, setRadius] = useState(100);
  const [alertOnEnter, setAlertOnEnter] = useState(true);
  const [alertOnLeave, setAlertOnLeave] = useState(false);

  const handleCreateAtCurrentLocation = () => {
    if (!userLocation || !userId) return;

    addGeofence({
      name: name || 'My Geofence',
      latitude: userLocation.lat,
      longitude: userLocation.lng,
      radius,
      userId,
      alertOnEnter,
      alertOnLeave,
    });

    setName('');
    setRadius(100);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          Manage Geofences
        </h2>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Home, Work, School..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Radius (meters)
            </label>
            <input
              type="range"
              min="50"
              max="1000"
              step="50"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">{radius}m</span>
          </div>

          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={alertOnEnter}
                onChange={(e) => setAlertOnEnter(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Alert on Enter</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={alertOnLeave}
                onChange={(e) => setAlertOnLeave(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Alert on Leave</span>
            </label>
          </div>

          <button
            onClick={handleCreateAtCurrentLocation}
            disabled={!userLocation}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create at Current Location
          </button>
        </div>

        {geofences.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
              Your Geofences
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {geofences.map((geofence) => (
                <div
                  key={geofence.id}
                  className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-700 rounded-md"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{geofence.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Radius: {geofence.radius}m
                    </p>
                  </div>
                  <button
                    onClick={() => removeGeofence(geofence.id)}
                    className="text-red-600 hover:text-red-700 text-sm font-medium"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-6 w-full bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-900 dark:text-white font-medium py-2 px-4 rounded-md"
        >
          Close
        </button>
      </div>
    </div>
  );
};
