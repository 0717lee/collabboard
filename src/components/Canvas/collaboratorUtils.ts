type CurrentUser = {
    id?: string | null;
    name?: string | null;
};

export type CollaboratorEntry = {
    connectionId: number;
    presence?: {
        userId?: string;
        name?: string;
        color?: string;
    } | null;
    info?: {
        id?: string;
        name?: string;
        color?: string;
        avatar?: string;
    } | null;
};

export type VisibleCollaborator = {
    connectionId: number;
    userId?: string;
    name: string;
    color: string;
    avatar?: string;
    presence?: CollaboratorEntry['presence'];
    info?: CollaboratorEntry['info'];
};

const normalizeName = (value?: string | null) => value?.trim().toLowerCase() || '';

export const getVisibleCollaborators = (
    others: readonly CollaboratorEntry[],
    currentUser?: CurrentUser | null
): VisibleCollaborator[] => {
    const seenUserIds = new Set<string>();
    const currentUserId = currentUser?.id || '';
    const currentUserName = normalizeName(currentUser?.name);

    return others.flatMap((entry) => {
        const userId = entry.presence?.userId || entry.info?.id || '';
        const name = entry.presence?.name || entry.info?.name || 'Anonymous';
        const normalizedName = normalizeName(name);

        // Hide mirror connections of the current authenticated user.
        if ((userId && userId === currentUserId) || (!userId && currentUserName && normalizedName === currentUserName)) {
            return [];
        }

        // Collapse multiple tabs/devices of the same collaborator into one visible user.
        if (userId) {
            if (seenUserIds.has(userId)) {
                return [];
            }
            seenUserIds.add(userId);
        }

        return [{
            connectionId: entry.connectionId,
            userId: userId || undefined,
            name,
            color: entry.presence?.color || entry.info?.color || '#ccc',
            avatar: entry.info?.avatar,
            presence: entry.presence,
            info: entry.info,
        }];
    });
};
