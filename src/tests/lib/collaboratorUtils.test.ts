import { describe, expect, it } from 'vitest';
import { getVisibleCollaborators } from '@/components/Canvas/collaboratorUtils';

describe('getVisibleCollaborators', () => {
    it('filters out duplicate connections from the current user', () => {
        const collaborators = getVisibleCollaborators(
            [
                {
                    connectionId: 1,
                    presence: { userId: 'user-1', name: 'zhiqian', color: '#f66' },
                },
                {
                    connectionId: 2,
                    presence: { userId: 'user-2', name: 'Alice', color: '#6cf' },
                },
            ],
            { id: 'user-1', name: 'zhiqian' }
        );

        expect(collaborators).toHaveLength(1);
        expect(collaborators[0]?.name).toBe('Alice');
    });

    it('collapses multiple connections from the same collaborator user id', () => {
        const collaborators = getVisibleCollaborators(
            [
                {
                    connectionId: 10,
                    presence: { userId: 'user-2', name: 'Alice', color: '#6cf' },
                },
                {
                    connectionId: 11,
                    presence: { userId: 'user-2', name: 'Alice', color: '#6cf' },
                },
            ],
            { id: 'user-1', name: 'zhiqian' }
        );

        expect(collaborators).toHaveLength(1);
        expect(collaborators[0]?.connectionId).toBe(10);
    });

    it('uses name fallback to hide stale same-user tabs without presence user id', () => {
        const collaborators = getVisibleCollaborators(
            [
                {
                    connectionId: 3,
                    presence: { name: 'zhiqian', color: '#f66' },
                },
                {
                    connectionId: 4,
                    presence: { name: 'Bob', color: '#9c6' },
                },
            ],
            { id: 'user-1', name: 'zhiqian' }
        );

        expect(collaborators).toHaveLength(1);
        expect(collaborators[0]?.name).toBe('Bob');
    });
});
