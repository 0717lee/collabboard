/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Canvas Utilities for Collabboard
 * Professional Smart Alignment & Snapping Logic (Fabric.js v6 Compatible)
 */

// Canvas-specific alignment state to support multiple instances
const canvasLineState = new WeakMap<any, { vLines: number[]; hLines: number[] }>();

const getLineState = (canvas: any) => {
    let state = canvasLineState.get(canvas);
    if (!state) {
        state = { vLines: [], hLines: [] };
        canvasLineState.set(canvas, state);
    }
    return state;
};
const SNAP_THRESHOLD = 5;

/**
 * Factory for Sticky Notes
 */
export const createStickyNote = (f: any, x: number, y: number, color: string = '#FFF3A3') => {
    const width = 180;
    const height = 180;

    const rect = new f.Rect({
        width,
        height,
        fill: color,
        shadow: {
            color: 'rgba(0,0,0,0.1)',
            blur: 10,
            offsetX: 4,
            offsetY: 4,
        },
        originX: 'center',
        originY: 'center',
        rx: 12,
        ry: 12,
        selectable: false,
        evented: false,
    });

    const text = new f.IText('', {
        fontSize: 18,
        fontFamily: 'Inter, system-ui, sans-serif',
        textAlign: 'center',
        originX: 'center',
        originY: 'center',
        width: width - 40,
        splitByGrapheme: true,
        editable: true,
        fill: '#2f2a24',
        selectable: false,
        evented: false,
    });

    return new f.Group([rect, text], {
        left: x,
        top: y,
        originX: 'center',
        originY: 'center',
        data: { stickyNote: true, type: 'stickyNote' },
        subTargetCheck: true,
        interactive: true,
        objectCaching: false,
    });
};

/**
 * Initialize Professional Aligning Guidelines
 */
export const initAligningGuidelines = (canvas: any) => {
    canvas.on('object:moving', (e: any) => {
        const actObj = e.transform ? e.transform.target : e.target;
        if (!actObj) return;

        const others = canvas.getObjects().filter((obj: any) => 
            obj !== actObj && 
            obj.visible && 
            obj.selectable && 
            obj.data?.type !== 'connector' &&
            obj.data?.type !== 'guide'
        );

        const lineState = getLineState(canvas);
        lineState.vLines = [];
        lineState.hLines = [];

        const actBounds = actObj.getBoundingRect();
        const actCenter = actObj.getCenterPoint();

        // 6-axis candidates for the active object
        const actAxes = {
            vertical: [actBounds.left, actCenter.x, actBounds.left + actBounds.width],
            horizontal: [actBounds.top, actCenter.y, actBounds.top + actBounds.height]
        };

        // Collect best snap for each axis (smallest absolute offset wins)
        let bestVShift: number | null = null;
        let bestVDist = Infinity;
        let bestHShift: number | null = null;
        let bestHDist = Infinity;

        others.forEach((obj: any) => {
            const b = obj.getBoundingRect();
            const c = obj.getCenterPoint();
            const targetAxes = {
                vertical: [b.left, c.x, b.left + b.width],
                horizontal: [b.top, c.y, b.top + b.height]
            };

            // Check vertical alignment — find closest match
            actAxes.vertical.forEach((av) => {
                targetAxes.vertical.forEach((tv) => {
                    const dist = Math.abs(av - tv);
                    if (dist < SNAP_THRESHOLD && dist < bestVDist) {
                        bestVDist = dist;
                        bestVShift = tv - av;
                    }
                });
            });

            // Check horizontal alignment — find closest match
            actAxes.horizontal.forEach((ah) => {
                targetAxes.horizontal.forEach((th) => {
                    const dist = Math.abs(ah - th);
                    if (dist < SNAP_THRESHOLD && dist < bestHDist) {
                        bestHDist = dist;
                        bestHShift = th - ah;
                    }
                });
            });
        });

        // Apply best single snap per axis
        if (bestVShift !== null) {
            actObj.set('left', actObj.left + bestVShift);
            // Collect all lines that now match after the shift
            const snappedBounds = actObj.getBoundingRect();
            const snappedCenter = actObj.getCenterPoint();
            const snappedVAxes = [snappedBounds.left, snappedCenter.x, snappedBounds.left + snappedBounds.width];
            others.forEach((obj: any) => {
                const b = obj.getBoundingRect();
                const c = obj.getCenterPoint();
                [b.left, c.x, b.left + b.width].forEach((tv) => {
                    snappedVAxes.forEach((sv) => {
                        if (Math.abs(sv - tv) < 1) lineState.vLines.push(tv);
                    });
                });
            });
        }

        if (bestHShift !== null) {
            actObj.set('top', actObj.top + bestHShift);
            const snappedBounds = actObj.getBoundingRect();
            const snappedCenter = actObj.getCenterPoint();
            const snappedHAxes = [snappedBounds.top, snappedCenter.y, snappedBounds.top + snappedBounds.height];
            others.forEach((obj: any) => {
                const b = obj.getBoundingRect();
                const c = obj.getCenterPoint();
                [b.top, c.y, b.top + b.height].forEach((th) => {
                    snappedHAxes.forEach((sh) => {
                        if (Math.abs(sh - th) < 1) lineState.hLines.push(th);
                    });
                });
            });
        }

        canvas.requestRenderAll();
    });

    canvas.on('after:render', (opt: any) => {
        const ctx = opt.ctx;
        const lineState = getLineState(canvas);
        if (!ctx || (lineState.vLines.length === 0 && lineState.hLines.length === 0)) return;

        const zoom = canvas.getZoom();
        const viewportMatrix = canvas.viewportTransform;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset to screen space
        
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);

        lineState.vLines.forEach((x: number) => {
            const screenX = x * zoom + viewportMatrix[4];
            ctx.beginPath();
            ctx.moveTo(screenX, 0);
            ctx.lineTo(screenX, canvas.height);
            ctx.stroke();
        });

        lineState.hLines.forEach((y: number) => {
            const screenY = y * zoom + viewportMatrix[5];
            ctx.beginPath();
            ctx.moveTo(0, screenY);
            ctx.lineTo(canvas.width, screenY);
            ctx.stroke();
        });

        ctx.restore();
    });

    // Clear lines when transformation ends
    const clearLines = () => {
        const lineState = getLineState(canvas);
        lineState.vLines = [];
        lineState.hLines = [];
        canvas.requestRenderAll();
    };

    canvas.on('object:modified', clearLines);
    canvas.on('selection:cleared', clearLines);
    canvas.on('mouse:up', clearLines);
};

