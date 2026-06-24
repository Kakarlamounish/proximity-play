import React from 'react';
import { useMapThemeStore } from '../stores/useMapThemeStore';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { motion } from 'framer-motion';

const MapStyleSwitcher: React.FC = () => {
  const { currentStyle, setStyle, availableStyles } = useMapThemeStore();
  const haptic = useHapticFeedback();

  const styleIcons: Record<string, string> = {
    light: '☀️',
    dark: '🌙',
    satellite: '🛰️',
    retro: '📻',
    outdoor: '🏕️',
    navigation: '🧭',
  };

  const styleLabels: Record<string, string> = {
    light: 'Light',
    dark: 'Dark',
    satellite: 'Satellite',
    retro: 'Retro',
    outdoor: 'Outdoor',
    navigation: 'Navigation',
  };

  return (
    <div className="absolute top-4 right-4 z-40">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
        <div className="p-2 bg-gray-50 border-b border-gray-200">
          <p className="text-xs font-semibold text-gray-600">Map Style</p>
        </div>
        <div className="grid grid-cols-3 gap-1 p-2">
          {availableStyles.map((style) => (
            <motion.button
              key={style}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                haptic.light();
                setStyle(style);
              }}
              className={`flex flex-col items-center p-2 rounded-lg transition-all ${
                currentStyle === style
                  ? 'bg-blue-100 border-2 border-blue-500 shadow-md'
                  : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
              }`}
              title={styleLabels[style]}
            >
              <span className="text-xl mb-1">{styleIcons[style]}</span>
              <span className="text-[10px] font-medium text-gray-700">
                {styleLabels[style]}
              </span>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MapStyleSwitcher;
