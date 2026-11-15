# CelToonz — Web & Mobile-First Flipbook Animation Studio

CelToonz is a responsive, touch-first 2D flipbook animation studio inspired by OpenToonz. It brings multi-layer cel drawing, chromatic onion skinning, exposure holds, **Hotshots JSON** storyboard import, portable `.celtoonz.json` project saving, and client-side **24fps opaque WebM** video export to both smartphones and desktop browsers.

---

## Quick Start

### Prerequisites
- **Node.js** 20+
- A modern browser with HTML5 Canvas 2D and `MediaRecorder` WebM support (Chrome, Edge, Firefox on desktop or Android)

### Local Development
```bash
npm install
npm run dev
```
The development server runs on `http://localhost:3000`.

### Build & Type Check
```bash
npm run lint     # TypeScript type-check (tsc --noEmit)
npm run build    # Production Vite bundle -> dist/
npm run preview  # Preview production build
```

### Deploying from GitHub to Vercel
The repository includes `vercel.json` pre-configured for zero-config static Vite deployment (`dist/` output, SPA fallback rewrite, immutable caching on `/assets/*`, and `no-cache` on `index.html`). Push to GitHub, import the repository in Vercel, and deploy—no environment variables are required.

---

## User Instructions

### 1. Drawing & Workspace Controls

#### Mobile & Touch (`< 768px`)
- **Draw**: Use one finger or a stylus anywhere on the paper cel (`touch-action: none` prevents accidental page scrolling).
- **Zoom & Pan**: Pinch with two fingers to zoom (`25%`–`500%`) and drag with two fingers to pan. Tap the **Maximize** icon in the top-right corner to re-fit the canvas.
- **Quick Corner Actions**:
  - Top-left: **Undo** and **Redo**
  - Top-right: **Onion** toggle and **Fit Canvas**
  - Bottom-left: **Prev** and **Next** frame steppers
  - Bottom-right: **+ Frame** to append a blank frame
- **Bottom Thumb Dock**:
  - **Tools**: Brush, Eraser, Fill Bucket, Line, Rectangle, Ellipse, Eyedropper, Pan, Registration Grid, and Clear Cel
  - **Brush / Color**: Stroke/Eraser diameter (`1px–64px`), Opacity (`10%–100%`), Shape Fill toggle, 12 studio swatches, and native hex color picker
  - **Play / Stop**: Center amber button previews the sequence at **24 FPS** honoring frame holds
  - **Frames**: Opens the filmstrip timeline, onion-skin controls, and exposure hold adjuster
  - **Layers**: Opens the cel layer stack (visibility, lock, opacity, rename, reorder, duplicate, add/delete)
- **Project Menu**: Tap the project title in the top bar to create a new canvas, load the 24fps **Bouncing Ball Demo**, import **Hotshots JSON**, or save/open `.celtoonz.json` files.

#### Desktop (`≥ 768px`) & Keyboard Shortcuts
| Shortcut | Action |
| :--- | :--- |
| `B` | Brush tool |
| `E` | Eraser tool |
| `G` | Scanline Fill Bucket |
| `L` | Straight Line tool |
| `R` | Rectangle tool |
| `C` | Ellipse / Circle tool |
| `I` | Eyedropper (samples composited stage color) |
| `H` | Pan Stage tool |
| `Space` + Drag | Temporary Pan without switching tools |
| Mouse Wheel | Zoom in / out |
| `O` | Toggle Onion Skinning |
| `S` | Toggle Shift & Trace peg editing mode (`Esc` returns to drawing) |
| `P` | Play / Pause 24fps playback |
| `,` or `←` | Previous frame |
| `.` or `→` | Next frame |
| `Ctrl/Cmd + Z` | Undo (up to 35 steps) |
| `Ctrl/Cmd + Shift + Z` / `Ctrl + Y` | Redo |

