import React, { ReactNode } from 'react';
import { RoomProvider } from '@/liveblocks.config';
import { useAuthStore } from '@/stores/authStore';

interface LiveblocksRoomProps {
    roomId: string;
    children: ReactNode;
}

// Generate a random color for the user
const generateColor = (): string => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
    return colors[Math.floor(Math.random() * colors.length)];
};

export const LiveblocksRoom: React.FC<LiveblocksRoomProps> = ({ roomId, children }) => {
    const { user } = useAuthStore();

    const userColor = React.useMemo(() => generateColor(), []);

    return (
        <RoomProvider
            id={`collabboard-${roomId}`}
            initialPresence={{
                cursor: null,
                name: user?.name || 'Anonymous',
                color: userColor,
            }}
            initialStorage={{
                canvasData: '{}',
                canvasData_2: '',
                canvasData_3: '',
                canvasData_4: '',
                canvasData_5: '',
                version: 0,
            }}
        >
            {children}
        </RoomProvider>
    );
};

export default LiveblocksRoom;
