import { create } from 'zustand';
import { supabase } from '@/lib/supabaseClient';
import { useBoardLibraryStore } from '@/stores/boardLibraryStore';
import type { Board } from '@/types';

interface BoardState {
    boards: Board[];
    sharedBoards: Board[];
    currentBoard: Board | null;
    isLoading: boolean;
    error: string | null;

    createBoard: (name: string) => Promise<Board | null>;
    updateBoard: (id: string, updates: Partial<Board>) => Promise<void>;
    deleteBoard: (id: string) => Promise<{ success: boolean; error?: string }>;
    setCurrentBoard: (board: Board | null) => void;
    fetchBoard: (boardId: string) => Promise<Board | null>;
    saveCanvasData: (boardId: string, data: string) => Promise<void>;
    loadBoards: (userId: string) => Promise<void>;
}

let latestLoadBoardsRequestId = 0;
const DB_TIMEOUT_MS = 10000; // 10 seconds timeout for DB operations

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> => {
    return Promise.race([
        promise,
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
        ),
    ]);
};


export const useBoardStore = create<BoardState>()((set, get) => ({
    boards: [],
    sharedBoards: [],
    currentBoard: null,
    isLoading: false,
    error: null,
    createBoard: async (name: string) => {
        set({ isLoading: true, error: null });

        try {
            console.log('[boardStore] Creating board:', name);
            const user = (await import('./authStore')).useAuthStore.getState().user;

            if (!user) {
                console.error('[boardStore] No user found in store');
                set({ isLoading: false, error: '未登录或登录已过期，请重新登录' });
                return null;
            }

            const newBoard = {
                name,
                owner_id: user.id, // Use Supabase auth user ID
                data: { objects: [], version: '1.0' },
            };

            const insertResult = await withTimeout(
                supabase
                    .from('boards')
                    .insert(newBoard)
                    .select()
                    .single(),
                DB_TIMEOUT_MS,
                '创建数据超时'
            );
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data, error } = insertResult as any;

            if (error) {
                console.error('[boardStore] Create board error:', error);
                set({ isLoading: false, error: error.message });
                return null;
            }


            const board: Board = {
                id: data.id,
                name: data.name,
                ownerId: data.owner_id,
                createdAt: data.created_at,
                updatedAt: data.updated_at,
                data: JSON.stringify(data.data),
                accessRole: 'owner',
                source: 'owned',
            };

            set((state) => ({
                boards: [...state.boards, board],
                currentBoard: board,
                isLoading: false,
            }));

            return board;
        } catch {
            set({ isLoading: false, error: '创建白板失败' });
            return null;
        }
    },

    updateBoard: async (id: string, updates: Partial<Board>) => {
        try {
            const dbUpdates: Record<string, unknown> = {
                updated_at: new Date().toISOString(),
            };

            if (updates.name !== undefined) dbUpdates.name = updates.name;
            if (updates.data !== undefined) dbUpdates.data = updates.data ? JSON.parse(updates.data) : null;

            const { error } = await supabase
                .from('boards')
                .update(dbUpdates)
                .eq('id', id);

            if (error) {
                console.error('Update board error:', error);
                return;
            }

            set((state) => ({
                boards: state.boards.map((board) =>
                    board.id === id
                        ? { ...board, ...updates, updatedAt: new Date().toISOString() }
                        : board
                ),
                sharedBoards: state.sharedBoards.map((board) =>
                    board.id === id
                        ? { ...board, ...updates, updatedAt: new Date().toISOString() }
                        : board
                ),
                currentBoard:
                    state.currentBoard?.id === id
                        ? { ...state.currentBoard, ...updates, updatedAt: new Date().toISOString() }
                        : state.currentBoard,
            }));
        } catch (err) {
            console.error('Update board failed:', err);
        }
    },

    deleteBoard: async (id: string) => {
        try {
            // Use count: 'exact' to check how many rows were deleted
            // This avoids RLS issues with 'select()' if you can delete but not read
            const { error } = await supabase
                .from('boards')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('Delete board error:', error);
                const msg = '删除出错: ' + error.message;
                set({ isLoading: false, error: msg });
                return { success: false, error: msg };
            }

            // Removed strict count checking. If error is null, consider it a successful delete.

            set((state) => ({
                boards: state.boards.filter((board) => board.id !== id),
                sharedBoards: state.sharedBoards.filter((board) => board.id !== id),
                currentBoard: state.currentBoard?.id === id ? null : state.currentBoard,
            }));
            useBoardLibraryStore.getState().removeBoard(id);
            return { success: true };
        } catch (err) {
            console.error('Delete board failed:', err);
            const msg = '删除失败，发生意外错误';
            set({ isLoading: false, error: msg });
            return { success: false, error: msg };
        }
    },

    setCurrentBoard: (board: Board | null) => {
        set({ currentBoard: board });
    },

    fetchBoard: async (boardId: string) => {
        set({ isLoading: true, error: null });
        try {
            const { data, error } = await supabase
                .from('boards')
                .select('*')
                .eq('id', boardId)
                .single();

            if (error) {
                console.error('Fetch board error:', error);
                set({ isLoading: false, error: '无法加载白板，可能已被删除或无权访问' });
                return null;
            }

            const board: Board = {
                id: data.id,
                name: data.name,
                ownerId: data.owner_id,
                createdAt: data.created_at,
                updatedAt: data.updated_at,
                data: JSON.stringify(data.data),
                source: 'owned',
            };

            const cachedEntry = useBoardLibraryStore.getState().entries[boardId];
            board.accessRole = cachedEntry?.role || 'owner';
            board.source = cachedEntry?.role ? 'shared' : 'owned';

            set({ currentBoard: board, isLoading: false });
            return board;
        } catch (err) {
            console.error('Fetch board failed:', err);
            set({ isLoading: false, error: '加载白板失败' });
            return null;
        }
    },

    saveCanvasData: async (boardId: string, data: string) => {
        const { updateBoard } = get();
        await updateBoard(boardId, { data });
    },

    loadBoards: async (userId: string) => {
        const requestId = ++latestLoadBoardsRequestId;
        set({ isLoading: true, error: null });
        console.log('[boardStore] Loading boards for user:', userId);

        try {
            const fetchResult = await withTimeout(
                supabase
                    .from('boards')
                    .select('id, name, owner_id, created_at, updated_at')
                    .eq('owner_id', userId)
                    .order('updated_at', { ascending: false }),
                DB_TIMEOUT_MS,
                '获取白板列表超时'
            );
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data, error } = fetchResult as any;


            if (requestId !== latestLoadBoardsRequestId) {
                return;
            }

            if (error) {
                set({ isLoading: false, error: error.message });
                return;
            }

            const boards: Board[] = (data || []).map((item: {
                id: string;
                name: string;
                owner_id: string;
                created_at: string;
                updated_at: string;
            }) => ({
                id: item.id,
                name: item.name,
                ownerId: item.owner_id,
                createdAt: item.created_at,
                updatedAt: item.updated_at,
                accessRole: 'owner',
                source: 'owned',
            }));

            const sharedBoards: Board[] = Object.values(useBoardLibraryStore.getState().entries)
                .filter((entry) => entry.source === 'shared' && entry.ownerId !== userId)
                .map((entry) => ({
                    id: entry.id,
                    name: entry.name,
                    ownerId: entry.ownerId,
                    createdAt: entry.createdAt,
                    updatedAt: entry.updatedAt,
                    thumbnail: entry.thumbnail,
                    accessRole: entry.role,
                    source: 'shared',
                }));

            set({ boards, sharedBoards, isLoading: false });
        } catch {
            if (requestId !== latestLoadBoardsRequestId) {
                return;
            }

            set({ isLoading: false, error: '加载白板失败' });
        }
    },
}));
