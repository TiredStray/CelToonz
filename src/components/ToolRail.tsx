import React from 'react';
import {
  Brush,
  Circle,
  Eraser,
  Hand,
  Minus,
  PaintBucket,
  Pipette,
  Square,
  Trash2,
  Grid3X3,
} from 'lucide-react';
import { STUDIO_SWATCHES, ToolState, ToolType } from '../types/animation';

interface ToolRailProps {
  toolState: ToolState;
  setTool: (tool: ToolType) => void;
  setToolState: React.Dispatch<React.SetStateAction<ToolState>>;
  showGrid: boolean;
  onToggleGrid: () => void;
  onClearCel: () => void;
  activeLayerLocked: boolean;
}

export const TOOL_ITEMS: { id: ToolType; label: string; shortcut: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'brush', label: 'Brush', shortcut: 'B', icon: Brush },
  { id: 'eraser', label: 'Eraser', shortcut: 'E', icon: Eraser },
  { id: 'fill', label: 'Fill Bucket', shortcut: 'G', icon: PaintBucket },
  { id: 'line', label: 'Line', shortcut: 'L', icon: Minus },
  { id: 'rect', label: 'Rectangle', shortcut: 'R', icon: Square },
  { id: 'circle', label: 'Ellipse', shortcut: 'C', icon: Circle },
  { id: 'eyedropper', label: 'Eyedropper', shortcut: 'I', icon: Pipette },
  { id: 'pan', label: 'Pan Stage', shortcut: 'H', icon: Hand },
];

export const ToolRail: React.FC<ToolRailProps> = ({
  toolState,
  setTool,
  setToolState,
  showGrid,
  onToggleGrid,
  onClearCel,
  activeLayerLocked,
}) => {
  const isEraser = toolState.tool === 'eraser';
  const currentSize = isEraser ? toolState.eraserSize : toolState.brushSize;
  const showShapeFillToggle = toolState.tool === 'rect' || toolState.tool === 'circle';

  return (
    <aside
      aria-label="Drawing tools"
      className="hidden md:flex shrink-0 bg-[#1D1D21] border-r border-[#32323A] h-full"
    >
      {/* Vertical Icon Rail */}
      <div className="w-14 flex flex-col items-center py-3 gap-1.5 border-r border-[#32323A]/70">
        {TOOL_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = toolState.tool === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTool(item.id)}
              title={`${item.label} (${item.shortcut})`}
              aria-label={`${item.label} (${item.shortcut})`}
              aria-pressed={active}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#F59E0B] ${
                active
                  ? 'bg-[#F59E0B] text-[#141417]'
                  : 'text-[#A1A1AA] hover:text-[#F4F4F6] hover:bg-[#26262C]'
              }`}
            >
              <Icon className="w-4.5 h-4.5" />
            </button>
          );
        })}

        <div className="w-7 h-px bg-[#32323A] my-1.5" />

        <button
          type="button"
          onClick={onToggleGrid}
          title="Toggle Registration Grid"
          aria-label="Toggle Registration Grid"
          aria-pressed={showGrid}
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
            showGrid
              ? 'bg-[#26262C] text-[#F59E0B] border border-[#F59E0B]/40'
              : 'text-[#A1A1AA] hover:text-[#F4F4F6] hover:bg-[#26262C]'
          }`}
        >
          <Grid3X3 className="w-4.5 h-4.5" />
        </button>

        <button
          type="button"
          onClick={onClearCel}
          disabled={activeLayerLocked}
          title="Clear Active Cel"
          aria-label="Clear Active Cel"
          className="w-10 h-10 rounded-lg flex items-center justify-center text-[#A1A1AA] hover:text-rose-400 hover:bg-[#26262C] disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <Trash2 className="w-4.5 h-4.5" />
        </button>
      </div>

      {/* Contextual Brush & Swatch Strip */}
      <div className="w-48 p-3.5 flex flex-col gap-5 overflow-y-auto studio-scroll">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[#A1A1AA]">
              {isEraser ? 'Eraser Size' : 'Stroke Size'}
            </span>
            <span className="text-xs font-mono-tabular text-[#F4F4F6]">
              {currentSize}px
            </span>
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
            aria-label={isEraser ? 'Eraser size' : 'Stroke size'}
          />
        </div>

        {!isEraser && toolState.tool !== 'pan' && toolState.tool !== 'eyedropper' && (
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
              onChange={(e) => {
                const val = Number(e.target.value) / 100;
                setToolState((prev) => ({ ...prev, brushOpacity: val }));
              }}
              className="w-full studio-range"
              aria-label="Brush opacity"
            />
          </div>
        )}

        {showShapeFillToggle && (
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-medium text-[#A1A1AA]">Fill Shape</span>
            <button
              type="button"
              onClick={() => setToolState((prev) => ({ ...prev, fillShapes: !prev.fillShapes }))}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                toolState.fillShapes
                  ? 'bg-[#F59E0B] text-[#141417]'
                  : 'bg-[#26262C] text-[#A1A1AA] hover:text-[#F4F4F6]'
              }`}
            >
              {toolState.fillShapes ? 'Filled' : 'Outline'}
            </button>
          </div>
        )}

        <div className="h-px bg-[#32323A]" />

        {/* Studio Color Palette */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-medium text-[#A1A1AA]">Ink Color</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <span className="text-[11px] font-mono-tabular text-[#A1A1AA]">
                {toolState.color}
              </span>
              <input
                type="color"
                value={toolState.color}
                onChange={(e) =>
                  setToolState((prev) => ({ ...prev, color: e.target.value.toUpperCase() }))
                }
                aria-label="Custom ink color"
                className="w-6 h-6 rounded border border-[#32323A] bg-transparent cursor-pointer p-0"
              />
            </label>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {STUDIO_SWATCHES.map((hex) => {
              const selected = toolState.color.toUpperCase() === hex.toUpperCase();
              return (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setToolState((prev) => ({ ...prev, color: hex }))}
                  aria-label={`Color ${hex}`}
                  className={`h-8 rounded-md border transition-transform cursor-pointer ${
                    selected
                      ? 'border-[#F59E0B] ring-2 ring-[#F59E0B]/40 scale-105'
                      : 'border-[#32323A] hover:scale-105'
                  }`}
                  style={{ backgroundColor: hex }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
};
