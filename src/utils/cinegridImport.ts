import {
  CineGridParsedPanel,
  CineGridParseResult,
  Frame,
  Layer,
  Project,
} from '../types/animation';
import { makeId } from './demoProject';

type AnyRecord = Record<string, unknown>;

function asRecord(val: unknown): AnyRecord | null {
  return val && typeof val === 'object' && !Array.isArray(val) ? (val as AnyRecord) : null;
}

function firstString(obj: AnyRecord | null, keys: string[]): string | undefined {
  if (!obj) return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) {
      return v.trim();
    }
    if (typeof v === 'number' && Number.isFinite(v)) {
      return String(v);
    }
  }
  return undefined;
}

function firstArray(obj: AnyRecord | null, keys: string[]): unknown[] | undefined {
  if (!obj) return undefined;
  for (const k of keys) {
    if (Array.isArray(obj[k])) {
      return obj[k] as unknown[];
    }
  }
  return undefined;
}

function normalizeImageSource(raw: unknown): string | undefined {
  if (!raw) return undefined;

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const rec = raw as AnyRecord;
    return normalizeImageSource(
      rec.dataUrl ?? rec.url ?? rec.src ?? rec.image ?? rec.imageUrl ?? rec.thumbnail
    );
  }

  if (typeof raw !== 'string') return undefined;
  const s = raw.trim();
  if (!s) return undefined;

  if (s.startsWith('data:image/') || s.startsWith('http://') || s.startsWith('https://') || s.startsWith('blob:')) {
    return s;
  }
  if (s.startsWith('<svg')) {
    return `data:image/svg+xml;utf8,${encodeURIComponent(s)}`;
  }
  // Raw base64 PNG/JPEG heuristic
  if (s.startsWith('iVBORw0KGgo')) {
    return `data:image/png;base64,${s}`;
  }
  if (s.startsWith('/9j/')) {
    return `data:image/jpeg;base64,${s}`;
  }
  if (s.startsWith('UklGR')) {
    return `data:image/webp;base64,${s}`;
  }
  return undefined;
}

function extractImageFromObject(obj: AnyRecord | null): string | undefined {
  if (!obj) return undefined;
  const keys = [
    'imageDataUrl',
    'dataUrl',
    'imageUrl',
    'image_url',
    'image',
    'thumbnailUrl',
    'thumbnail_url',
    'thumbnail',
    'frameUrl',
    'sketch',
    'drawing',
    'src',
    'url',
    'mediaUrl',
    'preview',
    'asset',
    'media',
  ];
  for (const k of keys) {
    const found = normalizeImageSource(obj[k]);
    if (found) return found;
  }
  return undefined;
}

function extractHoldFrames(obj: AnyRecord | null): number | undefined {
  if (!obj) return undefined;
  const frameVal = Number(obj.frames ?? obj.frameCount ?? obj.holdFrames);
  if (Number.isFinite(frameVal) && frameVal >= 1) {
    return Math.max(1, Math.min(48, Math.round(frameVal)));
  }
  const secVal = Number(obj.durationSec ?? obj.durationSeconds ?? obj.duration);
  if (Number.isFinite(secVal) && secVal > 0) {
    // Cap individual panel hold at 48 frames (2s) so storyboard timelines stay nimble
    return Math.max(1, Math.min(48, Math.round(secVal * 8)));
  }
  return undefined;
}

