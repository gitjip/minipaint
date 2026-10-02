export interface Point {
  x: number;
  y: number;
}

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Bresenham 直线：返回包含两端点的所有整数像素坐标。 */
export function bresenham(x0: number, y0: number, x1: number, y1: number): Point[] {
  const points: Point[] = [];
  let x = Math.round(x0);
  let y = Math.round(y0);
  const ex = Math.round(x1);
  const ey = Math.round(y1);
  const dx = Math.abs(ex - x);
  const dy = -Math.abs(ey - y);
  const sx = x < ex ? 1 : -1;
  const sy = y < ey ? 1 : -1;
  let error = dx + dy;
  for (;;) {
    points.push({ x, y });
    if (x === ex && y === ey) break;
    const e2 = 2 * error;
    if (e2 >= dy) {
      error += dy;
      x += sx;
    }
    if (e2 <= dx) {
      error += dx;
      y += sy;
    }
  }
  return points;
}

/** 把折线路径展开为连续像素点，相邻段端点去重，防快速拖拽断点。 */
export function polylineToPixels(points: readonly Point[]): Point[] {
  if (points.length === 0) return [];
  if (points.length === 1) {
    const only = points[0];
    return [{ x: Math.round(only.x), y: Math.round(only.y) }];
  }
  const pixels: Point[] = [];
  let previous: Point | null = null;
  for (let i = 1; i < points.length; i++) {
    const segment = bresenham(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
    for (const pixel of segment) {
      if (previous && previous.x === pixel.x && previous.y === pixel.y) continue;
      pixels.push(pixel);
      previous = pixel;
    }
  }
  return pixels;
}

export function pixelRect(x: number, y: number, size = 1): PixelRect {
  const offset = Math.floor(size / 2);
  return { x: x - offset, y: y - offset, width: size, height: size };
}

export function unionRects(rects: readonly PixelRect[]): PixelRect | null {
  let result: PixelRect | null = null;
  for (const rect of rects) {
    if (!result) {
      result = { ...rect };
      continue;
    }
    const x0 = Math.min(result.x, rect.x);
    const y0 = Math.min(result.y, rect.y);
    const x1 = Math.max(result.x + result.width, rect.x + rect.width);
    const y1 = Math.max(result.y + result.height, rect.y + rect.height);
    result = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  }
  return result;
}