### 2. Layers, Exposure Holds & Onion Skinning
- **Layers**: Layers stack bottom-to-top in render order (shown top-down in the Layers panel). Double-click any layer name on desktop to rename it. Lock a layer to protect roughs or storyboards from accidental strokes.
- **Exposure Holds (`1f–48f`)**: Adjust how many `1/24s` frames a drawing holds using the **Hold `-` / `+`** stepper in the timeline bar. Both live playback and WebM export honor hold counts.
- **Onion Skinning**: Toggle **Prev** (coral-rose `#FB7185`) and **Next** (sky-blue `#38BDF8`) ghost frames independently to trace arcs and spacing accurately.
- **Shift & Trace (Light-Table Peg Bar)**: Click **Shift & Trace** (or press `S` / tap **Shift** on mobile) to temporarily un-peg the **Prev Ghost** or **Next Ghost** without modifying the original frames:
  - Drag anywhere on the stage to reposition the ghost, grab the top handle knob (hold `Shift` for `15°` snap) or use two-finger pinch/twist on touchscreens to scale and rotate, or fine-tune via the Peg Bar HUD sliders.
  - Click **Draw** to lock the shifted ghosts in place and sketch your in-between right over them; click **Re-Peg** anytime to snap ghosts back to `0, 0, 0°`.

### 3. Importing Hotshots JSON Storyboards
1. Click **Hotshots JSON** in the top bar (or **Import Hotshots JSON** in the mobile project sheet). You can also pick a Hotshots file directly via **Open JSON**—CelToonz auto-detects the format.
2. Drop or select your `.json` storyboard file (or click **Try Sample Storyboard** to test the workflow).
3. Review the **Shots & SubShots Mapping Preview**, choose your canvas preset (`16:9` `1280×720`, `1:1` `1080×1080`, or `9:16` `720×1280`), default hold duration, and reference opacity.
4. Click **Import to Timeline**:
   - Each Shot and SubShot is mapped onto the timeline with Shot boundary dividers, Shot/SubShot codes (`S01·1A`), camera specs, and director notes.
   - Panel artwork (or a generated Storyboard Guide Card if text-only or CORS-restricted) is placed on a locked **`Storyboard Ref`** layer underneath **`Rough Sketch`** and **`Clean Ink`**.
   - Hide or lower the opacity of **`Storyboard Ref`** whenever you are ready to render your final clean animation.

#### Supported Hotshots JSON Structure
The importer accepts nested, relational, or flat storyboard arrays using common field names:
- **Top-level**: `title` / `projectName`, `aspectRatio`, and `shots` (or `scenes` / `storyboard` / `panels`), plus optional top-level `subShots` linked by `shotId`.
- **Shot fields**: `id`, `shotNumber` / `number`, `title` / `name`, `camera` / `shotType`, `description` / `notes` / `action`, `frames` / `duration`, `subShots` / `subshots` / `panels` / `beats`.
- **SubShot fields**: `subShotNumber` / `number`, `title` / `name`, `camera`, `notes` / `action` / `prompt`, `frames` / `duration`, and image data via `imageDataUrl`, `dataUrl`, `imageUrl`, `image`, `thumbnail`, `sketch`, or SVG markup.

### 4. Exporting 24fps Opaque WebM & Saving JSON
- **Save JSON / Open JSON**: Downloads or restores a self-contained `.celtoonz.json` file containing all layers, frame bitmap cels, exposure holds, and imported Shot/SubShot metadata (no login or cloud database required).
- **Export WebM**: Click **Export WebM** to composite all visible layers over your opaque paper background at a fixed **24 FPS**, watch the inline `<video>` preview, and download `<title>-24fps.webm`.

---

## Codebase Breakdown

