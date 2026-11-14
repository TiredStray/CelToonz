import React from 'react';
import { Film, Layers, Palette, Pause, Play, Wrench } from 'lucide-react';
import { ToolState } from '../types/animation';
import { TOOL_ITEMS } from './ToolRail';

export type MobileSheetType = 'tools' | 'brush' | 'timeline' | 'layers' | 'project' | null;

interface MobileDockProps {
  toolState: ToolState;
  isPlaying: boolean;
  currentFrameIndex: number;
  frameCount: number;
  layerCount: number;
  activeSheet: MobileSheetType;
  onToggleSheet: (sheet: MobileSheetType) => void;
  onTogglePlay: () => void;
}

export const MobileDock: React.FC<MobileDockProps> = ({
  toolState,
  isPlaying,
  currentFrameIndex,
  frameCount,
  layerCount,
  activeSheet,
  onToggleSheet,
  onTogglePlay,
}) => {
  const activeToolItem = TOOL_ITEMS.find((t) => t.id === toolState.tool) ?? TOOL_ITEMS[0];
  const ActiveToolIcon = activeToolItem.icon;

  return (
    <nav
      aria-label="Mobile studio controls"
      className="md:hidden shrink-0 bg-[#1D1D21] border-t border-[#32323A] px-2 pb-[env(safe-area-inset-bottom)] z-30"
    >
      <div className="grid grid-cols-5 items-center h-14">
        {/* Tools Sheet */}
        <button
          type="button"
          onClick={() => onToggleSheet(activeSheet === 'tools' ? null : 'tools')}
          className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
            activeSheet === 'tools' ? 'text-[#F59E0B]' : 'text-[#A1A1AA]'
          }`}
        >
          {ActiveToolIcon ? <ActiveToolIcon className="w-5 h-5" /> : <Wrench className="w-5 h-5" />}
          <span className="text-[10px] font-medium tracking-tight">{activeToolItem.label}</span>
        </button>

        {/* Brush & Color Sheet */}
        <button
          type="button"
          onClick={() => onToggleSheet(activeSheet === 'brush' ? null : 'brush')}
          className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
            activeSheet === 'brush' ? 'text-[#F59E0B]' : 'text-[#A1A1AA]'
          }`}
        >
          <div className="flex items-center gap-1">
            <span
              className="w-4 h-4 rounded-full border border-white/25"
              style={{ backgroundColor: toolState.color }}
            />
            <Palette className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-mono-tabular tracking-tight">
            {toolState.tool === 'eraser' ? toolState.eraserSize : toolState.brushSize}px
          </span>
        </button>

        {/* Center Play/Stop 24fps Button */}
        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={isPlaying ? 'Stop playback' : 'Play 24fps'}
          className="min-h-[44px] flex flex-col items-center justify-center"
        >
          <div
            className={`w-11 h-9 rounded-xl flex items-center justify-center transition-transform active:scale-95 ${
              isPlaying ? 'bg-rose-500 text-white' : 'bg-[#F59E0B] text-[#141417]'
            }`}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </div>
        </button>

        {/* Timeline / Frames Sheet */}
        <button
          type="button"
          onClick={() => onToggleSheet(activeSheet === 'timeline' ? null : 'timeline')}
          className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
            activeSheet === 'timeline' ? 'text-[#F59E0B]' : 'text-[#A1A1AA]'
          }`}
        >
          <Film className="w-5 h-5" />
          <span className="text-[10px] font-mono-tabular tracking-tight">
            {currentFrameIndex + 1}/{frameCount}
          </span>
        </button>

        {/* Layers Sheet */}
        <button
          type="button"
          onClick={() => onToggleSheet(activeSheet === 'layers' ? null : 'layers')}
          className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
            activeSheet === 'layers' ? 'text-[#F59E0B]' : 'text-[#A1A1AA]'
          }`}
        >
          <Layers className="w-5 h-5" />
          <span className="text-[10px] font-medium tracking-tight">Layers ({layerCount})</span>
        </button>
      </div>
    </nav>
  );
};
