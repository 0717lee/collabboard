import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from '@/stores/settingsStore';

describe('settingsStore', () => {
    beforeEach(() => {
        // Reset store state before each test
        useSettingsStore.setState({
            settings: {
                theme: {
                    mode: 'light',
                    primaryColor: '#1890ff',
                },
                autoSave: true,
                showGrid: true,
                snapToGrid: false,
            },
        });
    });

    describe('toggleTheme', () => {
        it('should toggle from light to dark', () => {
            expect(useSettingsStore.getState().settings.theme.mode).toBe('light');

            useSettingsStore.getState().toggleTheme();

            expect(useSettingsStore.getState().settings.theme.mode).toBe('dark');
        });

        it('should toggle from dark to light', () => {
            useSettingsStore.getState().toggleTheme(); // Switch to dark
            expect(useSettingsStore.getState().settings.theme.mode).toBe('dark');

            useSettingsStore.getState().toggleTheme(); // Switch back to light
            expect(useSettingsStore.getState().settings.theme.mode).toBe('light');
        });
    });

    describe('updateTheme', () => {
        it('should update primary color', () => {
            useSettingsStore.getState().updateTheme({ primaryColor: '#ff0000' });

            expect(useSettingsStore.getState().settings.theme.primaryColor).toBe('#ff0000');
        });

        it('should preserve other theme properties', () => {
            useSettingsStore.getState().updateTheme({ primaryColor: '#ff0000' });

            expect(useSettingsStore.getState().settings.theme.mode).toBe('light');
        });
    });

    describe('updateSettings', () => {
        it('should update autoSave setting', () => {
            useSettingsStore.getState().updateSettings({ autoSave: false });

            expect(useSettingsStore.getState().settings.autoSave).toBe(false);
        });

        it('should update multiple settings at once', () => {
            useSettingsStore.getState().updateSettings({
                showGrid: false,
                snapToGrid: true,
            });

            const settings = useSettingsStore.getState().settings;
            expect(settings.showGrid).toBe(false);
            expect(settings.snapToGrid).toBe(true);
        });

        it('should preserve unmodified settings', () => {
            useSettingsStore.getState().updateSettings({ showGrid: false });

            const settings = useSettingsStore.getState().settings;
            expect(settings.autoSave).toBe(true);
            expect(settings.snapToGrid).toBe(false);
        });
    });

    describe('resetSettings', () => {
        it('should reset all settings to default', () => {
            // Modify settings
            useSettingsStore.getState().toggleTheme();
            useSettingsStore.getState().updateSettings({
                autoSave: false,
                showGrid: false,
                snapToGrid: true,
            });
            useSettingsStore.getState().updateTheme({ primaryColor: '#ff0000' });

            // Reset
            useSettingsStore.getState().resetSettings();

            const settings = useSettingsStore.getState().settings;
            expect(settings.theme.mode).toBe('light');
            expect(settings.theme.primaryColor).toBe('#1890ff');
            expect(settings.autoSave).toBe(true);
            expect(settings.showGrid).toBe(true);
            expect(settings.snapToGrid).toBe(false);
        });
    });
});