| Module | Responsibility |
| :--- | :--- |
| `src/App.tsx` | Responsive shell orchestrating desktop workspace, mobile thumb dock, bottom sheets, global keyboard shortcuts, and modals. |
| `src/types/animation.ts` | TypeScript models for `Project`, `Layer`, `Frame`, `StoryboardMeta`, `ToolState`, `OnionSkinState`, and `Hotshots` parse results. |
| `src/hooks/useAnimationStudio.ts` | Central studio state, 35-step immutable undo/redo history, 24fps hold-aware `requestAnimationFrame` playback loop, and image cache preloading. |
| `src/utils/canvasDrawing.ts` | Quadratic Bezier stroke smoothing, shape rendering, typed-array scanline flood fill, and chromatic onion-skin compositing. |
| `src/utils/webmExport.ts` | Client-side 24fps opaque frame expander, offscreen canvas compositor, and `MediaRecorder` WebM encoder. |
| `src/utils/cinegridImport.ts` | Flexible Hotshots JSON storyboard parser, CORS-safe reference cel renderer, and sample storyboard generator. |
| `src/utils/projectJson.ts` | `.celtoonz.json` export serializer and strict schema validator on import. |
| `src/utils/demoProject.ts` | Blank 2-layer workspace factory and procedural 24fps squash-and-stretch bouncing ball generator. |
| `src/components/CanvasStage.tsx` | 4-canvas layered drawing stage, unified pointer/multi-touch gesture controller, zoom/pan transforms, and Shot HUD. |
| `src/components/TimelineBar.tsx` | Filmstrip thumbnails, Shot/SubShot grouping dividers, director notes strip, onion-skin toggles, and hold steppers. |
| `src/components/ToolRail.tsx` & `MobileToolSheets.tsx` | Desktop tool/swatch rail and mobile bottom-sheet drawers (`Tools`, `Brush & Ink`, `Project`). |
| `src/components/LayersPanel.tsx` | Layer visibility, opacity, lock, inline rename, reorder, duplicate, and delete controls. |
| `src/components/ExportWebmModal.tsx` | Render progress tracking, abort handling, and inline `.webm` video preview/download dialog. |
| `src/components/CineGridImportModal.tsx` | Hotshots JSON dropzone, Shot/SubShot preview list, and timeline import configuration modal. |
| `src/components/ProjectModal.tsx` | New Canvas dialog with aspect ratio (`16:9`, `1:1`, `9:16`) and opaque paper background presets. |
| `src/components/TopBar.tsx`, `MobileDock.tsx`, `BottomSheet.tsx` | Compact header, mobile thumb-zone navigation dock (`≥ 44px` hitboxes), and slide-up modal sheets. |

---

## Algorithms & Technical Attribution

### 1. Quadratic Midpoint Bezier Stroke Smoothing
- **Where**: `drawSmoothStroke` in `src/utils/canvasDrawing.ts`
- **How It Works**: Raw pointer events arrive as discrete `(x, y, pressure)` samples that look polygonal when connected with straight segments. The renderer computes midpoints between consecutive sample pairs `(p1, p2)` and feeds `p1` as the control point to `CanvasRenderingContext2D.quadraticCurveTo(p1.x, p1.y, mid2x, mid2y)`, modulating segment `lineWidth` smoothly by `baseSize * (0.65 + pressure * 0.55)`.
- **Uniform Semi-Transparent Strokes**: In-progress brush strokes draw at full alpha onto an isolated `liveStrokeCanvas` whose CSS opacity reflects `brushOpacity`, then composite once onto the active cel on `pointerup`. This avoids overlapping alpha darkening at segment joints.

### 2. Span-Queue Scanline Flood Fill
- **Where**: `scanlineFloodFill` in `src/utils/canvasDrawing.ts`
- **How It Works**: Based on the classic 4-connected **Scanline Flood Fill** algorithm (Heckbert, *Graphics Gems*, 1990). Instead of recursive per-pixel flood filling (which overflows the JS call stack on `1280×720` = 921,600-pixel buffers), it maintains an explicit coordinate stack and a flat `Uint8Array(width * height)` visited mask. For each popped seed, it scans left and right along the row, fills the horizontal span in `ImageData.data`, and pushes only the start coordinates of unvisited contiguous spans on the rows immediately above and below within an RGBA Euclidean/Manhattan tolerance (`tolerance = 32`).

