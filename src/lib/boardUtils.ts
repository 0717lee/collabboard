import LZString from 'lz-string';
import type { Board, BoardLibraryEntry, BoardRole } from '@/types';

const SHARED_ROLES = new Set<Extract<BoardRole, 'editor' | 'viewer'>>(['editor', 'viewer']);

export const MAX_BOARD_LIBRARY_ENTRIES = 60;
export const MAX_BOARD_SNAPSHOTS = 12;

const getTimestamp = (value?: string) => {
    if (!value) return 0;
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
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