/**
 * Anchor points for connection system
 */
export const getAnchorPoints = (obj: any) => {
    const b = obj.getBoundingRect();
    return {
        top: { x: b.left + b.width / 2, y: b.top },
        bottom: { x: b.left + b.width / 2, y: b.top + b.height },
        left: { x: b.left, y: b.top + b.height / 2 },
        right: { x: b.left + b.width, y: b.top + b.height / 2 },
    };
};

export interface AnchorResult {
    obj: any;
    anchor: string;
    point: { x: number; y: number };
}

export const findNearestAnchor = (ptr: { x: number, y: number }, obs: any[], t: number = 40): AnchorResult | null => {
    let nearest: AnchorResult | null = null;
    let minD = Infinity;
    obs.forEach(obj => {
        if (obj.data?.type === 'connector' || !obj.selectable) return;
        const anchors = getAnchorPoints(obj);
        Object.entries(anchors).forEach(([key, pt]: [string, any]) => {
            const d = Math.sqrt(Math.pow(pt.x - ptr.x, 2) + Math.pow(pt.y - ptr.y, 2));
            if (d < t && d < minD) { 
                minD = d; 
                nearest = { obj, anchor: key, point: pt }; 
            }
        });
    });
    return nearest;
};

/**
 * Check if any IText on the canvas (including inside Groups) is currently being edited.
 * This is needed because Fabric.js Group.isEditing is always undefined.
 */
