import { create } from 'zustand';
import { supabase } from '@/lib/supabaseClient';
import type { Board } from '@/types';

interface BoardState {
    boards: Board[];
    currentBoard: Board | null;
    isLoading: boolean;
    error: string | null;

    createBoard: (name: string, ownerId: string) => Promise<Board | null>;
    updateBoard: (id: string, updates: Partial<Board>) => Promise<void>;
    deleteBoard: (id: string) => Promise<void>;
    setCurrentBoard: (board: Board | null) => void;
    saveCanvasData: (boardId: string, data: string) => Promise<void>;
    loadBoards: (userId: string) => Promise<void>;
}

export const useBoardStore = create<BoardState>()((set, get) => ({
    boards: [],
    currentBoard: null,
    isLoading: false,
    error: null,

    createBoard: async (name: string, ownerId: string) => {
        set({ isLoading: true, error: null });

        try {
            const newBoard = {
                name,
                owner_id: ownerId,
                data: { objects: [], version: '1.0' },
            };

            const { data, error } = await supabase
                .from('boards')
                .insert(newBoard)
                .select()
                .single();

            if (error) {
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
        } catch (err) {
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
            const { error } = await supabase
                .from('boards')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('Delete board error:', error);
                return;
            }

            set((state) => ({
                boards: state.boards.filter((board) => board.id !== id),
                currentBoard: state.currentBoard?.id === id ? null : state.currentBoard,
            }));
        } catch (err) {
            console.error('Delete board failed:', err);
        }
    },

    setCurrentBoard: (board: Board | null) => {
        set({ currentBoard: board });
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
        } catch (err) {
            set({ isLoading: false, error: '加载白板失败' });
        }
    },
}));
