import React from 'react';
import { Download } from 'lucide-react';

interface TopBarProps {
  projectTitle: string;
  canvasSizeLabel: string;
  onOpenNew: () => void;
  onLoadDemo: () => void;
  onImportJson: () => void;
  onExportJson: () => void;
  onOpenExportWebm: () => void;
  onOpenProjectSheetMobile: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  projectTitle,
  canvasSizeLabel,
  onOpenNew,
  onLoadDemo,
  onImportJson,
  onExportJson,
  onOpenExportWebm,
  onOpenProjectSheetMobile,
}) => {
  return (
    <header className="h-11 md:h-12 shrink-0 bg-[#1D1D21] border-b border-[#32323A] px-3 md:px-5 flex items-center justify-between gap-4 md:gap-8 z-30">
      {/* Zone 1: Single-element brand wordmark */}
      <div className="flex items-center gap-4 min-w-0">
        <span className="font-display text-base md:text-lg font-semibold tracking-tight text-[#F4F4F6] whitespace-nowrap shrink-0">
          CelToonz
        </span>
        <span className="hidden lg:inline text-xs text-[#71717A] truncate max-w-[220px]">
          {projectTitle} · <span className="font-mono-tabular">{canvasSizeLabel}</span>
        </span>
      </div>

      {/* Zone 2: Clean single-line project navigation links (Desktop) */}
      <nav
        aria-label="Project actions"
        className="hidden md:flex items-center gap-6 text-xs font-medium text-[#A1A1AA]"
      >
        <button
          type="button"
          onClick={onOpenNew}
          className="hover:text-[#F4F4F6] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1"
        >
          New Canvas
        </button>
        <button
          type="button"
          onClick={onLoadDemo}
          className="hover:text-[#F4F4F6] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1"
        >
          Demo Loop
        </button>
        <button
          type="button"
          onClick={onImportJson}
          className="hover:text-[#F4F4F6] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1"
        >
          Open JSON
        </button>
        <button
          type="button"
          onClick={onExportJson}
          className="hover:text-[#F4F4F6] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1"
        >
          Save JSON
        </button>
      </nav>

      {/* Mobile Project Menu Trigger */}
      <button
        type="button"
        onClick={onOpenProjectSheetMobile}
        className="md:hidden min-h-[44px] px-2.5 text-xs font-medium text-[#A1A1AA] hover:text-[#F4F4F6] whitespace-nowrap shrink-0 truncate max-w-[130px]"
      >
        {projectTitle}
      </button>

      {/* Zone 3: Single primary CTA */}
      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onOpenExportWebm}
          className="h-8 md:h-9 px-3.5 md:px-4 rounded-lg bg-[#F59E0B] hover:bg-[#FBBF24] active:scale-[0.98] text-[#141417] text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F59E0B]"
        >
          <Download className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Export WebM</span>
        </button>
      </div>
    </header>
  );
};
