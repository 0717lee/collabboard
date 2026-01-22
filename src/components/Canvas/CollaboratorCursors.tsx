import React from 'react';
import type { Collaborator } from '@/types';
import styles from './CanvasBoard.module.css';

interface CollaboratorCursorsProps {
    collaborators: Collaborator[];
}

export const CollaboratorCursors: React.FC<CollaboratorCursorsProps> = ({
    collaborators,
}) => {
    return (
        <div className={styles.cursorOverlay}>
            {collaborators.map((collaborator) => {
                if (!collaborator.cursor || !collaborator.isOnline) return null;

                return (
                    <div
                        key={collaborator.userId}
                        className={styles.collaboratorCursor}
                        style={{
                            left: collaborator.cursor.x,
                            top: collaborator.cursor.y,
                        }}
                    >
                        <svg
                            className={styles.cursorPointer}
                            viewBox="0 0 24 24"
                            fill={collaborator.color}
                        >
                            <path d="M5.5 3.21V20.79L12.54 15.39L18.5 20.95V3.21C18.5 2.72 18.12 2.31 17.63 2.25L5.5 3.21Z" />
                            <path
                                d="M5.5 3.21V20.79L12.54 15.39L18.5 20.95V3.21C18.5 2.72 18.12 2.31 17.63 2.25L5.5 3.21Z"
                                fill={collaborator.color}
                                stroke="#fff"
                                strokeWidth="1"
                            />
                        </svg>
                        <span
                            className={styles.cursorLabel}
                            style={{ backgroundColor: collaborator.color }}
                        >
                            {collaborator.name}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};
