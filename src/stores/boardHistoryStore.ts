import { v4 as uuidv4 } from 'uuid';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { compressSnapshotData, MAX_BOARD_SNAPSHOTS } from '@/lib/boardUtils';
import type { BoardSnapshot } from '@/types';

interface CreateSnapshotInput {
    boardId: string;
    name: string;
    data: string;
    source: 'manual' | 'auto';
    thumbnail?: string;
    createdAt?: string;
    id?: string;
}

interface BoardHistoryState {
    snapshots: Record<string, BoardSnapshot[]>;
    createSnapshot: (snapshot: CreateSnapshotInput) => BoardSnapshot;
    getSnapshots: (boardId: string) => BoardSnapshot[];
    setSnapshots: (boardId: string, snapshots: BoardSnapshot[]) => void;
    removeSnapshot: (boardId: string, snapshotId: string) => void;
}

export const useBoardHistoryStore = create<BoardHistoryState>()(
    persist(
        (set, get) => ({
            snapshots: {},

            createSnapshot: ({ boardId, name, data, source, thumbnail, createdAt, id }) => {
                const compressedData = compressSnapshotData(data);
                const currentSnapshots = get().snapshots[boardId] || [];
                const latestSnapshot = currentSnapshots[0];

                if (latestSnapshot?.compressedData === compressedData) {
                    return latestSnapshot;
                }

                const snapshot: BoardSnapshot = {
                    id: id || uuidv4(),
                    boardId,
                    name,
                    compressedData,
                    source,
                    thumbnail,
                    createdAt: createdAt || new Date().toISOString(),
                    storage: 'local',
                };

                set((state) => ({
                    snapshots: {
                        ...state.snapshots,
                        [boardId]: [snapshot, ...(state.snapshots[boardId] || [])].slice(0, MAX_BOARD_SNAPSHOTS),
                    },
                }));

                return snapshot;
            },

            getSnapshots: (boardId) => get().snapshots[boardId] || [],

            setSnapshots: (boardId, snapshots) => {
                set((state) => ({
                    snapshots: {
                        ...state.snapshots,
                        [boardId]: snapshots
                            .slice()
                            .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
                            .slice(0, MAX_BOARD_SNAPSHOTS),
                    },
                }));
            },

            removeSnapshot: (boardId, snapshotId) => {
                set((state) => ({
                    snapshots: {
                        ...state.snapshots,
                        [boardId]: (state.snapshots[boardId] || []).filter((snapshot) => snapshot.id !== snapshotId),
                    },
                }));
            },
        }),
        {
            name: 'board-history-storage',
            version: 1,
            partialize: (state) => ({
                snapshots: state.snapshots,
            }),
        }
    )
);
