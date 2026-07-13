import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabaseClient';
import { useBoardStore } from '@/stores/boardStore';
import { useBoardLibraryStore } from '@/stores/boardLibraryStore';
import { useBoardHistoryStore } from '@/stores/boardHistoryStore';
import type { User } from '@/types';

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    hasValidatedSession: boolean;
    isLoading: boolean;
    hasInitialized: boolean;
    error: string | null;
    notice: string | null;

    login: (email: string, password: string) => Promise<boolean>;
    register: (email: string, password: string, name: string) => Promise<boolean>;
    logout: () => Promise<void>;
    clearError: () => void;
    initializeAuth: () => Promise<void>;
}

const AUTH_INIT_TIMEOUT_MS = 4000;
let latestAuthInitializationId = 0;

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

const clearUserScopedState = () => {
    useBoardStore.getState().reset();
    useBoardLibraryStore.getState().clear();
    useBoardHistoryStore.getState().clear();
};

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            isAuthenticated: false,
            hasValidatedSession: false,
            isLoading: false,
            hasInitialized: false,
            error: null,
            notice: null,

            login: async (email: string, password: string) => {
                set({ isLoading: true, error: null, notice: null });

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
                        const authUser = data.user;
                        set({
                            user: buildUserFromSessionUser(authUser),
                            isAuthenticated: true,
                            hasValidatedSession: true,
                            isLoading: true,
                            hasInitialized: true,
                            error: null,
                        });

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

                        const currentAuth = get();
                        if (!currentAuth.isAuthenticated || currentAuth.user?.id !== authUser.id) {
                            return false;
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
                set({ isLoading: true, error: null, notice: null });

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
                        // 必须同时拥有 session 才能视为已登录并写 profile。
                        // 当 Supabase 开启邮箱确认（autoconfirm 关闭）时，signUp 只返回 user 不返回 session，
                        // 此时未认证用户写 profiles 会被 RLS 拒绝，且错误被吞掉；
                        // 因此保持未认证、不写 profile，并通过 notice 提示用户完成邮箱验证。
                        if (!data.session) {
                            clearUserScopedState();
                            set({
                                user: null,
                                isAuthenticated: false,
                                hasValidatedSession: false,
                                isLoading: false,
                                hasInitialized: true,
                                error: null,
                                notice: '注册成功，请前往邮箱完成验证后再登录。',
                            });
                            return false;
                        }

                        // 有 session 才写 profile（已认证，RLS 允许写入）
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
                            isLoading: true,
                            hasInitialized: true,
                            error: null,
                        });

                        await supabase.from('profiles').insert({
                            id: data.user.id,
                            email,
                            name,
                        });

                        const currentAuth = get();
                        if (!currentAuth.isAuthenticated || currentAuth.user?.id !== user.id) {
                            return false;
                        }
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
                latestAuthInitializationId += 1;
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
                        isLoading: false,
                        error: null,
                        notice: null,
                    });
                    // Clear any local storage manually if needed
                    clearUserScopedState();
                    localStorage.removeItem('auth-storage');
                }
            },

            clearError: () => {
                set({ error: null, notice: null });
            },

            initializeAuth: async () => {
                const initializationId = ++latestAuthInitializationId;
                set({ isLoading: true });
                console.log('[authStore] Initializing auth...');

                try {
                    // getUser verifies the JWT with Supabase Auth; getSession only reads local state.
                    const userPromise = supabase.auth.getUser();
                    const timeoutPromise = new Promise<null>((resolve) => {
                        setTimeout(() => resolve(null), AUTH_INIT_TIMEOUT_MS);
                    });

                    const result = await Promise.race([userPromise, timeoutPromise]);
                    if (initializationId !== latestAuthInitializationId) return;

                    if (result === null) {
                        // Timeout case - fail closed for security.
                        // 不再信任本地缓存：过期/无网络情况下应强制重新登录，
                        // 避免过期会话长期滞留受保护页面与未鉴权 Liveblocks 房间。
                        console.warn('[authStore] Auth initialization timed out, requiring re-login.');
                        set({
                            user: null,
                            isAuthenticated: false,
                            hasValidatedSession: false,
                            isLoading: false,
                            hasInitialized: true,
                        });
                        clearUserScopedState();
                        return;
                    }

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const { data: { user: authUser }, error } = result as any;

                    if (error) {
                        console.error('[authStore] Get session error:', error);
                        throw error;
                    }

                    if (!authUser) {
                        console.log('[authStore] No active session found.');
                        if (get().isAuthenticated) {
                            console.warn('[authStore] Local state was authenticated but no server session found, logging out.');
                        }
                        clearUserScopedState();
                        set({
                            user: null,
                            isAuthenticated: false,
                            hasValidatedSession: false,
                            isLoading: false,
                            hasInitialized: true,
                        });
                        return;
                    }

                    console.log('[authStore] Session restored for user:', authUser.id);
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
                            set((state) => {
                                const currentUser = state.user;
                                if (!currentUser || !state.isAuthenticated || currentUser.id !== authUser.id) {
                                    return {};
                                }
                                return {
                                    user: { ...currentUser, name: profile.name },
                                };
                            });
                        }
                    } catch (profileError) {
                        console.warn('Initialize profile lookup failed:', profileError);
                    }
                } catch (e) {
                    if (initializationId !== latestAuthInitializationId) return;
                    console.error('Initialize auth error:', e);
                    set({
                        user: null,
                        isAuthenticated: false,
                        hasValidatedSession: false,
                        isLoading: false,
                        hasInitialized: true,
                    });
                    clearUserScopedState();
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
const { data: authSubscription } = supabase.auth.onAuthStateChange((
    event: string,
    session: { user: { id: string; email?: string; created_at: string; user_metadata?: { name?: string } } } | null
) => {
    if (event === 'SIGNED_OUT') {
        latestAuthInitializationId += 1;
        console.log('[authStore] Auth event: SIGNED_OUT');
        useAuthStore.setState({
            user: null,
            isAuthenticated: false,
            hasValidatedSession: false,
            hasInitialized: true,
            isLoading: false,
            notice: null,
        });
        clearUserScopedState();
    } else if (event === 'INITIAL_SESSION' && !session?.user) {
        latestAuthInitializationId += 1;
        // 初始会话无用户：清理可能滞留的本地认证状态（例如 token 已过期但缓存仍标记为已认证）
        console.warn('[authStore] Initial session has no user, clearing stale auth state.');
        clearUserScopedState();
        useAuthStore.setState({
            user: null,
            isAuthenticated: false,
            hasValidatedSession: false,
            hasInitialized: true,
            isLoading: false,
        });
    } else if (event === 'INITIAL_SESSION' && session?.user) {
        // INITIAL_SESSION is reconstructed from local storage. initializeAuth owns
        // restoration and only authenticates after getUser verifies the token.
        console.log('[authStore] Ignoring unverified INITIAL_SESSION event.');
    } else if (event === 'SIGNED_IN' && session?.user) {
        latestAuthInitializationId += 1;
        console.log(`[authStore] Auth event: ${event}`, session.user.id);
        
        useAuthStore.setState({
            user: buildUserFromSessionUser(session.user),
            isAuthenticated: true,
            hasValidatedSession: true,
            hasInitialized: true,
            isLoading: false,
            error: null,
            notice: null,
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
                    const currentAuth = useAuthStore.getState();
                    if (currentAuth.isAuthenticated && currentAuth.user?.id === session.user.id) {
                        console.log('[authStore] Profile name found:', profile.name);
                        useAuthStore.setState({
                            user: buildUserFromSessionUser(session.user, profile.name),
                        });
                    }
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
