/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Canvas Utilities for Collabboard
 * Professional Smart Alignment & Snapping Logic (Fabric.js v6 Compatible)
 */

// Module-level variables for alignment state
let vLines: any[] = [];
let hLines: any[] = [];
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
    });

    const text = new f.IText('Hello!', {
        fontSize: 18,
        fontFamily: 'Inter, system-ui, sans-serif',
        textAlign: 'center',
        originX: 'center',
        originY: 'center',
        width: width - 40,
        splitByGrapheme: true,
    });

    return new f.Group([rect, text], {
        left: x,
        top: y,
        data: { stickyNote: true, type: 'stickyNote' },
        subTargetCheck: true,
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

        vLines = [];
        hLines = [];

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
                        if (Math.abs(sv - tv) < 1) vLines.push(tv);
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
                        if (Math.abs(sh - th) < 1) hLines.push(th);
                    });
                });
            });
        }

        canvas.requestRenderAll();
    });

    canvas.on('after:render', (opt: any) => {
        const ctx = opt.ctx;
        if (!ctx || (vLines.length === 0 && hLines.length === 0)) return;

        const zoom = canvas.getZoom();
        const viewportMatrix = canvas.viewportTransform;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset to screen space
        
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);

        vLines.forEach(x => {
            const screenX = x * zoom + viewportMatrix[4];
            ctx.beginPath();
            ctx.moveTo(screenX, 0);
            ctx.lineTo(screenX, canvas.height);
            ctx.stroke();
        });

        hLines.forEach(y => {
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
        vLines = [];
        hLines = [];
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

export const handleStickyNoteDoubleClick = (canvas: any, opt: any) => {
    const target = opt.target;
    if (target && target.data?.type === 'stickyNote') {
        const textObj = target._objects?.find((obj: any) => obj.type === 'i-text' || obj.type === 'text');
        if (textObj) {
            canvas.setActiveObject(target);
            // In v6, we might need a more specific way to focus sub-objects, 
            // but usually setting the group active and allowing subTargetCheck handles it.
        }
    }
};
