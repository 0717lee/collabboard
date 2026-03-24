import { createClient } from '@supabase/supabase-js';
import { clearMockSupabaseStorage, createMockSupabaseClient } from './mockSupabaseClient';
import { hasSupabaseConfig, shouldUseMockSupabase, supabaseConfigError } from './runtimeConfig';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (shouldUseMockSupabase) {
    console.warn('E2E mock mode enabled. Using local mock Supabase client.');
} else if (supabaseConfigError) {
    console.error(supabaseConfigError);
    clearMockSupabaseStorage();
}

const createMissingConfigClient = (message: string) => ({
    auth: {
        async signInWithPassword() {
            return {
                data: { user: null, session: null },
                error: { message },
            };
        },
        async signUp() {
            return {
                data: { user: null, session: null },
                error: { message },
            };
        },
        async signOut() {
            return { error: null };
        },
        async getUser() {
            return {
                data: { user: null },
                error: { message },
            };
        },
        async getSession() {
            return {
                data: { session: null },
                error: { message },
            };
        },
        onAuthStateChange() {
            return {
                data: {
                    subscription: {
                        unsubscribe: () => undefined,
                    },
                },
            };
        },
    },
    from() {
        return {
            select() {
                return {
                    eq() {
                        return {
                            single: async () => ({ data: null, error: { message } }),
                            order: async () => ({ data: [], error: { message } }),
                        };
                    },
                };
            },
            insert() {
                return {
                    select() {
                        return {
                            single: async () => ({ data: null, error: { message } }),
                        };
                    },
                };
            },
            update() {
                return {
                    eq: async () => ({ error: { message } }),
                };
            },
            delete() {
                return {
                    eq: async () => ({ error: { message }, count: 0 }),
                };
            },
        };
    },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase: any = shouldUseMockSupabase
    ? createMockSupabaseClient()
    : hasSupabaseConfig
        ? createClient(supabaseUrl!, supabaseAnonKey!)
        : createMissingConfigClient(supabaseConfigError!);

export default supabase;
