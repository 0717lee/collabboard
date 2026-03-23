import { beforeEach, describe, expect, it } from 'vitest';
import { useBoardLibraryStore } from '@/stores/boardLibraryStore';
import type { Board } from '@/types';

describe('boardLibraryStore', () => {
    const sampleBoard: Board = {
        id: 'board-1',
        name: 'Roadmap',
        ownerId: 'owner-1',
        createdAt: '2026-03-20T08:00:00.000Z',
        updatedAt: '2026-03-22T08:00:00.000Z',
    };

    beforeEach(() => {
        useBoardLibraryStore.setState({ entries: {} });
    });

    it('syncs board summaries while preserving local metadata', () => {
        useBoardLibraryStore.getState().syncBoards([sampleBoard], 'owned');
        useBoardLibraryStore.getState().toggleFavorite('board-1');
        useBoardLibraryStore.getState().setThumbnail('board-1', 'thumb-data');

        useBoardLibraryStore.getState().syncBoards([
            { ...sampleBoard, name: 'Roadmap 2.0', updatedAt: '2026-03-23T08:00:00.000Z' },
        ], 'owned');

        const entry = useBoardLibraryStore.getState().entries['board-1'];
        expect(entry.name).toBe('Roadmap 2.0');
        expect(entry.isFavorite).toBe(true);
        expect(entry.thumbnail).toBe('thumb-data');
    });

    it('records recent visits and shared roles', () => {
        useBoardLibraryStore.getState().touchBoard({
            ...sampleBoard,
            name: 'Shared Board',
        }, 'viewer');

        const entry = useBoardLibraryStore.getState().entries['board-1'];
        expect(entry.role).toBe('viewer');
        expect(entry.lastOpenedAt).toBeTruthy();
    });

    it('removes cached board metadata cleanly', () => {
        useBoardLibraryStore.getState().syncBoards([sampleBoard], 'owned');
        useBoardLibraryStore.getState().removeBoard('board-1');

        expect(useBoardLibraryStore.getState().entries['board-1']).toBeUndefined();
    });
});
