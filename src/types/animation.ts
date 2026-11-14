export type ToolType =
  | 'brush'
  | 'eraser'
  | 'fill'
  | 'line'
  | 'rect'
  | 'circle'
  | 'eyedropper'
  | 'pan';

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number; // 0 to 1
}

export interface Frame {
  id: string;
  duration: number; // exposure hold count (1 = 1/24s at 24fps)
  cels: Record<string, string | null>; // layerId -> PNG dataURL or null
}

export interface Project {
  id: string;
  title: string;
  width: number;
  height: number;
  fps: 24;
  backgroundColor: string;
  layers: Layer[];
  frames: Frame[];
  currentFrameIndex: number;
  activeLayerId: string;
}

export interface ToolState {
  tool: ToolType;
  color: string;
  brushSize: number;
  brushOpacity: number; // 0.1 to 1
  eraserSize: number;
  fillShapes: boolean;
}

export interface OnionSkinState {
  enabled: boolean;
  prevFrames: number; // 0..2
  nextFrames: number; // 0..2
  opacity: number; // 0.1 to 0.7
}

export interface ViewportState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface CanvasPreset {
  id: string;
  label: string;
  width: number;
  height: number;
  ratioLabel: string;
}

export interface ExportProgress {
  phase: 'preparing' | 'rendering' | 'finalizing' | 'done' | 'error';
  currentFrame: number;
  totalFrames: number;
  message?: string;
}

export const CANVAS_PRESETS: CanvasPreset[] = [
  { id: 'hd', label: 'Widescreen HD', width: 1280, height: 720, ratioLabel: '16:9' },
  { id: 'square', label: 'Square Loop', width: 1080, height: 1080, ratioLabel: '1:1' },
  { id: 'reel', label: 'Vertical Reel', width: 720, height: 1280, ratioLabel: '9:16' },
];

export const STUDIO_SWATCHES: string[] = [
  '#141417', // Charcoal Ink
  '#3F3F46', // Graphite
  '#FAF9F6', // Paper White
  '#EF4444', // Vermilion
  '#F59E0B', // Studio Amber
  '#FACC15', // Cadmium Yellow
  '#22C55E', // Cel Green
  '#06B6D4', // Cyan Pencil
  '#3B82F6', // Cobalt Blue
  '#8B5CF6', // Ultramarine Violet
  '#EC4899', // Magenta
  '#A16207', // Raw Sienna
];
