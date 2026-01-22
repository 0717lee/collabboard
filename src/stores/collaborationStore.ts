import { create } from 'zustand';
import type { Collaborator } from '@/types';

interface CollaborationState {
    collaborators: Collaborator[];
    isConnected: boolean;
    connectionError: string | null;

    connect: (boardId: string) => void;
    disconnect: () => void;
    updateCursor: (userId: string, position: { x: number; y: number }) => void;
    addCollaborator: (collaborator: Collaborator) => void;
    removeCollaborator: (userId: string) => void;
    broadcastAction: (action: CollaborationAction) => void;
}

export interface CollaborationAction {
    type: 'object:added' | 'object:modified' | 'object:removed' | 'cursor:moved';
    userId: string;
    payload: unknown;
    timestamp: number;
}

// Mock WebSocket connection
class MockWebSocket {
    private listeners: Map<string, ((data: unknown) => void)[]> = new Map();
    private isOpen = false;

    connect(): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(() => {
                this.isOpen = true;
                this.emit('open', {});
                resolve();
            }, 500);
        });
    }

    disconnect(): void {
        this.isOpen = false;
        this.emit('close', {});
    }

    send(data: CollaborationAction): void {
        if (!this.isOpen) return;

        // Simulate echo back for demo purposes
        setTimeout(() => {
            this.emit('message', data);
        }, 50);
    }

    on(event: string, callback: (data: unknown) => void): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(callback);
    }

    private emit(event: string, data: unknown): void {
        const callbacks = this.listeners.get(event) || [];
        callbacks.forEach((cb) => cb(data));
    }
}

const mockWs = new MockWebSocket();

// Generate random color for collaborator
const generateColor = (): string => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
    return colors[Math.floor(Math.random() * colors.length)];
};

export const useCollaborationStore = create<CollaborationState>((set, get) => ({
    collaborators: [],
    isConnected: false,
    connectionError: null,

    connect: async (boardId: string) => {
        try {
            await mockWs.connect();

            set({
                isConnected: true,
                connectionError: null,
                collaborators: [],
            });

            console.log(`Connected to board: ${boardId}`);
        } catch {
            set({ connectionError: '连接失败，请稍后重试' });
        }
    },

    disconnect: () => {
        mockWs.disconnect();
        set({
            isConnected: false,
            collaborators: [],
        });
    },

    updateCursor: (userId: string, position: { x: number; y: number }) => {
        set((state) => ({
            collaborators: state.collaborators.map((c) =>
                c.userId === userId ? { ...c, cursor: position } : c
            ),
        }));
    },

    addCollaborator: (collaborator: Collaborator) => {
        set((state) => ({
            collaborators: [...state.collaborators, { ...collaborator, color: generateColor() }],
        }));
    },

    removeCollaborator: (userId: string) => {
        set((state) => ({
            collaborators: state.collaborators.filter((c) => c.userId !== userId),
        }));
    },

    broadcastAction: (action: CollaborationAction) => {
        mockWs.send(action);
    },
}));
