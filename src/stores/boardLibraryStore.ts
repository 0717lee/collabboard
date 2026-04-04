import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MAX_BOARD_LIBRARY_ENTRIES } from '@/lib/boardUtils';
import type { Board, BoardLibraryEntry, BoardRole, BoardSource } from '@/types';

interface BoardLibraryState {
    entries: Record<string, BoardLibraryEntry>;
    syncBoards: (boards: Board[], source: BoardSource) => void;
    reconcileBoards: (boards: Board[], source: BoardSource) => void;
    touchBoard: (board: Board, role?: BoardRole) => void;
    setThumbnail: (boardId: string, thumbnail?: string) => void;
    toggleFavorite: (boardId: string) => void;
    setRole: (boardId: string, role: Extract<BoardRole, 'editor' | 'viewer'>) => void;
    removeBoard: (boardId: string) => void;
}

const limitEntries = (entries: Record<string, BoardLibraryEntry>) => {
    const records = Object.entries(entries);

    if (records.length <= MAX_BOARD_LIBRARY_ENTRIES) {
        return entries;
    }

    const nextEntries = { ...entries };
    const removable = records
        .sort(([, left], [, right]) => {
            const leftPinned = left.isFavorite ? 1 : 0;
            const rightPinned = right.isFavorite ? 1 : 0;

            if (leftPinned !== rightPinned) {
                return leftPinned - rightPinned;
            }

            return new Date(left.lastOpenedAt || left.updatedAt || 0).getTime()
                - new Date(right.lastOpenedAt || right.updatedAt || 0).getTime();
        })
        .slice(0, records.length - MAX_BOARD_LIBRARY_ENTRIES);

    removable.forEach(([boardId]) => {
        delete nextEntries[boardId];
    });

    return nextEntries;
};

const mergeBoardEntry = (
    current: BoardLibraryEntry | undefined,
    board: Board,
    source: BoardSource
): BoardLibraryEntry => ({
    id: board.id,
    name: board.name,
    ownerId: board.ownerId,
    updatedAt: board.updatedAt,
    createdAt: board.createdAt,
    thumbnail: board.thumbnail ?? current?.thumbnail,
    lastOpenedAt: current?.lastOpenedAt,
    isFavorite: current?.isFavorite ?? false,
    role: board.accessRole === 'owner'
        ? undefined
        : (board.accessRole as Extract<BoardRole, 'editor' | 'viewer'> | undefined) ?? current?.role,
    source,
});

const normalizeEntry = (entry: Partial<BoardLibraryEntry>): BoardLibraryEntry => {
    const normalizedSource: BoardSource = entry.source
        || (entry.role ? 'shared' : 'owned');

    return {
        id: entry.id || '',
        name: entry.name || 'Untitled Board',
        ownerId: entry.ownerId || '',
        createdAt: entry.createdAt || entry.updatedAt || new Date(0).toISOString(),
        updatedAt: entry.updatedAt || entry.createdAt || new Date(0).toISOString(),
        thumbnail: entry.thumbnail,
        lastOpenedAt: entry.lastOpenedAt,
        isFavorite: entry.isFavorite ?? false,
        role: entry.role,
        source: normalizedSource,
    };
};

const normalizeEntries = (entries: Record<string, Partial<BoardLibraryEntry>> | undefined) =>
    Object.entries(entries || {}).reduce<Record<string, BoardLibraryEntry>>((result, [boardId, entry]) => {
        result[boardId] = normalizeEntry({ ...entry, id: entry?.id || boardId });
        return result;
    }, {});

export const useBoardLibraryStore = create<BoardLibraryState>()(
    persist(
        (set) => ({
            entries: {},

            syncBoards: (boards, source) => {
                set((state) => {
                    const nextEntries = { ...state.entries };

                    boards.forEach((board) => {
                        nextEntries[board.id] = mergeBoardEntry(nextEntries[board.id], board, source);
                    });

                    return { entries: limitEntries(nextEntries) };
                });
            },

            reconcileBoards: (boards, source) => {
                set((state) => {
                    const nextEntries = Object.fromEntries(
                        Object.entries(state.entries).filter(([, entry]) => entry.source !== source)
                    );

                    boards.forEach((board) => {
                        nextEntries[board.id] = mergeBoardEntry(state.entries[board.id], board, source);
                    });

                    return { entries: limitEntries(nextEntries) };
                });
            },

            touchBoard: (board, role) => {
                set((state) => {
                    const current = state.entries[board.id];
                    const source = role && role !== 'owner' ? 'shared' : 'owned';
                    const nextEntries = {
                        ...state.entries,
                        [board.id]: {
                            ...mergeBoardEntry(current, board, source),
                            lastOpenedAt: new Date().toISOString(),
                            role: role && role !== 'owner'
                                ? role
                                : current?.role,
                        },
                    };

                    return { entries: limitEntries(nextEntries) };
                });
            },

            setThumbnail: (boardId, thumbnail) => {
                set((state) => {
                    const current = state.entries[boardId];
                    if (!current) return state;

                    return {
                        entries: {
                            ...state.entries,
                            [boardId]: {
                                ...current,
                                thumbnail,
                            },
                        },
                    };
                });
            },

            toggleFavorite: (boardId) => {
                set((state) => {
                    const current = state.entries[boardId];
                    if (!current) return state;

                    return {
                        entries: {
                            ...state.entries,
                            [boardId]: {
                                ...current,
                                isFavorite: !current.isFavorite,
                            },
                        },
                    };
                });
            },

            setRole: (boardId, role) => {
                set((state) => {
                    const current = state.entries[boardId];
                    if (!current) return state;

                    return {
                        entries: {
                            ...state.entries,
                            [boardId]: {
                                ...current,
                                role,
                                source: 'shared',
                            },
                        },
                    };
                });
            },

            removeBoard: (boardId) => {
                set((state) => {
                    const nextEntries = { ...state.entries };
                    delete nextEntries[boardId];
                    return { entries: nextEntries };
                });
            },
        }),
        {
            name: 'board-library-storage',
            version: 2,
            partialize: (state) => ({
                entries: state.entries,
            }),
            migrate: (persistedState) => {
                const state = persistedState as { entries?: Record<string, Partial<BoardLibraryEntry>> } | undefined;
                return {
                    entries: normalizeEntries(state?.entries),
                };
            },
        }
    )
);
