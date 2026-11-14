import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, Film, Loader2, X } from 'lucide-react';
import { ExportProgress, Project } from '../types/animation';
import { sanitizeFilename } from '../utils/projectJson';
import { exportProjectToWebm, getSupportedWebmMimeType, WebmExportResult } from '../utils/webmExport';

interface ExportWebmModalProps {
  open: boolean;
  project: Project;
  onClose: () => void;
}

export const ExportWebmModal: React.FC<ExportWebmModalProps> = ({
  open,
  project,
  onClose,
}) => {
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [result, setResult] = useState<WebmExportResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      abortRef.current = null;
      setProgress(null);
      setErrorMsg(null);
      setResult(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!open) return null;

  const totalExposureFrames = project.frames.reduce(
    (sum, f) => sum + Math.max(1, Math.round(f.duration || 1)),
    0
  );
  const durationSeconds = (totalExposureFrames / 24).toFixed(2);
  const supportedMime = getSupportedWebmMimeType();
  const isRendering =
    progress?.phase === 'preparing' ||
    progress?.phase === 'rendering' ||
    progress?.phase === 'finalizing';

  const handleStartRender = async () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setResult(null);
    setErrorMsg(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await exportProjectToWebm(
        project,
        (prog) => setProgress(prog),
        controller.signal
      );
      const url = URL.createObjectURL(res.blob);
      setResult(res);
      setPreviewUrl(url);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        setProgress(null);
        return;
      }
      const message =
        err instanceof Error ? err.message : 'Unable to render WebM video in this browser.';
      setErrorMsg(message);
      setProgress({
        phase: 'error',
        currentFrame: 0,
        totalFrames: totalExposureFrames,
        message,
      });
    }
  };

  const handleDownload = () => {
    if (!previewUrl) return;
    const link = document.createElement('a');
    link.href = previewUrl;
    link.download = `${sanitizeFilename(project.title)}-24fps.webm`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const pct =
    progress && progress.totalFrames > 0
      ? Math.round((progress.currentFrame / progress.totalFrames) * 100)
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Export 24fps WebM"
        className="w-full max-w-lg bg-[#1D1D21] border border-[#32323A] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#32323A] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Film className="w-5 h-5 text-[#F59E0B]" />
            <h2 className="font-display text-base font-semibold text-[#F4F4F6]">
              Export WebM Movie
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              abortRef.current?.abort();
              onClose();
            }}
            aria-label="Close export modal"
            className="min-w-[40px] min-h-[40px] -mr-2 rounded-lg flex items-center justify-center text-[#A1A1AA] hover:text-[#F4F4F6] hover:bg-[#26262C] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 overflow-y-auto studio-scroll">
          {/* Spec Summary */}
          <div className="grid grid-cols-3 gap-3 text-left border-b border-[#32323A] pb-4">
            <div>
              <div className="text-[11px] text-[#71717A]">Resolution</div>
              <div className="text-sm font-mono-tabular font-medium text-[#F4F4F6] mt-0.5">
                {project.width}×{project.height}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#71717A]">Frame Rate</div>
              <div className="text-sm font-mono-tabular font-medium text-[#F4F4F6] mt-0.5">
                24 FPS · Opaque
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#71717A]">Duration</div>
              <div className="text-sm font-mono-tabular font-medium text-[#F4F4F6] mt-0.5">
                {totalExposureFrames}f · {durationSeconds}s
              </div>
            </div>
          </div>

          {!supportedMime && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>
                Your browser does not expose a WebM MediaRecorder encoder. Please use Chrome,
                Edge, or Firefox on desktop or Android to export WebM video.
              </span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Render Progress */}
          {isRendering && progress && (
            <div className="space-y-2.5 py-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#E4E4E7] flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#F59E0B]" />
                  <span>{progress.message}</span>
                </span>
                <span className="font-mono-tabular text-[#F59E0B]">{pct}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#141417] overflow-hidden">
                <div
                  className="h-full bg-[#F59E0B] transition-all duration-150"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          {/* Rendered Video Preview */}
          {result && previewUrl && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-emerald-400">
                <span className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>WebM Render Complete</span>
                </span>
                <span className="font-mono-tabular text-[#A1A1AA]">
                  {(result.blob.size / 1024).toFixed(1)} KB
                </span>
              </div>
              <div className="rounded-xl overflow-hidden border border-[#32323A] bg-black">
                <video
                  src={previewUrl}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="w-full max-h-64 object-contain mx-auto"
                />
              </div>
            </div>
          )}

          {!isRendering && !result && supportedMime && (
            <p className="text-xs text-[#A1A1AA] leading-relaxed">
              Composites all visible layers over your opaque paper background (
              <span className="font-mono-tabular text-[#E4E4E7]">{project.backgroundColor}</span>
              ) at a fixed 24fps cadence using{' '}
              <span className="font-mono-tabular text-[#E4E4E7]">{supportedMime}</span>.
            </p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 border-t border-[#32323A] bg-[#19191D] flex items-center justify-end gap-2.5">
          {isRendering ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="min-h-[44px] md:min-h-[38px] px-4 rounded-lg bg-[#26262C] hover:bg-[#32323A] text-xs font-medium text-[#E4E4E7] cursor-pointer"
            >
              Cancel Render
            </button>
          ) : result && previewUrl ? (
            <>
              <button
                type="button"
                onClick={handleStartRender}
                className="min-h-[44px] md:min-h-[38px] px-4 rounded-lg bg-[#26262C] hover:bg-[#32323A] text-xs font-medium text-[#E4E4E7] cursor-pointer"
              >
                Re-render
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="min-h-[44px] md:min-h-[38px] px-4 rounded-lg bg-[#F59E0B] hover:bg-[#FBBF24] text-[#141417] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download .webm</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] md:min-h-[38px] px-4 rounded-lg bg-[#26262C] hover:bg-[#32323A] text-xs font-medium text-[#E4E4E7] cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                disabled={!supportedMime}
                onClick={handleStartRender}
                className="min-h-[44px] md:min-h-[38px] px-4 rounded-lg bg-[#F59E0B] hover:bg-[#FBBF24] disabled:opacity-40 text-[#141417] text-xs font-semibold cursor-pointer"
              >
                Render 24fps WebM
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
