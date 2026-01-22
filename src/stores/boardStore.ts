import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Board } from '@/types';

interface BoardState {
    boards: Board[];
    currentBoard: Board | null;
    isLoading: boolean;
    error: string | null;

    createBoard: (name: string, ownerId: string) => Board;
    updateBoard: (id: string, updates: Partial<Board>) => void;
    deleteBoard: (id: string) => void;
    setCurrentBoard: (board: Board | null) => void;
    saveCanvasData: (boardId: string, data: string) => void;
    loadBoards: (userId: string) => void;
}

export const useBoardStore = create<BoardState>()(
    persist(
        (set, get) => ({
            boards: [],
            currentBoard: null,
            isLoading: false,
            error: null,

            createBoard: (name: string, ownerId: string) => {
                const newBoard: Board = {
                    id: crypto.randomUUID(),
                    name,
                    ownerId,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    data: JSON.stringify({ objects: [], version: '1.0' }),
                };

                set((state) => ({
                    boards: [...state.boards, newBoard],
                    currentBoard: newBoard,
                }));

                return newBoard;
            },

            updateBoard: (id: string, updates: Partial<Board>) => {
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
            },

            deleteBoard: (id: string) => {
                set((state) => ({
                    boards: state.boards.filter((board) => board.id !== id),
                    currentBoard: state.currentBoard?.id === id ? null : state.currentBoard,
                }));
            },

            setCurrentBoard: (board: Board | null) => {
                set({ currentBoard: board });
            },

            saveCanvasData: (boardId: string, data: string) => {
                const { updateBoard } = get();
                updateBoard(boardId, { data });
            },

            loadBoards: (userId: string) => {
                set((state) => ({
                    boards: state.boards.filter((board) => board.ownerId === userId),
                }));
            },
        }),
        {
            name: 'board-storage',
        }
    )
);
