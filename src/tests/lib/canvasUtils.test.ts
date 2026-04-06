import { describe, expect, it, vi } from 'vitest';
import {
    createStickyNote,
    handleStickyNoteDoubleClick,
    reassembleDetachedStickyNotes,
} from '@/components/Canvas/canvasUtils';

type FabricLikeObject = {
    type?: string;
    left?: number;
    top?: number;
    originX?: string;
    originY?: string;
    selectable?: boolean;
    evented?: boolean;
    editable?: boolean;
    isEditing?: boolean;
    data?: Record<string, unknown>;
    _objects?: FabricLikeObject[];
    canvas?: ReturnType<typeof createCanvasMock>;
    set: (keyOrProps: string | Record<string, unknown>, value?: unknown) => FabricLikeObject;
    setCoords?: ReturnType<typeof vi.fn>;
    getAbsoluteCenterPoint?: () => { x: number; y: number };
    remove?: (object: FabricLikeObject) => void;
    add?: (object: FabricLikeObject) => void;
    enterEditing?: ReturnType<typeof vi.fn>;
    selectAll?: ReturnType<typeof vi.fn>;
    on?: (event: string, handler: () => void) => void;
    off?: (event: string, handler: () => void) => void;
    emit?: (event: string) => void;
};

const createFabricObject = (initial: Partial<FabricLikeObject> = {}): FabricLikeObject => {
    const eventHandlers = new Map<string, Set<() => void>>();

    const obj: FabricLikeObject = {
        ...initial,
        data: initial.data ? { ...initial.data } : {},
        _objects: initial._objects ? [...initial._objects] : undefined,
        set(keyOrProps, value) {
            if (typeof keyOrProps === 'string') {
                (this as Record<string, unknown>)[keyOrProps] = value;
            } else {
                Object.assign(this, keyOrProps);
            }
            return this;
        },
        on(event, handler) {
            const handlers = eventHandlers.get(event) ?? new Set<() => void>();
            handlers.add(handler);
            eventHandlers.set(event, handlers);
        },
        off(event, handler) {
            eventHandlers.get(event)?.delete(handler);
        },
        emit(event) {
            eventHandlers.get(event)?.forEach((handler) => handler());
        },
    };

    return obj;
};

const createCanvasMock = () => {
    const objects: FabricLikeObject[] = [];
    const handlers = new Map<string, Set<() => void>>();

    return {
        add(object: FabricLikeObject) {
            if (!objects.includes(object)) {
                objects.push(object);
            }
            object.canvas = this;
        },
        remove(object: FabricLikeObject) {
            const index = objects.indexOf(object);
            if (index >= 0) {
                objects.splice(index, 1);
            }
            if (object.canvas === this) {
                object.canvas = undefined;
            }
        },
        getObjects() {
            return [...objects];
        },
        setActiveObject: vi.fn(),
        requestRenderAll: vi.fn(),
        on(event: string, handler: () => void) {
            const eventHandlers = handlers.get(event) ?? new Set<() => void>();
            eventHandlers.add(handler);
            handlers.set(event, eventHandlers);
        },
        off(event: string, handler: () => void) {
            handlers.get(event)?.delete(handler);
        },
        fire(event: string) {
            handlers.get(event)?.forEach((handler) => handler());
        },
    };
};

