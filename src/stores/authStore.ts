import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;

    login: (email: string, password: string) => Promise<boolean>;
    register: (email: string, password: string, name: string) => Promise<boolean>;
    logout: () => void;
    clearError: () => void;
}

// Mock user database
const mockUsers: Map<string, { user: User; password: string }> = new Map();

// Generate JWT-like token
const generateToken = (userId: string): string => {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({ userId, exp: Date.now() + 24 * 60 * 60 * 1000 }));
    const signature = btoa(userId + Date.now().toString());
    return `${header}.${payload}.${signature}`;
};

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,

            login: async (email: string, password: string) => {
                set({ isLoading: true, error: null });

                // Simulate API delay
                await new Promise(resolve => setTimeout(resolve, 800));

                const userData = mockUsers.get(email);

                if (!userData) {
                    set({ isLoading: false, error: '用户不存在' });
                    return false;
                }

                if (userData.password !== password) {
                    set({ isLoading: false, error: '密码错误' });
                    return false;
                }

                const token = generateToken(userData.user.id);

                set({
                    user: userData.user,
                    token,
                    isAuthenticated: true,
                    isLoading: false,
                    error: null,
                });

                return true;
            },

            register: async (email: string, password: string, name: string) => {
                set({ isLoading: true, error: null });

                // Simulate API delay
                await new Promise(resolve => setTimeout(resolve, 800));

                if (mockUsers.has(email)) {
                    set({ isLoading: false, error: '该邮箱已被注册' });
                    return false;
                }

                const newUser: User = {
                    id: crypto.randomUUID(),
                    email,
                    name,
                    createdAt: new Date().toISOString(),
                };

                mockUsers.set(email, { user: newUser, password });

                const token = generateToken(newUser.id);

                set({
                    user: newUser,
                    token,
                    isAuthenticated: true,
                    isLoading: false,
                    error: null,
                });

                return true;
            },

            logout: () => {
                set({
                    user: null,
                    token: null,
                    isAuthenticated: false,
                    error: null,
                });
            },

            clearError: () => {
                set({ error: null });
            },
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                user: state.user,
                token: state.token,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
);

// Initialize demo account
mockUsers.set('demo@collabboard.com', {
    user: {
        id: 'demo-user-001',
        email: 'demo@collabboard.com',
        name: 'Demo User',
        createdAt: '2024-01-01T00:00:00.000Z',
    },
    password: 'demo123',
});