export function isCineGridJson(rawText: string): boolean {
  try {
    const parsed = JSON.parse(rawText);
    const root = asRecord(parsed);
    if (Array.isArray(parsed)) {
      return parsed.some((item) => {
        const rec = asRecord(item);
        return Boolean(
          rec &&
            ('subShots' in rec ||
              'subshots' in rec ||
              'sub_shots' in rec ||
              'shotNumber' in rec ||
              'shotTitle' in rec ||
              'camera' in rec)
        );
      });
    }
    if (!root) return false;
    if (root.format === 'celtoonz-flipbook') return false;
    if (
      'shots' in root ||
      'storyboard' in root ||
      'scenes' in root ||
      'subShots' in root ||
      (asRecord(root.project) && 'shots' in (asRecord(root.project) ?? {})) ||
      (asRecord(root.data) && 'shots' in (asRecord(root.data) ?? {}))
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function parseCineGridJson(rawText: string): CineGridParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }

  const rootRec = asRecord(parsed);
  if (rootRec?.format === 'celtoonz-flipbook') {
    throw new Error('This file is a CelToonz project, not a Hotshots storyboard.');
  }

  // Unwrap nested containers like { storyboard: {...} }, { data: {...} }, { project: {...} }
  const container =
    asRecord(rootRec?.storyboard) ??
    asRecord(rootRec?.data) ??
    asRecord(rootRec?.project) ??
    rootRec;

  const projectTitle =
    firstString(container, ['title', 'projectTitle', 'projectName', 'name']) ??
    firstString(rootRec, ['title', 'projectTitle', 'projectName', 'name']) ??
    'Hotshots Storyboard';

  const aspectRatioHint =
    firstString(container, ['aspectRatio', 'aspect_ratio', 'ratio']) ??
    firstString(rootRec, ['aspectRatio', 'aspect_ratio', 'ratio']);

  // Case 1: Relational { shots: [...], subShots: [...] }
  const topShots = Array.isArray(parsed)
    ? parsed
    : firstArray(container, ['shots', 'scenes', 'storyboard', 'panels', 'items']) ??
      firstArray(rootRec, ['shots', 'scenes', 'panels']);

  if (!topShots || topShots.length === 0) {
    throw new Error(
      'No Shots or SubShots were found in this JSON file. Expected a "shots" or "scenes" array.'
    );
  }

  const separateSubShots =
    firstArray(container, ['subShots', 'subshots', 'sub_shots']) ??
    firstArray(rootRec, ['subShots', 'subshots', 'sub_shots']);

  const subShotsByShotId = new Map<string, AnyRecord[]>();
  if (separateSubShots) {
    for (const rawSub of separateSubShots) {
      const sub = asRecord(rawSub);
      if (!sub) continue;
      const parentId = firstString(sub, ['shotId', 'shot_id', 'parentShotId', 'parentId']);
      if (parentId) {
        const list = subShotsByShotId.get(parentId) ?? [];
        list.push(sub);
        subShotsByShotId.set(parentId, list);
      }
    }
  }

  const panels: CineGridParsedPanel[] = [];
  let subShotCount = 0;

  topShots.forEach((rawShot, shotIdx) => {
    const shot = asRecord(rawShot);
    if (!shot) return;

    const rawShotId = firstString(shot, ['id', 'shotId', 'uuid']) ?? `shot-${shotIdx + 1}`;
    const rawShotNum = firstString(shot, [
      'shotNumber',
      'shot_number',
      'number',
      'code',
      'index',
    ]);
    const shotNumber = rawShotNum
      ? rawShotNum.toUpperCase().startsWith('S')
        ? rawShotNum
        : `S${String(rawShotNum).padStart(2, '0')}`
      : `S${String(shotIdx + 1).padStart(2, '0')}`;

    const shotTitle =
      firstString(shot, ['title', 'name', 'shotTitle', 'label', 'sceneName']) ??
      `Shot ${shotIdx + 1}`;

    const shotCamera = firstString(shot, [
      'camera',
      'shotType',
      'shot_type',
      'framing',
      'angle',
      'lens',
      'movement',
    ]);

    const shotNotes = firstString(shot, [
      'description',
      'notes',
      'action',
      'prompt',
      'visualPrompt',
      'summary',
      'script',
    ]);

    const shotImage = extractImageFromObject(shot);
    const shotHold = extractHoldFrames(shot);

    const nestedSubShots =
      firstArray(shot, [
        'subShots',
        'subshots',
        'sub_shots',
        'panels',
        'beats',
        'frames',
        'children',
        'items',
      ]) ?? subShotsByShotId.get(rawShotId);

    if (nestedSubShots && nestedSubShots.length > 0) {
      nestedSubShots.forEach((rawSub, subIdx) => {
        const sub = asRecord(rawSub);
        if (!sub) return;
        subShotCount++;

        const letter = String.fromCharCode(65 + (subIdx % 26));
        const rawSubNum = firstString(sub, [
          'subShotNumber',
          'sub_shot_number',
          'subNumber',
          'number',
          'code',
          'label',
        ]);
        const subShotNumber = rawSubNum ?? `${shotIdx + 1}${letter}`;
        const subShotTitle = firstString(sub, ['title', 'name', 'subShotTitle', 'label']);

        const subCamera =
          firstString(sub, ['camera', 'shotType', 'shot_type', 'framing', 'angle', 'movement']) ??
          shotCamera;

        const subNotes =
          firstString(sub, [
            'description',
            'notes',
            'action',
            'prompt',
            'visualPrompt',
            'dialogue',
            'script',
          ]) ?? shotNotes;

        const subImage = extractImageFromObject(sub) ?? shotImage;
        const subHold = extractHoldFrames(sub) ?? shotHold;

        panels.push({
          shotId: rawShotId,
          shotNumber,
          shotTitle,
          subShotNumber,
          subShotTitle,
          camera: subCamera,
          notes: subNotes,
          imageSrc: subImage,
          suggestedHoldFrames: subHold,
        });
      });
    } else {
      // Shot without SubShots — import the Shot itself as a timeline panel
      panels.push({
        shotId: rawShotId,
        shotNumber,
        shotTitle,
        camera: shotCamera,
        notes: shotNotes,
        imageSrc: shotImage,
        suggestedHoldFrames: shotHold,
      });
    }
  });

  if (panels.length === 0) {
    throw new Error('Could not extract any Shots or SubShots from this JSON file.');
  }

  return {
    title: projectTitle,
    aspectRatioHint,
    shotCount: topShots.length,
    subShotCount,
    panels,
  };
}

function loadImageWithCorsFallback(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (src.startsWith('http://') || src.startsWith('https://')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = src;
  });
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  return lines;
}

