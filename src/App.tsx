import React, { useEffect, useRef, useState } from 'react';
import { BottomSheet } from './components/BottomSheet';
import { CanvasStage } from './components/CanvasStage';
import { CineGridImportModal } from './components/CineGridImportModal';
import { ExportWebmModal } from './components/ExportWebmModal';
import { LayersPanel } from './components/LayersPanel';
import { MobileDock, MobileSheetType } from './components/MobileDock';
import {
  MobileBrushContent,
  MobileProjectContent,
  MobileToolsContent,
} from './components/MobileToolSheets';
import { ProjectModal } from './components/ProjectModal';
import { TimelineBar } from './components/TimelineBar';
import { ToolRail } from './components/ToolRail';
import { TopBar } from './components/TopBar';
import { useAnimationStudio } from './hooks/useAnimationStudio';
import { CineGridParseResult } from './types/animation';
import { isCineGridJson, parseCineGridJson } from './utils/cinegridImport';
import { exportProjectToJson, parseProjectFromJson } from './utils/projectJson';

export default function App() {
  const studio = useAnimationStudio();
  const {
    project,
    canUndo,
    canRedo,
    toolState,
    setToolState,
    setTool,
    onionSkin,
    setOnionSkin,
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
    createNewProject,
    loadDemoProject,
    loadImportedProject,
  } = studio;

  const [mobileSheet, setMobileSheet] = useState<MobileSheetType>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showCineGridModal, setShowCineGridModal] = useState(false);
  const [pendingCineGridParse, setPendingCineGridParse] = useState<CineGridParseResult | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: 'info' | 'error' } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (text: string, tone: 'info' | 'error' = 'info') => {
    setToast({ text, tone });
  };

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (showNewModal || showExportModal || showCineGridModal) return;

      const isMod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (isMod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if (isMod && key === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      if (isMod) return;

      switch (key) {
        case 'b':
          setTool('brush');
          break;
        case 'e':
          setTool('eraser');
          break;
        case 'g':
          setTool('fill');
          break;
        case 'l':
          setTool('line');
          break;
        case 'r':
          setTool('rect');
          break;
        case 'c':
          setTool('circle');
          break;
        case 'i':
          setTool('eyedropper');
          break;
        case 'h':
          setTool('pan');
          break;
        case 'o':
          setOnionSkin((prev) => ({ ...prev, enabled: !prev.enabled }));
          break;
        case 'p':
          setIsPlaying((p) => !p);
          break;
        case ',':
        case 'arrowleft':
          selectFrame(Math.max(0, project.currentFrameIndex - 1));
          break;
        case '.':
        case 'arrowright':
          selectFrame(Math.min(project.frames.length - 1, project.currentFrameIndex + 1));
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    showNewModal,
    showExportModal,
    showCineGridModal,
    undo,
    redo,
    setTool,
    setOnionSkin,
    setIsPlaying,
    selectFrame,
    project.currentFrameIndex,
    project.frames.length,
  ]);

  const handleImportJsonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      if (isCineGridJson(text)) {
        const parsedCineGrid = parseCineGridJson(text);
        setPendingCineGridParse(parsedCineGrid);
        setShowCineGridModal(true);
        setMobileSheet(null);
        return;
      }
      const imported = parseProjectFromJson(text);
      loadImportedProject(imported);
      setMobileSheet(null);
      showToast(`Loaded "${imported.title}" (${imported.frames.length} frames)`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to load JSON project file.',
        'error'
      );
    }
  };

  const handleExportJson = () => {
    exportProjectToJson(project);
    showToast(`Saved ${project.title}.celtoonz.json`);
  };

  const activeLayer = project.layers.find((l) => l.id === project.activeLayerId);
  const activeLayerLocked = Boolean(activeLayer?.locked);

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-[#141417] text-[#F4F4F6] overflow-hidden">
      {/* Hidden JSON File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Top Navigation Bar */}
      <TopBar
        projectTitle={project.title}
        canvasSizeLabel={`${project.width}×${project.height}`}
        onOpenNew={() => setShowNewModal(true)}
        onLoadDemo={() => {
          loadDemoProject();
          showToast('Loaded 24fps Bouncing Ball demo');
        }}
        onOpenCineGrid={() => {
          setPendingCineGridParse(null);
          setShowCineGridModal(true);
        }}
        onImportJson={handleImportJsonClick}
        onExportJson={handleExportJson}
        onOpenExportWebm={() => {
          setIsPlaying(false);
          setShowExportModal(true);
        }}
        onOpenProjectSheetMobile={() => setMobileSheet('project')}
      />

      {/* Main Studio Workspace */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Desktop Left Tool Rail + Brush Controls */}
        <ToolRail
          toolState={toolState}
          setTool={setTool}
          setToolState={setToolState}
          showGrid={showGrid}
          onToggleGrid={() => setShowGrid((g) => !g)}
          onClearCel={clearActiveCel}
          activeLayerLocked={activeLayerLocked}
        />

        {/* Center Interactive Lightbox Stage */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0 relative">
          <CanvasStage
            project={project}
            toolState={toolState}
            onionSkin={onionSkin}
            viewport={viewport}
            setViewport={setViewport}
            onResetViewport={resetViewport}
            isPlaying={isPlaying}
            showGrid={showGrid}
            imageCacheRef={imageCacheRef}
            cacheVersion={cacheVersion}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            onCommitCel={commitCel}
            onPickColor={(hex) => {
              setToolState((prev) => ({ ...prev, color: hex }));
              showToast(`Sampled ${hex}`);
            }}
            onToggleOnionSkin={() =>
              setOnionSkin((prev) => ({ ...prev, enabled: !prev.enabled }))
            }
            onPrevFrame={() => selectFrame(Math.max(0, project.currentFrameIndex - 1))}
            onNextFrame={() =>
              selectFrame(Math.min(project.frames.length - 1, project.currentFrameIndex + 1))
            }
            onAddFrame={() => addFrame()}
          />

          {/* Non-intrusive Studio Toast */}
          {toast && (
            <div
              role="status"
              aria-live="polite"
              className={`pointer-events-none absolute bottom-16 md:bottom-4 left-1/2 -translate-x-1/2 z-40 px-3.5 py-2 rounded-lg border text-xs font-medium shadow-lg whitespace-nowrap ${
                toast.tone === 'error'
                  ? 'bg-rose-950/95 border-rose-500/40 text-rose-200'
                  : 'bg-[#1D1D21]/95 border-[#32323A] text-[#F4F4F6]'
              }`}
            >
              {toast.text}
            </div>
          )}
        </main>

        {/* Desktop Right Layers Panel */}
        <aside
          aria-label="Layers inspector"
          className="hidden md:flex flex-col w-60 lg:w-64 shrink-0 bg-[#1D1D21] border-l border-[#32323A]"
        >
          <LayersPanel
            layers={project.layers}
            activeLayerId={project.activeLayerId}
            onSelectLayer={selectLayer}
            onAddLayer={addLayer}
            onDuplicateLayer={duplicateLayer}
            onDeleteLayer={deleteLayer}
            onReorderLayer={reorderLayer}
            onUpdateLayer={updateLayer}
          />
        </aside>
      </div>

      {/* Desktop Bottom 24fps Timeline Strip */}
      <TimelineBar
        frames={project.frames}
        layers={project.layers}
        width={project.width}
        height={project.height}
        backgroundColor={project.backgroundColor}
        currentFrameIndex={project.currentFrameIndex}
        isPlaying={isPlaying}
        loopPlayback={loopPlayback}
        onionSkin={onionSkin}
        imageCacheRef={imageCacheRef}
        cacheVersion={cacheVersion}
        onSelectFrame={selectFrame}
        onTogglePlay={() => setIsPlaying((p) => !p)}
        onToggleLoop={() => setLoopPlayback((l) => !l)}
        onAddFrame={() => addFrame()}
        onDuplicateFrame={() => duplicateFrame()}
        onDeleteFrame={() => deleteFrame()}
        onSetFrameDuration={setFrameDuration}
        onUpdateOnionSkin={setOnionSkin}
      />

      {/* Mobile Bottom Thumb Dock */}
      <MobileDock
        toolState={toolState}
        isPlaying={isPlaying}
        currentFrameIndex={project.currentFrameIndex}
        frameCount={project.frames.length}
        layerCount={project.layers.length}
        activeSheet={mobileSheet}
        onToggleSheet={(sheet) => setMobileSheet(sheet)}
        onTogglePlay={() => setIsPlaying((p) => !p)}
      />

      {/* Mobile Bottom Sheets */}
      <BottomSheet
        open={mobileSheet === 'tools'}
        title="Drawing Tools"
        onClose={() => setMobileSheet(null)}
      >
        <MobileToolsContent
          toolState={toolState}
          showGrid={showGrid}
          activeLayerLocked={activeLayerLocked}
          onSelectTool={(t) => {
            setTool(t);
            setMobileSheet(null);
          }}
          onToggleGrid={() => setShowGrid((g) => !g)}
          onClearCel={() => {
            clearActiveCel();
            setMobileSheet(null);
          }}
        />
      </BottomSheet>

      <BottomSheet
        open={mobileSheet === 'brush'}
        title="Brush & Ink Color"
        onClose={() => setMobileSheet(null)}
      >
        <MobileBrushContent toolState={toolState} setToolState={setToolState} />
      </BottomSheet>

      <BottomSheet
        open={mobileSheet === 'timeline'}
        title="Frames & 24fps Timeline"
        onClose={() => setMobileSheet(null)}
      >
        <TimelineBar
          inMobileSheet
          frames={project.frames}
          layers={project.layers}
          width={project.width}
          height={project.height}
          backgroundColor={project.backgroundColor}
          currentFrameIndex={project.currentFrameIndex}
          isPlaying={isPlaying}
          loopPlayback={loopPlayback}
          onionSkin={onionSkin}
          imageCacheRef={imageCacheRef}
          cacheVersion={cacheVersion}
          onSelectFrame={selectFrame}
          onTogglePlay={() => setIsPlaying((p) => !p)}
          onToggleLoop={() => setLoopPlayback((l) => !l)}
          onAddFrame={() => addFrame()}
          onDuplicateFrame={() => duplicateFrame()}
          onDeleteFrame={() => deleteFrame()}
          onSetFrameDuration={setFrameDuration}
          onUpdateOnionSkin={setOnionSkin}
        />
      </BottomSheet>

      <BottomSheet
        open={mobileSheet === 'layers'}
        title="Cel Layers"
        onClose={() => setMobileSheet(null)}
      >
        <LayersPanel
          compactMobile
          layers={project.layers}
          activeLayerId={project.activeLayerId}
          onSelectLayer={selectLayer}
          onAddLayer={addLayer}
          onDuplicateLayer={duplicateLayer}
          onDeleteLayer={deleteLayer}
          onReorderLayer={reorderLayer}
          onUpdateLayer={updateLayer}
        />
      </BottomSheet>

      <BottomSheet
        open={mobileSheet === 'project'}
        title="Project & JSON Files"
        onClose={() => setMobileSheet(null)}
      >
        <MobileProjectContent
          projectTitle={project.title}
          dimensionsLabel={`${project.width}×${project.height}`}
          onNewCanvas={() => {
            setMobileSheet(null);
            setShowNewModal(true);
          }}
          onLoadDemo={() => {
            loadDemoProject();
            setMobileSheet(null);
            showToast('Loaded 24fps Bouncing Ball demo');
          }}
          onOpenCineGrid={() => {
            setMobileSheet(null);
            setPendingCineGridParse(null);
            setShowCineGridModal(true);
          }}
          onImportJson={handleImportJsonClick}
          onExportJson={() => {
            handleExportJson();
            setMobileSheet(null);
          }}
        />
      </BottomSheet>

      {/* Desktop/Mobile Modals */}
      <ProjectModal
        open={showNewModal}
        initialTitle="Untitled Flipbook"
        onClose={() => setShowNewModal(false)}
        onCreateProject={(title, w, h, bg) => {
          createNewProject(title, w, h, bg);
          showToast(`Created ${title} (${w}×${h})`);
        }}
      />

      <ExportWebmModal
        open={showExportModal}
        project={project}
        onClose={() => setShowExportModal(false)}
      />

      <CineGridImportModal
        open={showCineGridModal}
        initialParsed={pendingCineGridParse}
        onClose={() => {
          setShowCineGridModal(false);
          setPendingCineGridParse(null);
        }}
        onImported={(importedProj, summaryText) => {
          loadImportedProject(importedProj);
          showToast(summaryText);
        }}
      />
    </div>
  );
}