describe('canvasUtils sticky note reassembly', () => {
    it('creates sticky notes centered on the pointer position', () => {
        class RectMock {
            constructor(config: Record<string, unknown>) {
                Object.assign(this, config);
            }
        }

        class ITextMock {
            constructor(_text: string, config: Record<string, unknown>) {
                Object.assign(this, config);
            }
        }

        class GroupMock {
            constructor(objects: unknown[], config: Record<string, unknown>) {
                Object.assign(this, config);
                (this as Record<string, unknown>)._objects = objects;
            }
        }

        const stickyNote = createStickyNote(
            { Rect: RectMock, IText: ITextMock, Group: GroupMock },
            320,
            240,
            '#FFF3A3'
        ) as Record<string, unknown>;

        expect(stickyNote.left).toBe(320);
        expect(stickyNote.top).toBe(240);
        expect(stickyNote.originX).toBe('center');
        expect(stickyNote.originY).toBe('center');
    });

    it('restores sticky note text to non-selectable state after editing ends and refreshes selection', () => {
        const canvas = createCanvasMock();
        const selectionUpdated = vi.fn();
        canvas.on('selection:updated', selectionUpdated);
        const rect = createFabricObject({ type: 'rect', setCoords: vi.fn() });
        const text = createFabricObject({
            type: 'i-text',
            selectable: false,
            evented: false,
            editable: true,
            data: { id: 'sticky-text-1' },
            enterEditing: vi.fn(function (this: FabricLikeObject) {
                this.isEditing = true;
            }),
            selectAll: vi.fn(),
            getAbsoluteCenterPoint: () => ({ x: 120, y: 160 }),
        });
        const stickyNote = createFabricObject({
            type: 'group',
            left: 120,
            top: 160,
            originX: 'center',
            originY: 'center',
            data: { id: 'sticky-1', type: 'stickyNote' },
            _objects: [rect, text],
            setCoords: vi.fn(),
            remove(object) {
                this._objects = this._objects?.filter((candidate) => candidate !== object);
            },
            add(object) {
                this._objects = [...(this._objects ?? []), object];
            },
        });

        canvas.add(stickyNote);

        handleStickyNoteDoubleClick(canvas, { target: stickyNote });

        expect(canvas.getObjects()).toContain(text);
        expect(text.selectable).toBe(true);
        expect(text.evented).toBe(true);

        text.isEditing = false;
        text.emit?.('editing:exited');

        expect(stickyNote._objects).toContain(text);
        expect(text.selectable).toBe(false);
        expect(text.evented).toBe(false);
        expect(text.editable).toBe(true);
        expect(selectionUpdated).toHaveBeenCalledTimes(1);
    });

    it('skips the mouseup fallback when sticky note editing is opened programmatically', () => {
        const canvas = createCanvasMock();

        const rect = createFabricObject({ type: 'rect', setCoords: vi.fn() });
        const text = createFabricObject({
            type: 'i-text',
            selectable: false,
            evented: false,
            editable: true,
            data: { id: 'sticky-text-3' },
            enterEditing: vi.fn(function (this: FabricLikeObject) {
                this.isEditing = true;
            }),
            selectAll: vi.fn(),
            getAbsoluteCenterPoint: () => ({ x: 180, y: 220 }),
        });
        const stickyNote = createFabricObject({
            type: 'group',
            left: 180,
            top: 220,
            originX: 'center',
            originY: 'center',
            data: { id: 'sticky-3', type: 'stickyNote' },
            _objects: [rect, text],
            setCoords: vi.fn(),
            remove(object) {
                this._objects = this._objects?.filter((candidate) => candidate !== object);
            },
            add(object) {
                this._objects = [...(this._objects ?? []), object];
            },
        });

        const canvasOnSpy = vi.spyOn(canvas, 'on');
        canvas.add(stickyNote);

        handleStickyNoteDoubleClick(canvas, { target: stickyNote }, undefined, {
            skipMouseUpFallback: true,
        });

        expect(canvasOnSpy).not.toHaveBeenCalledWith('mouse:up', expect.any(Function));
    });

    it('restores detached sticky note text to non-selectable state during safety reassembly', () => {
        const canvas = createCanvasMock();
        const rect = createFabricObject({ type: 'rect', setCoords: vi.fn() });
        const text = createFabricObject({
            type: 'i-text',
            selectable: true,
            evented: true,
            editable: true,
            isEditing: false,
            data: {
                id: 'sticky-text-2',
                stickyNoteId: 'sticky-2',
                isEditingStickyNote: true,
                _stickyGroupRef: 'sticky-2',
            },
        });
        const stickyNote = createFabricObject({
            type: 'group',
            left: 240,
            top: 260,
            data: { id: 'sticky-2', type: 'stickyNote' },
            _objects: [rect],
            setCoords: vi.fn(),
            add(object) {
                this._objects = [...(this._objects ?? []), object];
            },
        });

        canvas.add(stickyNote);
        canvas.add(text);

        reassembleDetachedStickyNotes(canvas);

        expect(canvas.getObjects()).not.toContain(text);
        expect(stickyNote._objects).toContain(text);
        expect(text.selectable).toBe(false);
        expect(text.evented).toBe(false);
        expect(text.editable).toBe(true);
        expect(text.data?.isEditingStickyNote).toBe(false);
    });

    it('does not reassemble sticky note text while it is actively being edited', () => {
        const canvas = createCanvasMock();
        const rect = createFabricObject({ type: 'rect', setCoords: vi.fn() });
        const text = createFabricObject({
            type: 'i-text',
            selectable: true,
            evented: true,
            editable: true,
            isEditing: true,
            data: {
                id: 'sticky-text-4',
                stickyNoteId: 'sticky-4',
                isEditingStickyNote: true,
                _stickyGroupRef: 'sticky-4',
            },
        });
        const stickyNote = createFabricObject({
            type: 'group',
            left: 260,
            top: 280,
            data: { id: 'sticky-4', type: 'stickyNote' },
            _objects: [rect],
            setCoords: vi.fn(),
            add(object) {
                this._objects = [...(this._objects ?? []), object];
            },
        });

        canvas.add(stickyNote);
        canvas.add(text);

        reassembleDetachedStickyNotes(canvas);

        expect(canvas.getObjects()).toContain(text);
        expect(stickyNote._objects).not.toContain(text);
        expect(text.isEditing).toBe(true);
        expect(text.data?.isEditingStickyNote).toBe(true);
    });
});
