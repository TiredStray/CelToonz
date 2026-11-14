import { Frame, Layer, Project } from '../types/animation';

interface CelToonzJsonEnvelope {
  format: 'celtoonz-flipbook';
  version: number;
  exportedAt: string;
  project: Project;
}

export function sanitizeFilename(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'celtoonz-project';
}

export function exportProjectToJson(project: Project): void {
  const envelope: CelToonzJsonEnvelope = {
    format: 'celtoonz-flipbook',
    version: 1,
    exportedAt: new Date().toISOString(),
    project,
  };

  const json = JSON.stringify(envelope, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeFilename(project.title)}.celtoonz.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function parseProjectFromJson(rawText: string): Project {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid project structure.');
  }

  const candidate =
    'project' in parsed && parsed.project && typeof parsed.project === 'object'
      ? (parsed.project as Partial<Project>)
      : (parsed as Partial<Project>);

  const width = Number(candidate.width);
  const height = Number(candidate.height);
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 64 ||
    width > 4096 ||
    height < 64 ||
    height > 4096
  ) {
    throw new Error('Project canvas dimensions must be between 64 and 4096 pixels.');
  }

  if (!Array.isArray(candidate.layers) || candidate.layers.length === 0) {
    throw new Error('Project must contain at least one layer.');
  }

  if (!Array.isArray(candidate.frames) || candidate.frames.length === 0) {
    throw new Error('Project must contain at least one frame.');
  }

  const layers: Layer[] = candidate.layers.map((l, idx) => ({
    id: typeof l?.id === 'string' && l.id ? l.id : `layer-${idx + 1}`,
    name: typeof l?.name === 'string' && l.name ? l.name : `Layer ${idx + 1}`,
    visible: typeof l?.visible === 'boolean' ? l.visible : true,
    locked: typeof l?.locked === 'boolean' ? l.locked : false,
    opacity:
      typeof l?.opacity === 'number' && Number.isFinite(l.opacity)
        ? Math.max(0, Math.min(1, l.opacity))
        : 1,
  }));

  const layerIds = new Set(layers.map((l) => l.id));

  const frames: Frame[] = candidate.frames.map((f, idx) => {
    const cleanedCels: Record<string, string | null> = {};
    if (f?.cels && typeof f.cels === 'object') {
      for (const [lid, val] of Object.entries(f.cels)) {
        if (layerIds.has(lid) && (typeof val === 'string' || val === null)) {
          cleanedCels[lid] = val;
        }
      }
    }

    const sb = f?.storyboard;
    const cleanedStoryboard =
      sb && typeof sb === 'object' && typeof sb.shotNumber === 'string'
        ? {
            shotId: typeof sb.shotId === 'string' ? sb.shotId : `shot-${idx + 1}`,
            shotNumber: sb.shotNumber,
            shotTitle: typeof sb.shotTitle === 'string' ? sb.shotTitle : sb.shotNumber,
            subShotNumber: typeof sb.subShotNumber === 'string' ? sb.subShotNumber : undefined,
            subShotTitle: typeof sb.subShotTitle === 'string' ? sb.subShotTitle : undefined,
            camera: typeof sb.camera === 'string' ? sb.camera : undefined,
            notes: typeof sb.notes === 'string' ? sb.notes : undefined,
          }
        : undefined;

    return {
      id: typeof f?.id === 'string' && f.id ? f.id : `frame-${idx + 1}`,
      duration:
        typeof f?.duration === 'number' && Number.isFinite(f.duration)
          ? Math.max(1, Math.min(48, Math.round(f.duration)))
          : 1,
      cels: cleanedCels,
      ...(cleanedStoryboard ? { storyboard: cleanedStoryboard } : {}),
    };
  });

  const currentFrameIndex =
    typeof candidate.currentFrameIndex === 'number' &&
    candidate.currentFrameIndex >= 0 &&
    candidate.currentFrameIndex < frames.length
      ? Math.floor(candidate.currentFrameIndex)
      : 0;

  const activeLayerId =
    typeof candidate.activeLayerId === 'string' && layerIds.has(candidate.activeLayerId)
      ? candidate.activeLayerId
      : layers[layers.length - 1].id;

  return {
    id: typeof candidate.id === 'string' && candidate.id ? candidate.id : `proj-${Date.now()}`,
    title:
      typeof candidate.title === 'string' && candidate.title.trim()
        ? candidate.title.trim()
        : 'Imported Flipbook',
    width: Math.round(width),
    height: Math.round(height),
    fps: 24,
    backgroundColor:
      typeof candidate.backgroundColor === 'string' && candidate.backgroundColor.startsWith('#')
        ? candidate.backgroundColor
        : '#FAF9F6',
    layers,
    frames,
    currentFrameIndex,
    activeLayerId,
  };
}
