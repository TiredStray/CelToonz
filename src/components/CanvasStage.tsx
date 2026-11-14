import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layers, Maximize2, Redo2, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import {
  Layer,
  OnionSkinState,
  Project,
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
              cache
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
              cache
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

    // 2+ pointers => Pinch zoom & two-finger pan
    if (activePointersRef.current.size === 2) {
      cancelActiveDrawing();
      panDragRef.current = null;

      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
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

  const cursorStyle =
    toolState.tool === 'pan' || spaceHeld
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

        {activeLayer && (!activeLayer.visible || activeLayer.locked) && (
          <div className="px-2.5 h-8 rounded-lg bg-[#1D1D21]/95 border border-amber-500/40 text-amber-300 text-xs font-medium flex items-center whitespace-nowrap">
            {activeLayer.locked ? 'Layer Locked' : 'Layer Hidden'}
          </div>
        )}
      </div>

      {/* Top-Right Floating Zoom & Mobile Onion Toggle */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute top-3 right-3 z-20 flex items-center gap-1.5"
      >
        <button
          type="button"
          onClick={onToggleOnionSkin}
          title="Toggle Onion Skin (O)"
          aria-label="Toggle Onion Skin"
          aria-pressed={onionSkin.enabled}
          className={`md:hidden min-h-[44px] px-3 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
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

      {/* Top-Center Floating Storyboard Shot / SubShot HUD */}
      {currentFrame?.storyboard && (
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
      )}

      {/* Mobile Quick Frame Stepper Corners */}
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
      </div>
    </div>
  );
};
