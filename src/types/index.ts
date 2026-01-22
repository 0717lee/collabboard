// Type definitions
export interface User {
    id: string;
    email: string;
    name: string;
    avatar?: string;
    createdAt: string;
}

export interface Board {
    id: string;
    name: string;
    ownerId: string;
    thumbnail?: string;
    createdAt: string;
    updatedAt: string;
    data: string; // JSON string of canvas data
}

export interface CanvasObject {
    id: string;
    type: 'rect' | 'circle' | 'line' | 'text' | 'path' | 'image' | 'sticky' | 'chart';
    data: Record<string, unknown>;
}

export interface Collaborator {
    userId: string;
    name: string;
    avatar?: string;
    color: string;
    cursor?: { x: number; y: number };
    isOnline: boolean;
}

export interface ChartData {
    type: 'bar' | 'line' | 'pie';
    title: string;
    labels: string[];
    datasets: {
        label: string;
        data: number[];
        backgroundColor?: string[];
    }[];
}

export interface ToolType {
    id: string;
    name: string;
    icon: string;
    cursor?: string;
}

export interface Theme {
    mode: 'light' | 'dark';
    primaryColor: string;
}

export interface UserSettings {
    theme: Theme;
    autoSave: boolean;
    showGrid: boolean;
    snapToGrid: boolean;
}
