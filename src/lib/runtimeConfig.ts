export const isE2EMockMode = import.meta.env.VITE_E2E_MOCK_MODE === 'true';

export const hasSupabaseConfig = Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);

export const hasLiveblocksConfig = Boolean(import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY);

export const shouldUseMockSupabase = isE2EMockMode;
export const shouldUseMockLiveblocks = isE2EMockMode;

export const supabaseConfigError = !shouldUseMockSupabase && !hasSupabaseConfig
    ? '缺少 Supabase 环境变量：请在部署平台中配置 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY。'
    : null;

export const liveblocksConfigWarning = !shouldUseMockLiveblocks && !hasLiveblocksConfig
    ? '缺少 Liveblocks 环境变量：实时协作将降级为单人模式，需配置 VITE_LIVEBLOCKS_PUBLIC_KEY 后恢复。'
    : null;