async function renderPanelReferenceCel(
  panel: CineGridParsedPanel,
  width: number,
  height: number
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, width, height);

  if (panel.imageSrc) {
    try {
      const img = await loadImageWithCorsFallback(panel.imageSrc);
      const scale = Math.min(width / img.naturalWidth, height / img.naturalHeight);
      const drawW = img.naturalWidth * scale;
      const drawH = img.naturalHeight * scale;
      const dx = (width - drawW) / 2;
      const dy = (height - drawH) / 2;
      ctx.drawImage(img, dx, dy, drawW, drawH);
      return canvas.toDataURL('image/png');
    } catch {
      // Fall through to crisp Storyboard Guide Card if external URL blocks CORS
    }
  }

  // Render clean Storyboard Reference Guide Card onto the transparent Storyboard Ref layer
  const pad = Math.round(Math.min(width, height) * 0.08);
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  ctx.save();
  ctx.strokeStyle = 'rgba(63, 63, 70, 0.45)';
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 10]);
  ctx.strokeRect(pad, pad, innerW, innerH);
  ctx.setLineDash([]);

  // Rule-of-thirds subtle guides
  ctx.strokeStyle = 'rgba(113, 113, 122, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pad + innerW / 3, pad);
  ctx.lineTo(pad + innerW / 3, pad + innerH);
  ctx.moveTo(pad + (innerW * 2) / 3, pad);
  ctx.lineTo(pad + (innerW * 2) / 3, pad + innerH);
  ctx.moveTo(pad, pad + innerH / 3);
  ctx.lineTo(pad + innerW, pad + innerH / 3);
  ctx.moveTo(pad, pad + (innerH * 2) / 3);
  ctx.lineTo(pad + innerW, pad + (innerH * 2) / 3);
  ctx.stroke();

  // Header badge text
  const headerSize = Math.max(24, Math.round(width * 0.028));
  ctx.fillStyle = '#18181B';
  ctx.font = `600 ${headerSize}px "Plus Jakarta Sans", system-ui, sans-serif`;
  const heading = panel.subShotNumber
    ? `${panel.shotNumber} · SubShot ${panel.subShotNumber}`
    : panel.shotNumber;
  const titleText = panel.subShotTitle
    ? `${heading} — ${panel.subShotTitle}`
    : `${heading} — ${panel.shotTitle}`;
  ctx.fillText(titleText, pad + 24, pad + headerSize + 18, innerW - 48);

  let cursorY = pad + headerSize + 52;

  if (panel.camera) {
    const camSize = Math.max(18, Math.round(width * 0.019));
    ctx.fillStyle = '#B45309';
    ctx.font = `600 ${camSize}px "JetBrains Mono", monospace`;
    ctx.fillText(`CAMERA: ${panel.camera}`, pad + 24, cursorY, innerW - 48);
    cursorY += camSize + 24;
  }

  if (panel.notes) {
    const noteSize = Math.max(18, Math.round(width * 0.02));
    ctx.fillStyle = '#3F3F46';
    ctx.font = `500 ${noteSize}px "Plus Jakarta Sans", system-ui, sans-serif`;
    const lines = wrapTextLines(ctx, panel.notes, innerW - 48, 6);
    lines.forEach((line) => {
      ctx.fillText(line, pad + 24, cursorY);
      cursorY += Math.round(noteSize * 1.45);
    });
  }

  ctx.restore();
  return canvas.toDataURL('image/png');
}

