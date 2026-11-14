import React, { useState } from 'react';
import { X } from 'lucide-react';
import { CANVAS_PRESETS, CanvasPreset } from '../types/animation';

interface ProjectModalProps {
  open: boolean;
  initialTitle: string;
  onClose: () => void;
  onCreateProject: (
    title: string,
    width: number,
    height: number,
    backgroundColor: string
  ) => void;
}

const PAPER_OPTIONS = [
  { label: 'Warm Paper', hex: '#FAF9F6' },
  { label: 'Pure White', hex: '#FFFFFF' },
  { label: 'Dark Slate', hex: '#18181B' },
];

export const ProjectModal: React.FC<ProjectModalProps> = ({
  open,
  initialTitle,
  onClose,
  onCreateProject,
}) => {
  const [title, setTitle] = useState(initialTitle || 'Untitled Flipbook');
  const [selectedPreset, setSelectedPreset] = useState<CanvasPreset>(CANVAS_PRESETS[0]);
  const [paperColor, setPaperColor] = useState('#FAF9F6');

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateProject(
      title.trim() || 'Untitled Flipbook',
      selectedPreset.width,
      selectedPreset.height,
      paperColor
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New Flipbook Canvas"
        className="w-full max-w-md bg-[#1D1D21] border border-[#32323A] rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-[#32323A] flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-[#F4F4F6]">
            New Flipbook Canvas
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="min-w-[40px] min-h-[40px] -mr-2 rounded-lg flex items-center justify-center text-[#A1A1AA] hover:text-[#F4F4F6] hover:bg-[#26262C] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div>
            <label
              htmlFor="proj-title-input"
              className="block text-xs font-medium text-[#A1A1AA] mb-1.5"
            >
              Project Title
            </label>
            <input
              id="proj-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My Flipbook"
              className="w-full h-10 px-3 rounded-lg bg-[#141417] border border-[#32323A] focus:border-[#F59E0B] focus:outline-none text-sm text-[#F4F4F6]"
            />
          </div>

          <div>
            <span className="block text-xs font-medium text-[#A1A1AA] mb-2">
              Aspect Ratio · 24 FPS
            </span>
            <div className="grid grid-cols-3 gap-2">
              {CANVAS_PRESETS.map((preset) => {
                const active = selectedPreset.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedPreset(preset)}
                    className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#26262C] border-[#F59E0B] text-[#F4F4F6]'
                        : 'bg-[#141417] border-[#32323A] text-[#A1A1AA] hover:text-[#E4E4E7]'
                    }`}
                  >
                    <div className="text-xs font-semibold">{preset.ratioLabel}</div>
                    <div className="text-[11px] text-[#71717A] mt-0.5 truncate">
                      {preset.label}
                    </div>
                    <div className="text-[10px] font-mono-tabular text-[#A1A1AA] mt-1">
                      {preset.width}×{preset.height}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-[#A1A1AA] mb-2">
              Opaque Paper Background
            </span>
            <div className="grid grid-cols-3 gap-2">
              {PAPER_OPTIONS.map((opt) => {
                const active = paperColor === opt.hex;
                return (
                  <button
                    key={opt.hex}
                    type="button"
                    onClick={() => setPaperColor(opt.hex)}
                    className={`min-h-[44px] px-3 rounded-lg border flex items-center gap-2 text-xs font-medium transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#26262C] border-[#F59E0B] text-[#F4F4F6]'
                        : 'bg-[#141417] border-[#32323A] text-[#A1A1AA]'
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded border border-white/20 shrink-0"
                      style={{ backgroundColor: opt.hex }}
                    />
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] md:min-h-[38px] px-4 rounded-lg bg-[#26262C] hover:bg-[#32323A] text-xs font-medium text-[#E4E4E7] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] md:min-h-[38px] px-4 rounded-lg bg-[#F59E0B] hover:bg-[#FBBF24] text-[#141417] text-xs font-semibold cursor-pointer"
            >
              Create Canvas
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
