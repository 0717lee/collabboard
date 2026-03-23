import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MAX_BOARD_LIBRARY_ENTRIES } from '@/lib/boardUtils';
import type { Board, BoardLibraryEntry, BoardRole, BoardSource } from '@/types';

interface BoardLibraryState {
    entries: Record<string, BoardLibraryEntry>;
    syncBoards: (boards: Board[], source: BoardSource) => void;
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
            version: 1,
            partialize: (state) => ({
                entries: state.entries,
            }),
        }
    )
);
