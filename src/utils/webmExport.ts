import { ExportProgress, Frame, Project } from '../types/animation';
import { preloadFrameImages, renderCompositeFrameSync } from './canvasDrawing';

export interface WebmExportResult {
  blob: Blob;
  mimeType: string;
  totalExposureFrames: number;
  durationSeconds: number;
}

export function getSupportedWebmMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return null;
}

function waitMs(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Export cancelled', 'AbortError'));
      return;
    }
    const timer = window.setTimeout(() => {
      cleanup();
      resolve();
    }, Math.max(0, ms));

    const onAbort = () => {
      window.clearTimeout(timer);
      cleanup();
      reject(new DOMException('Export cancelled', 'AbortError'));
    };

    const cleanup = () => {
      signal?.removeEventListener('abort', onAbort);
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function exportProjectToWebm(
  project: Project,
  onProgress: (progress: ExportProgress) => void,
  signal?: AbortSignal
): Promise<WebmExportResult> {
  const mimeType = getSupportedWebmMimeType();
  if (!mimeType) {
    throw new Error(
      'This browser does not support WebM video recording via MediaRecorder. Try Chrome, Edge, or Firefox.'
    );
  }

  // Expand frames by exposure duration (hold counts)
  const expandedFrames: Frame[] = [];
  for (const frame of project.frames) {
    const hold = Math.max(1, Math.round(frame.duration || 1));
    for (let h = 0; h < hold; h++) {
      expandedFrames.push(frame);
    }
  }

  const totalFrames = expandedFrames.length;
  onProgress({
    phase: 'preparing',
    currentFrame: 0,
    totalFrames,
    message: 'Decoding cel layers...',
  });

  const imageCache = new Map<string, HTMLImageElement>();
  await preloadFrameImages(project.frames, imageCache);

  if (signal?.aborted) {
    throw new DOMException('Export cancelled', 'AbortError');
  }

  const canvas = document.createElement('canvas');
  canvas.width = project.width;
  canvas.height = project.height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    throw new Error('Could not initialize 2D compositing context for WebM export.');
  }

  // Render first frame before capturing stream so initial video frame is valid and opaque
  renderCompositeFrameSync(
    ctx,
    project.width,
    project.height,
    expandedFrames[0],
    project.layers,
    project.backgroundColor,
    imageCache,
    true
  );

  // Use manual requestFrame if available on CanvasCaptureMediaStreamTrack for crisp 24fps pacing
  const rawStream =
    typeof canvas.captureStream === 'function'
      ? canvas.captureStream(0)
      : (canvas as unknown as { mozCaptureStream?: (fps: number) => MediaStream }).mozCaptureStream?.(24);

  if (!rawStream) {
    throw new Error('Canvas stream capture is not supported in this browser.');
  }

  const videoTrack = rawStream.getVideoTracks()[0] as MediaStreamTrack & {
    requestFrame?: () => void;
  };
  const supportsManualFrame = Boolean(videoTrack && typeof videoTrack.requestFrame === 'function');

  // If manual requestFrame isn't supported, fall back to automatic 24fps stream
  const stream = supportsManualFrame ? rawStream : canvas.captureStream(24);
  const activeTrack = stream.getVideoTracks()[0] as MediaStreamTrack & {
    requestFrame?: () => void;
  };

  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 6_000_000,
  });

  const recordingStopped = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunks.push(e.data);
      }
    };
    recorder.onerror = () => {
      reject(new Error('MediaRecorder encountered an encoding error.'));
    };
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: mimeType }));
    };
  });

  const frameDurationMs = 1000 / 24;
  recorder.start(100);

  try {
    const startTime = performance.now();

    for (let i = 0; i < totalFrames; i++) {
      if (signal?.aborted) {
        throw new DOMException('Export cancelled', 'AbortError');
      }

      renderCompositeFrameSync(
        ctx,
        project.width,
        project.height,
        expandedFrames[i],
        project.layers,
        project.backgroundColor,
        imageCache,
        true
      );

      if (supportsManualFrame && activeTrack?.requestFrame) {
        activeTrack.requestFrame();
      }

      onProgress({
        phase: 'rendering',
        currentFrame: i + 1,
        totalFrames,
        message: `Encoding frame ${i + 1} of ${totalFrames} at 24 fps`,
      });

      const targetNextTime = startTime + (i + 1) * frameDurationMs;
      const delay = targetNextTime - performance.now();
      await waitMs(Math.max(12, delay), signal);
    }

    onProgress({
      phase: 'finalizing',
      currentFrame: totalFrames,
      totalFrames,
      message: 'Finalizing WebM container...',
    });

    if (recorder.state !== 'inactive') {
      recorder.stop();
    }

    const blob = await recordingStopped;
    stream.getTracks().forEach((t) => t.stop());

    onProgress({
      phase: 'done',
      currentFrame: totalFrames,
      totalFrames,
      message: 'WebM render complete',
    });

    return {
      blob,
      mimeType,
      totalExposureFrames: totalFrames,
      durationSeconds: Number((totalFrames / 24).toFixed(2)),
    };
  } catch (err) {
    if (recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        // ignore stop error during abort
      }
    }
    stream.getTracks().forEach((t) => t.stop());
    throw err;
  }
}
