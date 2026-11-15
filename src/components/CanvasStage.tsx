import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Layers,
  Maximize2,
  Move,
  Redo2,
  RotateCcw,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  isShiftTransformActive,
  Layer,
  OnionSkinState,
  Project,
  ShiftTraceState,
  ShiftTraceTransform,
  ToolState,
  ViewportState,
} from '../types/animation';
import {
  drawShapePreview,
  drawSmoothStroke,
  renderCompositeFrameSync,
  renderTintedFrameSync,
  rgbaToHex,
  scanlineFloodFill,
  StrokePoint,
} from '../utils/canvasDrawing';

interface CanvasStageProps {
  project: Project;
  toolState: ToolState;
  onionSkin: OnionSkinState;
  shiftTrace: ShiftTraceState;
  onToggleShiftTrace: (forceValue?: boolean) => void;
  onSetShiftTarget: (target: 'prev' | 'next') => void;
  onUpdateShiftTransform: (
    target: 'prev' | 'next',
    patch: Partial<ShiftTraceTransform>
  ) => void;
  onResetShiftTransform: (target?: 'prev' | 'next' | 'both') => void;
  viewport: ViewportState;
  setViewport: React.Dispatch<React.SetStateAction<ViewportState>>;
  onResetViewport: () => void;
  isPlaying: boolean;
  showGrid: boolean;
  imageCacheRef: React.MutableRefObject<Map<string, HTMLImageElement>>;
  cacheVersion: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onCommitCel: (frameIndex: number, layerId: string, dataUrl: string | null) => void;
  onPickColor: (hex: string) => void;
  onToggleOnionSkin: () => void;
  onPrevFrame: () => void;
  onNextFrame: () => void;
  onAddFrame: () => void;
}

