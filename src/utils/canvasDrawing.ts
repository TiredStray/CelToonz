import { Frame, Layer, ToolType } from '../types/animation';

export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

export function hexToRgba(hex: string, alpha = 1): [number, number, number, number] {
  const clean = hex.replace('#', '').trim();
  let r = 20;
  let g = 20;
  let b = 23;
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16);
    g = parseInt(clean[1] + clean[1], 16);
    b = parseInt(clean[2] + clean[2], 16);
  } else if (clean.length >= 6) {
    r = parseInt(clean.slice(0, 2), 16);
    g = parseInt(clean.slice(2, 4), 16);
    b = parseInt(clean.slice(4, 6), 16);
  }
  return [
    Number.isNaN(r) ? 0 : r,
    Number.isNaN(g) ? 0 : g,
    Number.isNaN(b) ? 0 : b,
    Math.round(Math.max(0, Math.min(1, alpha)) * 255),
  ];
}

export function rgbaToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function drawSmoothStroke(
  ctx: CanvasRenderingContext2D,
  points: StrokePoint[],
  color: string,
  baseSize: number
) {
  if (points.length === 0) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.fillStyle = color;

  if (points.length === 1) {
    const p = points[0];
    const radius = Math.max(0.5, (baseSize * (0.65 + p.pressure * 0.55)) / 2);
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  // Variable width pressure-aware segments using quadratic midpoint smoothing
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];

    const mid1x = (p0.x + p1.x) / 2;
    const mid1y = (p0.y + p1.y) / 2;
    const mid2x = (p1.x + p2.x) / 2;
    const mid2y = (p1.y + p2.y) / 2;

    const avgPressure = (p1.pressure + p2.pressure) * 0.5;
    const width = Math.max(1, baseSize * (0.65 + avgPressure * 0.55));

    ctx.lineWidth = width;
    ctx.beginPath();
    if (i === 0) {
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(mid2x, mid2y);
    } else {
      ctx.moveTo(mid1x, mid1y);
      ctx.quadraticCurveTo(p1.x, p1.y, mid2x, mid2y);
    }
    ctx.stroke();
  }

  // Final half-segment to last point
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  ctx.lineWidth = Math.max(1, baseSize * (0.65 + last.pressure * 0.55));
  ctx.beginPath();
  ctx.moveTo((prev.x + last.x) / 2, (prev.y + last.y) / 2);
  ctx.lineTo(last.x, last.y);
  ctx.stroke();

  ctx.restore();
}

export function drawShapePreview(
  ctx: CanvasRenderingContext2D,
  tool: ToolType,
  start: { x: number; y: number },
  end: { x: number; y: number },
  color: string,
  lineWidth: number,
  filled: boolean
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1, lineWidth);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (tool === 'line') {
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  } else if (tool === 'rect') {
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    const h = Math.abs(end.y - start.y);
    if (filled) {
      ctx.fillRect(x, y, w, h);
    } else {
      ctx.strokeRect(x, y, w, h);
    }
  } else if (tool === 'circle') {
    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;
    const rx = Math.abs(end.x - start.x) / 2;
    const ry = Math.abs(end.y - start.y) / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
    if (filled) {
      ctx.fill();
    } else {
      ctx.stroke();
    }
  }

  ctx.restore();
}

