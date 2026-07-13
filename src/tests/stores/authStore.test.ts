import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '@/stores/authStore';
import { useBoardStore } from '@/stores/boardStore';
import { useBoardLibraryStore } from '@/stores/boardLibraryStore';
import { useBoardHistoryStore } from '@/stores/boardHistoryStore';

const authMocks = vi.hoisted(() => ({
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    getUser: vi.fn(),
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(() => ({
        data: {
            subscription: {
                unsubscribe: vi.fn(),
            },
        },
    })),
    profileMaybeSingle: vi.fn(),
    profileInsert: vi.fn(),
}));

// Mock Supabase client
vi.mock('@/lib/supabaseClient', () => ({
    supabase: {
        auth: {
            signInWithPassword: authMocks.signInWithPassword,
            signUp: authMocks.signUp,
            signOut: authMocks.signOut,
            getUser: authMocks.getUser,
            getSession: authMocks.getSession,
            onAuthStateChange: authMocks.onAuthStateChange,
        },
        from: () => ({
            select: () => ({
                eq: () => ({
                    maybeSingle: authMocks.profileMaybeSingle,
                }),
            }),
            insert: authMocks.profileInsert,
        }),
    },
}));

describe('authStore', () => {
    const mockAuthUser = {
        id: 'mock-user-id',
        email: 'test@example.com',
        created_at: new Date().toISOString(),
    };

    beforeEach(() => {
        vi.useRealTimers();
        authMocks.signInWithPassword.mockResolvedValue({
            data: {
                user: mockAuthUser,
                session: { access_token: 'mock-token' },
            },
            error: null,
        });
        authMocks.signUp.mockResolvedValue({
            data: {
                user: mockAuthUser,
                session: { access_token: 'mock-token' },
            },
            error: null,
        });
        authMocks.signOut.mockResolvedValue({ error: null });
        authMocks.getUser.mockResolvedValue({
            data: { user: mockAuthUser },
            error: null,
        });
        authMocks.getSession.mockResolvedValue({
            data: {
                session: {
                    user: {
                        ...mockAuthUser,
                        user_metadata: {
                            name: 'Test User',
                        },
                    },
                    access_token: 'mock-token',
                },
            },
            error: null,
        });
        authMocks.profileMaybeSingle.mockResolvedValue({
            data: { name: 'Test User', email: 'test@example.com' },
            error: null,
        });
        authMocks.profileInsert.mockReturnValue({
            select: () => ({
                single: () => Promise.resolve({
                    data: { name: 'Test User', email: 'test@example.com' },
                    error: null,
                }),
            }),
        });
        authMocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });

        // Reset store state before each test
        useAuthStore.setState({
            user: null,
            isAuthenticated: false,
            hasValidatedSession: false,
            isLoading: false,
            hasInitialized: false,
            error: null,
            notice: null,
        });
        useBoardStore.getState().reset();
        useBoardLibraryStore.getState().clear();
        useBoardHistoryStore.getState().clear();
    });

    describe('register', () => {
        it('should register a new user successfully', async () => {
            const store = useAuthStore.getState();

            const result = await store.register('test@example.com', 'password123', 'Test User');

            expect(result).toBe(true);

            const state = useAuthStore.getState();
            expect(state.isAuthenticated).toBe(true);
            expect(state.user).not.toBeNull();
            expect(state.error).toBeNull();
            expect(state.hasInitialized).toBe(true);
            expect(state.hasValidatedSession).toBe(true);
        });

        it('should not authenticate and should not write profile when session is null (autoconfirm off)', async () => {
            // 开启邮箱确认时，signUp 只返回 user 不返回 session。
            // 此时不应伪造登录态，也不应写 profile（RLS 会拒绝未认证写入）。
            authMocks.signUp.mockResolvedValueOnce({
                data: {
                    user: mockAuthUser,
                    session: null,
                },
                error: null,
            });

            useBoardStore.setState({
                boards: [{
                    id: 'private-board',
                    name: 'Private',
                    ownerId: 'test',
                    createdAt: '',
                    updatedAt: '',
                }],
                sharedBoards: [],
                currentBoard: null,
            });
            useBoardLibraryStore.setState({
                entries: {
                    'private-board': {
                        id: 'private-board',
                        name: 'Private',
                        ownerId: 'test',
                        createdAt: '',
                        updatedAt: '',
                        source: 'owned',
                    },
                },
            });
            useBoardHistoryStore.setState({ snapshots: { 'private-board': [] } });
            authMocks.profileInsert.mockClear();

            const result = await useAuthStore.getState().register('test@example.com', 'password123', 'Test User');

            expect(result).toBe(false);

            const state = useAuthStore.getState();
            expect(state.isAuthenticated).toBe(false);
            expect(state.user).toBeNull();
            expect(state.hasValidatedSession).toBe(false);
            expect(useBoardStore.getState().boards).toEqual([]);
            expect(useBoardLibraryStore.getState().entries).toEqual({});
            expect(useBoardHistoryStore.getState().snapshots).toEqual({});
            expect(state.hasInitialized).toBe(true);
            expect(state.error).toBeNull();
            expect(state.notice).toBeTruthy();
            // 不应尝试写 profile
            expect(authMocks.profileInsert).not.toHaveBeenCalled();
        });
    });

    describe('login', () => {
        it('should login successfully', async () => {
            const store = useAuthStore.getState();

            const result = await store.login('test@example.com', 'password123');

            expect(result).toBe(true);

            const state = useAuthStore.getState();
            expect(state.isAuthenticated).toBe(true);
            expect(state.user).not.toBeNull();
            expect(state.hasInitialized).toBe(true);
            expect(state.hasValidatedSession).toBe(true);
        });
        it('should not restore auth when logout happens during profile loading', async () => {
            let resolveProfile!: (value: {
                data: { name: string };
                error: null;
            }) => void;
            authMocks.profileMaybeSingle.mockImplementationOnce(() => new Promise((resolve) => {
                resolveProfile = resolve;
            }));

            const loginPromise = useAuthStore.getState().login('test@example.com', 'password123');
            await vi.waitFor(() => {
                expect(useAuthStore.getState().user?.id).toBe('mock-user-id');
            });

            await useAuthStore.getState().logout();
            resolveProfile({
                data: { name: 'Late Profile' },
                error: null,
            });

            await expect(loginPromise).resolves.toBe(false);
            const state = useAuthStore.getState();
            expect(state.isAuthenticated).toBe(false);
            expect(state.user).toBeNull();
            expect(state.isLoading).toBe(false);
        });
    });

    describe('logout', () => {
        it('should clear user data on logout', async () => {
            // Set authenticated state
            useAuthStore.setState({
                user: { id: 'test', email: 'test@example.com', name: 'Test', createdAt: '' },
                isAuthenticated: true,
            });
            useBoardStore.setState({
                boards: [{
                    id: 'private-board',
                    name: 'Private',
                    ownerId: 'test',
                    createdAt: '',
                    updatedAt: '',
                }],
                sharedBoards: [],
                currentBoard: null,
            });
            useBoardLibraryStore.setState({
                entries: {
                    'private-board': {
                        id: 'private-board',
                        name: 'Private',
                        ownerId: 'test',
                        createdAt: '',
                        updatedAt: '',
                        source: 'owned',
                    },
                },
            });
            useBoardHistoryStore.setState({ snapshots: { 'private-board': [] } });

            // Logout
            await useAuthStore.getState().logout();

            const state = useAuthStore.getState();
            expect(state.isAuthenticated).toBe(false);
            expect(state.user).toBeNull();
            expect(state.hasInitialized).toBe(true);
            expect(state.hasValidatedSession).toBe(false);
            expect(useBoardStore.getState().boards).toEqual([]);
            expect(useBoardLibraryStore.getState().entries).toEqual({});
            expect(useBoardHistoryStore.getState().snapshots).toEqual({});
        });
    });

    describe('clearError', () => {
        it('should clear error message', () => {
            useAuthStore.setState({ error: 'Some error' });

            useAuthStore.getState().clearError();

            expect(useAuthStore.getState().error).toBeNull();
        });
    });

    describe('initializeAuth', () => {
        it('should finish initialization and keep authenticated user when session is valid', async () => {
            await useAuthStore.getState().initializeAuth();

            const state = useAuthStore.getState();
            expect(state.hasInitialized).toBe(true);
            expect(state.isAuthenticated).toBe(true);
            expect(state.user?.id).toBe('mock-user-id');
            expect(state.hasValidatedSession).toBe(true);
        });

        it('should finish initialization and clear stale auth state when session is missing', async () => {
            authMocks.getUser.mockResolvedValueOnce({
                data: { user: null },
                error: null,
            });

            useAuthStore.setState({
                user: { id: 'stale-id', email: 'stale@example.com', name: 'Stale', createdAt: '' },
                isAuthenticated: true,
                hasValidatedSession: false,
                isLoading: false,
                hasInitialized: false,
                error: null,
            });

            await useAuthStore.getState().initializeAuth();

            const state = useAuthStore.getState();
            expect(state.hasInitialized).toBe(true);
            expect(state.isAuthenticated).toBe(false);
            expect(state.user).toBeNull();
            expect(state.hasValidatedSession).toBe(false);
        });

        it('should hydrate the profile name after restoring the session user', async () => {
            authMocks.profileMaybeSingle.mockImplementationOnce(
                () => new Promise((resolve) => setTimeout(() => resolve({
                    data: { name: 'Profile Name', email: 'test@example.com' },
                    error: null,
                }), 20))
            );

            await useAuthStore.getState().initializeAuth();

            const state = useAuthStore.getState();
            expect(state.hasInitialized).toBe(true);
            expect(state.isAuthenticated).toBe(true);
            expect(state.user?.name).toBe('Profile Name');
            expect(state.hasValidatedSession).toBe(true);
        });

        it('should fail closed and clear stale auth state if session restoration hangs', async () => {
            // 安全修复：超时后不再信任本地缓存，强制重新登录，
            // 避免过期会话长期滞留受保护页面与未鉴权 Liveblocks 房间。
            vi.useFakeTimers();
            authMocks.getUser.mockImplementationOnce(
                () => new Promise(() => undefined)
            );

            useAuthStore.setState({
                user: { id: 'stale-id', email: 'stale@example.com', name: 'Stale', createdAt: '' },
                isAuthenticated: true,
                hasValidatedSession: false,
                isLoading: false,
                hasInitialized: false,
                error: null,
            });

            const initPromise = useAuthStore.getState().initializeAuth();
            await vi.advanceTimersByTimeAsync(8000);
            await initPromise;

            const state = useAuthStore.getState();
            expect(state.hasInitialized).toBe(true);
            expect(state.isAuthenticated).toBe(false);
            expect(state.user).toBeNull();
            expect(state.hasValidatedSession).toBe(false);
            expect(state.isLoading).toBe(false);
        });

        it('should ignore an unverified INITIAL_SESSION after timeout fallback', async () => {
            vi.useFakeTimers();
            authMocks.getUser.mockImplementationOnce(
                () => new Promise(() => undefined)
            );

            useAuthStore.setState({
                user: { id: 'stale-id', email: 'stale@example.com', name: 'Stale', createdAt: '' },
                isAuthenticated: true,
                hasValidatedSession: false,
                isLoading: false,
                hasInitialized: false,
                error: null,
            });

            const initPromise = useAuthStore.getState().initializeAuth();
            await vi.advanceTimersByTimeAsync(8000);
            await initPromise;

            const authChangeCallback = authMocks.onAuthStateChange.mock.calls[0]?.[0];
            expect(authChangeCallback).toBeTypeOf('function');

            await authChangeCallback('INITIAL_SESSION', {
                user: {
                    ...mockAuthUser,
                    user_metadata: {
                        name: 'Recovered User',
                    },
                },
            });

            const state = useAuthStore.getState();
            expect(state.hasInitialized).toBe(true);
            expect(state.isAuthenticated).toBe(false);
            expect(state.user).toBeNull();
            expect(state.hasValidatedSession).toBe(false);
        });

        it('should ignore an old initialization timeout after a valid auth event', async () => {
            vi.useFakeTimers();
            authMocks.getUser.mockImplementationOnce(
                () => new Promise(() => undefined)
            );

            const initPromise = useAuthStore.getState().initializeAuth();
            const authChangeCallback = authMocks.onAuthStateChange.mock.calls[0]?.[0];
            expect(authChangeCallback).toBeTypeOf('function');

            authChangeCallback('SIGNED_IN', {
                user: {
                    ...mockAuthUser,
                    user_metadata: {
                        name: 'Current User',
                    },
                },
            });

            await vi.advanceTimersByTimeAsync(8000);
            await initPromise;

            const state = useAuthStore.getState();
            expect(state.isAuthenticated).toBe(true);
            expect(state.user?.id).toBe('mock-user-id');
            expect(state.hasValidatedSession).toBe(true);
            expect(state.isLoading).toBe(false);
        });

        it('should clear stale auth state when INITIAL_SESSION arrives without a user', async () => {
            // 模拟 token 已过期但本地缓存仍标记为已认证：
            // onAuthStateChange 收到空 INITIAL_SESSION 时应清理滞留状态。
            useAuthStore.setState({
                user: { id: 'stale-id', email: 'stale@example.com', name: 'Stale', createdAt: '' },
                isAuthenticated: true,
                hasValidatedSession: true,
                isLoading: false,
                hasInitialized: true,
                error: null,
            });

            const authChangeCallback = authMocks.onAuthStateChange.mock.calls[0]?.[0];
            expect(authChangeCallback).toBeTypeOf('function');

            await authChangeCallback('INITIAL_SESSION', null);

            const state = useAuthStore.getState();
            expect(state.isAuthenticated).toBe(false);
            expect(state.user).toBeNull();
            expect(state.hasValidatedSession).toBe(false);
            expect(state.hasInitialized).toBe(true);
        });
        it('should not let a late profile lookup overwrite a newer authenticated user', async () => {
            let resolveProfile!: (value: {
                data: { name: string };
                error: null;
            }) => void;
            authMocks.profileMaybeSingle.mockImplementationOnce(() => new Promise((resolve) => {
                resolveProfile = resolve;
            }));

            const authChangeCallback = authMocks.onAuthStateChange.mock.calls[0]?.[0];
            expect(authChangeCallback).toBeTypeOf('function');

            authChangeCallback('SIGNED_IN', { user: mockAuthUser });
            useAuthStore.setState({
                user: {
                    id: 'new-user-id',
                    email: 'new@example.com',
                    name: 'New User',
                    createdAt: '',
                },
                isAuthenticated: true,
                hasValidatedSession: true,
                hasInitialized: true,
            });

            resolveProfile({
                data: { name: 'Old Profile Name' },
                error: null,
            });

            await vi.waitFor(() => {
                const state = useAuthStore.getState();
                expect(state.user?.id).toBe('new-user-id');
                expect(state.user?.name).toBe('New User');
            });
        });
    });
});
