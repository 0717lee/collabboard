import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from '@/stores/settingsStore';

describe('settingsStore', () => {
    beforeEach(() => {
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
            useSettingsStore.getState().updateSettings({
                autoSave: false,
                showGrid: false,
                snapToGrid: true,
            });

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
