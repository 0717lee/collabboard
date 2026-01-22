import React from 'react';
import { useParams } from 'react-router-dom';
import { LiveblocksRoom } from './LiveblocksRoom';
import CanvasBoardInner from './CanvasBoardInner';

/**
 * CanvasBoard wrapped with Liveblocks for real-time collaboration.
 * This component handles the room connection and provides the context.
 */
const CanvasBoard: React.FC = () => {
    const { boardId } = useParams<{ boardId: string }>();

    if (!boardId) {
        return <div>Board ID not found</div>;
    }

    return (
        <LiveblocksRoom roomId={boardId}>
            <CanvasBoardInner />
        </LiveblocksRoom>
    );
};

export default CanvasBoard;
