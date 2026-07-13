import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    createClient: vi.fn(),
    Liveblocks: vi.fn(),
    getUser: vi.fn(),
    prepareSession: vi.fn(),
    allow: vi.fn(),
    authorize: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
    createClient: mocks.createClient,
}));

vi.mock('@liveblocks/node', () => ({
    Liveblocks: mocks.Liveblocks,
}));

import { onRequestPost, parseBoardRoomId } from '../../../functions/api/liveblocks-auth';

const BOARD_ID = '123e4567-e89b-42d3-a456-426614174000';
const ROOM_ID = `collabboard-${BOARD_ID}`;

type QueryResult = {
    data: Record<string, unknown> | null;
    error: { message: string } | null;
};

const env = {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    LIVEBLOCKS_SECRET_KEY: 'sk_test',
};

const createRequest = (roomId: unknown = ROOM_ID, token = 'valid-token') => new Request(
    'https://collabboard.example/api/liveblocks-auth',
    {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ roomId }),
    }
);

describe('liveblocks-auth', () => {
    let results: Record<string, QueryResult>;
    let queryLog: Array<{ table: string; filters: Record<string, unknown> }>;

    beforeEach(() => {
        vi.clearAllMocks();
        results = {
            boards: {
                data: { owner_id: 'owner-id', public_role: null },
                error: null,
            },
            shared_boards: {
                data: { role: 'editor' },
                error: null,
            },
            profiles: {
                data: { name: 'Editor', avatar_url: null },
                error: null,
            },
        };
        queryLog = [];

        mocks.getUser.mockResolvedValue({
            data: { user: { id: 'editor-id', email: 'editor@example.com' } },
            error: null,
        });
        mocks.authorize.mockResolvedValue({
            status: 200,
            body: JSON.stringify({ token: 'liveblocks-token' }),
        });
        mocks.prepareSession.mockReturnValue({
            allow: mocks.allow,
            authorize: mocks.authorize,
        });
        mocks.Liveblocks.mockImplementation(function MockLiveblocks() {
            return { prepareSession: mocks.prepareSession };
        });
        mocks.createClient.mockReturnValue({
            auth: { getUser: mocks.getUser },
            from: (table: string) => {
                const filters: Record<string, unknown> = {};
                const query = {
                    select: vi.fn(() => query),
                    eq: vi.fn((column: string, value: unknown) => {
                        filters[column] = value;
                        return query;
                    }),
                    maybeSingle: vi.fn(async () => {
                        queryLog.push({ table, filters: { ...filters } });
                        return results[table];
                    }),
                };
                return query;
            },
        });
    });

    it('accepts only the canonical prefixed UUID room format', () => {
        expect(parseBoardRoomId(ROOM_ID)).toEqual({ boardId: BOARD_ID, roomId: ROOM_ID });
        expect(parseBoardRoomId(BOARD_ID)).toBeNull();
        expect(parseBoardRoomId('collabboard-not-a-uuid')).toBeNull();
        expect(parseBoardRoomId({ roomId: ROOM_ID })).toBeNull();
    });

    it('queries by board UUID and authorizes the full Liveblocks room for editors', async () => {
        const response = await onRequestPost({ request: createRequest(), env });

        expect(response.status).toBe(200);
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        expect(queryLog).toContainEqual({
            table: 'boards',
            filters: { id: BOARD_ID },
        });
        expect(queryLog).toContainEqual({
            table: 'shared_boards',
            filters: { board_id: BOARD_ID, user_id: 'editor-id' },
        });
        expect(mocks.allow).toHaveBeenCalledWith(ROOM_ID, ['*:write']);
    });

    it('grants read-only room access to viewers', async () => {
        results.shared_boards = { data: { role: 'viewer' }, error: null };

        const response = await onRequestPost({ request: createRequest(), env });

        expect(response.status).toBe(200);
        expect(mocks.allow).toHaveBeenCalledWith(ROOM_ID, ['*:read']);
    });

    it('rejects malformed room IDs before querying the database', async () => {
        const response = await onRequestPost({
            request: createRequest('collabboard-not-a-uuid'),
            env,
        });

        expect(response.status).toBe(400);
        expect(mocks.createClient).not.toHaveBeenCalled();
        expect(response.headers.get('Cache-Control')).toBe('no-store');
    });

    it('fails closed when access lookups fail', async () => {
        results.boards = { data: null, error: { message: 'database unavailable' } };

        const response = await onRequestPost({ request: createRequest(), env });

        expect(response.status).toBe(500);
        expect(mocks.prepareSession).not.toHaveBeenCalled();
    });

    it('rejects users without board access', async () => {
        results.shared_boards = { data: null, error: null };

        const response = await onRequestPost({ request: createRequest(), env });

        expect(response.status).toBe(403);
        expect(mocks.prepareSession).not.toHaveBeenCalled();
    });
});
