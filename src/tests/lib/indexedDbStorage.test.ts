import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createIndexedDbStorage } from '@/lib/indexedDbStorage';

describe('createIndexedDbStorage', () => {
    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('migrates a legacy localStorage value into IndexedDB', async () => {
        vi.stubGlobal('indexedDB', new IDBFactory());
        localStorage.setItem('board-history-storage', '{"state":{"snapshots":{}}}');
        const databaseName = `collabboard-test-${crypto.randomUUID()}`;

        const storage = createIndexedDbStorage({ databaseName });
        await expect(storage.getItem('board-history-storage')).resolves.toBe(
            '{"state":{"snapshots":{}}}'
        );
        expect(localStorage.getItem('board-history-storage')).toBeNull();

        const reloadedStorage = createIndexedDbStorage({ databaseName });
        await expect(reloadedStorage.getItem('board-history-storage')).resolves.toBe(
            '{"state":{"snapshots":{}}}'
        );
    });

    it('persists and removes large state in IndexedDB', async () => {
        vi.stubGlobal('indexedDB', new IDBFactory());
        const storage = createIndexedDbStorage({
            databaseName: `collabboard-test-${crypto.randomUUID()}`,
        });
        const value = 'x'.repeat(6 * 1024 * 1024);

        await storage.setItem('board-library-storage', value);
        await expect(storage.getItem('board-library-storage')).resolves.toBe(value);
        expect(localStorage.getItem('board-library-storage')).toBeNull();

        await storage.removeItem('board-library-storage');
        await expect(storage.getItem('board-library-storage')).resolves.toBeNull();
    });

    it('uses an explicit localStorage fallback when IndexedDB is unavailable', async () => {
        vi.stubGlobal('indexedDB', undefined);
        const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const storage = createIndexedDbStorage();

        await storage.setItem('board-history-storage', 'fallback');

        expect(await storage.getItem('board-history-storage')).toBe('fallback');
        expect(warning).toHaveBeenCalledOnce();
    });
});