export function scanlineFloodFill(
  imageData: ImageData,
  startX: number,
  startY: number,
  fillHex: string,
  fillOpacity: number,
  tolerance = 32
): boolean {
  const { width, height, data } = imageData;
  const x0 = Math.floor(startX);
  const y0 = Math.floor(startY);
  if (x0 < 0 || x0 >= width || y0 < 0 || y0 >= height) return false;

  const [fr, fg, fb, fa] = hexToRgba(fillHex, fillOpacity);
  const startIdx = (y0 * width + x0) * 4;
  const sr = data[startIdx];
  const sg = data[startIdx + 1];
  const sb = data[startIdx + 2];
  const sa = data[startIdx + 3];

  // If target pixel is already effectively the fill color, skip
  if (
    Math.abs(sr - fr) <= 2 &&
    Math.abs(sg - fg) <= 2 &&
    Math.abs(sb - fb) <= 2 &&
    Math.abs(sa - fa) <= 2
  ) {
    return false;
  }

  const visited = new Uint8Array(width * height);

  const matchesStart = (pixelPos: number): boolean => {
    const idx = pixelPos * 4;
    const dr = Math.abs(data[idx] - sr);
    const dg = Math.abs(data[idx + 1] - sg);
    const db = Math.abs(data[idx + 2] - sb);
    const da = Math.abs(data[idx + 3] - sa);
    return dr <= tolerance && dg <= tolerance && db <= tolerance && da <= tolerance;
  };

  const colorPixel = (pixelPos: number) => {
    const idx = pixelPos * 4;
    data[idx] = fr;
    data[idx + 1] = fg;
    data[idx + 2] = fb;
    data[idx + 3] = fa;
  };

  const stack: number[] = [x0, y0];

  while (stack.length > 0) {
    const y = stack.pop()!;
    const x = stack.pop()!;

    let lx = x;
    while (lx >= 0 && !visited[y * width + lx] && matchesStart(y * width + lx)) {
      lx--;
    }
    lx++;

    let rx = x;
    while (rx < width && !visited[y * width + rx] && matchesStart(y * width + rx)) {
      rx++;
    }
    rx--;

    let spanAbove = false;
    let spanBelow = false;

    for (let cx = lx; cx <= rx; cx++) {
      const pos = y * width + cx;
      visited[pos] = 1;
      colorPixel(pos);

      if (y > 0) {
        const upPos = (y - 1) * width + cx;
        const upMatch = !visited[upPos] && matchesStart(upPos);
        if (!spanAbove && upMatch) {
          stack.push(cx, y - 1);
          spanAbove = true;
        } else if (spanAbove && !upMatch) {
          spanAbove = false;
        }
      }

      if (y < height - 1) {
        const downPos = (y + 1) * width + cx;
        const downMatch = !visited[downPos] && matchesStart(downPos);
        if (!spanBelow && downMatch) {
          stack.push(cx, y + 1);
          spanBelow = true;
        } else if (spanBelow && !downMatch) {
          spanBelow = false;
        }
      }
    }
  }

  return true;
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

export async function preloadFrameImages(
  frames: Frame[],
  cache: Map<string, HTMLImageElement>
): Promise<void> {
  const uniqueUrls = new Set<string>();
  for (const frame of frames) {
    for (const url of Object.values(frame.cels)) {
      if (url && !cache.has(url)) {
        uniqueUrls.add(url);
      }
    }
  }

  await Promise.all(
    Array.from(uniqueUrls).map(async (url) => {
      try {
        const img = await loadImageElement(url);
        cache.set(url, img);
      } catch {
        // Ignore corrupt individual cel images safely
      }
    })
  );
}

export function renderCompositeFrameSync(
  targetCtx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: Frame,
  layers: Layer[],
  backgroundColor: string,
  imageCache: Map<string, HTMLImageElement>,
  includeBackground = true
) {
  targetCtx.clearRect(0, 0, width, height);
  if (includeBackground) {
    targetCtx.fillStyle = backgroundColor;
    targetCtx.fillRect(0, 0, width, height);
  }

  for (const layer of layers) {
    if (!layer.visible || layer.opacity <= 0) continue;
    const celUrl = frame.cels[layer.id];
    if (!celUrl) continue;
    const img = imageCache.get(celUrl);
    if (!img) continue;

    targetCtx.save();
    targetCtx.globalAlpha = layer.opacity;
    targetCtx.drawImage(img, 0, 0, width, height);
    targetCtx.restore();
  }
}

export function renderTintedFrameSync(
  targetCtx: CanvasRenderingContext2D,
  scratchCanvas: HTMLCanvasElement,
  width: number,
  height: number,
  frame: Frame,
  layers: Layer[],
  tintColor: string,
  tintAlpha: number,
  imageCache: Map<string, HTMLImageElement>
) {
  if (tintAlpha <= 0) return;

  if (scratchCanvas.width !== width || scratchCanvas.height !== height) {
    scratchCanvas.width = width;
    scratchCanvas.height = height;
  }
  const sCtx = scratchCanvas.getContext('2d');
  if (!sCtx) return;

  sCtx.clearRect(0, 0, width, height);
  let hasPixels = false;

  for (const layer of layers) {
    if (!layer.visible || layer.opacity <= 0) continue;
    const celUrl = frame.cels[layer.id];
    if (!celUrl) continue;
    const img = imageCache.get(celUrl);
    if (!img) continue;
    hasPixels = true;
    sCtx.save();
    sCtx.globalAlpha = layer.opacity;
    sCtx.drawImage(img, 0, 0, width, height);
    sCtx.restore();
  }

  if (!hasPixels) return;

  sCtx.save();
  sCtx.globalCompositeOperation = 'source-in';
  sCtx.fillStyle = tintColor;
  sCtx.fillRect(0, 0, width, height);
  sCtx.restore();

  targetCtx.save();
  targetCtx.globalAlpha = tintAlpha;
  targetCtx.drawImage(scratchCanvas, 0, 0, width, height);
  targetCtx.restore();
}
