import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@/types';

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    hasInitialized: boolean;
    error: string | null;

    login: (email: string, password: string) => Promise<boolean>;
    register: (email: string, password: string, name: string) => Promise<boolean>;
    logout: () => Promise<void>;
    clearError: () => void;
    initializeAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            hasInitialized: false,
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
                        // Fetch or create user profile in profiles table
                        let { data: profile } = await supabase
                            .from('profiles')
                            .select('*')
                            .eq('id', data.user.id)
                            .single();

                        // If no profile exists, create one
                        if (!profile) {
                            try {
                                const { data: newProfile, error: profileError } = await supabase
                                    .from('profiles')
                                    .insert({
                                        id: data.user.id,
                                        email: data.user.email,
                                        name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User',
                                    })
                                    .select()
                                    .single();

                                if (profileError) {
                                    console.warn('Profile creation failed:', profileError);
                                } else {
                                    profile = newProfile;
                                }
                            } catch (err) {
                                console.warn('Profile creation error:', err);
                            }
                        }

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
                            hasInitialized: true,
                            error: null,
                        });

                        return true;
                    }

                    set({ isLoading: false, hasInitialized: true, error: '登录失败' });
                    return false;
                } catch {
                    set({ isLoading: false, hasInitialized: true, error: '网络错误，请稍后重试' });
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
                            hasInitialized: true,
                            error: null,
                        });

                        return true;
                    }

                    set({ isLoading: false, hasInitialized: true, error: '注册失败' });
                    return false;
                } catch {
                    set({ isLoading: false, hasInitialized: true, error: '网络错误，请稍后重试' });
                    return false;
                }
            },

            logout: async () => {
                try {
                    await supabase.auth.signOut();
                } catch (error) {
                    console.error('Logout error:', error);
                } finally {
                    // Always clear local state, even if server logout fails
                    set({
                        user: null,
                        isAuthenticated: false,
                        hasInitialized: true,
                        error: null,
                    });
                    // Clear any local storage manually if needed
                    localStorage.removeItem('auth-storage');
                }
            },

            clearError: () => {
                set({ error: null });
            },

            initializeAuth: async () => {
                set({ isLoading: true });

                try {
                    // Restore the local session first so protected routes do not block on a network round-trip.
                    const { data: { session }, error } = await supabase.auth.getSession();

                    if (error || !session?.user) {
                        // If no session found, or error occurred, make sure we clear local state
                        if (get().isAuthenticated) {
                            console.warn('Session expired or missing, logging out');
                            set({
                                user: null,
                                isAuthenticated: false,
                                isLoading: false,
                                hasInitialized: true,
                            });
                        } else {
                            set({ isLoading: false, hasInitialized: true });
                        }
                        return;
                    }

                    const authUser = session.user;
                    const fallbackUser: User = {
                        id: authUser.id,
                        email: authUser.email || '',
                        name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
                        createdAt: authUser.created_at,
                    };

                    set({
                        user: fallbackUser,
                        isAuthenticated: true,
                        isLoading: false,
                        hasInitialized: true,
                    });

                    // Hydrate the richer profile name asynchronously after the route is already usable.
                    try {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('*')
                            .eq('id', authUser.id)
                            .single();

                        if (profile?.name) {
                            set((state) => ({
                                user: state.user
                                    ? { ...state.user, name: profile.name }
                                    : state.user,
                            }));
                        }
                    } catch (profileError) {
                        console.warn('Initialize profile lookup failed:', profileError);
                    }
                } catch (e) {
                    console.error('Initialize auth error:', e);
                    set({
                        user: null,
                        isAuthenticated: false,
                        isLoading: false,
                        hasInitialized: true,
                    });
                }
            },
        }),
        {
            name: 'auth-storage',
            version: 1,
            partialize: (state) => ({
                user: state.user,
                isAuthenticated: state.isAuthenticated,
            }),
            onRehydrateStorage: () => (state) => {
                // Ensure isLoading is always false after rehydration
                if (state) {
                    state.isLoading = false;
                    state.hasInitialized = false;
                }
            },
        }
    )
);

// Listen for auth state changes
supabase.auth.onAuthStateChange(async (event: string, session: { user: { id: string; email?: string; created_at: string } } | null) => {
    if (event === 'SIGNED_OUT') {
        useAuthStore.setState({
            user: null,
            isAuthenticated: false,
            hasInitialized: true,
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
            hasInitialized: true,
        });
    }
});