export async function buildProjectFromCineGrid(
  parsed: CineGridParseResult,
  options: {
    title: string;
    width: number;
    height: number;
    backgroundColor: string;
    defaultHoldFrames: number;
    refLayerOpacity: number;
  }
): Promise<Project> {
  const refLayerId = makeId('layer');
  const sketchLayerId = makeId('layer');
  const inkLayerId = makeId('layer');

  const layers: Layer[] = [
    {
      id: refLayerId,
      name: 'Storyboard Ref',
      visible: true,
      locked: true,
      opacity: options.refLayerOpacity,
    },
    {
      id: sketchLayerId,
      name: 'Rough Sketch',
      visible: true,
      locked: false,
      opacity: 0.85,
    },
    {
      id: inkLayerId,
      name: 'Clean Ink',
      visible: true,
      locked: false,
      opacity: 1,
    },
  ];

  const frames: Frame[] = [];
  for (const panel of parsed.panels) {
    const refDataUrl = await renderPanelReferenceCel(panel, options.width, options.height);
    frames.push({
      id: makeId('frame'),
      duration: panel.suggestedHoldFrames ?? options.defaultHoldFrames,
      cels: {
        [refLayerId]: refDataUrl,
        [sketchLayerId]: null,
        [inkLayerId]: null,
      },
      storyboard: {
        shotId: panel.shotId,
        shotNumber: panel.shotNumber,
        shotTitle: panel.shotTitle,
        subShotNumber: panel.subShotNumber,
        subShotTitle: panel.subShotTitle,
        camera: panel.camera,
        notes: panel.notes,
      },
    });
  }

  return {
    id: makeId('proj'),
    title: options.title.trim() || parsed.title || 'Hotshots Storyboard',
    width: options.width,
    height: options.height,
    fps: 24,
    backgroundColor: options.backgroundColor,
    layers,
    frames,
    currentFrameIndex: 0,
    activeLayerId: inkLayerId,
  };
}

export function createSampleCineGridJson(): string {
  const makeThumbSvg = (label: string, accent: string, shape: 'wide' | 'mid' | 'close') => {
    const body =
      shape === 'wide'
        ? `<rect x="40" y="210" width="560" height="4" fill="#3F3F46"/><circle cx="190" cy="175" r="24" fill="${accent}"/><rect x="176" y="200" width="28" height="48" rx="6" fill="#18181B"/>`
        : shape === 'mid'
        ? `<rect x="40" y="290" width="560" height="4" fill="#3F3F46"/><circle cx="320" cy="150" r="46" fill="${accent}"/><path d="M265 205 Q320 190 375 205 L390 290 L250 290 Z" fill="#18181B"/>`
        : `<circle cx="320" cy="170" r="95" fill="${accent}" opacity="0.22"/><circle cx="320" cy="170" r="78" fill="none" stroke="#18181B" stroke-width="6"/><circle cx="292" cy="155" r="9" fill="#18181B"/><circle cx="348" cy="155" r="9" fill="#18181B"/><path d="M292 198 Q320 218 348 198" fill="none" stroke="#18181B" stroke-width="6" stroke-linecap="round"/>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="none"/>${body}<text x="24" y="38" font-family="sans-serif" font-size="18" font-weight="700" fill="#3F3F46">${label}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };

  return JSON.stringify(
    {
      app: 'Hotshots',
      title: 'Rooftop Chase Sequence',
      aspectRatio: '16:9',
      shots: [
        {
          id: 'shot-1',
          shotNumber: 'S01',
          title: 'Rooftop Arrival',
          subShots: [
            {
              id: 'sub-1a',
              subShotNumber: '1A',
              title: 'Establishing Wide',
              camera: 'Wide 24mm · Static',
              notes: 'Courier lands on the far edge of the rooftop skyline.',
              frames: 4,
              thumbnail: makeThumbSvg('S01 · 1A Wide', '#F59E0B', 'wide'),
            },
            {
              id: 'sub-1b',
              subShotNumber: '1B',
              title: 'Step Forward',
              camera: 'Medium 50mm · Push In',
              notes: 'Courier spots the signal tower and shifts weight forward.',
              frames: 4,
              thumbnail: makeThumbSvg('S01 · 1B Medium', '#38BDF8', 'mid'),
            },
          ],
        },
        {
          id: 'shot-2',
          shotNumber: 'S02',
          title: 'Reaction Beat',
          subShots: [
            {
              id: 'sub-2a',
              subShotNumber: '2A',
              title: 'Expression Close-Up',
              camera: 'Close-Up 85mm',
              notes: 'Determined grin before sprinting across the gap.',
              frames: 6,
              thumbnail: makeThumbSvg('S02 · 2A Close-Up', '#FB7185', 'close'),
            },
          ],
        },
      ],
    },
    null,
    2
  );
}
