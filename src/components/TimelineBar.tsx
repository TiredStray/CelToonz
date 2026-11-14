import React, { useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CopyPlus,
  Layers,
  Pause,
  Play,
  Plus,
  Repeat,
  Trash2,
} from 'lucide-react';
import { Frame, Layer, OnionSkinState } from '../types/animation';
import { renderCompositeFrameSync } from '../utils/canvasDrawing';

interface FrameThumbnailProps {
  frame: Frame;
  layers: Layer[];
  width: number;
  height: number;
  backgroundColor: string;
  imageCacheRef: React.MutableRefObject<Map<string, HTMLImageElement>>;
  cacheVersion: number;
}

const FrameThumbnail: React.FC<FrameThumbnailProps> = ({
  frame,
  layers,
  width,
  height,
  backgroundColor,
  imageCacheRef,
  cacheVersion,
}) => {
  const thumbRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = thumbRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const thumbW = 96;
    const thumbH = Math.max(36, Math.round((height / width) * thumbW));
    if (canvas.width !== thumbW || canvas.height !== thumbH) {
      canvas.width = thumbW;
      canvas.height = thumbH;
    }

    // Draw full frame scaled to thumbnail
    ctx.save();
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, thumbW, thumbH);
    ctx.scale(thumbW / width, thumbH / height);
    renderCompositeFrameSync(
      ctx,
      width,
      height,
      frame,
      layers,
      backgroundColor,
      imageCacheRef.current,
      false
    );
    ctx.restore();
  }, [frame, layers, width, height, backgroundColor, imageCacheRef, cacheVersion]);

  return (
    <canvas
      ref={thumbRef}
      className="w-full h-full object-contain rounded-[4px]"
    />
  );
};

interface TimelineBarProps {
  frames: Frame[];
  layers: Layer[];
  width: number;
  height: number;
  backgroundColor: string;
  currentFrameIndex: number;
  isPlaying: boolean;
  loopPlayback: boolean;
  onionSkin: OnionSkinState;
  imageCacheRef: React.MutableRefObject<Map<string, HTMLImageElement>>;
  cacheVersion: number;
  onSelectFrame: (index: number) => void;
  onTogglePlay: () => void;
  onToggleLoop: () => void;
  onAddFrame: () => void;
  onDuplicateFrame: () => void;
  onDeleteFrame: () => void;
  onSetFrameDuration: (index: number, duration: number) => void;
  onUpdateOnionSkin: React.Dispatch<React.SetStateAction<OnionSkinState>>;
  inMobileSheet?: boolean;
}