export const isAnyTextEditing = (canvas: any): boolean => {
    if (!canvas) return false;
    const objects = canvas.getObjects();
    for (const obj of objects) {
        if ((obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') && obj.isEditing) {
            return true;
        }
        // Check inside Groups
        if (obj._objects) {
            for (const child of obj._objects) {
                if ((child.type === 'i-text' || child.type === 'text' || child.type === 'textbox') && child.isEditing) {
                    return true;
                }
            }
        }
    }
    return false;
};

const restoreStickyNoteTextToGroup = (textObj: any, stickyNoteId: string) => {
    textObj.set({
        originX: 'center',
        originY: 'center',
        left: 0,
        top: 0,
        selectable: false,
        evented: false,
        editable: true,
        data: {
            ...(textObj.data || {}),
            isEditingStickyNote: false,
            stickyNoteId,
        },
    });
};

export const handleStickyNoteDoubleClick = (
    canvas: any,
    opt: any,
    onEditCommitted?: () => void,
    options?: { skipMouseUpFallback?: boolean }
) => {
    const target = opt.target;
    if (target && target.data?.type === 'stickyNote') {
        const textObj = target._objects?.find((obj: any) => obj.type === 'i-text' || obj.type === 'text');
        if (!textObj) return;

        const stickyNoteId = target.data?.id || `sticky-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        if (!target.data?.id) {
            target.set('data', { ...(target.data || {}), id: stickyNoteId });
            target.setCoords?.();
        }

        if (!textObj.data?.id) {
            textObj.set('data', { ...(textObj.data || {}), id: `sticky-text-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` });
        }

        // Record Group position for later re-grouping
        const groupLeft = target.left;
        const groupTop = target.top;

        (canvas as any).__stickyNoteEditingText = true;

        // Remove textObj from Group and add it to canvas as an independent object
        // so Fabric.js can properly enter editing mode on it
        const absPos = textObj.getAbsoluteCenterPoint?.() || {
            x: groupLeft + (target.originX === 'center' ? 0 : (target.width || 180) / 2),
            y: groupTop + (target.originY === 'center' ? 0 : (target.height || 180) / 2),
        };

        target.remove(textObj);
        textObj.set({
            left: absPos.x,
            top: absPos.y,
            originX: 'center',
            originY: 'center',
            evented: true,
            selectable: true,
            editable: true,
            // Mark it so we can avoid persisting a detached intermediate state
            data: {
                ...(textObj.data || {}),
                isEditingStickyNote: true,
                stickyNoteId,
                _stickyGroupRef: stickyNoteId,
            },
        });

        canvas.add(textObj);
        canvas.setActiveObject(textObj);
        textObj.enterEditing();
        textObj.selectAll();
        canvas.requestRenderAll();
        canvas.fire?.('selection:cleared');

        // When editing is done, put textObj back into the Group
        const reassembleStickyNote = () => {
            // Guard: if textObj is no longer on canvas or already reassembled, skip
            if (!canvas.getObjects().includes(textObj)) return;
            // Guard: if target group no longer exists, skip
            if (!canvas.getObjects().includes(target) && target.canvas !== canvas) return;

            canvas.remove(textObj);

            // Restore sticky note child text to its non-selectable in-group state.
            restoreStickyNoteTextToGroup(textObj, stickyNoteId);

            target.add(textObj);
            
            // Safety measure: Ensure the background rectangle remains strictly centered
            const rectObj = target._objects?.find((obj: any) => obj.type === 'rect');
            if (rectObj) {
                rectObj.set({ left: 0, top: 0, originX: 'center', originY: 'center' });
            }

            target.set({ left: groupLeft, top: groupTop });
            target.setCoords();
            canvas.setActiveObject(target);
            canvas.requestRenderAll();
            canvas.fire?.('selection:updated');
            (canvas as any).__stickyNoteEditingText = false;

            onEditCommitted?.();
        };

        const onEditingExit = () => {
            textObj.off('editing:exited', onEditingExit);
            reassembleStickyNote();
        };

        textObj.on('editing:exited', onEditingExit);

        // Safety: also listen for mouse:up outside editing to catch cases
        // where editing is exited without the event firing properly
        if (!options?.skipMouseUpFallback) {
            const onMouseUpHandler = () => {
                if ((canvas as any).__stickyNoteEditingText && textObj && !textObj.isEditing) {
                    canvas.off('mouse:up', onMouseUpHandler);
                    textObj.off('editing:exited', onEditingExit);
                    reassembleStickyNote();
                }
            };
            canvas.on('mouse:up', onMouseUpHandler);
        }
    }
};

/**
 * Reassemble any detached sticky note text objects back into their parent Groups.
 * This is a safety net for cases where serialization happens while text is being edited.
 * Call this before toJSON() or any serialization to ensure sticky notes stay intact.
 */
export const reassembleDetachedStickyNotes = (canvas: any) => {
    if (!canvas) return;

    const detachedTexts = canvas.getObjects().filter((obj: any) =>
        (obj.data?.isEditingStickyNote === true || obj.data?._stickyGroupRef) &&
        !obj.isEditing
    );

    for (const textObj of detachedTexts) {
        const stickyNoteId = textObj.data?.stickyNoteId;
        if (!stickyNoteId) continue;

        // Find the parent Group
        const parentGroup = canvas.getObjects().find((obj: any) =>
            obj.data?.id === stickyNoteId && obj._objects
        );

        if (!parentGroup) continue;

        const groupLeft = parentGroup.left;
        const groupTop = parentGroup.top;

        canvas.remove(textObj);

        restoreStickyNoteTextToGroup(textObj, stickyNoteId);

        parentGroup.add(textObj);

        const rectObj = parentGroup._objects?.find((obj: any) => obj.type === 'rect');
        if (rectObj) {
            rectObj.set({ left: 0, top: 0, originX: 'center', originY: 'center' });
        }

        parentGroup.set({ left: groupLeft, top: groupTop });
        parentGroup.setCoords();
        canvas.setActiveObject(parentGroup);
    }

    if (detachedTexts.length > 0) {
        canvas.requestRenderAll();
        canvas.fire?.('selection:updated');
    }
};
