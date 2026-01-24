import React from 'react';
import { useOthers } from '@/liveblocks.config';
import styles from './CanvasBoard.module.css';

// Cursor colors for different users
const COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#FF9F43'
];

export const LiveblocksCursors: React.FC = () => {
    const others = useOthers();

    return (
        <>
            {others.map(({ connectionId, presence, info }) => {
                if (!presence?.cursor) return null;

                const color = presence.color || info?.color || COLORS[connectionId % COLORS.length];
                const name = presence.name || info?.name || `User ${connectionId}`;

                return (
                    <div
                        key={connectionId}
                        className={styles.liveCursor}
                        style={{
                            transform: `translate(${presence.cursor.x}px, ${presence.cursor.y}px)`,
                        }}
                    >
                        <svg
                            width="24"
                            height="36"
                            viewBox="0 0 24 36"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                d="M5.65376 12.4563L1.37766 1.04425C1.16941 0.536889 1.77313 0.0969548 2.27032 0.362641L22.1768 11.5478C22.7157 11.8378 22.5988 12.6338 21.9949 12.776L13.4319 14.7818C13.2002 14.8364 13.0115 15.0056 12.9318 15.2299L8.97649 25.9659C8.76622 26.5089 8.00277 26.4653 7.85439 25.9035L5.65376 12.4563Z"
                                fill={color}
                            />
                        </svg>
                        <div
                            className={styles.cursorLabel}
                            style={{ backgroundColor: color }}
                        >
                            {name}
                        </div>
                    </div>
                );
            })}
        </>
    );
};

export default LiveblocksCursors;
