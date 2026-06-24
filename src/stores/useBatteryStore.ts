import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface BatteryState {
  level: number;
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  isLowBattery: boolean;
  batterySaverMode: boolean;
  toggleBatterySaver: () => void;
  updateBatteryInfo: (battery: any) => void;
  initBatteryListener: () => void;
}

export const useBatteryStore = create<BatteryState>()(
  subscribeWithSelector((set, get) => ({
    level: 100,
    charging: false,
    chargingTime: 0,
    dischargingTime: 0,
    isLowBattery: false,
    batterySaverMode: false,

    toggleBatterySaver: () => {
      set((state) => ({ batterySaverMode: !state.batterySaverMode }));
    },

    updateBatteryInfo: (battery: any) => {
      if (!battery) return;
      const level = battery.level * 100;
      const isLow = level < 20;
      
      set({
        level,
        charging: battery.charging,
        chargingTime: battery.chargingTime,
        dischargingTime: battery.dischargingTime,
        isLowBattery: isLow,
        // Auto-enable saver if low battery and not already on
        batterySaverMode: isLow ? true : get().batterySaverMode,
      });
    },

    initBatteryListener: () => {
      if ('getBattery' in navigator) {
        (navigator as any).getBattery().then((battery: any) => {
          const updateAll = () => {
            get().updateBatteryInfo(battery);
          };
          
          updateAll();
          
          battery.addEventListener('levelchange', updateAll);
          battery.addEventListener('chargingchange', updateAll);
          battery.addEventListener('chargingtimechange', updateAll);
          battery.addEventListener('dischargingtimechange', updateAll);
        });
      }
    },
  }))
);
