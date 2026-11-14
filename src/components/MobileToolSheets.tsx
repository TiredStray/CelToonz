import React from 'react';
import {
  FileJson,
  FolderOpen,
  Grid3X3,
  Play,
  PlusSquare,
  Trash2,
} from 'lucide-react';
import { STUDIO_SWATCHES, ToolState, ToolType } from '../types/animation';
import { TOOL_ITEMS } from './ToolRail';

interface MobileToolsContentProps {
  toolState: ToolState;
  showGrid: boolean;
  activeLayerLocked: boolean;
  onSelectTool: (tool: ToolType) => void;
  onToggleGrid: () => void;
  onClearCel: () => void;
}

export const MobileToolsContent: React.FC<MobileToolsContentProps> = ({
  toolState,
  showGrid,
  activeLayerLocked,
  onSelectTool,
  onToggleGrid,
  onClearCel,
}) => {
  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-4 gap-2.5">
        {TOOL_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = toolState.tool === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTool(item.id)}
              className={`min-h-[60px] rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-colors ${
                active
                  ? 'bg-[#F59E0B] border-[#F59E0B] text-[#141417]'
                  : 'bg-[#141417] border-[#32323A] text-[#E4E4E7]'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[11px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-[#32323A]">
        <button
          type="button"
          onClick={onToggleGrid}
          className={`min-h-[48px] px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-medium ${
            showGrid
              ? 'bg-[#26262C] border-[#F59E0B]/50 text-[#F59E0B]'
              : 'bg-[#141417] border-[#32323A] text-[#E4E4E7]'
          }`}
        >
          <Grid3X3 className="w-4 h-4" />
          <span>{showGrid ? 'Hide Grid' : 'Show Grid'}</span>
        </button>

        <button
          type="button"
          onClick={onClearCel}
          disabled={activeLayerLocked}
          className="min-h-[48px] px-3 rounded-xl border border-[#32323A] bg-[#141417] text-rose-400 disabled:opacity-40 flex items-center justify-center gap-2 text-xs font-medium"
        >
          <Trash2 className="w-4 h-4" />
          <span>Clear Cel</span>
        </button>
      </div>
    </div>
  );
};

interface MobileBrushContentProps {
  toolState: ToolState;
  setToolState: React.Dispatch<React.SetStateAction<ToolState>>;
}

export const MobileBrushContent: React.FC<MobileBrushContentProps> = ({
  toolState,
  setToolState,
}) => {
  const isEraser = toolState.tool === 'eraser';
  const currentSize = isEraser ? toolState.eraserSize : toolState.brushSize;
  const showFillToggle = toolState.tool === 'rect' || toolState.tool === 'circle';

  return (
    <div className="p-4 space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-[#A1A1AA]">
            {isEraser ? 'Eraser Diameter' : 'Stroke Diameter'}
          </span>
          <span className="text-xs font-mono-tabular text-[#F4F4F6]">{currentSize}px</span>
        </div>
        <input
          type="range"
          min={1}
          max={64}
          value={currentSize}
          onChange={(e) => {
            const val = Number(e.target.value);
            setToolState((prev) =>
              isEraser ? { ...prev, eraserSize: val } : { ...prev, brushSize: val }
            );
          }}
          className="w-full studio-range"
        />
      </div>

      {!isEraser && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[#A1A1AA]">Opacity</span>
            <span className="text-xs font-mono-tabular text-[#F4F4F6]">
              {Math.round(toolState.brushOpacity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={10}
            max={100}
            value={Math.round(toolState.brushOpacity * 100)}
            onChange={(e) =>
              setToolState((prev) => ({
                ...prev,
                brushOpacity: Number(e.target.value) / 100,
              }))
            }
            className="w-full studio-range"
          />
        </div>
      )}

      {showFillToggle && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[#A1A1AA]">Shape Style</span>
          <button
            type="button"
            onClick={() => setToolState((prev) => ({ ...prev, fillShapes: !prev.fillShapes }))}
            className={`min-h-[44px] px-4 rounded-xl text-xs font-medium ${
              toolState.fillShapes
                ? 'bg-[#F59E0B] text-[#141417]'
                : 'bg-[#26262C] text-[#E4E4E7]'
            }`}
          >
            {toolState.fillShapes ? 'Filled Shape' : 'Outline Only'}
          </button>
        </div>
      )}

      <div className="pt-2 border-t border-[#32323A]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-[#A1A1AA]">Studio Palette</span>
          <label className="flex items-center gap-2 min-h-[44px]">
            <span className="text-xs font-mono-tabular text-[#E4E4E7]">{toolState.color}</span>
            <input
              type="color"
              value={toolState.color}
              onChange={(e) =>
                setToolState((prev) => ({ ...prev, color: e.target.value.toUpperCase() }))
              }
              className="w-8 h-8 rounded border border-[#32323A] bg-transparent p-0"
            />
          </label>
        </div>
        <div className="grid grid-cols-6 gap-2.5">
          {STUDIO_SWATCHES.map((hex) => {
            const active = toolState.color.toUpperCase() === hex.toUpperCase();
            return (
              <button
                key={hex}
                type="button"
                onClick={() => setToolState((prev) => ({ ...prev, color: hex }))}
                aria-label={`Select color ${hex}`}
                className={`h-11 rounded-xl border ${
                  active ? 'border-[#F59E0B] ring-2 ring-[#F59E0B]/40' : 'border-[#32323A]'
                }`}
                style={{ backgroundColor: hex }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface MobileProjectContentProps {
  projectTitle: string;
  dimensionsLabel: string;
  onNewCanvas: () => void;
  onLoadDemo: () => void;
  onImportJson: () => void;
  onExportJson: () => void;
}

export const MobileProjectContent: React.FC<MobileProjectContentProps> = ({
  projectTitle,
  dimensionsLabel,
  onNewCanvas,
  onLoadDemo,
  onImportJson,
  onExportJson,
}) => {
  return (
    <div className="p-4 space-y-2.5">
      <div className="pb-3 border-b border-[#32323A]">
        <div className="text-sm font-semibold text-[#F4F4F6]">{projectTitle}</div>
        <div className="text-xs font-mono-tabular text-[#71717A] mt-0.5">
          {dimensionsLabel} · 24 FPS · Session Memory
        </div>
      </div>

      <button
        type="button"
        onClick={onNewCanvas}
        className="w-full min-h-[48px] px-4 rounded-xl bg-[#141417] border border-[#32323A] text-sm font-medium text-[#E4E4E7] flex items-center gap-3"
      >
        <PlusSquare className="w-4 h-4 text-[#F59E0B]" />
        <span>New Blank Canvas</span>
      </button>

      <button
        type="button"
        onClick={onLoadDemo}
        className="w-full min-h-[48px] px-4 rounded-xl bg-[#141417] border border-[#32323A] text-sm font-medium text-[#E4E4E7] flex items-center gap-3"
      >
        <Play className="w-4 h-4 text-[#F59E0B]" />
        <span>Load Bouncing Ball Demo</span>
      </button>

      <button
        type="button"
        onClick={onImportJson}
        className="w-full min-h-[48px] px-4 rounded-xl bg-[#141417] border border-[#32323A] text-sm font-medium text-[#E4E4E7] flex items-center gap-3"
      >
        <FolderOpen className="w-4 h-4 text-[#38BDF8]" />
        <span>Open Project (.json)</span>
      </button>

      <button
        type="button"
        onClick={onExportJson}
        className="w-full min-h-[48px] px-4 rounded-xl bg-[#141417] border border-[#32323A] text-sm font-medium text-[#E4E4E7] flex items-center gap-3"
      >
        <FileJson className="w-4 h-4 text-emerald-400" />
        <span>Save Project (.json)</span>
      </button>
    </div>
  );
};
