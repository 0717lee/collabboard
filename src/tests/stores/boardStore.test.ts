import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useBoardStore } from '@/stores/boardStore';
import { useAuthStore } from '@/stores/authStore';

const boardMocks = vi.hoisted(() => ({
    insertSingle: vi.fn(),
    orderBoards: vi.fn(),
    // updateSpy 捕获 update(dbUpdates, opts) 的参数；updateResult 是 .maybeSingle() 的返回值
    updateSpy: vi.fn(() => ({
        eq: () => ({
            select: () => ({
                maybeSingle: boardMocks.updateResult,
            }),
        }),
    })),
    updateResult: vi.fn(),
    deleteEq: vi.fn(),
    getUser: vi.fn(),
}));

// Mock Supabase client
vi.mock('@/lib/supabaseClient', () => ({
    supabase: {
        from: () => ({
            insert: () => ({
                select: () => ({
                    single: boardMocks.insertSingle,
                }),
            }),
            select: () => ({
                eq: () => ({
                    order: boardMocks.orderBoards,
                }),
            }),
            update: boardMocks.updateSpy,
            delete: () => ({
                eq: boardMocks.deleteEq,
            }),
        }),
        auth: {
            getUser: boardMocks.getUser,
            onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
        },
    },
}));

describe('boardStore', () => {
    const mockUserId = 'test-user-id-123';

    beforeEach(() => {
        boardMocks.insertSingle.mockResolvedValue({
            data: {
                id: 'mock-board-id',
                name: 'Test Board',
                owner_id: 'test-user-id-123',
                data: { objects: [], version: '1.0' },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            },
            error: null,
        });
        boardMocks.orderBoards.mockResolvedValue({
            data: [],
            error: null,
        });
        boardMocks.updateResult.mockResolvedValue({ data: { id: 'mock-board-id' }, error: null });
        boardMocks.deleteEq.mockResolvedValue({ error: null });
        boardMocks.getUser.mockResolvedValue({
            data: {
                user: {
                    id: 'test-user-id-123',
                    email: 'test@example.com',
                    created_at: new Date().toISOString(),
                },
            },
            error: null,
        });

        // Set a valid mock user in authStore so board creation doesn't fail
        useAuthStore.setState({
            user: {
                id: 'test-user-id-123',
                email: 'test@example.com',
                name: 'Test User',
                createdAt: new Date().toISOString(),
            },
            isAuthenticated: true,
            hasInitialized: true,
            hasValidatedSession: true,
        });

        // Reset store state before each test
        useBoardStore.setState({
            boards: [],
            sharedBoards: [],
            currentBoard: null,
            isLoading: false,
            error: null,
        });
    });

    describe('createBoard', () => {
        it('should create a new board', async () => {
            const store = useBoardStore.getState();

            const newBoard = await store.createBoard('Test Board');

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

        it('should return true when load succeeds with empty list', async () => {
            // 用户确实没有白板时也应返回 true，以便上层据此 reconcile 清理 stale 缓存
            boardMocks.orderBoards.mockResolvedValueOnce({ data: [], error: null });

            const result = await useBoardStore.getState().loadBoards(mockUserId);

            expect(result).toBe(true);
            expect(useBoardStore.getState().boards).toHaveLength(0);
        });

        it('should return false when load fails with error', async () => {
            boardMocks.orderBoards.mockResolvedValueOnce({
                data: null,
                error: { message: 'permission denied' },
            });

            const result = await useBoardStore.getState().loadBoards(mockUserId);

            expect(result).toBe(false);
        });

        it('should ignore stale load results when a newer request finishes first', async () => {
            const now = new Date().toISOString();
            let resolveFirstLoad: ((value: {
                data: Array<{
                    id: string;
                    name: string;
                    owner_id: string;
                    created_at: string;
                    updated_at: string;
                }>;
                error: null;
            }) => void) | undefined;

            boardMocks.orderBoards
                .mockImplementationOnce(() => new Promise((resolve) => {
                    resolveFirstLoad = resolve;
                }))
                .mockResolvedValueOnce({
                    data: [
                        {
                            id: 'latest-board-id',
                            name: 'Recovered Board',
                            owner_id: mockUserId,
                            created_at: now,
                            updated_at: now,
                        },
                    ],
                    error: null,
                });

            const store = useBoardStore.getState();
            const firstLoad = store.loadBoards(mockUserId);
            const secondLoad = store.loadBoards(mockUserId);

            await secondLoad;
            expect(useBoardStore.getState().boards).toHaveLength(1);
            expect(useBoardStore.getState().boards[0]?.name).toBe('Recovered Board');

            resolveFirstLoad?.({
                data: [],
                error: null,
            });
            await firstLoad;

            const state = useBoardStore.getState();
            expect(state.boards).toHaveLength(1);
            expect(state.boards[0]?.name).toBe('Recovered Board');
            expect(state.isLoading).toBe(false);
        });
    });

    describe('updateBoard', () => {
        it('should return true when update succeeds', async () => {
            const result = await useBoardStore.getState().updateBoard('board-1', { name: 'New Name' });

            expect(result).toBe(true);
        });

        it('should return false when update fails with database error', async () => {
            boardMocks.updateResult.mockResolvedValueOnce({
                data: null,
                error: { message: 'permission denied' },
            });

            const result = await useBoardStore.getState().updateBoard('board-1', { name: 'New Name' });

            expect(result).toBe(false);
        });

        it('should persist publicRole to public_role column', async () => {
            const result = await useBoardStore.getState().updateBoard('board-1', { publicRole: 'viewer' });

            expect(result).toBe(true);
            expect(boardMocks.updateSpy).toHaveBeenCalledWith(
                expect.objectContaining({ public_role: 'viewer' }),
                expect.anything(),
            );
        });

        it('should allow clearing publicRole by passing null', async () => {
            const result = await useBoardStore.getState().updateBoard('board-1', { publicRole: null });

            expect(result).toBe(true);
            expect(boardMocks.updateSpy).toHaveBeenCalledWith(
                expect.objectContaining({ public_role: null }),
                expect.anything(),
            );
        });
    });

    describe('saveCanvasData', () => {
        it('should propagate updateBoard success result', async () => {
            const result = await useBoardStore.getState().saveCanvasData('board-1', '{}');

            expect(result).toBe(true);
        });

        it('should propagate updateBoard failure result', async () => {
            boardMocks.updateResult.mockResolvedValueOnce({
                data: null,
                error: { message: 'permission denied' },
            });

            const result = await useBoardStore.getState().saveCanvasData('board-1', '{}');

            expect(result).toBe(false);
        });
    });
});
