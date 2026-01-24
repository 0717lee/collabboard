import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Layout,
    Button,
    Tooltip,
    Divider,
    Dropdown,
    message,
    Modal,
    ColorPicker,
    Slider,
    Typography,
    Input,
    Space,
} from 'antd';
import {
    ArrowLeftOutlined,
    SelectOutlined,
    EditOutlined,
    BorderOutlined,
    MinusOutlined,
    FontSizeOutlined,
    FileImageOutlined,
    UndoOutlined,
    RedoOutlined,
    DownloadOutlined,
    ZoomInOutlined,
    ZoomOutOutlined,
    DeleteOutlined,
    BarChartOutlined,
    ShareAltOutlined,
    CopyOutlined,
    CheckOutlined,
} from '@ant-design/icons';
import { useBoardStore } from '@/stores/boardStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useLanguageStore } from '@/stores/languageStore';
import { useUpdateMyPresence, useOthers, useStorage, useMutation } from '@/liveblocks.config';
import { LiveblocksCursors } from './LiveblocksCursors';
import { ChartWidget } from '@/components/Charts/ChartWidget';
import styles from './CanvasBoard.module.css';

// Dynamic import for fabric to avoid TypeScript issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let fabric: any = null;
import('fabric').then((mod) => {
    fabric = mod;
});

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

type ToolType = 'select' | 'draw' | 'rect' | 'circle' | 'line' | 'text' | 'sticky';

interface HistoryState {
    past: string[];
    future: string[];
}

