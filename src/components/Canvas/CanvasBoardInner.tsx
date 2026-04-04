/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
    Alert,
    Button,
    ColorPicker,
    Divider,
    Dropdown,
    Input,
    Layout,
    Modal,
    Tooltip,
    Typography,
    message,
} from 'antd';
import {
    ArrowLeftOutlined,
    BarChartOutlined,
    BorderOutlined,
    CheckOutlined,
    ClearOutlined,
    CopyOutlined,
    DeleteOutlined,
    DownloadOutlined,
    EditOutlined,
    EyeOutlined,
    FileTextOutlined,
    FontSizeOutlined,
    HistoryOutlined,
    LockOutlined,
    MenuOutlined,
    MinusOutlined,
    RedoOutlined,
    SelectOutlined,
    ShareAltOutlined,
    UndoOutlined,
    ZoomInOutlined,
    ZoomOutOutlined,
} from '@ant-design/icons';
import LZString from 'lz-string';
import { useAuthStore } from '@/stores/authStore';
import { useBoardHistoryStore } from '@/stores/boardHistoryStore';
import { useBoardLibraryStore } from '@/stores/boardLibraryStore';
import { useBoardStore } from '@/stores/boardStore';
import { useLanguageStore } from '@/stores/languageStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { buildBoardShareLink, decompressSnapshotData, extractBoardRoleFromUrl } from '@/lib/boardUtils';
import { useMutation, useOthers, useStorage, useUpdateMyPresence } from '@/liveblocks.config';
import { createStickyNote, findNearestAnchor, getAnchorPoints, handleStickyNoteDoubleClick, initAligningGuidelines } from './canvasUtils';
import { CircularSlider } from './CircularSlider';
import { LiveblocksCursors } from './LiveblocksCursors';
import { VersionHistoryModal } from './VersionHistoryModal';
import styles from './CanvasBoard.module.css';
import type { Board, BoardRole, BoardSnapshot } from '@/types';

const LazyChartWidget = lazy(() => import('@/components/Charts/ChartWidget'));

 
let fabric: any = null;

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

type ToolType = 'select' | 'draw' | 'eraser' | 'rect' | 'circle' | 'line' | 'text' | 'stickyNote';

interface HistoryState {
    past: string[];
    future: string[];
}

const GRID_SIZE = 24;
const MAX_SYNC_SIZE = 400000;
const AUTO_SAVE_INTERVAL_MS = 5000;
const AUTO_SNAPSHOT_INTERVAL_MS = 60000;
const EMPTY_SNAPSHOTS: BoardSnapshot[] = [];

const decodeCanvasData = (data: string | null) => {
    if (!data) return null;

    try {
        const trimmed = data.trim();

        if (trimmed.startsWith('{')) {
            return {
                json: trimmed,
                parsed: JSON.parse(trimmed),
            };
        }

        const decompressed = LZString.decompressFromBase64(data);
        if (decompressed) {
            return {
                json: decompressed,
                parsed: JSON.parse(decompressed),
            };
        }
    } catch (error) {
        console.error('Failed to decode canvas data', error);
    }

    return null;
};

