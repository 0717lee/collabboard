import React from 'react';
import { createClient } from '@liveblocks/client';
import { createRoomContext } from '@liveblocks/react';
import { liveblocksConfigWarning, shouldUseMockLiveblocks } from './lib/runtimeConfig';

export type Presence = {
    cursor: { x: number; y: number } | null;
    name: string;
    color: string;
};

export type Storage = {
    canvasData: string;
    canvasData_2?: string;
    canvasData_3?: string;
    canvasData_4?: string;
    canvasData_5?: string;
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

const realContext = createRoomContext<Presence, Storage, UserMeta>(createClient({
    publicApiKey: import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY || 'pk_dev_placeholder',
    throttle: 100,
}));

const mockStorage: Storage = {
    canvasData: '{}',
    canvasData_2: '',
    canvasData_3: '',
    canvasData_4: '',
    canvasData_5: '',
    version: 0,
};

const mockPresence: Presence = {
    cursor: null,
    name: 'Mock User',
    color: '#6B8068',
};

const createMockMutationHelpers = () => ({
    storage: {
        get<K extends keyof Storage>(key: K) {
            return mockStorage[key];
        },
        set<K extends keyof Storage>(key: K, value: Storage[K]) {
            mockStorage[key] = value;
        },
    },
});

if (shouldUseMockLiveblocks) {
    console.warn('E2E mock mode enabled. Using local collaboration mock.');
} else if (liveblocksConfigWarning) {
    console.warn(liveblocksConfigWarning);
}

const mockRoomProvider: typeof realContext.RoomProvider = ({ children }) => React.createElement(React.Fragment, null, children);
const mockUseRoom = (() => null) as unknown as typeof realContext.useRoom;
const mockUseMyPresence: typeof realContext.useMyPresence = () => [mockPresence, () => undefined] as never;
const useMockUpdateMyPresence: typeof realContext.useUpdateMyPresence = () => React.useCallback((nextPresence) => {
    void nextPresence;
}, []);
const mockUseOthersMapped: typeof realContext.useOthersMapped = () => [];
const mockUseOthers: typeof realContext.useOthers = () => [];
const mockUseSelf: typeof realContext.useSelf = () => null;
const mockUseStorage: typeof realContext.useStorage = ((selector: (root: Storage) => unknown) => selector(mockStorage)) as typeof realContext.useStorage;
const useMockMutation: typeof realContext.useMutation = ((callback: (context: ReturnType<typeof createMockMutationHelpers>, ...args: unknown[]) => unknown) => {
    const callbackRef = React.useRef(callback);
    callbackRef.current = callback;

    return React.useCallback((...args: unknown[]) => callbackRef.current(createMockMutationHelpers(), ...args), []);
}) as typeof realContext.useMutation;
const mockUseBroadcastEvent: typeof realContext.useBroadcastEvent = () => () => undefined;
const mockUseEventListener: typeof realContext.useEventListener = () => undefined;

const useFallbackLiveblocks = shouldUseMockLiveblocks || Boolean(liveblocksConfigWarning);

export const RoomProvider = useFallbackLiveblocks ? mockRoomProvider : realContext.RoomProvider;
export const useRoom = useFallbackLiveblocks ? mockUseRoom : realContext.useRoom;
export const useMyPresence = useFallbackLiveblocks ? mockUseMyPresence : realContext.useMyPresence;
export const useUpdateMyPresence = useFallbackLiveblocks ? useMockUpdateMyPresence : realContext.useUpdateMyPresence;
export const useOthersMapped = useFallbackLiveblocks ? mockUseOthersMapped : realContext.useOthersMapped;
export const useOthers = useFallbackLiveblocks ? mockUseOthers : realContext.useOthers;
export const useSelf = useFallbackLiveblocks ? mockUseSelf : realContext.useSelf;
export const useStorage = useFallbackLiveblocks ? mockUseStorage : realContext.useStorage;
export const useMutation = useFallbackLiveblocks ? useMockMutation : realContext.useMutation;
export const useBroadcastEvent = useFallbackLiveblocks ? mockUseBroadcastEvent : realContext.useBroadcastEvent;
export const useEventListener = useFallbackLiveblocks ? mockUseEventListener : realContext.useEventListener;
