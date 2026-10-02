export const MIN_SCALE = 1 / 64;
export const MAX_SCALE = 64;
export const FIT_PADDING = 32;

export interface Point {
  x: number;
  y: number;
}

export interface ViewportState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampScale(scale: number): number {
  return clamp(scale, MIN_SCALE, MAX_SCALE);
}

export function screenToCanvas(state: ViewportState, screenX: number, screenY: number): Point {
  return {
    x: (screenX - state.offsetX) / state.scale,
    y: (screenY - state.offsetY) / state.scale,
  };
}

export function canvasToScreen(state: ViewportState, canvasX: number, canvasY: number): Point {
  return {
    x: canvasX * state.scale + state.offsetX,
    y: canvasY * state.scale + state.offsetY,
  };
}

/** 以屏幕锚点为中心缩放，锚点下的画布坐标保持不变。 */
export function zoomAt(
  state: ViewportState,
  screenX: number,
  screenY: number,
  factor: number,
): ViewportState {
  const nextScale = clampScale(state.scale * factor);
  if (nextScale === state.scale) return state;
  const k = nextScale / state.scale;
  return {
    scale: nextScale,
    offsetX: screenX - (screenX - state.offsetX) * k,
    offsetY: screenY - (screenY - state.offsetY) * k,
  };
}

export function panBy(state: ViewportState, dx: number, dy: number): ViewportState {
  return { scale: state.scale, offsetX: state.offsetX + dx, offsetY: state.offsetY + dy };
}

/** 缩放到文档完整可见并居中，最大不超过 maxScale（默认 1，即 100%）。 */
export function fitToRect(
  viewW: number,
  viewH: number,
  docW: number,
  docH: number,
  options?: { padding?: number; maxScale?: number },
): ViewportState {
  const padding = options?.padding ?? FIT_PADDING;
  const maxScale = options?.maxScale ?? 1;
  const availableW = Math.max(1, viewW - padding * 2);
  const availableH = Math.max(1, viewH - padding * 2);
  const scale = clampScale(Math.min(availableW / docW, availableH / docH, maxScale));
  return {
    scale,
    offsetX: (viewW - docW * scale) / 2,
    offsetY: (viewH - docH * scale) / 2,
  };
}

/** 文档是否完整落在可视区域内。 */
export function isFullyVisible(
  state: ViewportState,
  viewW: number,
  viewH: number,
  docW: number,
  docH: number,
  epsilon = 0.5,
): boolean {
  const topLeft = canvasToScreen(state, 0, 0);
  const bottomRight = canvasToScreen(state, docW, docH);
  return (
    topLeft.x >= -epsilon &&
    topLeft.y >= -epsilon &&
    bottomRight.x <= viewW + epsilon &&
    bottomRight.y <= viewH + epsilon
  );
}

export class Viewport {
  scale = 1;
  offsetX = 0;
  offsetY = 0;
  viewW = 0;
  viewH = 0;
  dpr = 1;

  setViewSize(w: number, h: number): void {
    this.viewW = w;
    this.viewH = h;
  }

  get state(): ViewportState {
    return { scale: this.scale, offsetX: this.offsetX, offsetY: this.offsetY };
  }

  private apply(state: ViewportState): boolean {
    const changed =
      state.scale !== this.scale ||
      state.offsetX !== this.offsetX ||
      state.offsetY !== this.offsetY;
    this.scale = state.scale;
    this.offsetX = state.offsetX;
    this.offsetY = state.offsetY;
    return changed;
  }

  screenToCanvas(screenX: number, screenY: number): Point {
    return screenToCanvas(this.state, screenX, screenY);
  }

  canvasToScreen(canvasX: number, canvasY: number): Point {
    return canvasToScreen(this.state, canvasX, canvasY);
  }

  zoomAt(screenX: number, screenY: number, factor: number): boolean {
    return this.apply(zoomAt(this.state, screenX, screenY, factor));
  }

  panBy(dx: number, dy: number): boolean {
    return this.apply(panBy(this.state, dx, dy));
  }

  fit(docW: number, docH: number, options?: { padding?: number; maxScale?: number }): boolean {
    return this.apply(fitToRect(this.viewW, this.viewH, docW, docH, options));
  }

  isFullyVisible(docW: number, docH: number): boolean {
    return isFullyVisible(this.state, this.viewW, this.viewH, docW, docH);
  }
}