const CanvasBoardInner: React.FC = () => {
    const { boardId } = useParams<{ boardId: string }>();
    const navigate = useNavigate();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fabricRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const { boards, currentBoard, setCurrentBoard, saveCanvasData } = useBoardStore();
    const { settings } = useSettingsStore();
    const { language } = useLanguageStore();
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
    const [linkCopied, setLinkCopied] = useState(false);
    const [fabricLoaded, setFabricLoaded] = useState(false);

    // Liveblocks hooks - Sync Canvas Data
    const canvasData = useStorage((root) => root.canvasData);

    const updateStorage = useMutation(({ storage }, json: string) => {
        storage.set('canvasData', json);
    }, []);

    // Ref to track if update is coming from remote (to avoid loop)
    const isRemoteUpdate = useRef(false);

    // Get share link
    const shareLink = typeof window !== 'undefined'
        ? `${window.location.origin}/board/${boardId}`
        : '';

    const handleCopyLink = () => {
        navigator.clipboard.writeText(shareLink).then(() => {
            setLinkCopied(true);
            message.success(isEn ? 'Link copied to clipboard!' : '链接已复制到剪贴板！');
            setTimeout(() => setLinkCopied(false), 2000);
        });
    };

    // Load fabric dynamically
    useEffect(() => {
        import('fabric').then((mod) => {
            fabric = mod;
            setFabricLoaded(true);
        });
    }, []);

    // Sync from Liveblocks to local canvas
    useEffect(() => {
        if (!fabricRef.current || !canvasData || !fabricLoaded) return;

        // Skip if this update originated from local changes
        if (isRemoteUpdate.current) return;

        try {
            const currentJson = JSON.stringify(fabricRef.current.toJSON());
            if (currentJson === canvasData) return;

            const data = JSON.parse(canvasData);
            if (data.objects) {
                const canvas = fabricRef.current;

                // Disable auto-save/sync during remote update
                isRemoteUpdate.current = true;

                canvas.loadFromJSON(data).then(() => {
                    canvas.renderAll();
                    // Re-enable sync after a short delay
                    setTimeout(() => {
                        isRemoteUpdate.current = false;
                    }, 100);
                });
            }
        } catch (e) {
            console.error('Error syncing remote data', e);
        }
    }, [canvasData, fabricLoaded]);

    // Initialize canvas
    useEffect(() => {
        if (!canvasRef.current || !containerRef.current || !fabricLoaded || !fabric) return;

        const container = containerRef.current;
        const canvas = new fabric.Canvas(canvasRef.current, {
            width: container.clientWidth,
            height: container.clientHeight,
            backgroundColor: '#ffffff',
            selection: true,
            preserveObjectStacking: true,
        });

        fabricRef.current = canvas;

        // Initialize free drawing brush
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        canvas.freeDrawingBrush.color = '#000000';
        canvas.freeDrawingBrush.width = 3;

        // Load board data
        const loadBoardData = async () => {
            if (!boardId) return;

            let board = boards.find((b) => b.id === boardId);

            // If board not in local list, fetch it
            if (!board) {
                const fetchedBoard = await useBoardStore.getState().fetchBoard(boardId);
                if (fetchedBoard) board = fetchedBoard;
            } else {
                setCurrentBoard(board);
            }

            // Sync Strategy:
            // 1. If Liveblocks (canvasData) has data, use it (it's the real-time truth)
            // 2. If Liveblocks is empty (new session), load from DB (persistence layer)

            if (canvasData && canvasData !== '{}') {
                try {
                    const data = JSON.parse(canvasData);
                    if (data.objects) {
                        await canvas.loadFromJSON(data);
                        canvas.renderAll();
                    }
                } catch (e) {
                    console.error('Error loading from Liveblocks:', e);
                }
            } else if (board) {
                // Fallback to DB
                try {
                    const data = JSON.parse(board.data);
                    if (data.objects && data.objects.length > 0) {
                        await canvas.loadFromJSON(data);
                        canvas.renderAll();

                        // Initial push to Liveblocks if we are the first one
                        const json = JSON.stringify(data);
                        updateStorage(json);
                    }
                } catch {
                    console.log('Empty or invalid board data');
                }
            }
        };

        loadBoardData();

        // Handle window resize
        const handleResize = () => {
            if (container && canvas) {
                canvas.setDimensions({
                    width: container.clientWidth,
                    height: container.clientHeight,
                });
                canvas.renderAll();
            }
        };
        window.addEventListener('resize', handleResize);

        // Sync to Liveblocks listener
        const handleModification = () => {
            saveState();

            // Sync to Liveblocks only if not processing remote update
            if (fabricRef.current && !isRemoteUpdate.current) {
                const json = JSON.stringify(fabricRef.current.toJSON());
                updateStorage(json);

                // Also save to DB periodically (handled by auto-save effect), 
                // but we trigger immediate save on important changes if needed
            }
        };

        canvas.on('object:modified', handleModification);
        canvas.on('object:added', handleModification);
        canvas.on('object:removed', handleModification);

        // Track cursor
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        canvas.on('mouse:move', (options: any) => {
            if (options.pointer) {
                updateMyPresence({ cursor: options.pointer });
            }
        });

        canvas.on('mouse:out', () => {
            updateMyPresence({ cursor: null });
        });

        // Save initial empty state for full undo capability
        setTimeout(() => {
            const initialState = JSON.stringify(canvas.toJSON());
            historyRef.current = { past: [initialState], future: [] };
            setHistory({ ...historyRef.current });
        }, 100);

        return () => {
            window.removeEventListener('resize', handleResize);
            canvas.dispose();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [boardId, fabricLoaded]);

    // Save canvas state for undo/redo - use ref to avoid stale closure
    const historyRef = useRef<HistoryState>({ past: [], future: [] });
    const isRestoringRef = useRef(false);

    const saveState = useCallback(() => {
        if (!fabricRef.current || isRestoringRef.current) return;
        const json = JSON.stringify(fabricRef.current.toJSON());
        historyRef.current = {
            past: [...historyRef.current.past.slice(-20), json],
            future: [],
        };
        setHistory({ ...historyRef.current });
    }, []);

    // Auto-save
    useEffect(() => {
        if (!fabricRef.current || !currentBoard) return;

        const interval = setInterval(() => {
            if (settings.autoSave && fabricRef.current) {
                const json = JSON.stringify(fabricRef.current.toJSON());
                saveCanvasData(currentBoard.id, json);
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [currentBoard, settings.autoSave, saveCanvasData]);

    // Tool handlers
    useEffect(() => {
        const canvas = fabricRef.current;
        if (!canvas || !fabric) return;

        canvas.isDrawingMode = activeTool === 'draw';
        canvas.selection = activeTool === 'select';

        if (activeTool === 'draw') {
            // Ensure brush exists
            if (!canvas.freeDrawingBrush) {
                canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
            }
            canvas.freeDrawingBrush.color = brushColor;
            canvas.freeDrawingBrush.width = brushWidth;
        }
    }, [activeTool, brushColor, brushWidth]);

    // Handle canvas click for shape creation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleCanvasMouseDown = useCallback((opt: any) => {
        if (activeTool === 'select' || activeTool === 'draw' || !fabric) return;

        const canvas = fabricRef.current;
        if (!canvas || !opt.pointer) return;

        const { x, y } = opt.pointer;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
            case 'line':
                object = new fabric.Line([x, y, x + 100, y], {
                    stroke: brushColor,
                    strokeWidth: 2,
                });
                break;
            case 'text':
                object = new fabric.IText('双击编辑', {
                    left: x,
                    top: y,
                    fontSize: 20,
                    fill: brushColor,
                    fontFamily: 'Inter, sans-serif',
                });
                break;
            case 'sticky': {
                const stickyRect = new fabric.Rect({
                    width: 150,
                    height: 150,
                    fill: '#fef3c7',
                    rx: 4,
                    ry: 4,
                    shadow: new fabric.Shadow({
                        color: 'rgba(0,0,0,0.1)',
                        blur: 10,
                        offsetX: 2,
                        offsetY: 2,
                    }),
                });
                const stickyText = new fabric.IText('便签', {
                    fontSize: 16,
                    fill: '#92400e',
                    originX: 'center',
                    originY: 'center',
                });
                const group = new fabric.Group([stickyRect, stickyText], {
                    left: x,
                    top: y,
                });
                object = group;
                break;
            }
        }

        if (object) {
            canvas.add(object);
            canvas.setActiveObject(object);
            canvas.renderAll();
            setActiveTool('select');
        }
    }, [activeTool, brushColor]);

    useEffect(() => {
        const canvas = fabricRef.current;
        if (!canvas) return;

        canvas.on('mouse:down', handleCanvasMouseDown);
        return () => {
            canvas.off('mouse:down', handleCanvasMouseDown);
        };
    }, [handleCanvasMouseDown]);

    // Undo/Redo
    const undo = useCallback(() => {
        if (historyRef.current.past.length === 0 || !fabricRef.current) return;

        isRestoringRef.current = true;
        const newPast = [...historyRef.current.past];
        const previous = newPast.pop()!;
        const current = JSON.stringify(fabricRef.current.toJSON());

        historyRef.current = {
            past: newPast,
            future: [current, ...historyRef.current.future],
        };
        setHistory({ ...historyRef.current });

        fabricRef.current.loadFromJSON(JSON.parse(previous)).then(() => {
            fabricRef.current!.renderAll();
            isRestoringRef.current = false;
        });
    }, []);

    const redo = useCallback(() => {
        if (historyRef.current.future.length === 0 || !fabricRef.current) return;

        isRestoringRef.current = true;
        const newFuture = [...historyRef.current.future];
        const next = newFuture.shift()!;
        const current = JSON.stringify(fabricRef.current.toJSON());

        historyRef.current = {
            past: [...historyRef.current.past, current],
            future: newFuture,
        };
        setHistory({ ...historyRef.current });

        fabricRef.current.loadFromJSON(JSON.parse(next)).then(() => {
            fabricRef.current!.renderAll();
            isRestoringRef.current = false;
        });
    }, []);

    // Zoom controls
    const handleZoom = (delta: number) => {
        const newZoom = Math.min(Math.max(zoom + delta, 25), 200);
        setZoom(newZoom);
        if (fabricRef.current) {
            fabricRef.current.setZoom(newZoom / 100);
            fabricRef.current.renderAll();
        }
    };

    // Delete selected objects
    const deleteSelected = () => {
        const canvas = fabricRef.current;
        if (!canvas) return;

        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            activeObjects.forEach((obj: any) => canvas.remove(obj));
            canvas.discardActiveObject();
            canvas.renderAll();
            message.success('已删除');
        }
    };

    // Export functions
    const exportPNG = () => {
        if (!fabricRef.current) return;
        const dataURL = fabricRef.current.toDataURL({
            format: 'png',
            quality: 1,
            multiplier: 2,
        });
        const link = document.createElement('a');
        link.download = `${currentBoard?.name || 'canvas'}.png`;
        link.href = dataURL;
        link.click();
        message.success('已导出为 PNG');
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
        message.success('已导出为 SVG');
    };

    const exportItems = [
        { key: 'png', label: '导出为 PNG', onClick: exportPNG },
        { key: 'svg', label: '导出为 SVG', onClick: exportSVG },
    ];

    const addChart = async () => {
        // Add chart as image to canvas
        const chartElement = document.querySelector('.echarts-for-react canvas') as HTMLCanvasElement;
        if (chartElement && fabricRef.current && fabric) {
            const dataURL = chartElement.toDataURL();
            try {
                const img = await fabric.FabricImage.fromURL(dataURL);
                img.scale(0.5);
                fabricRef.current.add(img);
                fabricRef.current.renderAll();
            } catch (err) {
                console.error('Failed to add chart', err);
            }
        }
        setShowChartModal(false);
        message.success(isEn ? 'Chart added to canvas' : '图表已添加到画布');
    };

    const tools = [
        { key: 'select', icon: <SelectOutlined />, title: isEn ? 'Select' : '选择' },
        { key: 'draw', icon: <EditOutlined />, title: isEn ? 'Draw' : '画笔' },
        { key: 'rect', icon: <BorderOutlined />, title: isEn ? 'Rectangle' : '矩形' },
        { key: 'circle', icon: <span style={{ fontSize: 18 }}>○</span>, title: isEn ? 'Circle' : '圆形' },
        { key: 'line', icon: <MinusOutlined />, title: isEn ? 'Line' : '直线' },
        { key: 'text', icon: <FontSizeOutlined />, title: isEn ? 'Text' : '文本' },
        { key: 'sticky', icon: <FileImageOutlined />, title: isEn ? 'Sticky Note' : '便签' },
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
                    />
                    <Text strong className={styles.boardName}>
                        {currentBoard?.name || (isEn ? 'Untitled Board' : '未命名白板')}
                    </Text>
                </div>

                <div className={styles.headerCenter}>
                    <Tooltip title={isEn ? 'Undo' : '撤销'}>
                        <Button
                            type="text"
                            icon={<UndoOutlined />}
                            onClick={undo}
                            disabled={history.past.length === 0}
                        />
                    </Tooltip>
                    <Tooltip title={isEn ? 'Redo' : '重做'}>
                        <Button
                            type="text"
                            icon={<RedoOutlined />}
                            onClick={redo}
                            disabled={history.future.length === 0}
                        />
                    </Tooltip>
                    <Divider type="vertical" />
                    <Tooltip title={isEn ? 'Delete Selected' : '删除选中'}>
                        <Button
                            type="text"
                            icon={<DeleteOutlined />}
                            onClick={deleteSelected}
                        />
                    </Tooltip>
                    <Divider type="vertical" />
                    <Dropdown menu={{ items: exportItems }}>
                        <Button type="text" icon={<DownloadOutlined />}>
                            {isEn ? 'Export' : '导出'}
                        </Button>
                    </Dropdown>
                </div>

                <div className={styles.headerRight}>
                    <div className={styles.collaborators}>
                        {others.slice(0, 3).map(({ connectionId, info }) => (
                            <Tooltip key={connectionId} title={info?.name || 'Anonymous'}>
                                <div
                                    className={styles.collaboratorAvatar}
                                    style={{ backgroundColor: info?.color || '#ccc' }}
                                >
                                    {(info?.name || 'A').charAt(0).toUpperCase()}
                                </div>
                            </Tooltip>
                        ))}
                        {others.length > 3 && (
                            <div className={styles.collaboratorMore}>
                                +{others.length - 3}
                            </div>
                        )}
                    </div>
                    <Tooltip title={isEn ? 'Invite Friends' : '邀请好友'}>
                        <Button
                            type="primary"
                            icon={<ShareAltOutlined />}
                            onClick={() => setShowInviteModal(true)}
                            className={styles.inviteButton}
                        >
                            {isEn ? 'Invite' : '邀请'}
                        </Button>
                    </Tooltip>
                    <div className={styles.zoomControls}>
                        <Button
                            type="text"
                            size="small"
                            icon={<ZoomOutOutlined />}
                            onClick={() => handleZoom(-10)}
                        />
                        <Text className={styles.zoomText}>{zoom}%</Text>
                        <Button
                            type="text"
                            size="small"
                            icon={<ZoomInOutlined />}
                            onClick={() => handleZoom(10)}
                        />
                    </div>
                </div>
            </Header>

            <Layout>
                <Sider width={64} className={styles.toolbar}>
                    {tools.map((tool) => (
                        <Tooltip key={tool.key} title={tool.title} placement="right">
                            <Button
                                type={activeTool === tool.key ? 'primary' : 'text'}
                                icon={tool.icon}
                                className={styles.toolButton}
                                onClick={() => setActiveTool(tool.key as ToolType)}
                            />
                        </Tooltip>
                    ))}

                    <Divider className={styles.toolDivider} />

                    <Tooltip title="添加图表" placement="right">
                        <Button
                            type="text"
                            icon={<BarChartOutlined />}
                            className={styles.toolButton}
                            onClick={() => setShowChartModal(true)}
                        />
                    </Tooltip>

                    <Divider className={styles.toolDivider} />

                    <div className={styles.colorPicker}>
                        <ColorPicker
                            value={brushColor}
                            onChange={(color) => setBrushColor(color.toHexString())}
                            size="small"
                        />
                    </div>

                    <div className={styles.brushWidth}>
                        <Slider
                            vertical
                            min={1}
                            max={20}
                            value={brushWidth}
                            onChange={setBrushWidth}
                            className={styles.widthSlider}
                        />
                    </div>
                </Sider>

                <Content
                    className={styles.canvasContainer}
                    ref={containerRef}
                    onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        updateMyPresence({
                            cursor: {
                                x: e.clientX - rect.left,
                                y: e.clientY - rect.top,
                            },
                        });
                    }}
                    onMouseLeave={() => {
                        updateMyPresence({ cursor: null });
                    }}
                >
                    <canvas ref={canvasRef} id="fabric-canvas" />
                    <LiveblocksCursors />
                </Content>
            </Layout>

            <Modal
                title={isEn ? 'Add Chart' : '添加图表'}
                open={showChartModal}
                onCancel={() => setShowChartModal(false)}
                footer={null}
                width={800}
            >
                <ChartWidget onAdd={addChart} />
            </Modal>

            <Modal
                title={isEn ? 'Invite Friends' : '邀请好友协作'}
                open={showInviteModal}
                onCancel={() => setShowInviteModal(false)}
                footer={null}
                centered
                className={styles.inviteModal}
            >
                <div className={styles.inviteContent}>
                    <p className={styles.inviteDescription}>
                        {isEn
                            ? 'Share the link below to invite friends to collaborate on this board. Users who open the link will see each other\'s cursors and edits in real-time.'
                            : '分享以下链接，邀请好友一起协作编辑这个白板。打开链接的用户将能够实时看到彼此的光标和编辑内容。'}
                    </p>

                    <div className={styles.shareSection}>
                        <label>{isEn ? 'Share Link' : '分享链接'}</label>
                        <Space.Compact style={{ width: '100%' }}>
                            <Input
                                value={shareLink}
                                readOnly
                                className={styles.shareInput}
                            />
                            <Button
                                type="primary"
                                icon={linkCopied ? <CheckOutlined /> : <CopyOutlined />}
                                onClick={handleCopyLink}
                            >
                                {linkCopied ? (isEn ? 'Copied' : '已复制') : (isEn ? 'Copy' : '复制')}
                            </Button>
                        </Space.Compact>
                    </div>

                    <div className={styles.collaboratorsList}>
                        <label>{isEn ? `Online Now (${others.length + 1})` : `当前在线 (${others.length + 1} 人)`}</label>
                        <div className={styles.onlineUsers}>
                            <div className={styles.onlineUser}>
                                <div className={styles.userAvatar} style={{ backgroundColor: '#667eea' }}>
                                    {isEn ? 'Me' : '我'}
                                </div>
                                <span>{isEn ? 'Me (You)' : '我 (你)'}</span>
                            </div>
                            {others.map(({ connectionId, info }) => (
                                <div key={connectionId} className={styles.onlineUser}>
                                    <div
                                        className={styles.userAvatar}
                                        style={{ backgroundColor: info?.color || '#ccc' }}
                                    >
                                        {(info?.name || 'A').charAt(0).toUpperCase()}
                                    </div>
                                    <span>{info?.name || 'Anonymous'}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </Modal>
        </Layout>
    );
};

export default CanvasBoardInner;
