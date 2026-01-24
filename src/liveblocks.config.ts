import { createClient } from "@liveblocks/client";
import { createRoomContext } from "@liveblocks/react";

// Create the Liveblocks client
// In production, get your public key from https://liveblocks.io/dashboard
const client = createClient({
    // For demo purposes, we use a public key placeholder
    // Replace with your actual Liveblocks public key
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    publicApiKey: (import.meta as any).env?.VITE_LIVEBLOCKS_PUBLIC_KEY || "pk_dev_placeholder",

    // Throttle presence updates to reduce network traffic
    throttle: 100,
});

// Define types for presence and storage
export type Presence = {
    cursor: { x: number; y: number } | null;
    name: string;
    color: string;
};

export type Storage = {
    canvasData: string; // JSON stringified canvas data (Chunk 1)
    canvasData_2?: string; // Chunk 2
    canvasData_3?: string; // Chunk 3
    canvasData_4?: string; // Chunk 4
    canvasData_5?: string; // Chunk 5
    version: number;
};

export type UserMeta = {
    id: string;
    info: {
        name: string;
        color: string;
        avatar?: string;
    };
};

// Create Room context with types
export const {
    RoomProvider,
    useRoom,
    useMyPresence,
    useUpdateMyPresence,
    useOthersMapped,
    useOthers,
    useSelf,
    useStorage,
    useMutation,
    useBroadcastEvent,
    useEventListener,
} = createRoomContext<Presence, Storage, UserMeta>(client);
