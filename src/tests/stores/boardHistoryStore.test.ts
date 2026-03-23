import { beforeEach, describe, expect, it } from 'vitest';
import { useBoardHistoryStore } from '@/stores/boardHistoryStore';
import { decompressSnapshotData } from '@/lib/boardUtils';

describe('boardHistoryStore', () => {
    beforeEach(() => {
        useBoardHistoryStore.setState({ snapshots: {} });
    });

    it('creates compressed snapshots and keeps the latest first', () => {
        const store = useBoardHistoryStore.getState();

        const first = store.createSnapshot({
            boardId: 'board-1',
            name: 'First snapshot',
            data: '{"objects":[{"id":1}]}',
            source: 'manual',
        });
        const second = store.createSnapshot({
            boardId: 'board-1',
            name: 'Second snapshot',
            data: '{"objects":[{"id":2}]}',
            source: 'auto',
        });

        const snapshots = useBoardHistoryStore.getState().getSnapshots('board-1');
        expect(snapshots[0].id).toBe(second.id);
        expect(decompressSnapshotData(snapshots[0].compressedData)).toBe('{"objects":[{"id":2}]}');
        expect(first.id).not.toBe(second.id);
    });

    it('deduplicates consecutive identical snapshots', () => {
        const store = useBoardHistoryStore.getState();
        const first = store.createSnapshot({
            boardId: 'board-1',
            name: 'Same snapshot',
            data: '{"objects":[{"id":1}]}',
            source: 'manual',
        });
        const second = store.createSnapshot({
            boardId: 'board-1',
            name: 'Same snapshot',
            data: '{"objects":[{"id":1}]}',
            source: 'manual',
        });

        expect(first.id).toBe(second.id);
        expect(store.getSnapshots('board-1')).toHaveLength(1);
    });

    it('caps snapshot history to twelve entries per board', () => {
        const store = useBoardHistoryStore.getState();

        for (let index = 0; index < 15; index += 1) {
            store.createSnapshot({
                boardId: 'board-1',
                name: `Snapshot ${index}`,
                data: `{"objects":[{"id":${index}}]}`,
                source: 'auto',
            });
        }

        expect(store.getSnapshots('board-1')).toHaveLength(12);
    });
});
