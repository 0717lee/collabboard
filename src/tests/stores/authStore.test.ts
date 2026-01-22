import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '@/stores/authStore';

describe('authStore', () => {
    beforeEach(() => {
        // Reset store state before each test
        useAuthStore.setState({
            user: null,
            token: null,
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
            expect(state.user?.email).toBe('test@example.com');
            expect(state.user?.name).toBe('Test User');
            expect(state.token).not.toBeNull();
            expect(state.error).toBeNull();
        });

        it('should fail when email is already registered', async () => {
            const store = useAuthStore.getState();

            // Register first time
            await store.register('duplicate@example.com', 'password123', 'User 1');

            // Reset state but keep mock users
            useAuthStore.setState({
                user: null,
                token: null,
                isAuthenticated: false,
                isLoading: false,
                error: null,
            });

            // Try to register with same email
            const result = await useAuthStore.getState().register('duplicate@example.com', 'password456', 'User 2');

            expect(result).toBe(false);
            expect(useAuthStore.getState().error).toBe('该邮箱已被注册');
        });
    });

    describe('login', () => {
        it('should login with demo account successfully', async () => {
            const store = useAuthStore.getState();

            const result = await store.login('demo@collabboard.com', 'demo123');

            expect(result).toBe(true);

            const state = useAuthStore.getState();
            expect(state.isAuthenticated).toBe(true);
            expect(state.user?.email).toBe('demo@collabboard.com');
            expect(state.user?.name).toBe('Demo User');
        });

        it('should fail with wrong password', async () => {
            const store = useAuthStore.getState();

            const result = await store.login('demo@collabboard.com', 'wrongpassword');

            expect(result).toBe(false);
            expect(useAuthStore.getState().error).toBe('密码错误');
        });

        it('should fail with non-existent user', async () => {
            const store = useAuthStore.getState();

            const result = await store.login('nonexistent@example.com', 'password123');

            expect(result).toBe(false);
            expect(useAuthStore.getState().error).toBe('用户不存在');
        });
    });

    describe('logout', () => {
        it('should clear user data on logout', async () => {
            const store = useAuthStore.getState();

            // First login
            await store.login('demo@collabboard.com', 'demo123');
            expect(useAuthStore.getState().isAuthenticated).toBe(true);

            // Then logout
            useAuthStore.getState().logout();

            const state = useAuthStore.getState();
            expect(state.isAuthenticated).toBe(false);
            expect(state.user).toBeNull();
            expect(state.token).toBeNull();
        });
    });

    describe('clearError', () => {
        it('should clear error message', async () => {
            const store = useAuthStore.getState();

            // Trigger an error
            await store.login('nonexistent@example.com', 'password123');
            expect(useAuthStore.getState().error).not.toBeNull();

            // Clear error
            useAuthStore.getState().clearError();
            expect(useAuthStore.getState().error).toBeNull();
        });
    });
});
