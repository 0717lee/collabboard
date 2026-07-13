// Cloudflare Pages Function: Liveblocks 鉴权端点
// 路由: POST /api/liveblocks-auth
//
// 职责：
// 1. 从 Authorization header 提取 Supabase JWT 并验证
// 2. 查 boards + shared_boards 确定用户在房间（boardId）中的角色
// 3. 调用 Liveblocks authorize，返回房间 token
//
// 环境变量（在 Cloudflare Pages → Settings → Environment variables 配置）：
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY（service role key，绕过 RLS 用于服务端查询）
// - LIVEBLOCKS_SECRET_KEY（sk_live_...）

import { Liveblocks } from '@liveblocks/node';
import { createClient } from '@supabase/supabase-js';

interface AppEnv {
    SUPABASE_URL: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    LIVEBLOCKS_SECRET_KEY: string;
}

interface PagesFunctionContext<Env = AppEnv> {
    request: Request;
    env: Env;
}

// Liveblocks 连接房间时 POST 的 body 格式
interface LiveblocksAuthBody {
    roomId: string;
}

const ROOM_PREFIX = 'collabboard-';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const parseBoardRoomId = (value: unknown): { boardId: string; roomId: string } | null => {
    if (typeof value !== 'string' || !value.startsWith(ROOM_PREFIX)) {
        return null;
    }

    const boardId = value.slice(ROOM_PREFIX.length);
    return UUID_PATTERN.test(boardId) ? { boardId, roomId: value } : null;
};

export const onRequestPost = async (context: PagesFunctionContext) => {
    const { request, env } = context;

    // ---------- 0. 参数校验 ----------
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.LIVEBLOCKS_SECRET_KEY) {
        return json({ error: 'Server missing env vars' }, 500);
    }

    // ---------- 1. 提取 roomId 与 JWT ----------
    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    let requestedRoomId: unknown;
    try {
        const body = await request.json() as LiveblocksAuthBody;
        requestedRoomId = body.roomId;
    } catch {
        return json({ error: 'Invalid request body' }, 400);
    }

    if (!token) {
        return json({ error: 'Missing token' }, 401);
    }

    const parsedRoom = parseBoardRoomId(requestedRoomId);
    if (!parsedRoom) {
        return json({ error: 'Invalid roomId' }, 400);
    }
    const { boardId, roomId } = parsedRoom;

    // ---------- 2. 验证 Supabase JWT ----------
    // 用 service role key 创建客户端（绕过 RLS），仅用于服务端查询
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
        return json({ error: 'Invalid or expired token' }, 401);
    }

    // ---------- 3. 查 boards 确定角色 ----------
    const { data: board, error: boardError } = await supabase
        .from('boards')
        .select('owner_id, public_role')
        .eq('id', boardId)
        .maybeSingle();

    if (boardError) {
        console.error('Liveblocks auth board lookup failed:', boardError.message);
        return json({ error: 'Unable to verify board access' }, 500);
    }

    let role: 'owner' | 'editor' | 'viewer';

    if (board?.owner_id === user.id) {
        // owner
        role = 'owner';
    } else {
        // 先查 shared_boards（用户特定共享权限，优先级高于 public_role）
        const { data: shared, error: sharedError } = await supabase
            .from('shared_boards')
            .select('role')
            .eq('board_id', boardId)
            .eq('user_id', user.id)
            .maybeSingle();

        if (sharedError) {
            console.error('Liveblocks auth share lookup failed:', sharedError.message);
            return json({ error: 'Unable to verify board access' }, 500);
        }

        if (shared?.role === 'editor') {
            role = 'editor';
        } else if (shared?.role === 'viewer') {
            role = 'viewer';
        } else if (board?.public_role === 'editor') {
            // 链接共享：owner 已开启公开编辑
            role = 'editor';
        } else if (board?.public_role === 'viewer') {
            // 链接共享：owner 已开启公开只读
            role = 'viewer';
        } else {
            // 无权限：board 不存在、未被共享、未开启公开访问
            return json({ error: 'No access to this board' }, 403);
        }
    }

    // ---------- 4. 查 profile 获取展示信息 ----------
    const { data: profile } = await supabase
        .from('profiles')
        .select('name, avatar_url')
        .eq('id', user.id)
        .maybeSingle();

    // ---------- 5. 调用 Liveblocks authorize ----------
    const liveblocks = new Liveblocks({ secret: env.LIVEBLOCKS_SECRET_KEY });

    const session = liveblocks.prepareSession(user.id, {
        userInfo: {
            name: profile?.name || user.email?.split('@')[0] || '匿名用户',
            avatar: profile?.avatar_url || undefined,
        },
    });

    // owner/editor 拥有完全读写权限；viewer 只读
    if (role === 'owner' || role === 'editor') {
        session.allow(roomId, ['*:write']);
    } else {
        session.allow(roomId, ['*:read']);
    }

    const { status, body: authBody } = await session.authorize();
    return new Response(authBody, {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
        },
    });
};

function json(data: unknown, status: number): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
        },
    });
}
