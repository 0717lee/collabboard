import { create } from 'zustand';
import { supabase } from '@/lib/supabaseClient';
import type { Board } from '@/types';

interface BoardState {
    boards: Board[];
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

export const useBoardStore = create<BoardState>()((set, get) => ({
    boards: [],
    currentBoard: null,
    isLoading: false,
    error: null,

    createBoard: async (name: string) => {
        set({ isLoading: true, error: null });

        try {
            // Get the current authenticated user from Supabase
            const { data: { user }, error: authError } = await supabase.auth.getUser();

            if (authError || !user) {
                console.error('Auth error:', authError);
                // Force logout on auth error
                import('./authStore').then(({ useAuthStore }) => {
                    useAuthStore.getState().logout();
                });
                set({ isLoading: false, error: '未登录或登录已过期，请重新登录' });
                return null;
            }

            const newBoard = {
                name,
                owner_id: user.id, // Use Supabase auth user ID
                data: { objects: [], version: '1.0' },
            };

            const { data, error } = await supabase
                .from('boards')
                .insert(newBoard)
                .select()
                .single();

            if (error) {
                console.error('Create board error:', error);
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

            if (updates.name) dbUpdates.name = updates.name;
            if (updates.data) dbUpdates.data = JSON.parse(updates.data);

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
            const { error, count } = await supabase
                .from('boards')
                .delete({ count: 'exact' })
                .eq('id', id);

            if (error) {
                console.error('Delete board error:', error);
                const msg = '删除出错: ' + error.message;
                set({ isLoading: false, error: msg });
                return { success: false, error: msg };
            }

            // Check count explicitly
            if (count === null || count === 0) {
                console.error('Delete board failed: No rows affected');
                const msg = '删除无效：权限不足或该白板不存在';
                set({ isLoading: false, error: msg });
                return { success: false, error: msg };
            }

            set((state) => ({
                boards: state.boards.filter((board) => board.id !== id),
                currentBoard: state.currentBoard?.id === id ? null : state.currentBoard,
            }));
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

            console.log('fetchBoard result:', { boardId, data, error });

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
            };

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
        set({ isLoading: true, error: null });

        try {
            const { data, error } = await supabase
                .from('boards')
                .select('*')
                .eq('owner_id', userId)
                .order('updated_at', { ascending: false });

            if (error) {
                set({ isLoading: false, error: error.message });
                return;
            }

            const boards: Board[] = (data || []).map((item) => ({
                id: item.id,
                name: item.name,
                ownerId: item.owner_id,
                createdAt: item.created_at,
                updatedAt: item.updated_at,
                data: JSON.stringify(item.data),
            }));

            set({ boards, isLoading: false });
        } catch {
            set({ isLoading: false, error: '加载白板失败' });
        }
    },
}));
