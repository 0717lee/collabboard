import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@/types';

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    hasValidatedSession: boolean;
    isLoading: boolean;
    hasInitialized: boolean;
    error: string | null;

    login: (email: string, password: string) => Promise<boolean>;
    register: (email: string, password: string, name: string) => Promise<boolean>;
    logout: () => Promise<void>;
    clearError: () => void;
    initializeAuth: () => Promise<void>;
}

const AUTH_INIT_TIMEOUT_MS = 4000;

const buildUserFromSessionUser = (sessionUser: {
    id: string;
    email?: string;
    created_at: string;
    user_metadata?: { name?: string };
}, profileName?: string): User => ({
    id: sessionUser.id,
    email: sessionUser.email || '',
    name: profileName || sessionUser.user_metadata?.name || sessionUser.email?.split('@')[0] || 'User',
    createdAt: sessionUser.created_at,
});

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            isAuthenticated: false,
            hasValidatedSession: false,
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
                            .maybeSingle();

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
                            hasValidatedSession: true,
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
                            hasValidatedSession: true,
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
                        hasValidatedSession: false,
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
                    const sessionResult = await Promise.race([
                        supabase.auth.getSession()
                            .then((result: { data: { session: { user: User } | null }; error: { message: string } | null }) => ({
                                type: 'session' as const,
                                result,
                            }))
                            .catch((error: unknown) => ({
                                type: 'error' as const,
                                error,
                            })),
                        new Promise<{ type: 'timeout' }>((resolve) => {
                            setTimeout(() => resolve({ type: 'timeout' }), AUTH_INIT_TIMEOUT_MS);
                        }),
                    ]);

                    if (sessionResult.type === 'timeout') {
                        const { isAuthenticated, user } = get();
                        console.warn('Auth initialization timed out, falling back to cached auth state.');
                        set({
                            user: isAuthenticated ? user : null,
                            isAuthenticated,
                            // Trust cached auth on timeout so the app remains usable.
                            // onAuthStateChange will correct state if session is actually invalid.
                            hasValidatedSession: isAuthenticated,
                            isLoading: false,
                            hasInitialized: true,
                        });
                        return;
                    }

                    if (sessionResult.type === 'error') {
                        throw sessionResult.error;
                    }

                    // Restore the local session first so protected routes do not block on a network round-trip.
                    const { data: { session }, error } = sessionResult.result;

                    if (error || !session?.user) {
                        // If no session found, or error occurred, make sure we clear local state
                        if (get().isAuthenticated) {
                            console.warn('Session expired or missing, logging out');
                            set({
                                user: null,
                                isAuthenticated: false,
                                hasValidatedSession: false,
                                isLoading: false,
                                hasInitialized: true,
                            });
                        } else {
                            set({ isLoading: false, hasInitialized: true, hasValidatedSession: false });
                        }
                        return;
                    }

                    const authUser = session.user;
                    const fallbackUser = buildUserFromSessionUser(authUser);

                    set({
                        user: fallbackUser,
                        isAuthenticated: true,
                        hasValidatedSession: true,
                        isLoading: false,
                        hasInitialized: true,
                    });

                    // Hydrate the richer profile name asynchronously after the route is already usable.
                    try {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('*')
                            .eq('id', authUser.id)
                            .maybeSingle();

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
                        hasValidatedSession: false,
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
            migrate: (persistedState: unknown) => persistedState as Partial<AuthState>,
            onRehydrateStorage: () => (state) => {
                // Ensure isLoading is always false after rehydration
                if (state) {
                    state.isLoading = false;
                }
            },
        }
    )
);

// Listen for auth state changes
supabase.auth.onAuthStateChange(async (
    event: string,
    session: { user: { id: string; email?: string; created_at: string; user_metadata?: { name?: string } } } | null
) => {
    if (event === 'SIGNED_OUT') {
        useAuthStore.setState({
            user: null,
            isAuthenticated: false,
            hasValidatedSession: false,
            hasInitialized: true,
        });
    } else if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        let profileName: string | undefined;
        try {
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .maybeSingle();
            profileName = profile?.name;
        } catch (err) {
            console.warn('onAuthStateChange: profile lookup failed, continuing without profile name:', err);
        }

        useAuthStore.setState({
            user: buildUserFromSessionUser(session.user, profileName),
            isAuthenticated: true,
            hasValidatedSession: true,
            hasInitialized: true,
        });
    }
});
