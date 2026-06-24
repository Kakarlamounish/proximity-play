import React, { useState } from 'react';
import { useBatteryStore } from '../stores/useBatteryStore';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { motion } from 'framer-motion';

const BatterySaverWidget: React.FC = () => {
  const { level, charging, batterySaverMode, toggleBatterySaver } = useBatteryStore();
  const haptic = useHapticFeedback();
  const [showTooltip, setShowTooltip] = useState(false);

  const getBatteryColor = () => {
    if (charging) return 'text-green-500';
    if (level > 50) return 'text-green-500';
    if (level > 20) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getBatteryIcon = () => {
    if (charging) return '🔌';
    if (level > 50) return '🔋';
    if (level > 20) return '🪫';
    return '🪫';
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className={`relative p-3 rounded-full shadow-lg cursor-pointer transition-all ${
          batterySaverMode ? 'bg-green-100 border-2 border-green-500' : 'bg-white'
        }`}
        onClick={() => {
          haptic.light();
          toggleBatterySaver();
        }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span className="text-2xl">{getBatteryIcon()}</span>
        
        {/* Battery Level Indicator */}
        <div className="absolute -top-1 -right-1 bg-gray-800 text-white text-xs px-2 py-0.5 rounded-full">
          {Math.round(level)}%
        </div>

        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute bottom-full right-0 mb-2 w-48 p-3 bg-gray-900 text-white text-sm rounded-lg shadow-xl">
            <p className="font-semibold">
              {batterySaverMode ? '✅ Battery Saver ON' : '⚡ Battery Saver OFF'}
            </p>
            <p className="text-xs text-gray-300 mt-1">
              {batterySaverMode
                ? 'GPS updates reduced to save power'
                : 'Normal GPS polling frequency'}
            </p>
            {level < 20 && !charging && (
              <p className="text-xs text-red-400 mt-2 font-medium">
                ⚠️ Low battery! Auto-enabled.
              </p>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default BatterySaverWidget;