export const TimelineBar: React.FC<TimelineBarProps> = ({
  frames,
  layers,
  width,
  height,
  backgroundColor,
  currentFrameIndex,
  isPlaying,
  loopPlayback,
  onionSkin,
  imageCacheRef,
  cacheVersion,
  onSelectFrame,
  onTogglePlay,
  onToggleLoop,
  onAddFrame,
  onDuplicateFrame,
  onDeleteFrame,
  onSetFrameDuration,
  onUpdateOnionSkin,
  inMobileSheet = false,
}) => {
  const stripRef = useRef<HTMLDivElement>(null);
  const currentFrame = frames[currentFrameIndex];

  const totalExposureFrames = frames.reduce((acc, f) => acc + Math.max(1, f.duration), 0);
  const totalSeconds = (totalExposureFrames / 24).toFixed(2);
  const hasStoryboard = frames.some((f) => Boolean(f.storyboard));

  // Assign alternating Shot group index for clean visual Shot boundary lines
  const shotGroupIndexByFrame = frames.map((f, idx) => {
    if (!f.storyboard) return -1;
    let group = 0;
    for (let i = 1; i <= idx; i++) {
      if (frames[i].storyboard?.shotId !== frames[i - 1].storyboard?.shotId) {
        group++;
      }
    }
    return group;
  });

  useEffect(() => {
    const activeBtn = stripRef.current?.querySelector(
      `[data-frame-index="${currentFrameIndex}"]`
    ) as HTMLElement | null;
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    }
  }, [currentFrameIndex]);

  return (
    <section
      aria-label="Animation timeline"
      className={
        inMobileSheet
          ? 'flex flex-col bg-[#1D1D21] pb-4'
          : 'hidden md:flex flex-col h-44 shrink-0 bg-[#1D1D21] border-t border-[#32323A] z-20'
      }
    >
      {/* Transport & Frame Controls Row */}
      <div className="px-4 py-2 border-b border-[#32323A] flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Left: Playback Transport */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSelectFrame(Math.max(0, currentFrameIndex - 1))}
            disabled={currentFrameIndex === 0}
            title="Previous Frame (,)"
            aria-label="Previous Frame"
            className="min-w-[36px] min-h-[36px] md:min-w-[30px] md:min-h-[30px] rounded-md bg-[#26262C] hover:bg-[#32323A] disabled:opacity-35 text-[#E4E4E7] flex items-center justify-center cursor-pointer disabled:pointer-events-none"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onTogglePlay}
            title="Play / Pause (P)"
            aria-label={isPlaying ? 'Pause' : 'Play 24fps'}
            className={`min-h-[36px] md:min-h-[30px] px-3 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              isPlaying
                ? 'bg-rose-500 text-white hover:bg-rose-400'
                : 'bg-[#F59E0B] text-[#141417] hover:bg-[#FBBF24]'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'Stop' : 'Play'}</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectFrame(Math.min(frames.length - 1, currentFrameIndex + 1))}
            disabled={currentFrameIndex >= frames.length - 1}
            title="Next Frame (.)"
            aria-label="Next Frame"
            className="min-w-[36px] min-h-[36px] md:min-w-[30px] md:min-h-[30px] rounded-md bg-[#26262C] hover:bg-[#32323A] disabled:opacity-35 text-[#E4E4E7] flex items-center justify-center cursor-pointer disabled:pointer-events-none"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onToggleLoop}
            title="Loop Playback"
            aria-label="Toggle Loop Playback"
            aria-pressed={loopPlayback}
            className={`min-w-[36px] min-h-[36px] md:min-w-[30px] md:min-h-[30px] rounded-md flex items-center justify-center transition-colors cursor-pointer ${
              loopPlayback
                ? 'bg-[#26262C] text-[#F59E0B] border border-[#F59E0B]/40'
                : 'bg-[#26262C] text-[#71717A] hover:text-[#E4E4E7]'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>

          <span className="ml-2 text-xs font-mono-tabular text-[#A1A1AA] whitespace-nowrap">
            <strong className="text-[#F4F4F6] font-semibold">
              {String(currentFrameIndex + 1).padStart(2, '0')}
            </strong>
            /{String(frames.length).padStart(2, '0')} · 24 FPS · {totalSeconds}s
          </span>
        </div>

        {/* Center/Right: Onion Skin & Frame Exposure Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-[#141417] border border-[#32323A] rounded-md p-0.5">
            <button
              type="button"
              onClick={() =>
                onUpdateOnionSkin((prev) => ({ ...prev, enabled: !prev.enabled }))
              }
              aria-pressed={onionSkin.enabled}
              className={`px-2.5 h-7 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                onionSkin.enabled
                  ? 'bg-[#26262C] text-[#F59E0B]'
                  : 'text-[#71717A] hover:text-[#E4E4E7]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Onion</span>
            </button>
            <button
              type="button"
              onClick={() =>
                onUpdateOnionSkin((prev) => ({
                  ...prev,
                  prevFrames: prev.prevFrames > 0 ? 0 : 1,
                }))
              }
              title="Toggle Previous Frame Ghost"
              className={`px-2 h-7 rounded text-xs font-medium transition-colors cursor-pointer ${
                onionSkin.enabled && onionSkin.prevFrames > 0
                  ? 'text-[#FB7185] bg-[#FB7185]/10'
                  : 'text-[#52525B]'
              }`}
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() =>
                onUpdateOnionSkin((prev) => ({
                  ...prev,
                  nextFrames: prev.nextFrames > 0 ? 0 : 1,
                }))
              }
              title="Toggle Next Frame Ghost"
              className={`px-2 h-7 rounded text-xs font-medium transition-colors cursor-pointer ${
                onionSkin.enabled && onionSkin.nextFrames > 0
                  ? 'text-[#38BDF8] bg-[#38BDF8]/10'
                  : 'text-[#52525B]'
              }`}
            >
              Next
            </button>
          </div>

          {/* Exposure Hold Control */}
          {currentFrame && (
            <div className="flex items-center gap-1 bg-[#141417] border border-[#32323A] rounded-md px-2 h-8">
              <span className="text-[11px] text-[#A1A1AA] mr-1">Hold</span>
              <button
                type="button"
                onClick={() =>
                  onSetFrameDuration(currentFrameIndex, currentFrame.duration - 1)
                }
                disabled={currentFrame.duration <= 1}
                aria-label="Decrease frame hold"
                className="w-6 h-6 rounded hover:bg-[#26262C] text-[#E4E4E7] disabled:opacity-35 text-xs font-mono-tabular cursor-pointer"
              >
                -
              </button>
              <span className="text-xs font-mono-tabular text-[#F4F4F6] min-w-[22px] text-center">
                {currentFrame.duration}f
              </span>
              <button
                type="button"
                onClick={() =>
                  onSetFrameDuration(currentFrameIndex, currentFrame.duration + 1)
                }
                disabled={currentFrame.duration >= 48}
                aria-label="Increase frame hold"
                className="w-6 h-6 rounded hover:bg-[#26262C] text-[#E4E4E7] disabled:opacity-35 text-xs font-mono-tabular cursor-pointer"
              >
                +
              </button>
            </div>
          )}

          {/* Frame Add / Duplicate / Delete */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onAddFrame}
              className="h-8 px-2.5 rounded-md bg-[#26262C] hover:bg-[#32323A] text-[#F4F4F6] text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span>Frame</span>
            </button>
            <button
              type="button"
              onClick={onDuplicateFrame}
              title="Duplicate Frame"
              aria-label="Duplicate Frame"
              className="h-8 px-2.5 rounded-md bg-[#26262C] hover:bg-[#32323A] text-[#E4E4E7] text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
            >
              <CopyPlus className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Clone</span>
            </button>
            <button
              type="button"
              onClick={onDeleteFrame}
              title={frames.length <= 1 ? 'Clear Frame' : 'Delete Frame'}
              aria-label={frames.length <= 1 ? 'Clear Frame' : 'Delete Frame'}
              className="h-8 w-8 rounded-md bg-[#26262C] hover:bg-rose-500/20 hover:text-rose-400 text-[#A1A1AA] flex items-center justify-center transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Active Storyboard Shot / SubShot Notes Strip */}
      {hasStoryboard && currentFrame?.storyboard && (
        <div className="px-4 py-1.5 border-b border-[#2A2A32] bg-[#18181C] flex items-center gap-3 text-xs overflow-hidden shrink-0">
          <span className="font-mono-tabular font-semibold text-[#F59E0B] whitespace-nowrap shrink-0">
            {currentFrame.storyboard.shotNumber}
            {currentFrame.storyboard.subShotNumber
              ? ` · ${currentFrame.storyboard.subShotNumber}`
              : ''}
          </span>
          <span className="text-[#E4E4E7] font-medium whitespace-nowrap shrink-0 truncate max-w-[200px]">
            {currentFrame.storyboard.subShotTitle || currentFrame.storyboard.shotTitle}
          </span>
          {currentFrame.storyboard.camera && (
            <span className="hidden sm:inline font-mono-tabular text-[#38BDF8] whitespace-nowrap shrink-0">
              {currentFrame.storyboard.camera}
            </span>
          )}
          {currentFrame.storyboard.notes && (
            <span className="text-[#A1A1AA] truncate">
              — {currentFrame.storyboard.notes}
            </span>
          )}
        </div>
      )}

      {/* Horizontal Scrollable Filmstrip */}
      <div
        ref={stripRef}
        className="flex-1 px-4 py-2 overflow-x-auto studio-scroll flex items-center gap-2"
      >
        {frames.map((frame, idx) => {
          const isCurrent = idx === currentFrameIndex;
          const sb = frame.storyboard;
          const groupIdx = shotGroupIndexByFrame[idx];
          const prevShotId = idx > 0 ? frames[idx - 1].storyboard?.shotId : undefined;
          const isShotStart = Boolean(sb && sb.shotId !== prevShotId);
          const shotStripeClass =
            groupIdx % 2 === 0 ? 'bg-[#F59E0B]' : 'bg-[#38BDF8]';

          return (
            <React.Fragment key={frame.id}>
              {isShotStart && idx > 0 && (
                <div
                  aria-hidden="true"
                  className="h-16 w-px bg-[#3F3F46] shrink-0 mx-0.5"
                />
              )}
              <button
                type="button"
                data-frame-index={idx}
                onClick={() => onSelectFrame(idx)}
                className={`group relative shrink-0 w-26 h-20 rounded-lg p-1 flex flex-col justify-between transition-all cursor-pointer text-left overflow-hidden ${
                  isCurrent
                    ? 'bg-[#26262C] ring-2 ring-[#F59E0B]'
                    : 'bg-[#141417] border border-[#32323A] hover:border-[#52525B]'
                }`}
              >
                {sb && (
                  <div
                    className={`w-full h-0.5 rounded-full mb-1 shrink-0 ${shotStripeClass}`}
                  />
                )}

                <div className="w-full flex-1 overflow-hidden rounded bg-neutral-900 flex items-center justify-center">
                  <FrameThumbnail
                    frame={frame}
                    layers={layers}
                    width={width}
                    height={height}
                    backgroundColor={backgroundColor}
                    imageCacheRef={imageCacheRef}
                    cacheVersion={cacheVersion}
                  />
                </div>

                <div className="flex items-center justify-between px-0.5 pt-1 gap-1">
                  <span
                    className={`text-[10px] font-mono-tabular truncate ${
                      isCurrent ? 'text-[#F59E0B] font-semibold' : 'text-[#A1A1AA]'
                    }`}
                  >
                    {sb
                      ? `${sb.shotNumber}${sb.subShotNumber ? `·${sb.subShotNumber}` : ''}`
                      : String(idx + 1).padStart(2, '0')}
                  </span>
                  {frame.duration > 1 && (
                    <span className="text-[10px] font-mono-tabular text-[#71717A] shrink-0">
                      ×{frame.duration}
                    </span>
                  )}
                </div>
              </button>
            </React.Fragment>
          );
        })}

        <button
          type="button"
          onClick={onAddFrame}
          aria-label="Append blank frame"
          className="shrink-0 w-16 h-20 rounded-lg border border-dashed border-[#32323A] hover:border-[#F59E0B]/60 text-[#71717A] hover:text-[#F59E0B] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span className="text-[11px] font-medium">Add</span>
        </button>
      </div>
    </section>
  );
};
