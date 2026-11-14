import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface BottomSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  open,
  title,
  onClose,
  children,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative bg-[#1D1D21] border-t border-[#32323A] rounded-t-3xl max-h-[78vh] flex flex-col shadow-2xl pb-[env(safe-area-inset-bottom)]"
      >
        <div className="pt-2.5 pb-2 px-4 flex flex-col items-center border-b border-[#32323A] shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-[#3F3F46] mb-2" />
          <div className="w-full flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-[#F4F4F6]">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label={`Close ${title}`}
              className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center text-[#A1A1AA] hover:text-[#F4F4F6]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto studio-scroll">{children}</div>
      </div>
    </div>
  );
};
