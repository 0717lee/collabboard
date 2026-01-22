import { describe, it, expect, beforeEach } from 'vitest';
import { useBoardStore } from '@/stores/boardStore';

describe('boardStore', () => {
    const mockUserId = 'test-user-id-123';

    beforeEach(() => {
        // Reset store state before each test
        useBoardStore.setState({
            boards: [],
            currentBoard: null,
            isLoading: false,
            error: null,
        });
    });

    describe('createBoard', () => {
        it('should create a new board', () => {
            const store = useBoardStore.getState();

            const newBoard = store.createBoard('Test Board', mockUserId);

            expect(newBoard).toBeDefined();
            expect(newBoard.name).toBe('Test Board');
            expect(newBoard.ownerId).toBe(mockUserId);
            expect(newBoard.id).toBeDefined();
            expect(newBoard.createdAt).toBeDefined();
            expect(newBoard.data).toBe(JSON.stringify({ objects: [], version: '1.0' }));

            const state = useBoardStore.getState();
            expect(state.boards).toHaveLength(1);
            expect(state.currentBoard?.id).toBe(newBoard.id);
        });

        it('should add multiple boards', () => {
            const store = useBoardStore.getState();

            store.createBoard('Board 1', mockUserId);
            store.createBoard('Board 2', mockUserId);
            store.createBoard('Board 3', mockUserId);

            const state = useBoardStore.getState();
            expect(state.boards).toHaveLength(3);
        });
    });

    describe('updateBoard', () => {
        it('should update board name', () => {
            const store = useBoardStore.getState();
            const board = store.createBoard('Original Name', mockUserId);

            useBoardStore.getState().updateBoard(board.id, { name: 'Updated Name' });

            const state = useBoardStore.getState();
            const updatedBoard = state.boards.find((b) => b.id === board.id);
            expect(updatedBoard?.name).toBe('Updated Name');
        });

        it('should update current board if it matches', () => {
            const store = useBoardStore.getState();
            const board = store.createBoard('Board', mockUserId);

            useBoardStore.getState().updateBoard(board.id, { name: 'New Name' });

            const state = useBoardStore.getState();
            expect(state.currentBoard?.name).toBe('New Name');
        });
    });

    describe('deleteBoard', () => {
        it('should delete a board', () => {
            const store = useBoardStore.getState();
            const board1 = store.createBoard('Board 1', mockUserId);
            useBoardStore.getState().createBoard('Board 2', mockUserId);

            useBoardStore.getState().deleteBoard(board1.id);

            const state = useBoardStore.getState();
            expect(state.boards).toHaveLength(1);
            expect(state.boards.find((b) => b.id === board1.id)).toBeUndefined();
        });

        it('should clear current board if deleted', () => {
            const store = useBoardStore.getState();
            const board = store.createBoard('Board', mockUserId);

            expect(useBoardStore.getState().currentBoard?.id).toBe(board.id);

            useBoardStore.getState().deleteBoard(board.id);

            expect(useBoardStore.getState().currentBoard).toBeNull();
        });
    });

    describe('setCurrentBoard', () => {
        it('should set current board', () => {
            const store = useBoardStore.getState();
            const board = store.createBoard('Board', mockUserId);

            useBoardStore.getState().setCurrentBoard(null);
            expect(useBoardStore.getState().currentBoard).toBeNull();

            useBoardStore.getState().setCurrentBoard(board);
            expect(useBoardStore.getState().currentBoard?.id).toBe(board.id);
        });
    });

    describe('saveCanvasData', () => {
        it('should save canvas data to board', () => {
            const store = useBoardStore.getState();
            const board = store.createBoard('Board', mockUserId);

            const canvasData = JSON.stringify({ objects: [{ type: 'rect' }], version: '1.0' });
            useBoardStore.getState().saveCanvasData(board.id, canvasData);

            const state = useBoardStore.getState();
            const updatedBoard = state.boards.find((b) => b.id === board.id);
            expect(updatedBoard?.data).toBe(canvasData);
        });
    });
});
