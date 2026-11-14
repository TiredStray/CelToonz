import { Frame, Layer, Project } from '../types/animation';

export function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36).slice(-4)}`;
}

export function createBlankProject(
  title = 'Untitled Flipbook',
  width = 1280,
  height = 720,
  backgroundColor = '#FAF9F6'
): Project {
  const sketchId = makeId('layer');
  const inkId = makeId('layer');

  const layers: Layer[] = [
    { id: sketchId, name: 'Rough Sketch', visible: true, locked: false, opacity: 0.75 },
    { id: inkId, name: 'Clean Ink', visible: true, locked: false, opacity: 1 },
  ];

  const frames: Frame[] = [
    {
      id: makeId('frame'),
      duration: 1,
      cels: { [sketchId]: null, [inkId]: null },
    },
  ];

  return {
    id: makeId('proj'),
    title,
    width,
    height,
    fps: 24,
    backgroundColor,
    layers,
    frames,
    currentFrameIndex: 0,
    activeLayerId: inkId,
  };
}

export function createBouncingBallDemo(): Project {
  const width = 1280;
  const height = 720;
  const groundLayerId = makeId('layer');
  const ballLayerId = makeId('layer');

  const layers: Layer[] = [
    { id: groundLayerId, name: 'Ground & Arc', visible: true, locked: false, opacity: 0.85 },
    { id: ballLayerId, name: 'Bouncing Cel', visible: true, locked: false, opacity: 1 },
  ];

  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;
  const ctx = offscreen.getContext('2d')!;

  // Draw ground line once as static background cel duplicated per frame or held
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = '#3F3F46';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(140, 585);
  ctx.lineTo(1140, 585);
  ctx.stroke();

  // Subtle registration tick marks
  ctx.strokeStyle = '#A1A1AA';
  ctx.lineWidth = 2;
  for (let gx = 200; gx <= 1080; gx += 110) {
    ctx.beginPath();
    ctx.moveTo(gx, 585);
    ctx.lineTo(gx, 602);
    ctx.stroke();
  }
  const groundDataUrl = offscreen.toDataURL('image/png');

  // 16 keyframes for a crisp 24fps loop (bounces and loops cleanly)
  const keyPositions = [
    { x: 640, y: 150, sx: 1.0, sy: 1.0, hold: 2 },
    { x: 640, y: 175, sx: 0.98, sy: 1.02, hold: 1 },
    { x: 640, y: 235, sx: 0.94, sy: 1.06, hold: 1 },
    { x: 640, y: 330, sx: 0.88, sy: 1.14, hold: 1 },
    { x: 640, y: 455, sx: 0.82, sy: 1.22, hold: 1 },
    { x: 640, y: 538, sx: 1.32, sy: 0.68, hold: 2 }, // Squash impact
    { x: 640, y: 465, sx: 0.84, sy: 1.20, hold: 1 },
    { x: 640, y: 345, sx: 0.90, sy: 1.12, hold: 1 },
    { x: 640, y: 245, sx: 0.95, sy: 1.05, hold: 1 },
    { x: 640, y: 180, sx: 0.98, sy: 1.02, hold: 1 },
  ];

  const frames: Frame[] = keyPositions.map((pos) => {
    ctx.clearRect(0, 0, width, height);

    // Shadow on ground
    const heightRatio = Math.max(0, Math.min(1, (540 - pos.y) / 400));
    const shadowW = 92 - heightRatio * 48;
    const shadowAlpha = 0.28 - heightRatio * 0.18;
    ctx.save();
    ctx.fillStyle = `rgba(20, 20, 23, ${shadowAlpha.toFixed(2)})`;
    ctx.beginPath();
    ctx.ellipse(pos.x, 586, shadowW, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Squash & stretch ball
    const baseR = 64;
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.scale(pos.sx, pos.sy);

    // Fill
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(0, 0, baseR, 0, Math.PI * 2);
    ctx.fill();

    // Specular highlight
    ctx.fillStyle = '#FDE68A';
    ctx.beginPath();
    ctx.ellipse(-20, -22, 18, 11, -0.5, 0, Math.PI * 2);
    ctx.fill();

    // Ink outline
    ctx.strokeStyle = '#141417';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, baseR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();

    const ballDataUrl = offscreen.toDataURL('image/png');
    return {
      id: makeId('frame'),
      duration: pos.hold,
      cels: {
        [groundLayerId]: groundDataUrl,
        [ballLayerId]: ballDataUrl,
      },
    };
  });

  return {
    id: makeId('proj'),
    title: 'Bouncing Ball Loop',
    width,
    height,
    fps: 24,
    backgroundColor: '#FAF9F6',
    layers,
    frames,
    currentFrameIndex: 0,
    activeLayerId: ballLayerId,
  };
}
