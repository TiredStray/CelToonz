import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_SHIFT_TRANSFORM,
  Frame,
  Layer,
  OnionSkinState,
  Project,
  ShiftTraceState,
  ShiftTraceTransform,
  ToolState,
  ToolType,
  ViewportState,
} from '../types/animation';
import { preloadFrameImages } from '../utils/canvasDrawing';
import { createBlankProject, createBouncingBallDemo, makeId } from '../utils/demoProject';

const MAX_HISTORY = 35;

export function useAnimationStudio() {
  const [project, setProject] = useState<Project>(() => createBlankProject());
  const [past, setPast] = useState<Project[]>([]);
  const [future, setFuture] = useState<Project[]>([]);
  const [cacheVersion, setCacheVersion] = useState(0);

  const [toolState, setToolState] = useState<ToolState>({
    tool: 'brush',
    color: '#141417',
    brushSize: 8,
    brushOpacity: 1,
    eraserSize: 20,
    fillShapes: false,
  });

  const [onionSkin, setOnionSkin] = useState<OnionSkinState>({
    enabled: true,
    prevFrames: 1,
    nextFrames: 1,
    opacity: 0.35,
  });

  const [shiftTrace, setShiftTrace] = useState<ShiftTraceState>({
    editing: false,
    activeTarget: 'prev',
    prev: { ...DEFAULT_SHIFT_TRANSFORM },
    next: { ...DEFAULT_SHIFT_TRANSFORM },
  });

  const [viewport, setViewport] = useState<ViewportState>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [loopPlayback, setLoopPlayback] = useState(true);
  const [showGrid, setShowGrid] = useState(false);

  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Preload frame cel images into cache whenever frames update
  useEffect(() => {
    let cancelled = false;
    preloadFrameImages(project.frames, imageCacheRef.current).then(() => {
      if (!cancelled) {
        setCacheVersion((v) => v + 1);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [project.frames]);

  // 24fps Playback loop honoring frame.duration holds
  const projectRef = useRef(project);
  projectRef.current = project;

  useEffect(() => {
    if (!isPlaying) return;

    let rafId = 0;
    let lastTime = performance.now();
    let elapsedInFrame = 0;
    const msPerExposure = 1000 / 24;

    const tick = (now: number) => {
      const dt = now - lastTime;
      lastTime = now;
      elapsedInFrame += dt;

      const currentProj = projectRef.current;
      const currentFrame = currentProj.frames[currentProj.currentFrameIndex];
      const holdMs = Math.max(1, currentFrame?.duration ?? 1) * msPerExposure;

      if (elapsedInFrame >= holdMs) {
        elapsedInFrame = elapsedInFrame % holdMs;
        const nextIdx = currentProj.currentFrameIndex + 1;
        if (nextIdx >= currentProj.frames.length) {
          if (loopPlayback) {
            setProject((prev) => ({ ...prev, currentFrameIndex: 0 }));
          } else {
            setIsPlaying(false);
            return;
          }
        } else {
          setProject((prev) => ({ ...prev, currentFrameIndex: nextIdx }));
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, loopPlayback]);

  const applyWithHistory = useCallback((updater: (prev: Project) => Project) => {
    setProject((prev) => {
      const next = updater(prev);
      if (next === prev) return prev;
      setPast((h) => [...h.slice(-(MAX_HISTORY - 1)), prev]);
      setFuture([]);
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setIsPlaying(false);
    setPast((prevPast) => {
      if (prevPast.length === 0) return prevPast;
      const previous = prevPast[prevPast.length - 1];
      setProject((current) => {
        setFuture((f) => [current, ...f.slice(0, MAX_HISTORY - 1)]);
        return previous;
      });
      return prevPast.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setIsPlaying(false);
    setFuture((prevFuture) => {
      if (prevFuture.length === 0) return prevFuture;
      const next = prevFuture[0];
      setProject((current) => {
        setPast((p) => [...p.slice(-(MAX_HISTORY - 1)), current]);
        return next;
      });
      return prevFuture.slice(1);
    });
  }, []);

  const setTool = useCallback((tool: ToolType) => {
    setToolState((prev) => ({ ...prev, tool }));
  }, []);

  const commitCel = useCallback(
    (frameIndex: number, layerId: string, dataUrl: string | null) => {
      applyWithHistory((prev) => {
        const frame = prev.frames[frameIndex];
        if (!frame) return prev;
        if (frame.cels[layerId] === dataUrl) return prev;

        const nextFrames = prev.frames.map((f, idx) =>
          idx === frameIndex ? { ...f, cels: { ...f.cels, [layerId]: dataUrl } } : f
        );
        return { ...prev, frames: nextFrames };
      });
    },
    [applyWithHistory]
  );

  const clearActiveCel = useCallback(() => {
    const activeLayer = project.layers.find((l) => l.id === project.activeLayerId);
    if (!activeLayer || activeLayer.locked) return;
    commitCel(project.currentFrameIndex, project.activeLayerId, null);
  }, [project.layers, project.activeLayerId, project.currentFrameIndex, commitCel]);

  const selectFrame = useCallback((index: number) => {
    setIsPlaying(false);
    setProject((prev) => {
      const clamped = Math.max(0, Math.min(prev.frames.length - 1, index));
      if (clamped === prev.currentFrameIndex) return prev;
      return { ...prev, currentFrameIndex: clamped };
    });
  }, []);

  const addFrame = useCallback(
    (insertAfterIndex?: number) => {
      setIsPlaying(false);
      applyWithHistory((prev) => {
        const at =
          typeof insertAfterIndex === 'number'
            ? Math.max(0, Math.min(prev.frames.length - 1, insertAfterIndex))
            : prev.currentFrameIndex;

        const refFrame = prev.frames[at];
        const emptyCels: Record<string, string | null> = {};
        for (const l of prev.layers) emptyCels[l.id] = null;

        const newFrame: Frame = {
          id: makeId('frame'),
          duration: 1,
          cels: emptyCels,
          ...(refFrame?.storyboard ? { storyboard: { ...refFrame.storyboard } } : {}),
        };

        const nextFrames = [...prev.frames];
        nextFrames.splice(at + 1, 0, newFrame);

        return {
          ...prev,
          frames: nextFrames,
          currentFrameIndex: at + 1,
        };
      });
    },
    [applyWithHistory]
  );

  const duplicateFrame = useCallback(
    (sourceIndex?: number) => {
      setIsPlaying(false);
      applyWithHistory((prev) => {
        const idx =
          typeof sourceIndex === 'number'
            ? Math.max(0, Math.min(prev.frames.length - 1, sourceIndex))
            : prev.currentFrameIndex;
        const src = prev.frames[idx];
        if (!src) return prev;

        const copy: Frame = {
          id: makeId('frame'),
          duration: src.duration,
          cels: { ...src.cels },
          ...(src.storyboard ? { storyboard: { ...src.storyboard } } : {}),
        };

        const nextFrames = [...prev.frames];
        nextFrames.splice(idx + 1, 0, copy);
        return {
          ...prev,
          frames: nextFrames,
          currentFrameIndex: idx + 1,
        };
      });
    },
    [applyWithHistory]
  );

  const deleteFrame = useCallback(
    (targetIndex?: number) => {
      setIsPlaying(false);
      applyWithHistory((prev) => {
        const idx =
          typeof targetIndex === 'number'
            ? Math.max(0, Math.min(prev.frames.length - 1, targetIndex))
            : prev.currentFrameIndex;

        if (prev.frames.length <= 1) {
          // Clear all cels on single remaining frame
          const cleared: Record<string, string | null> = {};
          for (const l of prev.layers) cleared[l.id] = null;
          return {
            ...prev,
            frames: [{ ...prev.frames[0], duration: 1, cels: cleared }],
            currentFrameIndex: 0,
          };
        }

        const nextFrames = prev.frames.filter((_, i) => i !== idx);
        const nextIdx = Math.min(idx, nextFrames.length - 1);
        return {
          ...prev,
          frames: nextFrames,
          currentFrameIndex: nextIdx,
        };
      });
    },
    [applyWithHistory]
  );

  const setFrameDuration = useCallback(
    (index: number, duration: number) => {
      const clamped = Math.max(1, Math.min(48, Math.round(duration)));
      applyWithHistory((prev) => {
        const frame = prev.frames[index];
        if (!frame || frame.duration === clamped) return prev;
        const nextFrames = prev.frames.map((f, i) =>
          i === index ? { ...f, duration: clamped } : f
        );
        return { ...prev, frames: nextFrames };
      });
    },
    [applyWithHistory]
  );

  const addLayer = useCallback(() => {
    applyWithHistory((prev) => {
      const newId = makeId('layer');
      const newLayer: Layer = {
        id: newId,
        name: `Layer ${prev.layers.length + 1}`,
        visible: true,
        locked: false,
        opacity: 1,
      };
      const nextLayers = [...prev.layers, newLayer];
      const nextFrames = prev.frames.map((f) => ({
        ...f,
        cels: { ...f.cels, [newId]: null },
      }));
      return {
        ...prev,
        layers: nextLayers,
        frames: nextFrames,
        activeLayerId: newId,
      };
    });
  }, [applyWithHistory]);

  const duplicateLayer = useCallback(
    (layerId: string) => {
      applyWithHistory((prev) => {
        const idx = prev.layers.findIndex((l) => l.id === layerId);
        if (idx === -1) return prev;
        const src = prev.layers[idx];
        const newId = makeId('layer');
        const copy: Layer = {
          ...src,
          id: newId,
          name: `${src.name} Copy`,
          locked: false,
        };
        const nextLayers = [...prev.layers];
        nextLayers.splice(idx + 1, 0, copy);
        const nextFrames = prev.frames.map((f) => ({
          ...f,
          cels: { ...f.cels, [newId]: f.cels[layerId] ?? null },
        }));
        return {
          ...prev,
          layers: nextLayers,
          frames: nextFrames,
          activeLayerId: newId,
        };
      });
    },
    [applyWithHistory]
  );

  const deleteLayer = useCallback(
    (layerId: string) => {
      applyWithHistory((prev) => {
        if (prev.layers.length <= 1) return prev;
        const idx = prev.layers.findIndex((l) => l.id === layerId);
        if (idx === -1) return prev;

        const nextLayers = prev.layers.filter((l) => l.id !== layerId);
        const nextFrames = prev.frames.map((f) => {
          const nextCels = { ...f.cels };
          delete nextCels[layerId];
          return { ...f, cels: nextCels };
        });

        const nextActive =
          prev.activeLayerId === layerId
            ? nextLayers[Math.min(idx, nextLayers.length - 1)].id
            : prev.activeLayerId;

        return {
          ...prev,
          layers: nextLayers,
          frames: nextFrames,
          activeLayerId: nextActive,
        };
      });
    },
    [applyWithHistory]
  );

  const reorderLayer = useCallback(
    (layerId: string, direction: 'up' | 'down') => {
      // Layers array is bottom-to-top (last item is top visual layer)
      applyWithHistory((prev) => {
        const idx = prev.layers.findIndex((l) => l.id === layerId);
        if (idx === -1) return prev;
        const targetIdx = direction === 'up' ? idx + 1 : idx - 1;
        if (targetIdx < 0 || targetIdx >= prev.layers.length) return prev;

        const nextLayers = [...prev.layers];
        const [item] = nextLayers.splice(idx, 1);
        nextLayers.splice(targetIdx, 0, item);
        return { ...prev, layers: nextLayers };
      });
    },
    [applyWithHistory]
  );

  const updateLayer = useCallback(
    (layerId: string, patch: Partial<Layer>, recordHistory = true) => {
      const mutate = (prev: Project): Project => ({
        ...prev,
        layers: prev.layers.map((l) => (l.id === layerId ? { ...l, ...patch } : l)),
      });
      if (recordHistory) {
        applyWithHistory(mutate);
      } else {
        setProject(mutate);
      }
    },
    [applyWithHistory]
  );

  const selectLayer = useCallback((layerId: string) => {
    setProject((prev) => ({ ...prev, activeLayerId: layerId }));
  }, []);

  const updateProjectMeta = useCallback(
    (patch: Partial<Pick<Project, 'title' | 'backgroundColor'>>) => {
      applyWithHistory((prev) => ({ ...prev, ...patch }));
    },
    [applyWithHistory]
  );

  const createNewProject = useCallback(
    (title: string, width: number, height: number, backgroundColor: string) => {
      setIsPlaying(false);
      const fresh = createBlankProject(title, width, height, backgroundColor);
      setProject(fresh);
      setPast([]);
      setFuture([]);
      setViewport({ scale: 1, offsetX: 0, offsetY: 0 });
    },
    []
  );

  const loadDemoProject = useCallback(() => {
    setIsPlaying(false);
    const demo = createBouncingBallDemo();
    setProject(demo);
    setPast([]);
    setFuture([]);
    setViewport({ scale: 1, offsetX: 0, offsetY: 0 });
  }, []);

  const loadImportedProject = useCallback((imported: Project) => {
    setIsPlaying(false);
    setProject(imported);
    setPast([]);
    setFuture([]);
    setViewport({ scale: 1, offsetX: 0, offsetY: 0 });
  }, []);

  const resetViewport = useCallback(() => {
    setViewport({ scale: 1, offsetX: 0, offsetY: 0 });
  }, []);

  const toggleShiftTraceEditing = useCallback(
    (forceValue?: boolean) => {
      setIsPlaying(false);
      setShiftTrace((prev) => {
        const nextEditing = typeof forceValue === 'boolean' ? forceValue : !prev.editing;
        if (nextEditing) {
          setOnionSkin((o) => ({
            ...o,
            enabled: true,
            prevFrames: prev.activeTarget === 'prev' ? Math.max(1, o.prevFrames) : o.prevFrames,
            nextFrames: prev.activeTarget === 'next' ? Math.max(1, o.nextFrames) : o.nextFrames,
          }));
        }
        return { ...prev, editing: nextEditing };
      });
    },
    []
  );

  const setShiftTarget = useCallback((target: 'prev' | 'next') => {
    setShiftTrace((prev) => ({ ...prev, activeTarget: target }));
    setOnionSkin((o) => ({
      ...o,
      enabled: true,
      prevFrames: target === 'prev' ? Math.max(1, o.prevFrames) : o.prevFrames,
      nextFrames: target === 'next' ? Math.max(1, o.nextFrames) : o.nextFrames,
    }));
  }, []);

  const updateShiftTransform = useCallback(
    (target: 'prev' | 'next', patch: Partial<ShiftTraceTransform>) => {
      setShiftTrace((prev) => ({
        ...prev,
        [target]: { ...prev[target], ...patch },
      }));
    },
    []
  );

  const resetShiftTransform = useCallback((target: 'prev' | 'next' | 'both' = 'both') => {
    setShiftTrace((prev) => ({
      ...prev,
      prev: target === 'prev' || target === 'both' ? { ...DEFAULT_SHIFT_TRANSFORM } : prev.prev,
      next: target === 'next' || target === 'both' ? { ...DEFAULT_SHIFT_TRANSFORM } : prev.next,
    }));
  }, []);

  return {
    project,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    toolState,
    setToolState,
    setTool,
    onionSkin,
    setOnionSkin,
    shiftTrace,
    setShiftTrace,
    toggleShiftTraceEditing,
    setShiftTarget,
    updateShiftTransform,
    resetShiftTransform,
    viewport,
    setViewport,
    resetViewport,
    isPlaying,
    setIsPlaying,
    loopPlayback,
    setLoopPlayback,
    showGrid,
    setShowGrid,
    imageCacheRef,
    cacheVersion,
    undo,
    redo,
    commitCel,
    clearActiveCel,
    selectFrame,
    addFrame,
    duplicateFrame,
    deleteFrame,
    setFrameDuration,
    addLayer,
    duplicateLayer,
    deleteLayer,
    reorderLayer,
    updateLayer,
    selectLayer,
    updateProjectMeta,
    createNewProject,
    loadDemoProject,
    loadImportedProject,
  };
}
