export const MIN_SCALE = 1;
export const MAX_SCALE = 5;
export const ZOOM_STEP = 0.5;

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface ZoomState {
  scale: number;
  /** Top-left corner of the scaled content, in viewport coordinates. */
  offset: Point;
}

export const initialZoom: ZoomState = {
  scale: MIN_SCALE,
  offset: { x: 0, y: 0 },
};

export function clampScale(
  scale: number,
  min: number = MIN_SCALE,
  max: number = MAX_SCALE,
): number {
  return Math.min(max, Math.max(min, +scale.toFixed(3)));
}

function clampAxis(offset: number, content: number, viewport: number): number {
  // Smaller than the viewport: keep it centred. Larger: it must keep covering
  // the viewport, so the user can never drag the picture out of the frame.
  if (content <= viewport) return (viewport - content) / 2;
  return Math.min(0, Math.max(viewport - content, offset));
}

/**
 * Keeps the scaled content inside the viewport. `content` is the unscaled
 * size, and the content's transform origin is its top-left corner.
 */
export function clampOffset(
  offset: Point,
  content: Size,
  viewport: Size,
  scale: number,
): Point {
  return {
    x: clampAxis(offset.x, content.width * scale, viewport.width),
    y: clampAxis(offset.y, content.height * scale, viewport.height),
  };
}

/**
 * Changes the scale while keeping the content point under `anchor` (viewport
 * coordinates) in place, like zooming with a pointer.
 */
export function zoomAt(
  state: ZoomState,
  nextScale: number,
  anchor: Point,
  content: Size,
  viewport: Size,
): ZoomState {
  const scale = clampScale(nextScale);
  const ratio = scale / state.scale;
  return {
    scale,
    offset: clampOffset(
      {
        x: anchor.x - (anchor.x - state.offset.x) * ratio,
        y: anchor.y - (anchor.y - state.offset.y) * ratio,
      },
      content,
      viewport,
      scale,
    ),
  };
}

export function panBy(
  state: ZoomState,
  delta: Point,
  content: Size,
  viewport: Size,
): ZoomState {
  return {
    scale: state.scale,
    offset: clampOffset(
      { x: state.offset.x + delta.x, y: state.offset.y + delta.y },
      content,
      viewport,
      state.scale,
    ),
  };
}
