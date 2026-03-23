import { createClient } from '@supabase/supabase-js';
import { createMockSupabaseClient } from './mockSupabaseClient';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const useMockClient = import.meta.env.VITE_E2E_MOCK_MODE === 'true' || !supabaseUrl || !supabaseAnonKey;

if (useMockClient) {
    console.warn('Supabase credentials not found or mock mode enabled. Using local mock client.');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase: any = (useMockClient
    ? createMockSupabaseClient()
    : createClient(supabaseUrl!, supabaseAnonKey!));

export default supabase;
