import { describe, expect, it } from 'vitest';
import {
    buildBoardShareLink,
    chooseCanvasDataSource,
    compressSnapshotData,
    decompressSnapshotData,
    extractBoardRoleFromUrl,
    getCanvasDataUpdatedAt,
    sortBoardsForDisplay,
    stampCanvasData,
} from '@/lib/boardUtils';
import type { Board, BoardLibraryEntry } from '@/types';

describe('boardUtils', () => {
    it('builds share links with role metadata', () => {
        expect(buildBoardShareLink('https://collabboard.test', 'board-1', 'viewer'))
            .toBe('https://collabboard.test/board/board-1?role=viewer');
    });

    it('extracts valid shared roles from search strings', () => {
        expect(extractBoardRoleFromUrl('?role=viewer')).toBe('viewer');
        expect(extractBoardRoleFromUrl('?role=editor')).toBe('editor');
        expect(extractBoardRoleFromUrl('?role=owner')).toBeNull();
        expect(extractBoardRoleFromUrl('?role=unknown')).toBeNull();
    });

    it('stamps canvas data without changing its objects', () => {
        const raw = JSON.stringify({ objects: [{ type: 'rect' }] });
        const stamped = stampCanvasData(raw, 12345);

        expect(getCanvasDataUpdatedAt(stamped)).toBe(12345);
        expect(JSON.parse(stamped).objects).toEqual([{ type: 'rect' }]);
    });

    it('keeps canvas timestamps monotonic when the clock does not advance', () => {
        const first = stampCanvasData(JSON.stringify({ objects: [] }), 12345);
        const second = stampCanvasData(first, 12345);

        expect(getCanvasDataUpdatedAt(second)).toBe(12346);
    });

    it('prefers the newer explicitly versioned canvas source', () => {
        expect(chooseCanvasDataSource({
            hasLiveblocksData: true,
            liveblocksUpdatedAt: 200,
            hasBoardData: true,
            boardUpdatedAt: 100,
        })).toBe('liveblocks');

        expect(chooseCanvasDataSource({
            hasLiveblocksData: true,
            liveblocksUpdatedAt: 100,
            hasBoardData: true,
            boardUpdatedAt: 200,
        })).toBe('board');
    });

    it('keeps the current canvas when both sources have the same version', () => {
        expect(chooseCanvasDataSource({
            hasLiveblocksData: true,
            liveblocksUpdatedAt: 200,
            hasBoardData: true,
            boardUpdatedAt: 200,
        })).toBe('board');
    });

    it('prefers an oversized legacy database canvas over unversioned Liveblocks data', () => {
        expect(chooseCanvasDataSource({
            hasLiveblocksData: true,
            liveblocksUpdatedAt: 0,
            hasBoardData: true,
            boardUpdatedAt: 0,
            boardExceedsSyncLimit: true,
        })).toBe('board');
    });

    it('allows versioned Liveblocks data to supersede an oversized legacy board', () => {
        expect(chooseCanvasDataSource({
            hasLiveblocksData: true,
            liveblocksUpdatedAt: 200,
            hasBoardData: true,
            boardUpdatedAt: 0,
            boardExceedsSyncLimit: true,
        })).toBe('liveblocks');
    });

    it('sorts boards with favorites first and recent boards ahead of stale ones', () => {
        const boards: Board[] = [
            {
                id: 'alpha',
                name: 'Alpha',
                ownerId: 'owner-1',
                createdAt: '2026-03-20T10:00:00.000Z',
                updatedAt: '2026-03-20T10:00:00.000Z',
            },
            {
                id: 'beta',
                name: 'Beta',
                ownerId: 'owner-1',
                createdAt: '2026-03-21T10:00:00.000Z',
                updatedAt: '2026-03-21T10:00:00.000Z',
            },
            {
                id: 'gamma',
                name: 'Gamma',
                ownerId: 'owner-1',
                createdAt: '2026-03-22T10:00:00.000Z',
                updatedAt: '2026-03-22T10:00:00.000Z',
            },
        ];

        const metadata: Record<string, BoardLibraryEntry> = {
            beta: {
                id: 'beta',
                name: 'Beta',
                ownerId: 'owner-1',
                createdAt: '2026-03-21T10:00:00.000Z',
                updatedAt: '2026-03-21T10:00:00.000Z',
                isFavorite: true,
                source: 'owned',
            },
            alpha: {
                id: 'alpha',
                name: 'Alpha',
                ownerId: 'owner-1',
                createdAt: '2026-03-20T10:00:00.000Z',
                updatedAt: '2026-03-20T10:00:00.000Z',
                lastOpenedAt: '2026-03-23T10:00:00.000Z',
                source: 'owned',
            },
        };

        expect(sortBoardsForDisplay(boards, metadata).map((board) => board.id)).toEqual([
            'beta',
            'alpha',
            'gamma',
        ]);
    });

    it('compresses and decompresses snapshot payloads losslessly', () => {
        const raw = JSON.stringify({ objects: [{ type: 'rect', left: 10, top: 12 }] });
        const compressed = compressSnapshotData(raw);

        expect(compressed).not.toBe(raw);
        expect(decompressSnapshotData(compressed)).toBe(raw);
    });
});