const CanvasBoardInner: React.FC = () => {
    const { boardId } = useParams<{ boardId: string }>();
    const location = useLocation();
    const navigate = useNavigate();

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
     
    const fabricRef = useRef<any>(null);

    const { user } = useAuthStore();
    const {
        boards,
        sharedBoards,
        currentBoard,
        fetchBoard,
        saveCanvasData,
        setCurrentBoard,
    } = useBoardStore();
    const { settings } = useSettingsStore();
    const { language } = useLanguageStore();
    const { entries, setRole, setThumbnail, touchBoard } = useBoardLibraryStore();
    const createSnapshot = useBoardHistoryStore((state) => state.createSnapshot);
    const removeSnapshot = useBoardHistoryStore((state) => state.removeSnapshot);
    const snapshotMap = useBoardHistoryStore((state) => state.snapshots);
    const updateMyPresence = useUpdateMyPresence();
    const others = useOthers();

    const isEn = language === 'en-US';

    const [activeTool, setActiveTool] = useState<ToolType>('select');
    const [brushColor, setBrushColor] = useState('#000000');
    const [brushWidth, setBrushWidth] = useState(3);
    const [zoom, setZoom] = useState(100);
    const [history, setHistory] = useState<HistoryState>({ past: [], future: [] });
    const [showChartModal, setShowChartModal] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showVersionModal, setShowVersionModal] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);
    const [fabricLoaded, setFabricLoaded] = useState(false);
    const [canvasReady, setCanvasReady] = useState(false);
    const [shareRole, setShareRole] = useState<'editor' | 'viewer'>('editor');
    const [selectedObjectCount, setSelectedObjectCount] = useState(0);

    const historyRef = useRef<HistoryState>({ past: [], future: [] });
    const presentStateRef = useRef('');
    const latestSerializedRef = useRef('');
    const lastPersistedStateRef = useRef('');
    const lastSyncedDataRef = useRef<string | null>(null);
    const isRemoteUpdateRef = useRef(false);
    const isRestoringRef = useRef(false);
    const dirtyRef = useRef(false);
    const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const thumbnailTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastAutoSnapshotAtRef = useRef(0);
    const lastMouseEventRef = useRef<any>(null);
    const hoveredAnchorRef = useRef<{ obj: any; anchor: string; point: { x: number; y: number } } | null>(null);
    const activeLineRef = useRef<any>(null);
    const isDrawingLineRef = useRef(false);
    const clipboardRef = useRef<any>(null);


    const sharedRoleFromUrl = useMemo(
        () => extractBoardRoleFromUrl(location.search),
        [location.search]
    );
    const snapshots = useMemo(
        () => (boardId ? snapshotMap[boardId] || EMPTY_SNAPSHOTS : EMPTY_SNAPSHOTS),
        [boardId, snapshotMap]
    );
    const displayBoardName = useMemo(() => {
        if (currentBoard?.name) return currentBoard.name;
        if (!boardId) return '';

        const boardSummary = [...boards, ...sharedBoards].find((item) => item.id === boardId);
        return boardSummary?.name || '';
    }, [boardId, boards, currentBoard?.name, sharedBoards]);
    const cachedRole = boardId ? entries[boardId]?.role : undefined;
    const resolvedRole: BoardRole = currentBoard?.ownerId === user?.id
        ? 'owner'
        : sharedRoleFromUrl || cachedRole || currentBoard?.accessRole || 'editor';
    const isReadOnly = resolvedRole === 'viewer';
    const gridPixelSize = `${Math.max((GRID_SIZE * zoom) / 100, 12)}px`;

    const shareLink = useMemo(() => {
        if (!boardId || typeof window === 'undefined') return '';
        return buildBoardShareLink(window.location.origin, boardId, shareRole);
    }, [boardId, shareRole]);
    const shareRoleMeta = useMemo(() => {
        if (shareRole === 'editor') {
            return {
                icon: <EditOutlined />,
                title: isEn ? 'Can edit' : '可编辑',
                description: isEn
                    ? 'Collaborators can draw, move objects, export, and create version snapshots.'
                    : '协作者可以绘制、移动对象、导出内容，并创建版本快照。',
                accent: styles.shareModeEditor,
            };
        }

        return {
            icon: <EyeOutlined />,
            title: isEn ? 'View only' : '只读',
            description: isEn
                ? 'Collaborators can inspect, zoom, export, and browse snapshots, but editing tools stay locked.'
                : '协作者可以查看、缩放、导出和浏览快照，但编辑工具会保持锁定。',
            accent: styles.shareModeViewer,
        };
    }, [isEn, shareRole]);

    const chunk1 = useStorage((root) => root.canvasData);
    const chunk2 = useStorage((root) => root.canvasData_2);
    const chunk3 = useStorage((root) => root.canvasData_3);
    const chunk4 = useStorage((root) => root.canvasData_4);
    const chunk5 = useStorage((root) => root.canvasData_5);
    const canvasData = (chunk1 || '') + (chunk2 || '') + (chunk3 || '') + (chunk4 || '') + (chunk5 || '');

    const updateStorage = useMutation(({ storage }, compressedData: string) => {
        const chunkSize = 80000;
        const totalLength = compressedData.length;

        storage.set('canvasData', compressedData.slice(0, chunkSize));

        if (totalLength > chunkSize) {
            storage.set('canvasData_2', compressedData.slice(chunkSize, chunkSize * 2));
        } else if (storage.get('canvasData_2')) {
            storage.set('canvasData_2', '');
        }

        if (totalLength > chunkSize * 2) {
            storage.set('canvasData_3', compressedData.slice(chunkSize * 2, chunkSize * 3));
        } else if (storage.get('canvasData_3')) {
            storage.set('canvasData_3', '');
        }

        if (totalLength > chunkSize * 3) {
            storage.set('canvasData_4', compressedData.slice(chunkSize * 3, chunkSize * 4));
        } else if (storage.get('canvasData_4')) {
            storage.set('canvasData_4', '');
        }

        if (totalLength > chunkSize * 4) {
            storage.set('canvasData_5', compressedData.slice(chunkSize * 4, chunkSize * 5));
        } else if (storage.get('canvasData_5')) {
            storage.set('canvasData_5', '');
        }
    }, []);

    const resetHistory = useCallback((present: string) => {
        presentStateRef.current = present;
        historyRef.current = { past: [], future: [] };
        setHistory({ ...historyRef.current });
    }, []);

    const commitHistory = useCallback((nextState: string) => {
        if (!presentStateRef.current) {
            presentStateRef.current = nextState;
            setHistory({ ...historyRef.current });
            return;
        }

        if (nextState === presentStateRef.current) {
            return;
        }

        historyRef.current = {
            past: [...historyRef.current.past.slice(-19), presentStateRef.current],
            future: [],
        };
        presentStateRef.current = nextState;
        setHistory({ ...historyRef.current });
    }, []);

    const syncCanvasState = useCallback((json: string) => {
        const compressed = LZString.compressToBase64(json);

        if (compressed.length > MAX_SYNC_SIZE) {
            message.warning(isEn ? 'Canvas too complex. Please simplify.' : '画布内容过多无法同步，请简化内容。');
            return false;
        }

        lastSyncedDataRef.current = compressed;
        updateStorage(compressed);
        return true;
    }, [isEn, updateStorage]);

    const createThumbnail = useCallback(() => {
        if (!fabricRef.current || !boardId) return;

        try {
            const thumbnail = fabricRef.current.toDataURL({
                format: 'png',
                multiplier: 0.18,
            });

            if (thumbnail.length < 220000) {
                setThumbnail(boardId, thumbnail);
            }
        } catch (error) {
            console.warn('Unable to create thumbnail', error);
        }
    }, [boardId, setThumbnail]);

    const scheduleThumbnailCapture = useCallback(() => {
        if (thumbnailTimeoutRef.current) {
            clearTimeout(thumbnailTimeoutRef.current);
        }

        thumbnailTimeoutRef.current = setTimeout(() => {
            createThumbnail();
        }, 600);
    }, [createThumbnail]);

    const applyCanvasState = useCallback(async (
        json: string,
        options?: {
            resetHistory?: boolean;
            markPersisted?: boolean;
            sync?: boolean;
            markDirty?: boolean;
            suppressEvents?: boolean;
        }
    ) => {
        if (!fabricRef.current) return;

        isRestoringRef.current = true;
        isRemoteUpdateRef.current = options?.suppressEvents ?? false;

        try {
            await fabricRef.current.loadFromJSON(JSON.parse(json));
            fabricRef.current.requestRenderAll();

            latestSerializedRef.current = json;

            if (options?.resetHistory) {
                resetHistory(json);
            }

            if (options?.markPersisted) {
                lastPersistedStateRef.current = json;
                dirtyRef.current = false;
            }

            if (options?.markDirty) {
                dirtyRef.current = true;
            }

            if (options?.sync) {
                syncCanvasState(json);
            }

            scheduleThumbnailCapture();
        } finally {
            isRemoteUpdateRef.current = false;
            isRestoringRef.current = false;
        }
    }, [resetHistory, scheduleThumbnailCapture, syncCanvasState]);

    const createBoardSnapshot = useCallback((source: 'manual' | 'auto') => {
        if (!boardId || !fabricRef.current) return null;

        const data = latestSerializedRef.current || JSON.stringify(fabricRef.current.toJSON());
        const createdAt = new Date().toISOString();
        const label = source === 'manual'
            ? `${isEn ? 'Snapshot' : '快照'} ${snapshots.length + 1}`
            : `${isEn ? 'Auto Snapshot' : '自动快照'} ${new Date(createdAt).toLocaleTimeString(isEn ? 'en-US' : 'zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
            })}`;

        return createSnapshot({
            boardId,
            name: label,
            data,
            source,
            thumbnail: entries[boardId]?.thumbnail,
            createdAt,
        });
    }, [boardId, createSnapshot, entries, isEn, snapshots.length]);

    const resolveBoard = useCallback(async () => {
        if (!boardId) return null;

        let board = [...boards, ...sharedBoards].find((item) => item.id === boardId) || null;

        if (!board || !board.data) {
            const fetchedBoard = await fetchBoard(boardId);
            if (fetchedBoard) {
                board = fetchedBoard;
            }
        }

        if (!board) return null;

        const accessRole: BoardRole = board.ownerId === user?.id
            ? 'owner'
            : sharedRoleFromUrl || cachedRole || board.accessRole || 'editor';

        const normalizedBoard: Board = {
            ...board,
            accessRole,
            source: accessRole === 'owner' ? 'owned' : 'shared',
        };

        setCurrentBoard(normalizedBoard);
        touchBoard(normalizedBoard, accessRole);

        if (accessRole !== 'owner') {
            setRole(boardId, accessRole);
        }

        return normalizedBoard;
    }, [boardId, boards, cachedRole, fetchBoard, setCurrentBoard, setRole, sharedBoards, sharedRoleFromUrl, touchBoard, user?.id]);

    const processLocalCanvasChange = useCallback(() => {
        if (!fabricRef.current || isRemoteUpdateRef.current || isRestoringRef.current || isReadOnly) {
            return;
        }

        if (syncTimeoutRef.current) {
            clearTimeout(syncTimeoutRef.current);
        }

        syncTimeoutRef.current = setTimeout(() => {
            if (!fabricRef.current) return;

            const json = JSON.stringify(fabricRef.current.toJSON());
            latestSerializedRef.current = json;
            dirtyRef.current = true;
            commitHistory(json);
            syncCanvasState(json);
            scheduleThumbnailCapture();
        }, 300);
    }, [commitHistory, isReadOnly, scheduleThumbnailCapture, syncCanvasState]);

    const snapCoordinate = useCallback((value: number) => Math.round(value / GRID_SIZE) * GRID_SIZE, []);

    const snapObjectToGrid = useCallback((target?: { set: (key: string, value: number) => void; setCoords?: () => void; left?: number; top?: number; x1?: number; y1?: number; x2?: number; y2?: number; type?: string }) => {
        if (!settings.snapToGrid || !target) return;

        if (typeof target.left === 'number') target.set('left', snapCoordinate(target.left));
        if (typeof target.top === 'number') target.set('top', snapCoordinate(target.top));
        if (target.type === 'line') {
            if (typeof target.x1 === 'number') target.set('x1', snapCoordinate(target.x1));
            if (typeof target.y1 === 'number') target.set('y1', snapCoordinate(target.y1));
            if (typeof target.x2 === 'number') target.set('x2', snapCoordinate(target.x2));
            if (typeof target.y2 === 'number') target.set('y2', snapCoordinate(target.y2));
        }
        target.setCoords?.();
    }, [settings.snapToGrid, snapCoordinate]);

    const persistCurrentCanvas = useCallback(async () => {
        if (!boardId || !currentBoard || !latestSerializedRef.current) return;

        if (latestSerializedRef.current === lastPersistedStateRef.current) {
            dirtyRef.current = false;
            return;
        }

        await saveCanvasData(boardId, latestSerializedRef.current);
        lastPersistedStateRef.current = latestSerializedRef.current;
        dirtyRef.current = false;
    }, [boardId, currentBoard, saveCanvasData]);

    useEffect(() => {
        import('fabric').then((module) => {
            fabric = module;
            setFabricLoaded(true);
        });
    }, []);

    useEffect(() => {
        if (!canvasRef.current || !containerRef.current || !fabricLoaded || !fabric || !boardId) return;

        const container = containerRef.current;
        fabric.Object.NUM_FRACTION_DIGITS = 2;

        const canvas = new fabric.Canvas(canvasRef.current, {
            width: container.clientWidth,
            height: container.clientHeight,
            backgroundColor: 'transparent',
            selection: true,
            preserveObjectStacking: true,
        });

        fabricRef.current = canvas;
        setCanvasReady(true);
        initAligningGuidelines(canvas);

        // Global Locking Visuals
        if (!fabric.Object.prototype._renderOriginal) {
            fabric.Object.prototype._renderOriginal = fabric.Object.prototype.render;
            fabric.Object.prototype.render = function (ctx: CanvasRenderingContext2D) {
                this._renderOriginal(ctx);
                if (this.data?.locked) {
                    ctx.save();
                    // Draw in local coordinates. 0,0 is the object center in Fabric
                    const halfW = (this.width * this.scaleX) / 2;
                    const halfH = (this.height * this.scaleY) / 2;
                    ctx.font = '16px serif';
                    ctx.fillStyle = '#000';
                    ctx.fillText('🔒', halfW - 22, -halfH + 24);
                    ctx.restore();
                }
            };
        }

        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        canvas.freeDrawingBrush.color = brushColor;
        canvas.freeDrawingBrush.width = brushWidth;
        canvas.freeDrawingBrush.decimate = 5;

        const loadBoardData = async () => {
            const board = await resolveBoard();
            if (!board) return;

            const liveblocksState = decodeCanvasData(canvasData);
            const boardState = decodeCanvasData(board.data || '');

            if (liveblocksState?.parsed?.objects) {
                lastSyncedDataRef.current = canvasData;
                await applyCanvasState(liveblocksState.json, {
                    resetHistory: true,
                    markPersisted: true,
                    suppressEvents: true,
                });
                return;
            }

            if (boardState?.parsed?.objects) {
                await applyCanvasState(boardState.json, {
                    resetHistory: true,
                    markPersisted: true,
                    suppressEvents: true,
                });

                syncCanvasState(boardState.json);
                return;
            }

            const emptyJson = JSON.stringify(canvas.toJSON());
            latestSerializedRef.current = emptyJson;
            lastPersistedStateRef.current = emptyJson;
            resetHistory(emptyJson);
            scheduleThumbnailCapture();
        };

        const resizeCanvas = () => {
            const width = container.clientWidth;
            const height = container.clientHeight;

            if (width > 0 && height > 0) {
                canvas.setDimensions({ width, height });
                canvas.requestRenderAll();
            }
        };

        const updateConnectors = (obj: any) => {
            const canvas = fabricRef.current;
            if (!canvas) return;
            const objId = obj.data?.id;
            if (!objId) return;

            const connectors = canvas.getObjects().filter((o: any) => o.data?.type === 'connector');
            connectors.forEach((connector: any) => {
                if (connector.data.start?.id === objId) {
                    const anchors = getAnchorPoints(obj);
                    const point = (anchors as any)[connector.data.start.anchor];
                    connector.set({ x1: point.x, y1: point.y });
                }
                if (connector.data.end?.id === objId) {
                    const anchors = getAnchorPoints(obj);
                    const point = (anchors as any)[connector.data.end.anchor];
                    connector.set({ x2: point.x, y2: point.y });
                }
                connector.setCoords();
            });
        };

        const handleObjectMoving = ({ target }: any) => {
            if (!target) return;
            snapObjectToGrid(target);
            updateConnectors(target);
        };
        
        const handleObjectScaling = ({ target }: any) => {
            if (!target) return;
            updateConnectors(target);
        };

        const handleModification = () => {
            processLocalCanvasChange();
        };
        const updateSelectionState = () => {
            setSelectedObjectCount(canvas.getActiveObjects().length);
        };

        // Panning state
        let isDragging = false;
        let lastPosX = 0;
        let lastPosY = 0;

         
        const handleMouseMove = (options: any) => {
            if (isDragging) {
                const e = options.e;
                const vpt = canvas.viewportTransform;
                if (!vpt) return;
                vpt[4] += e.clientX - lastPosX;
                vpt[5] += e.clientY - lastPosY;
                canvas.requestRenderAll();
                lastPosX = e.clientX;
                lastPosY = e.clientY;
            } else if (options.pointer) {
                updateMyPresence({ cursor: options.pointer });
                lastMouseEventRef.current = options;

                if (activeTool === 'line' && fabricRef.current) {
                    const canvas = fabricRef.current;
                    const pointer = options.pointer;
                    
                    if (isDrawingLineRef.current && activeLineRef.current) {
                        // Update line end position
                        let endX = pointer.x;
                        let endY = pointer.y;
                        
                        // Try to find a target anchor for snapping while drawing
                        const nearest = findNearestAnchor(pointer, canvas.getObjects(), 30);
                        if (nearest && nearest.obj !== activeLineRef.current && nearest.obj.data?.id !== activeLineRef.current.data?.start?.id) {
                            endX = nearest.point.x;
                            endY = nearest.point.y;
                            hoveredAnchorRef.current = nearest;
                        } else {
                            hoveredAnchorRef.current = null;
                        }
                        
                        activeLineRef.current.set({ x2: endX, y2: endY });
                        canvas.requestRenderAll();
                    } else {
                        // Just hovering - find nearest anchor to highlight
                        const nearest = findNearestAnchor(pointer, canvas.getObjects(), 30);
                        if (nearest) {
                            hoveredAnchorRef.current = nearest;
                            canvas.requestRenderAll();
                        } else if (hoveredAnchorRef.current) {
                            hoveredAnchorRef.current = null;
                            canvas.requestRenderAll();
                        }
                    }
                }
            }
        };

         
        const handleMouseDown = (opt: any) => {
            const evt = opt.e;
            if (evt.altKey || evt.button === 1) { // Alt+Drag or Middle-Click
                isDragging = true;
                canvas.selection = false;
                lastPosX = evt.clientX;
                lastPosY = evt.clientY;
            }
        };

        const handleMouseUp = (opt: any) => {
            if (isDragging) {
                isDragging = false;
                canvas.selection = true;
            }

            if (isDrawingLineRef.current && activeLineRef.current) {
                const canvas = fabricRef.current;
                const pointer = canvas.getPointer(opt.e);
                const nearest = findNearestAnchor(pointer, canvas.getObjects(), 30);
                
                if (nearest && nearest.obj !== activeLineRef.current && nearest.obj.data?.id !== activeLineRef.current.data?.start?.id) {
                    // Snap and finalize
                    activeLineRef.current.set({
                        x2: nearest.point.x,
                        y2: nearest.point.y,
                        data: {
                            ...activeLineRef.current.data,
                            end: { id: nearest.obj.data?.id, anchor: nearest.anchor }
                        }
                    });
                } else {
                    // Fallback to static line or remove if too short? 
                    // Let's keep it but without end binding
                }
                
                isDrawingLineRef.current = false;
                activeLineRef.current = null;
                setActiveTool('select');
                canvas.requestRenderAll();
                processLocalCanvasChange();
            }
        };

         
        const handleMouseWheel = (opt: any) => {
            const delta = opt.e.deltaY;
            let currentZoom = canvas.getZoom();
            currentZoom *= 0.999 ** delta;
            if (currentZoom > 2) currentZoom = 2;
            if (currentZoom < 0.25) currentZoom = 0.25;
            canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, currentZoom);
            setZoom(Math.round(currentZoom * 100));
            opt.e.preventDefault();
            opt.e.stopPropagation();
        };

        const handleAfterRender = () => {
            if (activeTool !== 'line' || !fabricRef.current) return;
            const canvas = fabricRef.current;
            const ctx = canvas.getContext();
            const vpt = canvas.viewportTransform;
            if (!vpt) return;
            
            // Re-render anchor highlights if line tool is active
            const mouseEvent = lastMouseEventRef.current;
            if (!mouseEvent) return;
            
            const target = canvas.findTarget(mouseEvent.e);
            if (target && !target.isType('line') && !target.isType('guide') && (target.selectable !== false)) {
                const anchors = getAnchorPoints(target);
                ctx.save();
                for (const [key, point] of Object.entries(anchors)) {
                    const isHovered = hoveredAnchorRef.current?.obj === target && hoveredAnchorRef.current?.anchor === key;
                    
                    const screenX = point.x * vpt[0] + vpt[4];
                    const screenY = point.y * vpt[3] + vpt[5];
                    
                    ctx.beginPath();
                    ctx.arc(screenX, screenY, isHovered ? 6 : 4, 0, Math.PI * 2);
                    ctx.fillStyle = isHovered ? '#52c41a' : 'rgba(82,196,26,0.3)';
                    ctx.fill();
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                }
                ctx.restore();
            }
        };

        canvas.on('object:moving', handleObjectMoving);
        canvas.on('object:scaling', handleObjectScaling);
        canvas.on('object:modified', handleModification);
        canvas.on('object:added', handleModification);
        canvas.on('object:removed', handleModification);
        canvas.on('mouse:move', handleMouseMove);
        canvas.on('mouse:down', handleMouseDown);
        canvas.on('mouse:up', handleMouseUp);
        canvas.on('mouse:wheel', handleMouseWheel);
        canvas.on('after:render', handleAfterRender);
        const handleMouseOut = () => updateMyPresence({ cursor: null });
        canvas.on('mouse:out', handleMouseOut);
         
        const handleDblClick = (opt: any) => handleStickyNoteDoubleClick(canvas, opt);
        canvas.on('mouse:dblclick', handleDblClick);

        // P2: Keyboard Shortcuts
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
            if (canvas.getActiveObject()?.isEditing) return;

            const key = e.key.toLowerCase();
            const hasModifier = e.ctrlKey || e.metaKey;

            // Modifier shortcuts take priority over tool shortcuts
            if (hasModifier) {
                switch (key) {
                    case 'c': e.preventDefault(); copy(); return;
                    case 'v': e.preventDefault(); paste(); return;
                    case 'z':
                        e.preventDefault();
                        // undo/redo handled by separate useEffect
                        return;
                }
            }

            switch (key) {
                case 'v': setActiveTool('select'); break;
                case 'r': setActiveTool('rect'); break;
                case 'o': setActiveTool('circle'); break;
                case 'l': setActiveTool('line'); break;
                case 't': setActiveTool('text'); break;
                case 's': setActiveTool('stickyNote'); break;
                case 'backspace':
                case 'delete': {
                    const activeObjects = canvas.getActiveObjects();
                    if (activeObjects.length > 0) {
                        canvas.discardActiveObject();
                        activeObjects.forEach((obj: any) => canvas.remove(obj));
                        canvas.requestRenderAll();
                    }
                    break;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        
        // P1: Image Paste Support (Already added, making sure to remove in cleanup)
        const handlePaste = async (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items || isReadOnly) return;
            const canvas = fabricRef.current;
            if (!canvas) return;
            
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const blob = items[i].getAsFile();
                    if (!blob) continue;
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                        const dataUrl = event.target?.result as string;
                        const img = await fabric.FabricImage.fromURL(dataUrl);
                        img.scale(0.5);
                        canvas.centerObject(img);
                        canvas.add(img);
                        canvas.setActiveObject(img);
                        canvas.requestRenderAll();
                        processLocalCanvasChange();
                    };
                    reader.readAsDataURL(blob);
                }
            }
        };

        // P1: Image Drag and Drop Support
        const handleDrop = async (e: DragEvent) => {
            e.preventDefault();
            if (isReadOnly) return;
            const files = e.dataTransfer?.files;
            if (!files) return;

            for (let i = 0; i < files.length; i++) {
                if (files[i].type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                        const dataUrl = event.target?.result as string;
                        const img = await fabric.FabricImage.fromURL(dataUrl);
                        img.scale(0.5);
                        // Get pointer position for drop location
                        const pointer = canvas.getPointer(e);
                        img.set({ left: pointer.x, top: pointer.y });
                        canvas.add(img);
                        canvas.setActiveObject(img);
                        canvas.requestRenderAll();
                        processLocalCanvasChange();
                    };
                    reader.readAsDataURL(files[i]);
                }
            }
        };

        window.addEventListener('paste', handlePaste);
        const canvasElement = container.querySelector('canvas');
        if (canvasElement) {
            canvasElement.addEventListener('dragover', (e) => e.preventDefault());
            canvasElement.addEventListener('drop', handleDrop as any);
        }

        canvas.on('selection:created', updateSelectionState);
        canvas.on('selection:updated', updateSelectionState);
        canvas.on('selection:cleared', updateSelectionState);

        loadBoardData();
        resizeCanvas();

        window.addEventListener('resize', resizeCanvas);
        const resizeObserver = new ResizeObserver(resizeCanvas);
        resizeObserver.observe(container);

        return () => {
            setCanvasReady(false);
            window.removeEventListener('resize', resizeCanvas);
            resizeObserver.disconnect();
            canvas.off('object:moving', handleObjectMoving);
            canvas.off('object:scaling', handleObjectScaling);
            canvas.off('object:modified', handleModification);
            canvas.off('object:added', handleModification);
            canvas.off('object:removed', handleModification);
            canvas.off('mouse:move', handleMouseMove);
            canvas.off('mouse:down', handleMouseDown);
            canvas.off('mouse:up', handleMouseUp);
            canvas.off('mouse:wheel', handleMouseWheel);
            canvas.off('after:render', handleAfterRender);
            canvas.off('mouse:out', handleMouseOut);
            canvas.off('mouse:dblclick', handleDblClick);
            canvas.off('selection:created', updateSelectionState);
            canvas.off('selection:updated', updateSelectionState);
            canvas.off('selection:cleared', updateSelectionState);
            window.removeEventListener('paste', handlePaste);
            window.removeEventListener('keydown', handleKeyDown);
            canvas.dispose();
            fabricRef.current = null;

            if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
            if (thumbnailTimeoutRef.current) clearTimeout(thumbnailTimeoutRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [applyCanvasState, boardId, brushColor, brushWidth, canvasData, fabricLoaded, processLocalCanvasChange, resetHistory, resolveBoard, scheduleThumbnailCapture, snapObjectToGrid, syncCanvasState, updateMyPresence]);

    useEffect(() => {
        if (!canvasReady || !canvasData) return;

        const decoded = decodeCanvasData(canvasData);
        if (!decoded?.json || decoded.json === lastSyncedDataRef.current) return;

        lastSyncedDataRef.current = decoded.json;
        applyCanvasState(decoded.json, {
            resetHistory: true,
            markPersisted: true,
            suppressEvents: true,
        });
    }, [applyCanvasState, canvasData, canvasReady]);

    useEffect(() => {
        const canvas = fabricRef.current;
        if (!canvas || !fabric || !canvasReady) return;

        canvas.isDrawingMode = !isReadOnly && (activeTool === 'draw' || activeTool === 'eraser');
        canvas.selection = !isReadOnly && activeTool === 'select';

        const pathCreated = (event: { path?: any }) => {
            const pathNode = event.path;
            if (pathNode) {
                if (!pathNode.id) pathNode.id = Math.random().toString(36).substring(2, 9);
                
                if (activeTool === 'eraser') {
                    pathNode.set({
                        globalCompositeOperation: 'destination-out',
                        stroke: 'white',
                        selectable: false,
                        evented: false,
                        perPixelTargetFind: true,
                    });
                    canvas.requestRenderAll();
                }
            }
        };

        canvas.on('path:created', pathCreated);

        if (!isReadOnly && activeTool === 'draw') {
            canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
            canvas.freeDrawingBrush.color = brushColor;
            canvas.freeDrawingBrush.width = brushWidth;
            canvas.freeDrawingBrush.decimate = 5;
            canvas.freeDrawingCursor = 'default';
        } else if (!isReadOnly && activeTool === 'eraser') {
            const eraserWidth = brushWidth * 5;
            canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
            canvas.freeDrawingBrush.color = 'white';
            canvas.freeDrawingBrush.width = eraserWidth;
            canvas.freeDrawingBrush.decimate = 5;

            try {
                const size = eraserWidth;
                const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="rgba(255,255,255,0.5)" stroke="black" stroke-width="2"/></svg>`;
                const cursorUrl = `data:image/svg+xml;base64,${btoa(svg)}`;
                canvas.freeDrawingCursor = `url(${cursorUrl}) ${size / 2} ${size / 2}, auto`;
            } catch {
                canvas.freeDrawingCursor = 'crosshair';
            }
        }

        canvas.forEachObject((object: { set: (props: Record<string, boolean>) => void; globalCompositeOperation?: string }) => {
            const isEraserPath = object.globalCompositeOperation === 'destination-out';

            if (isReadOnly) {
                object.set({ selectable: false, evented: false });
            } else if (!isEraserPath) {
                object.set({ selectable: true, evented: true });
            }
        });

        canvas.requestRenderAll();

        return () => {
            canvas.off('path:created', pathCreated);
        };
    }, [activeTool, brushColor, brushWidth, canvasReady, isReadOnly]);

    const handleCanvasMouseDown = useCallback((opt: { pointer?: { x: number; y: number } }) => {
        if (isReadOnly || activeTool === 'select' || activeTool === 'draw' || activeTool === 'eraser' || !fabric) return;

        const canvas = fabricRef.current;
        if (!canvas || !opt.pointer) return;

        const x = settings.snapToGrid ? snapCoordinate(opt.pointer.x) : opt.pointer.x;
        const y = settings.snapToGrid ? snapCoordinate(opt.pointer.y) : opt.pointer.y;

         
        let object: any = null;

        switch (activeTool) {
            case 'rect':
                object = new fabric.Rect({
                    left: x,
                    top: y,
                    width: 100,
                    height: 80,
                    fill: 'transparent',
                    stroke: brushColor,
                    strokeWidth: 2,
                    rx: 8,
                    ry: 8,
                });
                break;
            case 'circle':
                object = new fabric.Circle({
                    left: x,
                    top: y,
                    radius: 50,
                    fill: 'transparent',
                    stroke: brushColor,
                    strokeWidth: 2,
                });
                break;
            case 'text':
                object = new fabric.IText(isEn ? 'Double click to edit' : '双击编辑', {
                    left: x,
                    top: y,
                    fontSize: 20,
                    fill: brushColor,
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                });
                break;
            case 'stickyNote':
                object = createStickyNote(fabric, x, y, brushColor);
                break;
            case 'line':
                if (hoveredAnchorRef.current) {
                    const { point, obj, anchor } = hoveredAnchorRef.current;
                    object = new fabric.Line([point.x, point.y, point.x, point.y], {
                        stroke: brushColor || '#52c41a',
                        strokeWidth: 2,
                        selectable: true,
                        evented: true,
                        data: {
                            type: 'connector',
                            start: { id: obj.data?.id, anchor },
                            end: null
                        }
                    });
                    activeLineRef.current = object;
                    isDrawingLineRef.current = true;
                } else {
                    object = new fabric.Line([x, y, x + 100, y], {
                        stroke: brushColor,
                        strokeWidth: 2,
                    });
                }
                break;
            default:
                break;
        }

        if (object) {
            if (!object.data) object.data = {};
            if (!object.data.id) object.data.id = `obj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            canvas.add(object);
            if (activeTool !== 'line' || !isDrawingLineRef.current) {
                canvas.setActiveObject(object);
                setActiveTool('select');
            }
            canvas.requestRenderAll();
        }
    }, [activeTool, brushColor, isEn, isReadOnly, settings.snapToGrid, snapCoordinate]);

    useEffect(() => {
        const canvas = fabricRef.current;
        if (!canvas) return;

        canvas.off('mouse:down', handleCanvasMouseDown);
        canvas.on('mouse:down', handleCanvasMouseDown);

        return () => {
            canvas.off('mouse:down', handleCanvasMouseDown);
        };
    }, [handleCanvasMouseDown]);

    const undo = useCallback(async () => {
        if (!fabricRef.current || historyRef.current.past.length === 0 || isReadOnly) return;

        const previous = historyRef.current.past[historyRef.current.past.length - 1];
        const nextPast = historyRef.current.past.slice(0, -1);
        const current = presentStateRef.current;

        historyRef.current = {
            past: nextPast,
            future: [current, ...historyRef.current.future],
        };
        presentStateRef.current = previous;
        setHistory({ ...historyRef.current });

        await applyCanvasState(previous, { markDirty: true, sync: true });
    }, [applyCanvasState, isReadOnly]);

    const redo = useCallback(async () => {
        if (!fabricRef.current || historyRef.current.future.length === 0 || isReadOnly) return;

        const [next, ...remainingFuture] = historyRef.current.future;
        const current = presentStateRef.current;

        historyRef.current = {
            past: [...historyRef.current.past.slice(-19), current],
            future: remainingFuture,
        };
        presentStateRef.current = next;
        setHistory({ ...historyRef.current });

        await applyCanvasState(next, { markDirty: true, sync: true });
    }, [applyCanvasState, isReadOnly]);

    const deleteSelected = useCallback(() => {
        if (isReadOnly) return;

        const canvas = fabricRef.current;
        if (!canvas) return;

        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length > 0) {
             
            activeObjects.forEach((object: any) => canvas.remove(object));
            canvas.discardActiveObject();
            canvas.requestRenderAll();
            message.success(isEn ? 'Deleted' : '已删除');
        }
    }, [isEn, isReadOnly]);

    const copy = useCallback(async () => {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const active = canvas.getActiveObject();
        if (active) {
            const cloned = await active.clone(['data']);
            clipboardRef.current = cloned;
            message.success(isEn ? 'Copied' : '已复制');
        }
    }, [isEn]);

    const paste = useCallback(async () => {
        const canvas = fabricRef.current;
        if (!canvas || !clipboardRef.current || isReadOnly) return;

        const cloned = await clipboardRef.current.clone(['data']);
        canvas.discardActiveObject();
        cloned.set({
            left: cloned.left + 20,
            top: cloned.top + 20,
            evented: true,
        });
        if (cloned.type === 'activeSelection') {
            cloned.canvas = canvas;
            cloned.forEachObject((obj: any) => {
                canvas.add(obj);
            });
            cloned.setCoords();
        } else {
            canvas.add(cloned);
        }
        clipboardRef.current.top += 20;
        clipboardRef.current.left += 20;
        canvas.setActiveObject(cloned);
        canvas.requestRenderAll();
        processLocalCanvasChange();
        message.success(isEn ? 'Pasted' : '已粘贴');
    }, [isEn, isReadOnly, processLocalCanvasChange]);

    const toggleLock = useCallback(() => {
        const canvas = fabricRef.current;
        if (!canvas || isReadOnly) return;
        const active = canvas.getActiveObject();
        if (!active) return;

        const isLocked = !active.data?.locked;
        const objects = active.type === 'activeSelection' ? (active as any)._objects : [active];

        objects.forEach((obj: any) => {
            obj.set({
                lockMovementX: isLocked,
                lockMovementY: isLocked,
                lockRotation: isLocked,
                lockScalingX: isLocked,
                lockScalingY: isLocked,
                hasControls: !isLocked,
                borderColor: isLocked ? '#999' : '#2196F3',
                borderDashArray: isLocked ? [4, 3] : null,
                data: { ...obj.data, locked: isLocked }
            });
        });

        canvas.discardActiveObject();
        canvas.requestRenderAll();
        processLocalCanvasChange();
        message.success(isLocked ? (isEn ? 'Locked' : '已锁定') : (isEn ? 'Unlocked' : '已解锁'));
    }, [isEn, isReadOnly, processLocalCanvasChange]);

    const bringToFront = useCallback(() => {
        const canvas = fabricRef.current;
        if (!canvas || isReadOnly) return;
        const active = canvas.getActiveObject();
        if (active) {
            active.bringToFront();
            canvas.requestRenderAll();
            processLocalCanvasChange();
        }
    }, [isReadOnly, processLocalCanvasChange]);

    const sendToBack = useCallback(() => {
        const canvas = fabricRef.current;
        if (!canvas || isReadOnly) return;
        const active = canvas.getActiveObject();
        if (active) {
            active.sendToBack();
            canvas.requestRenderAll();
            processLocalCanvasChange();
        }
    }, [isReadOnly, processLocalCanvasChange]);

    const handleContextMenu = (e: React.MouseEvent) => {
        if (isReadOnly) return;
        e.preventDefault();
        const canvas = fabricRef.current;
        if (!canvas) return;

        const target = canvas.findTarget(e.nativeEvent);
        if (target) {
            canvas.setActiveObject(target);
            canvas.requestRenderAll();
        } else {
            canvas.discardActiveObject();
            canvas.requestRenderAll();
        }
    };

    const contextMenuItems = useMemo(() => {
        const canvas = fabricRef.current;
        const active = canvas?.getActiveObject();
        
        if (!active) {
            return [
                { key: 'paste', label: (isEn ? 'Paste' : '粘贴'), icon: <CopyOutlined />, disabled: !clipboardRef.current, onClick: paste },
                { type: 'divider' as const },
                { key: 'select-all', label: (isEn ? 'Select All' : '全选'), onClick: () => { canvas?.setActiveObject(new fabric.ActiveSelection(canvas.getObjects(), { canvas })); canvas?.requestRenderAll(); } },
            ];
        }

        const isLocked = active.data?.locked;
         
        const items: any[] = [
            { key: 'copy', label: (isEn ? 'Copy' : '复制'), icon: <CopyOutlined />, onClick: copy },
            { key: 'delete', label: (isEn ? 'Delete' : '删除'), icon: <DeleteOutlined />, danger: true, onClick: deleteSelected },
            { type: 'divider' as const },
            { key: 'bringFront', label: (isEn ? 'Bring to Front' : '置于顶层'), onClick: bringToFront },
            { key: 'sendBack', label: (isEn ? 'Send to Back' : '置于底层'), onClick: sendToBack },
            { type: 'divider' as const },
            { key: 'lock', label: (isLocked ? (isEn ? 'Unlock' : '解锁') : (isEn ? 'Lock' : '锁定')), icon: <LockOutlined />, onClick: toggleLock },
        ];
        return items;
    }, [isEn, copy, paste, deleteSelected, toggleLock, bringToFront, sendToBack]);

    const hasSelection = selectedObjectCount > 0;

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const tagName = (event.target as HTMLElement)?.tagName;
            if (tagName === 'INPUT' || tagName === 'TEXTAREA') return;

            if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
                event.preventDefault();
                undo();
            } else if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
                event.preventDefault();
                redo();
            } else if (!isReadOnly && (event.key === 'Delete' || event.key === 'Backspace')) {
                event.preventDefault();
                deleteSelected();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [deleteSelected, isReadOnly, redo, undo]);

    useEffect(() => {
        const interval = setInterval(() => {
            if (!settings.autoSave || !dirtyRef.current || !currentBoard) return;

            persistCurrentCanvas();

            if (Date.now() - lastAutoSnapshotAtRef.current >= AUTO_SNAPSHOT_INTERVAL_MS) {
                const snapshot = createBoardSnapshot('auto');
                if (snapshot) {
                    lastAutoSnapshotAtRef.current = Date.now();
                }
            }
        }, AUTO_SAVE_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [createBoardSnapshot, currentBoard, persistCurrentCanvas, settings.autoSave]);

    useEffect(() => {
        if (!boardId || !currentBoard) return;

        touchBoard({
            ...currentBoard,
            accessRole: resolvedRole,
            source: resolvedRole === 'owner' ? 'owned' : 'shared',
        }, resolvedRole);

        if (resolvedRole !== 'owner') {
            setRole(boardId, resolvedRole);
        }
    }, [boardId, currentBoard, resolvedRole, setRole, touchBoard]);

    const handleZoom = (delta: number) => {
        const nextZoom = Math.min(Math.max(zoom + delta, 25), 200);
        setZoom(nextZoom);

        if (fabricRef.current) {
            fabricRef.current.setZoom(nextZoom / 100);
            fabricRef.current.requestRenderAll();
        }
    };

    const exportPNG = () => {
        if (!fabricRef.current) return;

        const dataUrl = fabricRef.current.toDataURL({
            format: 'png',
            quality: 1,
            multiplier: 2,
        });
        const link = document.createElement('a');
        link.download = `${currentBoard?.name || 'canvas'}.png`;
        link.href = dataUrl;
        link.click();
        message.success(isEn ? 'Exported as PNG' : '已导出为 PNG');
    };

    const exportSVG = () => {
        if (!fabricRef.current) return;

        const svg = fabricRef.current.toSVG();
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `${currentBoard?.name || 'canvas'}.svg`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        message.success(isEn ? 'Exported as SVG' : '已导出为 SVG');
    };

    const exportItems = [
        { key: 'png', label: isEn ? 'Export as PNG' : '导出为 PNG', onClick: exportPNG },
        { key: 'svg', label: isEn ? 'Export as SVG' : '导出为 SVG', onClick: exportSVG },
    ];
    const mobileActionItems = [
        {
            key: 'undo',
            icon: <UndoOutlined />,
            label: isEn ? 'Undo' : '撤销',
            onClick: undo,
            disabled: history.past.length === 0 || isReadOnly,
        },
        {
            key: 'redo',
            icon: <RedoOutlined />,
            label: isEn ? 'Redo' : '重做',
            onClick: redo,
            disabled: history.future.length === 0 || isReadOnly,
        },
        {
            key: 'delete-selected',
            icon: <DeleteOutlined />,
            label: isEn ? 'Delete selected' : '删除选中',
            onClick: deleteSelected,
            disabled: isReadOnly || !hasSelection,
        },
        { type: 'divider' as const },
        {
            key: 'version-history',
            icon: <HistoryOutlined />,
            label: isEn ? 'Version history' : '版本历史',
            onClick: () => setShowVersionModal(true),
        },
        { type: 'divider' as const },
        {
            key: 'export-png',
            icon: <DownloadOutlined />,
            label: isEn ? 'Export PNG' : '导出 PNG',
            onClick: exportPNG,
        },
        {
            key: 'export-svg',
            icon: <DownloadOutlined />,
            label: isEn ? 'Export SVG' : '导出 SVG',
            onClick: exportSVG,
        },
    ];

    const addChart = async () => {
        if (isReadOnly) return;

        const chartCanvas = document.querySelector('.echarts-for-react canvas') as HTMLCanvasElement | null;
        if (!chartCanvas || !fabricRef.current || !fabric) return;

        try {
            const dataUrl = chartCanvas.toDataURL();
            const image = await fabric.FabricImage.fromURL(dataUrl);
            image.scale(0.5);
            fabricRef.current.add(image);
            fabricRef.current.requestRenderAll();
            setShowChartModal(false);
            message.success(isEn ? 'Chart added to canvas' : '图表已添加到画布');
        } catch (error) {
            console.error('Failed to add chart', error);
            message.error(isEn ? 'Unable to add chart' : '添加图表失败');
        }
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(shareLink).then(() => {
            setLinkCopied(true);
            message.success(isEn ? 'Link copied to clipboard!' : '链接已复制到剪贴板！');
            setTimeout(() => setLinkCopied(false), 2000);
        });
    };

    const handleCreateManualSnapshot = () => {
        const snapshot = createBoardSnapshot('manual');
        if (snapshot) {
            message.success(isEn ? 'Snapshot saved' : '快照已保存');
        }
    };

    const handleRestoreSnapshot = async (snapshot: BoardSnapshot) => {
        if (isReadOnly) return;

        const json = decompressSnapshotData(snapshot.compressedData);
        historyRef.current = {
            past: [...historyRef.current.past.slice(-19), presentStateRef.current],
            future: [],
        };
        presentStateRef.current = json;
        setHistory({ ...historyRef.current });

        await applyCanvasState(json, { markDirty: true, sync: true });
        message.success(isEn ? 'Snapshot restored' : '已恢复到该版本');
    };

    const handleDeleteSnapshot = (snapshotId: string) => {
        if (!boardId) return;
        removeSnapshot(boardId, snapshotId);
        message.success(isEn ? 'Snapshot removed' : '快照已删除');
    };

    const tools = [
        { key: 'select', icon: <SelectOutlined />, title: isEn ? 'Select' : '选择', disabled: false },
        { key: 'draw', icon: <EditOutlined />, title: isEn ? 'Draw' : '画笔', disabled: isReadOnly },
        { key: 'eraser', icon: <ClearOutlined />, title: isEn ? 'Eraser' : '橡皮擦', disabled: isReadOnly },
        { key: 'rect', icon: <BorderOutlined />, title: isEn ? 'Rectangle' : '矩形', disabled: isReadOnly },
        { key: 'circle', icon: <span style={{ fontSize: 18 }}>○</span>, title: isEn ? 'Circle' : '圆形', disabled: isReadOnly },
        { key: 'line', icon: <MinusOutlined />, title: isEn ? 'Line' : '直线', disabled: isReadOnly },
        { key: 'text', icon: <FontSizeOutlined />, title: isEn ? 'Text' : '文本', disabled: isReadOnly },
        { key: 'stickyNote', icon: <FileTextOutlined />, title: isEn ? 'Sticky Note' : '便签', disabled: isReadOnly },
    ];

    if (!fabricLoaded) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                {isEn ? 'Loading...' : '加载中...'}
            </div>
        );
    }

    return (
        <Layout className={styles.canvasLayout}>
            <Header className={styles.header}>
                <div className={styles.headerLeft}>
                    <Button
                        type="text"
                        icon={<ArrowLeftOutlined />}
                        onClick={() => navigate('/dashboard')}
                        className={styles.headerIconButton}
                        aria-label={isEn ? 'Back to dashboard' : '返回白板列表'}
                    />
                    <Text strong className={styles.boardName}>
                        {displayBoardName || (isEn ? 'Untitled Board' : '未命名白板')}
                    </Text>
                </div>

                <div className={styles.headerCenter}>
                    <Tooltip title={isEn ? 'Undo' : '撤销'}>
                        <Button
                            type="text"
                            icon={<UndoOutlined />}
                            onClick={undo}
                            disabled={history.past.length === 0 || isReadOnly}
                            className={styles.headerIconButton}
                            aria-label={isEn ? 'Undo' : '撤销'}
                        />
                    </Tooltip>
                    <Tooltip title={isEn ? 'Redo' : '重做'}>
                        <Button
                            type="text"
                            icon={<RedoOutlined />}
                            onClick={redo}
                            disabled={history.future.length === 0 || isReadOnly}
                            className={styles.headerIconButton}
                            aria-label={isEn ? 'Redo' : '重做'}
                        />
                    </Tooltip>
                    <Divider type="vertical" />
                    <Tooltip title={hasSelection ? (isEn ? 'Delete Selected' : '删除选中') : (isEn ? 'Select an object first' : '请先选中对象')}>
                        <Button
                            type="text"
                            icon={<DeleteOutlined />}
                            onClick={deleteSelected}
                            disabled={isReadOnly || !hasSelection}
                            className={styles.headerIconButton}
                            aria-label={isEn ? 'Delete selected' : '删除选中'}
                        />
                    </Tooltip>
                    <Tooltip title={isEn ? 'Version History' : '版本历史'}>
                        <Button
                            type="text"
                            icon={<HistoryOutlined />}
                            onClick={() => setShowVersionModal(true)}
                            className={styles.headerIconButton}
                            aria-label={isEn ? 'Version history' : '版本历史'}
                        />
                    </Tooltip>
                    <Divider type="vertical" />
                    <Dropdown menu={{ items: exportItems }} overlayClassName={styles.exportDropdown} placement="bottomCenter">
                        <Button
                            type="text"
                            icon={<DownloadOutlined />}
                            className={styles.headerTextButton}
                            aria-label={isEn ? 'Export options' : '导出选项'}
                        >
                            {isEn ? 'Export' : '导出'}
                        </Button>
                    </Dropdown>
                </div>

                <div className={styles.headerRight}>
                    {isReadOnly && (
                        <div className={styles.readOnlyBadge}>
                            <LockOutlined /> {isEn ? 'Viewer mode' : '只读模式'}
                        </div>
                    )}

                    <div className={styles.collaborators}>
                        {others.slice(0, 3).map(({ connectionId, info, presence }) => (
                            <Tooltip key={connectionId} title={presence?.name || info?.name || 'Anonymous'}>
                                <div
                                    className={styles.collaboratorAvatar}
                                    style={{ backgroundColor: presence?.color || info?.color || '#ccc' }}
                                >
                                    {(presence?.name || info?.name || 'A').charAt(0).toUpperCase()}
                                </div>
                            </Tooltip>
                        ))}
                        {others.length > 3 && <div className={styles.collaboratorMore}>+{others.length - 3}</div>}
                    </div>

                    <Tooltip title={isReadOnly ? (isEn ? 'Viewer link cannot re-share access' : '只读模式下不能再次分享权限') : (isEn ? 'Invite collaborators' : '邀请协作者')}>
                        <Button
                            type="primary"
                            icon={isReadOnly ? <EyeOutlined /> : <ShareAltOutlined />}
                            onClick={() => setShowInviteModal(true)}
                            className={styles.inviteButton}
                            aria-label={isEn ? 'Invite collaborators' : '邀请协作者'}
                        >
                            {isEn ? 'Invite' : '邀请'}
                        </Button>
                    </Tooltip>

                    <Dropdown
                        menu={{ items: mobileActionItems }}
                        placement="bottomRight"
                        trigger={['click']}
                        overlayClassName={styles.mobileActionsMenu}
                    >
                        <Button
                            type="text"
                            icon={<MenuOutlined />}
                            className={`${styles.headerIconButton} ${styles.mobileActionsToggle}`}
                            aria-label={isEn ? 'More actions' : '更多操作'}
                        />
                    </Dropdown>

                    <div className={styles.zoomControls}>
                        <Button type="text" size="small" icon={<ZoomOutOutlined />} onClick={() => handleZoom(-10)} />
                        <Text className={styles.zoomText}>{zoom}%</Text>
                        <Button type="text" size="small" icon={<ZoomInOutlined />} onClick={() => handleZoom(10)} />
                    </div>
                </div>
            </Header>

            <Layout className={styles.boardArea}>
                <Sider width={96} className={styles.toolbar}>
                    {tools.map((tool) => (
                        <Tooltip key={tool.key} title={tool.title} placement="right">
                            <Button
                                type={activeTool === tool.key ? 'primary' : 'text'}
                                icon={tool.icon}
                                className={styles.toolButton}
                                onClick={() => setActiveTool(tool.key as ToolType)}
                                disabled={tool.disabled}
                            />
                        </Tooltip>
                    ))}

                    <Divider className={styles.toolDivider} />

                    <Tooltip title={isEn ? 'Add chart' : '添加图表'} placement="right">
                        <Button
                            type="text"
                            icon={<BarChartOutlined />}
                            className={styles.toolButton}
                            onClick={() => setShowChartModal(true)}
                            disabled={isReadOnly}
                        />
                    </Tooltip>

                    <Divider className={styles.toolDivider} />

                    <div className={styles.colorControls}>
                        <div className={styles.colorPicker}>
                            <ColorPicker
                                value={brushColor}
                                onChange={(color) => setBrushColor(color.toHexString())}
                                size="small"
                                disabled={isReadOnly}
                            />
                        </div>

                        <div className={styles.brushWidth}>
                            <CircularSlider
                                value={brushWidth}
                                min={1}
                                max={50}
                                onChange={setBrushWidth}
                                size={40}
                                color={brushColor}
                                thickness={4}
                                trackColor="rgba(0,0,0,0.1)"
                            />
                        </div>
                    </div>
                </Sider>

                <Content
                    className={`${styles.canvasContainer} ${settings.showGrid ? styles.gridVisible : ''}`}
                    ref={containerRef}
                    style={{ ['--grid-size' as string]: gridPixelSize }}
                >
                    {isReadOnly && (
                        <div className={styles.canvasNotice}>
                            <Alert
                                type="info"
                                showIcon
                                message={isEn
                                    ? 'This board is in viewer mode. You can inspect, zoom, export, and browse snapshots, but editing tools are locked.'
                                    : '当前白板处于只读模式。你仍可以查看、缩放、导出和浏览快照，但编辑工具已锁定。'}
                            />
                        </div>
                    )}

                    <Dropdown
                        menu={{ items: contextMenuItems }}
                        trigger={['contextMenu']}
                    >
                        <div className={styles.canvasDiv} onContextMenu={handleContextMenu}>
                            <canvas ref={canvasRef} id="fabric-canvas" />
                        </div>
                    </Dropdown>
                    <LiveblocksCursors />
                </Content>
            </Layout>

            <Modal
                title={isEn ? 'Add Chart' : '添加图表'}
                open={showChartModal}
                onCancel={() => setShowChartModal(false)}
                footer={null}
                width={800}
                className={styles.chartModal}
            >
                {showChartModal && (
                    <Suspense fallback={<div className={styles.modalLoader}>{isEn ? 'Loading chart tools...' : '图表工具加载中...'}</div>}>
                        <LazyChartWidget onAdd={addChart} />
                    </Suspense>
                )}
            </Modal>

            <Modal
                open={showInviteModal}
                onCancel={() => setShowInviteModal(false)}
                footer={null}
                centered
                className={styles.inviteModal}
                width={480}
            >
                <div className={styles.inviteContent}>
                    <div className={styles.inviteHeader}>
                        <div className={styles.inviteIcon}>
                            <ShareAltOutlined />
                        </div>
                        <h2 className={styles.inviteTitle}>{isEn ? 'Invite Friends' : '邀请好友协作'}</h2>
                        <p className={styles.inviteDescription}>
                            {isEn
                                ? 'Choose whether the link opens in edit mode or viewer mode. The selected role will be cached locally for quick re-entry from the dashboard.'
                                : '你可以选择链接打开后是可编辑还是只读模式。选定的角色会被本地缓存，方便稍后从仪表盘再次进入。'}
                        </p>
                    </div>

                    <div className={styles.shareSection}>
                        <label>{isEn ? 'Share mode' : '分享权限'}</label>
                        <div className={styles.shareModeToggle} role="tablist" aria-label={isEn ? 'Share mode' : '分享权限'}>
                            <button
                                type="button"
                                className={`${styles.shareModeOption} ${shareRole === 'editor' ? styles.shareModeOptionActive : ''}`}
                                onClick={() => setShareRole('editor')}
                                aria-pressed={shareRole === 'editor'}
                            >
                                {isEn ? 'Can edit' : '可编辑'}
                            </button>
                            <button
                                type="button"
                                className={`${styles.shareModeOption} ${shareRole === 'viewer' ? styles.shareModeOptionActive : ''}`}
                                onClick={() => setShareRole('viewer')}
                                aria-pressed={shareRole === 'viewer'}
                            >
                                {isEn ? 'View only' : '只读'}
                            </button>
                        </div>
                        <div className={`${styles.shareModePanel} ${shareRoleMeta.accent}`}>
                            <div className={styles.shareModeContent}>
                                <div className={styles.shareModeIcon}>{shareRoleMeta.icon}</div>
                                <div className={styles.shareModeText}>
                                    <strong>{shareRoleMeta.title}</strong>
                                    <span>{shareRoleMeta.description}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={styles.shareSection}>
                        <label>{isEn ? 'Share Link' : '分享链接'}</label>
                        <div className={styles.shareInputGroup}>
                            <Input value={shareLink} readOnly className={styles.shareInput} />
                            <Button
                                type="primary"
                                className={styles.copyButton}
                                icon={linkCopied ? <CheckOutlined /> : <CopyOutlined />}
                                onClick={handleCopyLink}
                            >
                                {linkCopied ? (isEn ? 'Copied' : '已复制') : (isEn ? 'Copy' : '复制')}
                            </Button>
                        </div>
                    </div>

                    <div className={styles.collaboratorsList}>
                        <label>{isEn ? `Online Now (${others.length + 1})` : `当前在线 (${others.length + 1} 人)`}</label>
                        <div className={styles.onlineUsers}>
                            <div className={styles.onlineUser}>
                                <div className={styles.userAvatar} style={{ backgroundColor: '#667eea' }}>
                                    {isEn ? 'Me' : '我'}
                                </div>
                                <span>{isEn ? 'Me (You)' : '我 (你)'}</span>
                                <div className={styles.statusDot} />
                            </div>
                            {others.map(({ connectionId, info, presence }) => (
                                <div key={connectionId} className={styles.onlineUser}>
                                    <div
                                        className={styles.userAvatar}
                                        style={{ backgroundColor: presence?.color || info?.color || '#ccc' }}
                                    >
                                        {(presence?.name || info?.name || 'A').charAt(0).toUpperCase()}
                                    </div>
                                    <span>{presence?.name || info?.name || 'Anonymous'}</span>
                                    <div className={styles.statusDot} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </Modal>

            <VersionHistoryModal
                isEn={isEn}
                open={showVersionModal}
                snapshots={snapshots}
                onClose={() => setShowVersionModal(false)}
                onCreateSnapshot={handleCreateManualSnapshot}
                onDeleteSnapshot={handleDeleteSnapshot}
                onRestoreSnapshot={handleRestoreSnapshot}
            />
        </Layout>
    );
};

export default CanvasBoardInner;