export const CanvasStage: React.FC<CanvasStageProps> = ({
  project,
  toolState,
  onionSkin,
  shiftTrace,
  onToggleShiftTrace,
  onSetShiftTarget,
  onUpdateShiftTransform,
  onResetShiftTransform,
  viewport,
  setViewport,
  onResetViewport,
  isPlaying,
  showGrid,
  imageCacheRef,
  cacheVersion,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onCommitCel,
  onPickColor,
  onToggleOnionSkin,
  onPrevFrame,
  onNextFrame,
  onAddFrame,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const celBoxRef = useRef<HTMLDivElement>(null);
  const belowCanvasRef = useRef<HTMLCanvasElement>(null);
  const activeCelCanvasRef = useRef<HTMLCanvasElement>(null);
  const liveStrokeCanvasRef = useRef<HTMLCanvasElement>(null);
  const aboveCanvasRef = useRef<HTMLCanvasElement>(null);
  const tintScratchRef = useRef<HTMLCanvasElement | null>(null);
  const eraserBackupRef = useRef<ImageData | null>(null);

  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [spaceHeld, setSpaceHeld] = useState(false);

  // Gesture / Drawing state refs
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartRef = useRef<{
    dist: number;
    midX: number;
    midY: number;
    scale: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const panDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origOffsetX: number;
    origOffsetY: number;
  } | null>(null);
  const drawingRef = useRef<{
    pointerId: number;
    frameIndex: number;
    layerId: string;
    tool: ToolState['tool'];
    points: StrokePoint[];
    startPoint: { x: number; y: number };
    lastPoint: { x: number; y: number };
  } | null>(null);
  const shiftDragRef = useRef<{
    pointerId: number;
    mode: 'translate' | 'rotate';
    target: 'prev' | 'next';
    startClientX: number;
    startClientY: number;
    origTransform: ShiftTraceTransform;
    pivotClientX: number;
    pivotClientY: number;
    startPointerAngle: number;
  } | null>(null);
  const shiftPinchRef = useRef<{
    target: 'prev' | 'next';
    dist: number;
    angle: number;
    midX: number;
    midY: number;
    origTransform: ShiftTraceTransform;
  } | null>(null);

  // Observe stage dimensions for responsive fit scale
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Spacebar temporary pan
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === 'Space' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        setSpaceHeld(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const baseFitScale = useMemo(() => {
    const padX = containerSize.width < 640 ? 20 : 48;
    const padY = containerSize.height < 500 ? 20 : 48;
    const availW = Math.max(120, containerSize.width - padX);
    const availH = Math.max(120, containerSize.height - padY);
    return Math.min(availW / project.width, availH / project.height, 1.5);
  }, [containerSize.width, containerSize.height, project.width, project.height]);

  const displayWidth = project.width * baseFitScale;
  const displayHeight = project.height * baseFitScale;

  const currentFrame = project.frames[project.currentFrameIndex];
  const activeLayerIndex = project.layers.findIndex((l) => l.id === project.activeLayerId);
  const activeLayer: Layer | undefined = project.layers[activeLayerIndex];

  // Composite below, active, and above layer canvases whenever state updates
  useEffect(() => {
    if (!currentFrame) return;

    if (!tintScratchRef.current) {
      tintScratchRef.current = document.createElement('canvas');
    }

    const belowCtx = belowCanvasRef.current?.getContext('2d');
    const activeCtx = activeCelCanvasRef.current?.getContext('2d');
    const aboveCtx = aboveCanvasRef.current?.getContext('2d');

    const w = project.width;
    const h = project.height;
    const cache = imageCacheRef.current;

    if (belowCtx) {
      belowCtx.clearRect(0, 0, w, h);

      // Onion skinning (only when paused / editing)
      if (!isPlaying && onionSkin.enabled) {
        for (let offset = onionSkin.prevFrames; offset >= 1; offset--) {
          const prevFrame = project.frames[project.currentFrameIndex - offset];
          if (prevFrame) {
            const alpha = onionSkin.opacity * (offset === 1 ? 1 : 0.45);
            renderTintedFrameSync(
              belowCtx,
              tintScratchRef.current,
              w,
              h,
              prevFrame,
              project.layers,
              '#FB7185',
              alpha,
              cache,
              offset === 1 ? shiftTrace.prev : undefined
            );
          }
        }
        for (let offset = onionSkin.nextFrames; offset >= 1; offset--) {
          const nextFrame = project.frames[project.currentFrameIndex + offset];
          if (nextFrame) {
            const alpha = onionSkin.opacity * (offset === 1 ? 1 : 0.45);
            renderTintedFrameSync(
              belowCtx,
              tintScratchRef.current,
              w,
              h,
              nextFrame,
              project.layers,
              '#38BDF8',
              alpha,
              cache,
              offset === 1 ? shiftTrace.next : undefined
            );
          }
        }
      }

      // Visible layers strictly below activeLayerIndex
      for (let i = 0; i < activeLayerIndex; i++) {
        const layer = project.layers[i];
        if (!layer.visible || layer.opacity <= 0) continue;
        const url = currentFrame.cels[layer.id];
        if (!url) continue;
        const img = cache.get(url);
        if (!img) continue;
        belowCtx.save();
        belowCtx.globalAlpha = layer.opacity;
        belowCtx.drawImage(img, 0, 0, w, h);
        belowCtx.restore();
      }
    }

    if (activeCtx && !drawingRef.current) {
      activeCtx.clearRect(0, 0, w, h);
      if (activeLayer) {
        const url = currentFrame.cels[activeLayer.id];
        if (url) {
          const img = cache.get(url);
          if (img) {
            activeCtx.drawImage(img, 0, 0, w, h);
          }
        }
      }
    }

    if (aboveCtx) {
      aboveCtx.clearRect(0, 0, w, h);
      for (let i = activeLayerIndex + 1; i < project.layers.length; i++) {
        const layer = project.layers[i];
        if (!layer.visible || layer.opacity <= 0) continue;
        const url = currentFrame.cels[layer.id];
        if (!url) continue;
        const img = cache.get(url);
        if (!img) continue;
        aboveCtx.save();
        aboveCtx.globalAlpha = layer.opacity;
        aboveCtx.drawImage(img, 0, 0, w, h);
        aboveCtx.restore();
      }
    }
  }, [
    currentFrame,
    project.width,
    project.height,
    project.layers,
    project.frames,
    project.currentFrameIndex,
    activeLayerIndex,
    activeLayer,
    onionSkin,
    shiftTrace.prev,
    shiftTrace.next,
    isPlaying,
    cacheVersion,
    imageCacheRef,
  ]);

  const clientToCanvasPoint = useCallback(
    (clientX: number, clientY: number, pressure = 0.5): StrokePoint => {
      const box = celBoxRef.current;
      if (!box) return { x: 0, y: 0, pressure };
      const rect = box.getBoundingClientRect();
      const x = ((clientX - rect.left) / Math.max(1, rect.width)) * project.width;
      const y = ((clientY - rect.top) / Math.max(1, rect.height)) * project.height;
      return { x, y, pressure: pressure > 0 ? pressure : 0.5 };
    },
    [project.width, project.height]
  );

  const cancelActiveDrawing = useCallback(() => {
    const drawing = drawingRef.current;
    if (!drawing) return;

    const liveCtx = liveStrokeCanvasRef.current?.getContext('2d');
    liveCtx?.clearRect(0, 0, project.width, project.height);

    if (drawing.tool === 'eraser' && eraserBackupRef.current) {
      const activeCtx = activeCelCanvasRef.current?.getContext('2d');
      activeCtx?.putImageData(eraserBackupRef.current, 0, 0);
      eraserBackupRef.current = null;
    }

    drawingRef.current = null;
  }, [project.width, project.height]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Ignore right-click except pan
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // 2+ pointers => Two-finger Shift/Pinch/Rotate when in Shift mode, or Viewport Pinch-Zoom/Pan
    if (activePointersRef.current.size === 2) {
      cancelActiveDrawing();
      panDragRef.current = null;
      shiftDragRef.current = null;

      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;

      if (shiftTrace.editing) {
        const angle = (Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) * 180) / Math.PI;
        const target = shiftTrace.activeTarget;
        shiftPinchRef.current = {
          target,
          dist: Math.max(10, dist),
          angle,
          midX,
          midY,
          origTransform: { ...shiftTrace[target] },
        };
        return;
      }

      pinchStartRef.current = {
        dist: Math.max(10, dist),
        midX,
        midY,
        scale: viewport.scale,
        offsetX: viewport.offsetX,
        offsetY: viewport.offsetY,
      };
      return;
    }

    if (activePointersRef.current.size > 2) return;

    // Single pointer Pan (Pan tool, middle mouse, or Space held)
    if (toolState.tool === 'pan' || spaceHeld || e.button === 1) {
      panDragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origOffsetX: viewport.offsetX,
        origOffsetY: viewport.offsetY,
      };
      return;
    }

    // Single pointer Shift & Trace translate
    if (shiftTrace.editing) {
      const target = shiftTrace.activeTarget;
      shiftDragRef.current = {
        pointerId: e.pointerId,
        mode: 'translate',
        target,
        startClientX: e.clientX,
        startClientY: e.clientY,
        origTransform: { ...shiftTrace[target] },
        pivotClientX: 0,
        pivotClientY: 0,
        startPointerAngle: 0,
      };
      return;
    }

    if (isPlaying || !currentFrame || !activeLayer) return;

    const pt = clientToCanvasPoint(e.clientX, e.clientY, e.pressure);

    // Eyedropper works even on locked layers
    if (toolState.tool === 'eyedropper') {
      const sampleCanvas = document.createElement('canvas');
      sampleCanvas.width = project.width;
      sampleCanvas.height = project.height;
      const sCtx = sampleCanvas.getContext('2d');
      if (sCtx) {
        renderCompositeFrameSync(
          sCtx,
          project.width,
          project.height,
          currentFrame,
          project.layers,
          project.backgroundColor,
          imageCacheRef.current,
          true
        );
        const sx = Math.max(0, Math.min(project.width - 1, Math.floor(pt.x)));
        const sy = Math.max(0, Math.min(project.height - 1, Math.floor(pt.y)));
        const pixel = sCtx.getImageData(sx, sy, 1, 1).data;
        onPickColor(rgbaToHex(pixel[0], pixel[1], pixel[2]));
      }
      return;
    }

    if (activeLayer.locked || !activeLayer.visible) return;

    // Flood Fill
    if (toolState.tool === 'fill') {
      const activeCtx = activeCelCanvasRef.current?.getContext('2d');
      if (!activeCtx) return;
      const imgData = activeCtx.getImageData(0, 0, project.width, project.height);
      const changed = scanlineFloodFill(
        imgData,
        pt.x,
        pt.y,
        toolState.color,
        toolState.brushOpacity
      );
      if (changed) {
        activeCtx.putImageData(imgData, 0, 0);
        const dataUrl = activeCelCanvasRef.current!.toDataURL('image/png');
        onCommitCel(project.currentFrameIndex, activeLayer.id, dataUrl);
      }
      return;
    }

    // Brush, Eraser, Line, Rect, Circle
    if (toolState.tool === 'eraser') {
      const activeCtx = activeCelCanvasRef.current?.getContext('2d');
      if (activeCtx) {
        eraserBackupRef.current = activeCtx.getImageData(0, 0, project.width, project.height);
      }
    }

    drawingRef.current = {
      pointerId: e.pointerId,
      frameIndex: project.currentFrameIndex,
      layerId: activeLayer.id,
      tool: toolState.tool,
      points: [pt],
      startPoint: { x: pt.x, y: pt.y },
      lastPoint: { x: pt.x, y: pt.y },
    };

    // Draw initial dot for brush/eraser
    if (toolState.tool === 'brush') {
      const liveCtx = liveStrokeCanvasRef.current?.getContext('2d');
      if (liveCtx) {
        liveCtx.clearRect(0, 0, project.width, project.height);
        drawSmoothStroke(liveCtx, [pt], toolState.color, toolState.brushSize);
      }
    } else if (toolState.tool === 'eraser') {
      const activeCtx = activeCelCanvasRef.current?.getContext('2d');
      if (activeCtx) {
        activeCtx.save();
        activeCtx.globalCompositeOperation = 'destination-out';
        drawSmoothStroke(activeCtx, [pt], '#000000', toolState.eraserSize);
        activeCtx.restore();
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // Two-finger Shift/Scale/Rotate when in Shift & Trace mode
    if (activePointersRef.current.size === 2 && shiftPinchRef.current) {
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      const angle = (Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) * 180) / Math.PI;
      const start = shiftPinchRef.current;

      const canvasScaleFactor = Math.max(0.05, baseFitScale * viewport.scale);
      const dxCanvas = (midX - start.midX) / canvasScaleFactor;
      const dyCanvas = (midY - start.midY) / canvasScaleFactor;
      const nextScale = Math.max(
        0.25,
        Math.min(3, Number((start.origTransform.scale * (dist / start.dist)).toFixed(2)))
      );
      let nextRot = start.origTransform.rotationDeg + (angle - start.angle);
      if (nextRot > 180) nextRot -= 360;
      if (nextRot < -180) nextRot += 360;

      onUpdateShiftTransform(start.target, {
        offsetX: Math.round(start.origTransform.offsetX + dxCanvas),
        offsetY: Math.round(start.origTransform.offsetY + dyCanvas),
        scale: nextScale,
        rotationDeg: Math.round(nextRot),
      });
      return;
    }

    // Pinch / two-finger pan
    if (activePointersRef.current.size === 2 && pinchStartRef.current) {
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      const start = pinchStartRef.current;

      const nextScale = Math.max(0.25, Math.min(5, start.scale * (dist / start.dist)));
      const dx = midX - start.midX;
      const dy = midY - start.midY;

      setViewport({
        scale: nextScale,
        offsetX: start.offsetX + dx,
        offsetY: start.offsetY + dy,
      });
      return;
    }

    // Single pointer Shift & Trace drag (translate or rotate knob)
    if (shiftDragRef.current && shiftDragRef.current.pointerId === e.pointerId) {
      const sd = shiftDragRef.current;
      if (sd.mode === 'translate') {
        const canvasScaleFactor = Math.max(0.05, baseFitScale * viewport.scale);
        const dxCanvas = (e.clientX - sd.startClientX) / canvasScaleFactor;
        const dyCanvas = (e.clientY - sd.startClientY) / canvasScaleFactor;
        onUpdateShiftTransform(sd.target, {
          offsetX: Math.round(sd.origTransform.offsetX + dxCanvas),
          offsetY: Math.round(sd.origTransform.offsetY + dyCanvas),
        });
      } else {
        const currentAngle =
          (Math.atan2(e.clientY - sd.pivotClientY, e.clientX - sd.pivotClientX) * 180) /
          Math.PI;
        let delta = currentAngle - sd.startPointerAngle;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        let nextRot = sd.origTransform.rotationDeg + delta;
        if (nextRot > 180) nextRot -= 360;
        if (nextRot < -180) nextRot += 360;
        if (e.shiftKey) {
          nextRot = Math.round(nextRot / 15) * 15;
        }
        onUpdateShiftTransform(sd.target, {
          rotationDeg: Math.round(nextRot),
        });
      }
      return;
    }

    // Single pointer pan
    if (panDragRef.current && panDragRef.current.pointerId === e.pointerId) {
      const dx = e.clientX - panDragRef.current.startX;
      const dy = e.clientY - panDragRef.current.startY;
      setViewport((prev) => ({
        ...prev,
        offsetX: panDragRef.current!.origOffsetX + dx,
        offsetY: panDragRef.current!.origOffsetY + dy,
      }));
      return;
    }

    const drawing = drawingRef.current;
    if (!drawing || drawing.pointerId !== e.pointerId) return;

    const pt = clientToCanvasPoint(e.clientX, e.clientY, e.pressure);
    drawing.lastPoint = { x: pt.x, y: pt.y };

    if (drawing.tool === 'brush') {
      drawing.points.push(pt);
      const liveCtx = liveStrokeCanvasRef.current?.getContext('2d');
      if (liveCtx) {
        liveCtx.clearRect(0, 0, project.width, project.height);
        drawSmoothStroke(liveCtx, drawing.points, toolState.color, toolState.brushSize);
      }
    } else if (drawing.tool === 'eraser') {
      const prevPt = drawing.points[drawing.points.length - 1];
      drawing.points.push(pt);
      const activeCtx = activeCelCanvasRef.current?.getContext('2d');
      if (activeCtx) {
        activeCtx.save();
        activeCtx.globalCompositeOperation = 'destination-out';
        drawSmoothStroke(activeCtx, [prevPt, pt], '#000000', toolState.eraserSize);
        activeCtx.restore();
      }
    } else if (drawing.tool === 'line' || drawing.tool === 'rect' || drawing.tool === 'circle') {
      const liveCtx = liveStrokeCanvasRef.current?.getContext('2d');
      if (liveCtx) {
        liveCtx.clearRect(0, 0, project.width, project.height);
        drawShapePreview(
          liveCtx,
          drawing.tool,
          drawing.startPoint,
          drawing.lastPoint,
          toolState.color,
          toolState.brushSize,
          toolState.fillShapes
        );
      }
    }
  };

  const finishPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(e.pointerId);
    if (activePointersRef.current.size < 2) {
      pinchStartRef.current = null;
      shiftPinchRef.current = null;
    }

    if (shiftDragRef.current?.pointerId === e.pointerId) {
      shiftDragRef.current = null;
    }

    if (panDragRef.current?.pointerId === e.pointerId) {
      panDragRef.current = null;
    }

    const drawing = drawingRef.current;
    if (!drawing || drawing.pointerId !== e.pointerId) return;

    const activeCanvas = activeCelCanvasRef.current;
    const activeCtx = activeCanvas?.getContext('2d');
    const liveCanvas = liveStrokeCanvasRef.current;
    const liveCtx = liveCanvas?.getContext('2d');

    if (activeCanvas && activeCtx) {
      if (drawing.tool !== 'eraser' && liveCanvas && liveCtx) {
        activeCtx.save();
        activeCtx.globalAlpha = toolState.brushOpacity;
        activeCtx.drawImage(liveCanvas, 0, 0, project.width, project.height);
        activeCtx.restore();
        liveCtx.clearRect(0, 0, project.width, project.height);
      }

      eraserBackupRef.current = null;
      const dataUrl = activeCanvas.toDataURL('image/png');
      drawingRef.current = null;
      onCommitCel(drawing.frameIndex, drawing.layerId, dataUrl);
    } else {
      drawingRef.current = null;
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > 0) {
      const factor = e.deltaY < 0 ? 1.09 : 0.92;
      setViewport((prev) => ({
        ...prev,
        scale: Math.max(0.25, Math.min(5, prev.scale * factor)),
      }));
    }
  };

  const startRotateKnobDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const containerEl = containerRef.current;
    const box = celBoxRef.current;
    if (!containerEl || !box) return;

    containerEl.setPointerCapture(e.pointerId);
    const rect = box.getBoundingClientRect();
    const target = shiftTrace.activeTarget;
    const tr = shiftTrace[target];
    const pivotClientX =
      rect.left + rect.width / 2 + (tr.offsetX / project.width) * rect.width;
    const pivotClientY =
      rect.top + rect.height / 2 + (tr.offsetY / project.height) * rect.height;
    const startPointerAngle =
      (Math.atan2(e.clientY - pivotClientY, e.clientX - pivotClientX) * 180) / Math.PI;

    shiftDragRef.current = {
      pointerId: e.pointerId,
      mode: 'rotate',
      target,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origTransform: { ...tr },
      pivotClientX,
      pivotClientY,
      startPointerAngle,
    };
  };

  const activeShift = shiftTrace[shiftTrace.activeTarget];
  const anyShifted =
    isShiftTransformActive(shiftTrace.prev) || isShiftTransformActive(shiftTrace.next);

  const cursorStyle =
    shiftTrace.editing
      ? 'cursor-move'
      : toolState.tool === 'pan' || spaceHeld
      ? 'cursor-grab active:cursor-grabbing'
      : toolState.tool === 'eyedropper'
      ? 'cursor-crosshair'
      : activeLayer?.locked
      ? 'cursor-not-allowed'
      : 'cursor-crosshair';

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      className={`flex-1 relative overflow-hidden bg-[#141417] flex items-center justify-center select-none touch-none ${cursorStyle}`}
    >
      {/* Top-Left Floating History & Layer Status */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute top-3 left-3 z-20 flex items-center gap-1.5"
      >
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
          className="min-w-[44px] min-h-[44px] md:min-w-[34px] md:min-h-[34px] rounded-lg bg-[#1D1D21]/90 backdrop-blur-sm border border-[#32323A] text-[#E4E4E7] hover:bg-[#26262C] disabled:opacity-35 flex items-center justify-center transition-colors cursor-pointer disabled:pointer-events-none"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          aria-label="Redo"
          className="min-w-[44px] min-h-[44px] md:min-w-[34px] md:min-h-[34px] rounded-lg bg-[#1D1D21]/90 backdrop-blur-sm border border-[#32323A] text-[#E4E4E7] hover:bg-[#26262C] disabled:opacity-35 flex items-center justify-center transition-colors cursor-pointer disabled:pointer-events-none"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        {activeLayer && (!activeLayer.visible || activeLayer.locked) && !shiftTrace.editing && (
          <div className="px-2.5 h-8 rounded-lg bg-[#1D1D21]/95 border border-amber-500/40 text-amber-300 text-xs font-medium flex items-center whitespace-nowrap">
            {activeLayer.locked ? 'Layer Locked' : 'Layer Hidden'}
          </div>
        )}
      </div>

      {/* Top-Right Floating Zoom & Mobile Onion/Shift Toggles */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute top-3 right-3 z-20 flex items-center gap-1.5"
      >
        <button
          type="button"
          onClick={() => onToggleShiftTrace()}
          title="Shift & Trace (S)"
          aria-label="Toggle Shift and Trace"
          aria-pressed={shiftTrace.editing}
          className={`md:hidden min-h-[44px] px-2.5 rounded-lg border text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
            shiftTrace.editing
              ? 'bg-[#F59E0B] border-[#F59E0B] text-[#141417] font-semibold'
              : anyShifted
              ? 'bg-[#26262C]/95 border-[#F59E0B]/60 text-[#F59E0B]'
              : 'bg-[#1D1D21]/90 border-[#32323A] text-[#A1A1AA]'
          }`}
        >
          <Move className="w-4 h-4" />
          <span>Shift</span>
        </button>

        <button
          type="button"
          onClick={onToggleOnionSkin}
          title="Toggle Onion Skin (O)"
          aria-label="Toggle Onion Skin"
          aria-pressed={onionSkin.enabled}
          className={`md:hidden min-h-[44px] px-2.5 rounded-lg border text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
            onionSkin.enabled
              ? 'bg-[#26262C]/95 border-[#F59E0B]/50 text-[#F59E0B]'
              : 'bg-[#1D1D21]/90 border-[#32323A] text-[#A1A1AA]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Onion</span>
        </button>

        <div className="hidden sm:flex items-center bg-[#1D1D21]/90 backdrop-blur-sm border border-[#32323A] rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() =>
              setViewport((prev) => ({
                ...prev,
                scale: Math.max(0.25, Number((prev.scale - 0.15).toFixed(2))),
              }))
            }
            aria-label="Zoom Out"
            className="w-8 h-8 flex items-center justify-center text-[#A1A1AA] hover:text-[#F4F4F6] hover:bg-[#26262C] cursor-pointer"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="px-2 text-xs font-mono-tabular text-[#E4E4E7] min-w-[46px] text-center">
            {Math.round(viewport.scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() =>
              setViewport((prev) => ({
                ...prev,
                scale: Math.min(5, Number((prev.scale + 0.15).toFixed(2))),
              }))
            }
            aria-label="Zoom In"
            className="w-8 h-8 flex items-center justify-center text-[#A1A1AA] hover:text-[#F4F4F6] hover:bg-[#26262C] cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={onResetViewport}
          title="Fit Canvas to Stage"
          aria-label="Fit Canvas to Stage"
          className="min-w-[44px] min-h-[44px] md:min-w-[34px] md:min-h-[34px] rounded-lg bg-[#1D1D21]/90 backdrop-blur-sm border border-[#32323A] text-[#A1A1AA] hover:text-[#F4F4F6] hover:bg-[#26262C] flex items-center justify-center transition-colors cursor-pointer"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Top-Center Floating Storyboard HUD OR Active Shift Indicator */}
      {!shiftTrace.editing && anyShifted ? (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="flex items-center gap-2 absolute top-15 sm:top-3 left-1/2 -translate-x-1/2 z-20 px-3 h-8 rounded-lg bg-[#1D1D21]/95 backdrop-blur-sm border border-[#F59E0B]/50 text-xs shadow-lg whitespace-nowrap"
        >
          <span className="text-[#F59E0B] font-medium">Shifted Peg</span>
          <button
            type="button"
            onClick={() => onToggleShiftTrace(true)}
            className="text-[#E4E4E7] hover:text-white underline underline-offset-2 cursor-pointer"
          >
            Adjust
          </button>
          <button
            type="button"
            onClick={() => onResetShiftTransform('both')}
            className="text-[#A1A1AA] hover:text-rose-300 cursor-pointer"
          >
            Re-Peg
          </button>
        </div>
      ) : (
        currentFrame?.storyboard && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="hidden sm:flex items-center gap-2 absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3 h-8 rounded-lg bg-[#1D1D21]/90 backdrop-blur-sm border border-[#32323A] text-xs pointer-events-none max-w-[42vw]"
          >
            <span className="font-mono-tabular font-semibold text-[#F59E0B] whitespace-nowrap">
              {currentFrame.storyboard.shotNumber}
              {currentFrame.storyboard.subShotNumber
                ? ` · ${currentFrame.storyboard.subShotNumber}`
                : ''}
            </span>
            <span className="text-[#E4E4E7] truncate">
              {currentFrame.storyboard.subShotTitle || currentFrame.storyboard.shotTitle}
            </span>
          </div>
        )
      )}

      {/* Mobile Quick Frame Stepper Corners (hidden while Shift & Trace HUD is open) */}
      {!shiftTrace.editing && (
        <>
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="md:hidden absolute bottom-3 left-3 z-20 flex items-center gap-1.5"
          >
            <button
              type="button"
              onClick={onPrevFrame}
              disabled={project.currentFrameIndex === 0}
              aria-label="Previous Frame"
              className="min-w-[44px] min-h-[44px] px-3 rounded-lg bg-[#1D1D21]/90 backdrop-blur-sm border border-[#32323A] text-xs font-medium text-[#E4E4E7] disabled:opacity-35"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={onNextFrame}
              disabled={project.currentFrameIndex >= project.frames.length - 1}
              aria-label="Next Frame"
              className="min-w-[44px] min-h-[44px] px-3 rounded-lg bg-[#1D1D21]/90 backdrop-blur-sm border border-[#32323A] text-xs font-medium text-[#E4E4E7] disabled:opacity-35"
            >
              Next
            </button>
          </div>

          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="md:hidden absolute bottom-3 right-3 z-20"
          >
            <button
              type="button"
              onClick={onAddFrame}
              aria-label="Add Blank Frame"
              className="min-w-[44px] min-h-[44px] px-3.5 rounded-lg bg-[#26262C]/95 backdrop-blur-sm border border-[#32323A] text-xs font-semibold text-[#F59E0B]"
            >
              + Frame
            </button>
          </div>
        </>
      )}

      {/* Floating Shift & Trace Peg Bar HUD */}
      {shiftTrace.editing && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 w-[calc(100%-24px)] max-w-md bg-[#1D1D21]/95 backdrop-blur-md border border-[#32323A] rounded-2xl shadow-2xl p-3 space-y-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            {/* Prev / Next Ghost Target Segmented Control */}
            <div className="flex items-center bg-[#141417] border border-[#32323A] rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => onSetShiftTarget('prev')}
                className={`min-h-[34px] px-2.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  shiftTrace.activeTarget === 'prev'
                    ? 'bg-[#FB7185]/20 text-[#FB7185]'
                    : 'text-[#A1A1AA] hover:text-[#E4E4E7]'
                }`}
              >
                Prev Ghost
              </button>
              <button
                type="button"
                onClick={() => onSetShiftTarget('next')}
                className={`min-h-[34px] px-2.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  shiftTrace.activeTarget === 'next'
                    ? 'bg-[#38BDF8]/20 text-[#38BDF8]'
                    : 'text-[#A1A1AA] hover:text-[#E4E4E7]'
                }`}
              >
                Next Ghost
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onResetShiftTransform(shiftTrace.activeTarget)}
                title="Re-peg active ghost to original position"
                className="min-h-[36px] px-2.5 rounded-lg bg-[#26262C] hover:bg-[#32323A] text-xs font-medium text-[#E4E4E7] flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Re-Peg</span>
              </button>
              <button
                type="button"
                onClick={() => onToggleShiftTrace(false)}
                className="min-h-[36px] px-3 rounded-lg bg-[#F59E0B] hover:bg-[#FBBF24] text-[#141417] text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Draw</span>
              </button>
            </div>
          </div>

          {/* Precision Rotation & Scale Sliders + Numeric Readout */}
          <div className="grid grid-cols-2 gap-3 pt-0.5">
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-[#A1A1AA]">Rotate</span>
                <span className="font-mono-tabular text-[#F4F4F6]">
                  {Math.round(activeShift.rotationDeg)}°
                </span>
              </div>
              <input
                type="range"
                min={-180}
                max={180}
                value={Math.round(activeShift.rotationDeg)}
                onChange={(e) =>
                  onUpdateShiftTransform(shiftTrace.activeTarget, {
                    rotationDeg: Number(e.target.value),
                  })
                }
                aria-label="Shift ghost rotation"
                className="w-full studio-range"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-[#A1A1AA]">Scale</span>
                <span className="font-mono-tabular text-[#F4F4F6]">
                  {Math.round(activeShift.scale * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={25}
                max={250}
                value={Math.round(activeShift.scale * 100)}
                onChange={(e) =>
                  onUpdateShiftTransform(shiftTrace.activeTarget, {
                    scale: Number(e.target.value) / 100,
                  })
                }
                aria-label="Shift ghost scale"
                className="w-full studio-range"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#71717A] font-mono-tabular">
            <span>
              Offset: {activeShift.offsetX >= 0 ? '+' : ''}
              {Math.round(activeShift.offsetX)}, {activeShift.offsetY >= 0 ? '+' : ''}
              {Math.round(activeShift.offsetY)} px
            </span>
            <span className="font-sans">Drag stage to move · Grab top knob or pinch to rotate</span>
          </div>
        </div>
      )}

      {/* Centered Transformed Lightbox Paper Cel */}
      <div
        ref={celBoxRef}
        style={{
          width: `${displayWidth}px`,
          height: `${displayHeight}px`,
          backgroundColor: project.backgroundColor,
          transform: `translate3d(${viewport.offsetX}px, ${viewport.offsetY}px, 0) scale(${viewport.scale})`,
        }}
        className="relative shadow-[0_20px_60px_rgba(0,0,0,0.65)] ring-1 ring-white/10 shrink-0 will-change-transform"
      >
        {/* Optional Registration / Rule of Thirds Grid */}
        {showGrid && (
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full pointer-events-none z-10 opacity-25"
          >
            <line x1="33.33" y1="0" x2="33.33" y2="100" stroke="#71717A" strokeWidth="0.25" />
            <line x1="66.66" y1="0" x2="66.66" y2="100" stroke="#71717A" strokeWidth="0.25" />
            <line x1="0" y1="33.33" x2="100" y2="33.33" stroke="#71717A" strokeWidth="0.25" />
            <line x1="0" y1="66.66" x2="100" y2="66.66" stroke="#71717A" strokeWidth="0.25" />
            <line x1="50" y1="45" x2="50" y2="55" stroke="#F59E0B" strokeWidth="0.35" />
            <line x1="47" y1="50" x2="53" y2="50" stroke="#F59E0B" strokeWidth="0.35" />
          </svg>
        )}

        {/* Layer Stack Canvases */}
        <canvas
          ref={belowCanvasRef}
          width={project.width}
          height={project.height}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
        <canvas
          ref={activeCelCanvasRef}
          width={project.width}
          height={project.height}
          style={{
            opacity: activeLayer && activeLayer.visible ? activeLayer.opacity : 0,
          }}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
        <canvas
          ref={liveStrokeCanvasRef}
          width={project.width}
          height={project.height}
          style={{
            opacity:
              activeLayer && activeLayer.visible
                ? toolState.brushOpacity * activeLayer.opacity
                : 0,
          }}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
        <canvas
          ref={aboveCanvasRef}
          width={project.width}
          height={project.height}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* On-Canvas Shift & Trace Ghost Transform Bounding Guide & Rotate Handle */}
        {shiftTrace.editing && (
          <div
            style={{
              transform: `translate(${(activeShift.offsetX / project.width) * 100}%, ${
                (activeShift.offsetY / project.height) * 100
              }%) rotate(${activeShift.rotationDeg}deg) scale(${activeShift.scale})`,
              transformOrigin: 'center center',
              borderColor:
                shiftTrace.activeTarget === 'prev' ? '#FB7185' : '#38BDF8',
            }}
            className="absolute inset-0 border-2 border-dashed pointer-events-none z-20"
          >
            {/* Center Pivot Crosshair */}
            <div
              style={{
                backgroundColor:
                  shiftTrace.activeTarget === 'prev' ? '#FB7185' : '#38BDF8',
              }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full opacity-80"
            />

            {/* Top Interactive Rotate Stem & Knob */}
            <div className="absolute -top-9 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto">
              <button
                type="button"
                onPointerDown={startRotateKnobDrag}
                title="Drag to rotate ghost (hold Shift for 15° snap)"
                aria-label="Rotate ghost handle"
                style={{
                  borderColor:
                    shiftTrace.activeTarget === 'prev' ? '#FB7185' : '#38BDF8',
                }}
                className="w-7 h-7 rounded-full bg-[#1D1D21] border-2 shadow-md flex items-center justify-center cursor-grab active:cursor-grabbing"
              >
                <span
                  style={{
                    backgroundColor:
                      shiftTrace.activeTarget === 'prev' ? '#FB7185' : '#38BDF8',
                  }}
                  className="w-2 h-2 rounded-full"
                />
              </button>
              <div
                style={{
                  backgroundColor:
                    shiftTrace.activeTarget === 'prev' ? '#FB7185' : '#38BDF8',
                }}
                className="w-0.5 h-2"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
