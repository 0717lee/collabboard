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
                console.log('[authStore] Initializing auth...');

                try {
                    // Try to get the session with a race condition for timeout
                    const sessionPromise = supabase.auth.getSession();
                    const timeoutPromise = new Promise<null>((resolve) => {
                        setTimeout(() => resolve(null), AUTH_INIT_TIMEOUT_MS);
                    });

                    const result = await Promise.race([sessionPromise, timeoutPromise]);

                    if (result === null) {
                        // Timeout case
                        const { isAuthenticated, user } = get();
                        console.warn('[authStore] Auth initialization timed out, falling back to cached auth state.');
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

                    // Result cast for clarity, though it's already well-typed from supabase-js
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const { data: { session }, error } = result as any;

                    if (error) {
                        console.error('[authStore] Get session error:', error);
                        throw error;
                    }

                    if (!session?.user) {
                        console.log('[authStore] No active session found.');
                        if (get().isAuthenticated) {
                            console.warn('[authStore] Local state was authenticated but no server session found, logging out.');
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

                    console.log('[authStore] Session restored for user:', session.user.id);
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
const { data: authSubscription } = supabase.auth.onAuthStateChange(async (
    event: string,
    session: { user: { id: string; email?: string; created_at: string; user_metadata?: { name?: string } } } | null
) => {
    if (event === 'SIGNED_OUT') {
        console.log('[authStore] Auth event: SIGNED_OUT');
        useAuthStore.setState({
            user: null,
            isAuthenticated: false,
            hasValidatedSession: false,
            hasInitialized: true,
        });
    } else if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        console.log(`[authStore] Auth event: ${event}`, session.user.id);
        
        useAuthStore.setState({
            user: buildUserFromSessionUser(session.user),
            isAuthenticated: true,
            hasValidatedSession: true,
            hasInitialized: true,
        });

        (async () => {
            try {
                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('name')
                    .eq('id', session.user.id)
                    .maybeSingle();
                
                if (error) {
                    console.warn('[authStore] Profile lookup error:', error.message);
                    return;
                }

                if (profile?.name) {
                    console.log('[authStore] Profile name found:', profile.name);
                    useAuthStore.setState({
                        user: buildUserFromSessionUser(session.user, profile.name)
                    });
                }
            } catch (err) {
                console.warn('[authStore] Profile lookup background failure:', err);
            }
        })();
    }
});

export const unsubscribeAuth = () => {
    authSubscription?.subscription.unsubscribe();
};
