import { create } from 'zustand';

type MapStyleType = 'light' | 'dark' | 'satellite' | 'retro' | 'outdoor' | 'navigation';

interface MapThemeState {
  currentStyle: MapStyleType;
  isAutoSwitching: boolean;
  availableStyles: MapStyleType[];
  setStyle: (style: MapStyleType) => void;
  toggleAutoSwitch: () => void;
  getStyleUrl: () => string;
}

const STYLE_URLS: Record<MapStyleType, string> = {
  light: 'mapbox://styles/mapbox/light-v11',
  dark: 'mapbox://styles/mapbox/dark-v11',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  retro: 'mapbox://styles/mapbox/navigation-night-v1',
  outdoor: 'mapbox://styles/mapbox/outdoors-v12',
  navigation: 'mapbox://styles/mapbox/navigation-day-v1',
};

export const useMapThemeStore = create<MapThemeState>((set, get) => ({
  currentStyle: 'light',
  isAutoSwitching: true,
  availableStyles: ['light', 'dark', 'satellite', 'retro', 'outdoor', 'navigation'],

  setStyle: (style: MapStyleType) => {
    set({ currentStyle: style });
  },

  toggleAutoSwitch: () => {
    set((state) => ({ isAutoSwitching: !state.isAutoSwitching }));
  },

  getStyleUrl: () => {
    return STYLE_URLS[get().currentStyle];
  },
}));

// Auto-switch based on time of day
export const initAutoMapTheme = () => {
  const updateStyleBasedOnTime = () => {
    const hour = new Date().getHours();
    
    // Night: 18:00 - 06:00
    if (hour >= 18 || hour < 6) {
      useMapThemeStore.getState().setStyle('dark');
    } else {
      useMapThemeStore.getState().setStyle('light');
    }
  };

  // Initial check
  updateStyleBasedOnTime();

  // Check every minute
  const interval = setInterval(updateStyleBasedOnTime, 60000);

  return () => clearInterval(interval);
};
