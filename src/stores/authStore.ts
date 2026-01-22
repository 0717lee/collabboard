import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@/types';

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;

    login: (email: string, password: string) => Promise<boolean>;
    register: (email: string, password: string, name: string) => Promise<boolean>;
    logout: () => Promise<void>;
    clearError: () => void;
    initializeAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,

            login: async (email: string, password: string) => {
                set({ isLoading: true, error: null });

                try {
                    const { data, error } = await supabase.auth.signInWithPassword({
                        email,
                        password,
                    });

                    if (error) {
                        set({ isLoading: false, error: error.message });
                        return false;
                    }

                    if (data.user) {
                        // Fetch user profile from profiles table
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('*')
                            .eq('id', data.user.id)
                            .single();

                        const user: User = {
                            id: data.user.id,
                            email: data.user.email || email,
                            name: profile?.name || data.user.email?.split('@')[0] || 'User',
                            createdAt: data.user.created_at,
                        };

                        set({
                            user,
                            isAuthenticated: true,
                            isLoading: false,
                            error: null,
                        });

                        return true;
                    }

                    set({ isLoading: false, error: '登录失败' });
                    return false;
                } catch (err) {
                    set({ isLoading: false, error: '网络错误，请稍后重试' });
                    return false;
                }
            },

            register: async (email: string, password: string, name: string) => {
                set({ isLoading: true, error: null });

                try {
                    const { data, error } = await supabase.auth.signUp({
                        email,
                        password,
                        options: {
                            data: {
                                name,
                            },
                        },
                    });

                    if (error) {
                        set({ isLoading: false, error: error.message });
                        return false;
                    }

                    if (data.user) {
                        // Create profile in profiles table
                        await supabase.from('profiles').insert({
                            id: data.user.id,
                            email,
                            name,
                        });

                        const user: User = {
                            id: data.user.id,
                            email,
                            name,
                            createdAt: data.user.created_at,
                        };

                        set({
                            user,
                            isAuthenticated: true,
                            isLoading: false,
                            error: null,
                        });

                        return true;
                    }

                    set({ isLoading: false, error: '注册失败' });
                    return false;
                } catch (err) {
                    set({ isLoading: false, error: '网络错误，请稍后重试' });
                    return false;
                }
            },

            logout: async () => {
                await supabase.auth.signOut();
                set({
                    user: null,
                    isAuthenticated: false,
                    error: null,
                });
            },

            clearError: () => {
                set({ error: null });
            },

            initializeAuth: async () => {
                set({ isLoading: true });

                try {
                    const { data: { session } } = await supabase.auth.getSession();

                    if (session?.user) {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('*')
                            .eq('id', session.user.id)
                            .single();

                        const user: User = {
                            id: session.user.id,
                            email: session.user.email || '',
                            name: profile?.name || session.user.email?.split('@')[0] || 'User',
                            createdAt: session.user.created_at,
                        };

                        set({
                            user,
                            isAuthenticated: true,
                            isLoading: false,
                        });
                    } else {
                        set({ isLoading: false });
                    }
                } catch {
                    set({ isLoading: false });
                }
            },
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                user: state.user,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
);

// Listen for auth state changes
supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT') {
        useAuthStore.setState({
            user: null,
            isAuthenticated: false,
        });
    } else if (event === 'SIGNED_IN' && session?.user) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

        useAuthStore.setState({
            user: {
                id: session.user.id,
                email: session.user.email || '',
                name: profile?.name || session.user.email?.split('@')[0] || 'User',
                createdAt: session.user.created_at,
            },
            isAuthenticated: true,
        });
    }
});
