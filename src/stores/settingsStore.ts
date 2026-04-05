import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserSettings } from '@/types';

interface SettingsState {
    settings: UserSettings;
    updateSettings: (settings: Partial<UserSettings>) => void;
    resetSettings: () => void;
}

const defaultSettings: UserSettings = {
    theme: {
        mode: 'light',
        primaryColor: '#1890ff',
    },
    autoSave: true,
    showGrid: true,
    snapToGrid: false,
};

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            settings: defaultSettings,

            updateSettings: (newSettings: Partial<UserSettings>) => {
                set((state) => ({
                    settings: { ...state.settings, ...newSettings },
                }));
            },

            resetSettings: () => {
                set({ settings: defaultSettings });
            },
        }),
        {
            name: 'settings-storage',
            version: 1,
            migrate: (persistedState: unknown, version: number) => {
                if (version === 0) {
                    return persistedState as SettingsState;
                }
                return persistedState as SettingsState;
            }
        }
    )
);
