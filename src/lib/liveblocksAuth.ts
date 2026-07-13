import { supabase } from '@/lib/supabaseClient';

export const requestLiveblocksAuthorization = async (
    room?: string
): Promise<{ token: string }> => {
    if (!room) {
        throw new Error('No room specified');
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
        throw new Error('Not authenticated');
    }

    const response = await fetch('/api/liveblocks-auth', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ roomId: room }),
    });

    if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`Liveblocks auth failed: ${response.status} ${errorBody}`);
    }

    const result = await response.json() as { token?: unknown };
    if (typeof result.token !== 'string' || !result.token) {
        throw new Error('Liveblocks auth returned an invalid token response');
    }

    return { token: result.token };
};
