import React, { useState } from 'react';
import { useSmartStatus, getSuggestedStatuses } from '../hooks/useSmartStatus';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { motion, AnimatePresence } from 'framer-motion';

interface SmartStatusPickerProps {
  currentSpeed?: number;
  location?: [number, number];
  onStatusChange?: (status: any) => void;
}

const SmartStatusPicker: React.FC<SmartStatusPickerProps> = ({
  currentSpeed,
  location,
  onStatusChange,
}) => {
  const autoStatus = useSmartStatus(currentSpeed, location);
  const suggestedStatuses = getSuggestedStatuses();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(autoStatus);
  const haptic = useHapticFeedback();

  const handleSelect = (status: any) => {
    haptic.success();
    setSelectedStatus(status);
    setIsOpen(false);
    onStatusChange?.(status);
  };

  return (
    <div className="relative">
      {/* Status Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          haptic.light();
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-md border border-gray-200 hover:shadow-lg transition-shadow"
      >
        <span className="text-xl">{selectedStatus.emoji}</span>
        <span className="text-sm font-medium text-gray-700">{selectedStatus.text}</span>
        <span className="text-xs text-gray-400">▼</span>
      </motion.button>

      {/* Status Picker Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden"
          >
            {/* Auto-detected Status */}
            <div className="p-3 bg-blue-50 border-b border-blue-100">
              <p className="text-xs text-blue-600 font-semibold mb-2">🤖 Auto-detected</p>
              <button
                onClick={() => handleSelect(autoStatus)}
                className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${
                  selectedStatus.type === autoStatus.type
                    ? 'bg-blue-100 border-blue-300'
                    : 'hover:bg-blue-50'
                }`}
              >
                <span className="text-2xl">{autoStatus.emoji}</span>
                <div className="text-left">
                  <p className="font-medium text-gray-800">{autoStatus.text}</p>
                  <p className="text-xs text-gray-500">
                    {Math.round(autoStatus.confidence * 100)}% confidence
                  </p>
                </div>
              </button>
            </div>

            {/* Suggested Statuses */}
            <div className="p-2">
              <p className="text-xs text-gray-500 font-semibold mb-2 px-2">💡 Suggestions</p>
              <div className="grid grid-cols-3 gap-2">
                {suggestedStatuses.map((status, idx) => (
                  <motion.button
                    key={idx}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleSelect(status)}
                    className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
                      selectedStatus.type === status.type && selectedStatus.text === status.text
                        ? 'bg-blue-100 border-2 border-blue-400'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-2xl mb-1">{status.emoji}</span>
                    <span className="text-xs text-gray-700 font-medium">{status.text}</span>
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SmartStatusPicker;
