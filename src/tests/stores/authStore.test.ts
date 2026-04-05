import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '@/stores/authStore';

const authMocks = vi.hoisted(() => ({
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    getUser: vi.fn(),
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
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
        });
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
    });

    describe('logout', () => {
        it('should clear user data on logout', async () => {
            // Set authenticated state
            useAuthStore.setState({
                user: { id: 'test', email: 'test@example.com', name: 'Test', createdAt: '' },
                isAuthenticated: true,
            });

            // Logout
            await useAuthStore.getState().logout();

            const state = useAuthStore.getState();
            expect(state.isAuthenticated).toBe(false);
            expect(state.user).toBeNull();
            expect(state.hasInitialized).toBe(true);
            expect(state.hasValidatedSession).toBe(false);
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
            authMocks.getSession.mockResolvedValueOnce({
                data: { session: null },
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

        it('should stop the global loader if session restoration hangs', async () => {
            vi.useFakeTimers();
            authMocks.getSession.mockImplementationOnce(
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
            expect(state.isAuthenticated).toBe(true);
            expect(state.user?.id).toBe('stale-id');
            expect(state.hasValidatedSession).toBe(true);
            expect(state.isLoading).toBe(false);
        });

        it('should validate the session again when INITIAL_SESSION arrives after timeout fallback', async () => {
            vi.useFakeTimers();
            authMocks.getSession.mockImplementationOnce(
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
            expect(state.isAuthenticated).toBe(true);
            expect(state.user?.id).toBe('mock-user-id');
            expect(state.hasValidatedSession).toBe(true);
        });
    });
});
