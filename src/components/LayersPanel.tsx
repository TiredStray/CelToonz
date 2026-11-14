import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  Lock,
  Plus,
  Trash2,
  Unlock,
} from 'lucide-react';
import { Layer } from '../types/animation';

interface LayersPanelProps {
  layers: Layer[];
  activeLayerId: string;
  onSelectLayer: (id: string) => void;
  onAddLayer: () => void;
  onDuplicateLayer: (id: string) => void;
  onDeleteLayer: (id: string) => void;
  onReorderLayer: (id: string, direction: 'up' | 'down') => void;
  onUpdateLayer: (id: string, patch: Partial<Layer>, recordHistory?: boolean) => void;
  compactMobile?: boolean;
}

export const LayersPanel: React.FC<LayersPanelProps> = ({
  layers,
  activeLayerId,
  onSelectLayer,
  onAddLayer,
  onDuplicateLayer,
  onDeleteLayer,
  onReorderLayer,
  onUpdateLayer,
  compactMobile = false,
}) => {
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  // Render top-most layer first visually
  const orderedTopDown = [...layers].reverse();
  const activeLayer = layers.find((l) => l.id === activeLayerId);

  const startRename = (layer: Layer) => {
    setEditingLayerId(layer.id);
    setDraftName(layer.name);
  };

  const commitRename = (layerId: string) => {
    const trimmed = draftName.trim();
    if (trimmed) {
      onUpdateLayer(layerId, { name: trimmed }, true);
    }
    setEditingLayerId(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#32323A] shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold text-[#F4F4F6] tracking-wide">Layers</h2>
          <span className="text-xs font-mono-tabular text-[#71717A]">{layers.length}</span>
        </div>
        <button
          type="button"
          onClick={onAddLayer}
          className="min-h-[36px] md:min-h-[30px] px-2.5 rounded-md bg-[#26262C] hover:bg-[#32323A] text-[#F4F4F6] text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-[#F59E0B]" />
          <span>Add</span>
        </button>
      </div>

      {/* Active Layer Opacity & Order Controls */}
      {activeLayer && (
        <div className="px-4 py-3 border-b border-[#32323A] bg-[#19191D] shrink-0 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#A1A1AA] truncate max-w-[140px]">
              {activeLayer.name}
            </span>
            <span className="text-xs font-mono-tabular text-[#F4F4F6]">
              {Math.round(activeLayer.opacity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(activeLayer.opacity * 100)}
            onChange={(e) =>
              onUpdateLayer(activeLayer.id, { opacity: Number(e.target.value) / 100 }, false)
            }
            onPointerUp={() =>
              onUpdateLayer(activeLayer.id, { opacity: activeLayer.opacity }, true)
            }
            className="w-full studio-range"
            aria-label="Active layer opacity"
          />
          <div className="flex items-center justify-between gap-1 pt-1">
            <button
              type="button"
              onClick={() => onReorderLayer(activeLayer.id, 'up')}
              disabled={layers[layers.length - 1]?.id === activeLayer.id}
              title="Move Layer Up"
              className="flex-1 min-h-[36px] md:min-h-[28px] rounded bg-[#26262C] hover:bg-[#32323A] disabled:opacity-35 text-xs text-[#E4E4E7] flex items-center justify-center gap-1 cursor-pointer disabled:pointer-events-none"
            >
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Up</span>
            </button>
            <button
              type="button"
              onClick={() => onReorderLayer(activeLayer.id, 'down')}
              disabled={layers[0]?.id === activeLayer.id}
              title="Move Layer Down"
              className="flex-1 min-h-[36px] md:min-h-[28px] rounded bg-[#26262C] hover:bg-[#32323A] disabled:opacity-35 text-xs text-[#E4E4E7] flex items-center justify-center gap-1 cursor-pointer disabled:pointer-events-none"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Down</span>
            </button>
            <button
              type="button"
              onClick={() => onDuplicateLayer(activeLayer.id)}
              title="Duplicate Layer"
              aria-label="Duplicate Layer"
              className="min-w-[36px] min-h-[36px] md:min-w-[30px] md:min-h-[28px] rounded bg-[#26262C] hover:bg-[#32323A] text-[#E4E4E7] flex items-center justify-center cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDeleteLayer(activeLayer.id)}
              disabled={layers.length <= 1}
              title="Delete Layer"
              aria-label="Delete Layer"
              className="min-w-[36px] min-h-[36px] md:min-w-[30px] md:min-h-[28px] rounded bg-[#26262C] hover:bg-rose-500/20 hover:text-rose-400 disabled:opacity-35 text-[#E4E4E7] flex items-center justify-center cursor-pointer disabled:pointer-events-none"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Layer Stack List */}
      <div className="flex-1 overflow-y-auto studio-scroll divide-y divide-[#2A2A32]">
        {orderedTopDown.map((layer) => {
          const isActive = layer.id === activeLayerId;
          const isEditing = editingLayerId === layer.id;

          return (
            <div
              key={layer.id}
              onClick={() => onSelectLayer(layer.id)}
              className={`flex items-center justify-between gap-2 px-3 transition-colors cursor-pointer ${
                compactMobile ? 'min-h-[56px]' : 'min-h-[46px]'
              } ${
                isActive
                  ? 'bg-[#26262C] text-[#F4F4F6]'
                  : 'bg-transparent text-[#A1A1AA] hover:bg-[#1F1F24] hover:text-[#E4E4E7]'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateLayer(layer.id, { visible: !layer.visible }, true);
                  }}
                  aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
                  className={`min-w-[44px] min-h-[44px] md:min-w-[28px] md:min-h-[28px] -ml-1.5 md:ml-0 rounded flex items-center justify-center transition-colors cursor-pointer ${
                    layer.visible
                      ? isActive
                        ? 'text-[#F59E0B]'
                        : 'text-[#E4E4E7]'
                      : 'text-[#52525B]'
                  }`}
                >
                  {layer.visible ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeOff className="w-4 h-4" />
                  )}
                </button>

                {isEditing ? (
                  <input
                    type="text"
                    value={draftName}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={() => commitRename(layer.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(layer.id);
                      if (e.key === 'Escape') setEditingLayerId(null);
                    }}
                    className="w-full bg-[#141417] border border-[#F59E0B] rounded px-2 py-0.5 text-xs text-[#F4F4F6] focus:outline-none"
                  />
                ) : (
                  <div
                    onDoubleClick={() => startRename(layer)}
                    className="flex flex-col min-w-0 flex-1"
                  >
                    <span className="text-xs font-medium truncate">
                      {layer.name}
                    </span>
                    <span className="text-[11px] font-mono-tabular text-[#71717A]">
                      {Math.round(layer.opacity * 100)}%
                    </span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateLayer(layer.id, { locked: !layer.locked }, true);
                }}
                aria-label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
                className={`min-w-[44px] min-h-[44px] md:min-w-[28px] md:min-h-[28px] rounded flex items-center justify-center transition-colors cursor-pointer ${
                  layer.locked
                    ? 'text-[#F59E0B]'
                    : 'text-[#52525B] hover:text-[#A1A1AA]'
                }`}
              >
                {layer.locked ? (
                  <Lock className="w-3.5 h-3.5" />
                ) : (
                  <Unlock className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
