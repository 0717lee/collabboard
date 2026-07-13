import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getSession: vi.fn(),
}));

vi.mock('@/lib/supabaseClient', () => ({
    supabase: {
        auth: {
            getSession: mocks.getSession,
        },
    },
}));

import { requestLiveblocksAuthorization } from '@/lib/liveblocksAuth';

describe('requestLiveblocksAuthorization', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        mocks.getSession.mockReset();
        mocks.getSession.mockResolvedValue({
            data: { session: { access_token: 'supabase-token' } },
            error: null,
        });
    });

    it('forwards the full room ID and current Supabase token', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(JSON.stringify({ token: 'liveblocks-token' }), { status: 200 })
        );

        await expect(
            requestLiveblocksAuthorization('collabboard-123e4567-e89b-42d3-a456-426614174000')
        ).resolves.toEqual({ token: 'liveblocks-token' });

        expect(fetchMock).toHaveBeenCalledWith('/api/liveblocks-auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer supabase-token',
            },
            body: JSON.stringify({
                roomId: 'collabboard-123e4567-e89b-42d3-a456-426614174000',
            }),
        });
    });

    it('rejects missing sessions before making a request', async () => {
        mocks.getSession.mockResolvedValueOnce({
            data: { session: null },
            error: null,
        });
        const fetchMock = vi.spyOn(globalThis, 'fetch');

        await expect(
            requestLiveblocksAuthorization('collabboard-123e4567-e89b-42d3-a456-426614174000')
        ).rejects.toThrow('Not authenticated');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects denied and malformed endpoint responses', async () => {
        vi.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(new Response('forbidden', { status: 403 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));

        await expect(
            requestLiveblocksAuthorization('collabboard-123e4567-e89b-42d3-a456-426614174000')
        ).rejects.toThrow('Liveblocks auth failed: 403');
        await expect(
            requestLiveblocksAuthorization('collabboard-123e4567-e89b-42d3-a456-426614174000')
        ).rejects.toThrow('invalid token response');
    });
});
