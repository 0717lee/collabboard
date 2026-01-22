import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '@/stores/authStore';

// Mock Supabase client
vi.mock('@/lib/supabaseClient', () => ({
    supabase: {
        auth: {
            signInWithPassword: vi.fn(() => Promise.resolve({
                data: {
                    user: {
                        id: 'mock-user-id',
                        email: 'test@example.com',
                        created_at: new Date().toISOString(),
                    },
                    session: { access_token: 'mock-token' },
                },
                error: null,
            })),
            signUp: vi.fn(() => Promise.resolve({
                data: {
                    user: {
                        id: 'mock-user-id',
                        email: 'test@example.com',
                        created_at: new Date().toISOString(),
                    },
                    session: { access_token: 'mock-token' },
                },
                error: null,
            })),
            signOut: vi.fn(() => Promise.resolve({ error: null })),
            getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
            onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
        },
        from: () => ({
            select: () => ({
                eq: () => ({
                    single: () => Promise.resolve({
                        data: { name: 'Test User', email: 'test@example.com' },
                        error: null,
                    }),
                }),
            }),
            insert: () => Promise.resolve({ error: null }),
        }),
    },
}));

describe('authStore', () => {
    beforeEach(() => {
        // Reset store state before each test
        useAuthStore.setState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
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
        });
    });

    describe('clearError', () => {
        it('should clear error message', () => {
            useAuthStore.setState({ error: 'Some error' });

            useAuthStore.getState().clearError();

            expect(useAuthStore.getState().error).toBeNull();
        });
    });
});
