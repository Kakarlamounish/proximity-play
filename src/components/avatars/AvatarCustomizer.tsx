import React, { useEffect, useState } from 'react';
import { useAvatarStore, AVATAR_ICONS, AVATAR_COLORS, AvatarIcon } from '../../stores/useAvatarStore';

interface AvatarCustomizerProps {
  userId: string;
  onClose: () => void;
}

export const AvatarCustomizer: React.FC<AvatarCustomizerProps> = ({ userId, onClose }) => {
  const setAvatar = useAvatarStore((state) => state.setAvatar);
  const fetchAvatar = useAvatarStore((state) => state.fetchAvatar);
  const currentAvatar = useAvatarStore((state) => state.avatars[userId]);

  const [selectedIcon, setSelectedIcon] = useState<AvatarIcon>(currentAvatar?.icon || 'user');
  const [selectedColor, setSelectedColor] = useState(currentAvatar?.color || AVATAR_COLORS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentAvatar) {
      fetchAvatar(userId).then((ua) => {
        if (ua) {
          setSelectedIcon(ua.icon);
          setSelectedColor(ua.color);
        }
      });
    }
  }, [userId, currentAvatar, fetchAvatar]);

  const handleSave = async () => {
    setSaving(true);
    await setAvatar(userId, { icon: selectedIcon, color: selectedColor });
    setSaving(false);
    onClose();
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          Customize Your Avatar
        </h2>

        {/* Icon Selection */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Choose Icon
          </h3>
          <div className="grid grid-cols-7 gap-2">
            {AVATAR_ICONS.map((icon) => (
              <button
                key={icon}
                onClick={() => setSelectedIcon(icon)}
                className={`p-2 rounded-lg transition-colors ${
                  selectedIcon === icon
                    ? 'bg-blue-100 dark:bg-blue-900 ring-2 ring-blue-500'
                    : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                aria-label={`Select ${icon} icon`}
              >
                <span className="text-xl">
                  {icon === 'user' && '👤'}
                  {icon === 'car' && '🚗'}
                  {icon === 'bike' && '🚴'}
                  {icon === 'walk' && '🚶'}
                  {icon === 'home' && '🏠'}
                  {icon === 'work' && '💼'}
                  {icon === 'coffee' && '☕'}
                  {icon === 'restaurant' && '🍽️'}
                  {icon === 'gym' && '💪'}
                  {icon === 'park' && '🌳'}
                  {icon === 'school' && '📚'}
                  {icon === 'shopping' && '🛍️'}
                  {icon === 'airport' && '✈️'}
                  {icon === 'train' && '🚂'}
                  {icon === 'bus' && '🚌'}
                  {icon === 'boat' && '⛵'}
                  {icon === 'dog' && '🐕'}
                  {icon === 'cat' && '🐱'}
                  {icon === 'star' && '⭐'}
                  {icon === 'heart' && '❤️'}
                  {icon === 'flag' && '🚩'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Color Selection */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Choose Color
          </h3>
          <div className="flex space-x-3">
            {AVATAR_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className={`w-10 h-10 rounded-full transition-transform ${
                  selectedColor === color ? 'ring-4 ring-offset-2 ring-gray-400 scale-110' : ''
                }`}
                style={{ backgroundColor: color }}
                aria-label={`Select color ${color}`}
              />
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Preview</p>
          <div
            className="w-16 h-16 mx-auto rounded-full flex items-center justify-center text-2xl"
            style={{ backgroundColor: selectedColor }}
          >
            {selectedIcon === 'user' && '👤'}
            {selectedIcon === 'car' && '🚗'}
            {selectedIcon === 'bike' && '🚴'}
            {selectedIcon === 'walk' && '🚶'}
            {selectedIcon === 'home' && '🏠'}
            {selectedIcon === 'work' && '💼'}
            {selectedIcon === 'coffee' && '☕'}
            {selectedIcon === 'restaurant' && '🍽️'}
            {selectedIcon === 'gym' && '💪'}
            {selectedIcon === 'park' && '🌳'}
            {selectedIcon === 'school' && '📚'}
            {selectedIcon === 'shopping' && '🛍️'}
            {selectedIcon === 'airport' && '✈️'}
            {selectedIcon === 'train' && '🚂'}
            {selectedIcon === 'bus' && '🚌'}
            {selectedIcon === 'boat' && '⛵'}
            {selectedIcon === 'dog' && '🐕'}
            {selectedIcon === 'cat' && '🐱'}
            {selectedIcon === 'star' && '⭐'}
            {selectedIcon === 'heart' && '❤️'}
            {selectedIcon === 'flag' && '🚩'}
          </div>
        </div>

        {/* Actions */}
        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-900 dark:text-white font-medium py-2 px-4 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