### 3. Split 4-Canvas Cel & Chromatic Onion-Skin Compositing
- **Where**: `CanvasStage.tsx` and `renderTintedFrameSync` in `src/utils/canvasDrawing.ts`
- **How It Works**: Rather than flattening every layer on every pointer move, the stage separates rendering into four aligned HTML5 canvases:
  1. `belowCanvas`: Tinted onion-skin ghosts + all visible layers beneath the active layer.
  2. `activeCelCanvas`: The active layer's pixel buffer (supporting live `destination-out` erasing with an `ImageData` backup snapshot for multi-touch cancellation).
  3. `liveStrokeCanvas`: In-progress stroke/shape preview.
  4. `aboveCanvas`: All visible layers above the active layer.
- **Onion-Skin Tinting & Shift & Trace**: Previous and next frames are composited onto a scratch canvas, recolored in one GPU-accelerated pass using `globalCompositeOperation = 'source-in'` (`#FB7185` for previous frames, `#38BDF8` for next frames), and optionally rendered through a center-pivoted 2D affine matrix (`translate → rotate → scale`) when light-table Shift & Trace offsets are active—preserving original frame bitmaps untouched.

### 4. Deterministic 24fps Exposure-Expanded WebM Encoding
- **Where**: `exportProjectToWebm` in `src/utils/webmExport.ts`
- **How It Works**:
  1. Timeline frames are expanded according to their integer `duration` hold count (`1/24s` per exposure unit).
  2. All unique cel data URLs are pre-decoded into an `HTMLImageElement` cache prior to recording so asynchronous decode stalls never drop video frames.
  3. An opaque offscreen canvas (`getContext('2d', { alpha: false })`) composites the paper background and visible layers frame-by-frame.
  4. Frames are pushed via `canvas.captureStream(0)` + `CanvasCaptureMediaStreamTrack.requestFrame()` (falling back to `canvas.captureStream(24)` where `requestFrame` is unavailable) paced at `1000 / 24 ms` (`41.67 ms`) with `performance.now()` drift compensation into the W3C `MediaRecorder` API (`video/webm;codecs=vp9` → `vp8` → `video/webm`).

### 5. Unified Pointer & Multi-Touch Pinch/Pan State Machine
- **Where**: `CanvasStage.tsx`
- **How It Works**: Tracks active pointer IDs in a `Map<number, {x, y}>` via W3C Pointer Events (`setPointerCapture`). When a second finger touches down mid-stroke, any accidental partial stroke is cleanly rolled back (clearing `liveStrokeCanvas` and restoring `eraserBackupRef`) and input transitions into simultaneous centroid translation and Euclidean distance ratio scaling (`translate3d` + `scale`).

### Third-Party Libraries & Standards Attribution
- **[React 19](https://react.dev/)** (`react`, `react-dom`) — UI component architecture and hooks (MIT License).
- **[Vite](https://vite.dev/)** & **[@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react)** — Fast ES module development server and production bundler (MIT License).
- **[Tailwind CSS v4](https://tailwindcss.com/)** (`tailwindcss`, `@tailwindcss/vite`) — Utility-first styling and responsive layout primitives (MIT License).
- **[Lucide React](https://lucide.dev/)** (`lucide-react`) — Crisp vector studio iconography (ISC License).
- **[Google Fonts](https://fonts.google.com/)** — `Outfit`, `Plus Jakarta Sans`, and `JetBrains Mono` typefaces (SIL Open Font License 1.1).
- **Web Platform APIs** — W3C HTML5 Canvas 2D, W3C Pointer Events Level 2, `ResizeObserver`, and W3C MediaStream Recording (`MediaRecorder`) API.
- **Conceptual Inspiration** — Workflow terminology (cel layers, exposure holds, light-table onion skinning) inspired by **[OpenToonz](https://opentoonz.github.io/)**; all source code in CelToonz is an original clean-room web implementation.
