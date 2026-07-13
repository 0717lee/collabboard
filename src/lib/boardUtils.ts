import LZString from 'lz-string';
import type { Board, BoardLibraryEntry, BoardRole } from '@/types';

const SHARED_ROLES = new Set<Extract<BoardRole, 'editor' | 'viewer'>>(['editor', 'viewer']);
const CANVAS_DATA_UPDATED_AT_KEY = '__collabboardUpdatedAt';

export type CanvasDataSource = 'liveblocks' | 'board' | 'empty';

export const MAX_BOARD_LIBRARY_ENTRIES = 60;
export const MAX_BOARD_SNAPSHOTS = 12;

const getTimestamp = (value?: string) => {
    if (!value) return 0;
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
};

export const getCanvasDataUpdatedAt = (data?: string | null) => {
    if (!data) return 0;

    try {
        const parsed = JSON.parse(data) as Record<string, unknown>;
        const timestamp = parsed?.[CANVAS_DATA_UPDATED_AT_KEY];
        return typeof timestamp === 'number' && Number.isFinite(timestamp) && timestamp > 0
            ? timestamp
            : 0;
    } catch {
        return 0;
    }
};

export const stampCanvasData = (data: string, timestamp = Date.now()) => {
    const parsed = JSON.parse(data) as Record<string, unknown>;

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Canvas data must be a JSON object');
    }

    const previousTimestamp = parsed[CANVAS_DATA_UPDATED_AT_KEY];
    const nextTimestamp = Math.max(
        Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now(),
        typeof previousTimestamp === 'number' && Number.isFinite(previousTimestamp)
            ? previousTimestamp + 1
            : 0
    );

    return JSON.stringify({
        ...parsed,
        [CANVAS_DATA_UPDATED_AT_KEY]: nextTimestamp,
    });
};

export const chooseCanvasDataSource = ({
    hasLiveblocksData,
    liveblocksUpdatedAt,
    hasBoardData,
    boardUpdatedAt,
    boardExceedsSyncLimit = false,
}: {
    hasLiveblocksData: boolean;
    liveblocksUpdatedAt: number;
    hasBoardData: boolean;
    boardUpdatedAt: number;
    boardExceedsSyncLimit?: boolean;
}): CanvasDataSource => {
    if (!hasLiveblocksData) return hasBoardData ? 'board' : 'empty';
    if (!hasBoardData) return 'liveblocks';
    if (boardExceedsSyncLimit && boardUpdatedAt === 0 && liveblocksUpdatedAt === 0) {
        return 'board';
    }
    if (liveblocksUpdatedAt > 0 || boardUpdatedAt > 0) {
        return liveblocksUpdatedAt > boardUpdatedAt ? 'liveblocks' : 'board';
    }
    return 'liveblocks';
};

export const buildBoardShareLink = (
    origin: string,
    boardId: string,
    role: Extract<BoardRole, 'editor' | 'viewer'>
) => {
    const url = new URL(`/board/${boardId}`, origin);
    url.searchParams.set('role', role);
    return url.toString();
};

export const extractBoardRoleFromUrl = (search: string): Extract<BoardRole, 'editor' | 'viewer'> | null => {
    const normalized = search.startsWith('?') ? search.slice(1) : search;
    const role = new URLSearchParams(normalized).get('role');

    if (role && SHARED_ROLES.has(role as Extract<BoardRole, 'editor' | 'viewer'>)) {
        return role as Extract<BoardRole, 'editor' | 'viewer'>;
    }

    return null;
};

export const sortBoardsForDisplay = (
    boards: Board[],
    metadata: Record<string, BoardLibraryEntry>
) => [...boards].sort((left, right) => {
    const leftMeta = metadata[left.id];
    const rightMeta = metadata[right.id];

    const leftFavorite = leftMeta?.isFavorite ? 1 : 0;
    const rightFavorite = rightMeta?.isFavorite ? 1 : 0;

    if (leftFavorite !== rightFavorite) {
        return rightFavorite - leftFavorite;
    }

    const leftLastOpened = getTimestamp(leftMeta?.lastOpenedAt);
    const rightLastOpened = getTimestamp(rightMeta?.lastOpenedAt);

    if (leftLastOpened !== rightLastOpened) {
        return rightLastOpened - leftLastOpened;
    }

    const leftUpdated = getTimestamp(left.updatedAt);
    const rightUpdated = getTimestamp(right.updatedAt);

    if (leftUpdated !== rightUpdated) {
        return rightUpdated - leftUpdated;
    }

    return left.name.localeCompare(right.name);
});

export const compressSnapshotData = (data: string) => LZString.compressToBase64(data);

export const decompressSnapshotData = (data: string) => {
    if (!data) return null;
    const decompressed = LZString.decompressFromBase64(data);
    if (!decompressed) return null;
    return decompressed;
};
