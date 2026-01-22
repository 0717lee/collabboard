import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserSettings, Theme } from '@/types';

interface SettingsState {
    settings: UserSettings;
    updateTheme: (theme: Partial<Theme>) => void;
    toggleTheme: () => void;
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

            updateTheme: (theme: Partial<Theme>) => {
                set((state) => ({
                    settings: {
                        ...state.settings,
                        theme: { ...state.settings.theme, ...theme },
                    },
                }));
            },

            toggleTheme: () => {
                set((state) => ({
                    settings: {
                        ...state.settings,
                        theme: {
                            ...state.settings.theme,
                            mode: state.settings.theme.mode === 'light' ? 'dark' : 'light',
                        },
                    },
                }));
            },

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
        }
    )
);
