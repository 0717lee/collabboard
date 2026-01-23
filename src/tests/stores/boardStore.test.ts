import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useBoardStore } from '@/stores/boardStore';

// Mock Supabase client
vi.mock('@/lib/supabaseClient', () => ({
    supabase: {
        from: () => ({
            insert: () => ({
                select: () => ({
                    single: () => Promise.resolve({
                        data: {
                            id: 'mock-board-id',
                            name: 'Test Board',
                            owner_id: 'test-user-id-123',
                            data: { objects: [], version: '1.0' },
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                        },
                        error: null,
                    }),
                }),
            }),
            select: () => ({
                eq: () => ({
                    order: () => Promise.resolve({
                        data: [],
                        error: null,
                    }),
                }),
            }),
            update: () => ({
                eq: () => Promise.resolve({ error: null }),
            }),
            delete: () => ({
                eq: () => Promise.resolve({ error: null }),
            }),
        }),
        auth: {
            getUser: () => Promise.resolve({
                data: {
                    user: {
                        id: 'test-user-id-123',
                        email: 'test@example.com',
                        created_at: new Date().toISOString(),
                    },
                },
                error: null,
            }),
        },
    },
}));

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
        it('should create a new board', async () => {
            const store = useBoardStore.getState();

            const newBoard = await store.createBoard('Test Board', mockUserId);

            expect(newBoard).toBeDefined();
            expect(newBoard?.name).toBe('Test Board');
            expect(newBoard?.id).toBeDefined();
        });
    });

    describe('setCurrentBoard', () => {
        it('should set current board', () => {
            const mockBoard = {
                id: 'test-id',
                name: 'Test',
                ownerId: mockUserId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                data: '{}',
            };

            useBoardStore.getState().setCurrentBoard(mockBoard);
            expect(useBoardStore.getState().currentBoard?.id).toBe('test-id');

            useBoardStore.getState().setCurrentBoard(null);
            expect(useBoardStore.getState().currentBoard).toBeNull();
        });
    });

    describe('loadBoards', () => {
        it('should load boards for user', async () => {
            const store = useBoardStore.getState();
            await store.loadBoards(mockUserId);

            const state = useBoardStore.getState();
            expect(state.isLoading).toBe(false);
            expect(Array.isArray(state.boards)).toBe(true);
        });
    });
});
