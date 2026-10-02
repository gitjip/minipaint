import { type Rect } from './patches';

export interface PointLike {
  x: number;
  y: number;
}

/**
 * 射线法点在多边形内判定（边界行为未定义，路径视作闭合）。
 * 不做除零：水平边因 `(a.y > p.y) !== (b.y > p.y)` 为 false 被短路。
 */
export function pointInPolygon(points: readonly PointLike[], p: PointLike): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    const spans = (a.y > p.y) !== (b.y > p.y);
    if (!spans) continue;
    const crossX = ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (p.x < crossX) inside = !inside;
  }
  return inside;
}

/** 多边形包围盒（floor/ceil，带 1e-6 容差吸收浮点误差）；点数不足或退化为 null。 */
export function polygonBounds(points: readonly PointLike[]): Rect | null {
  if (points.length < 3) return null;
  const eps = 1e-6;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const x = Math.floor(minX + eps);
  const y = Math.floor(minY + eps);
  const right = Math.ceil(maxX - eps);
  const bottom = Math.ceil(maxY - eps);
  if (right - x <= 0 || bottom - y <= 0) return null;
  return { x, y, width: right - x, height: bottom - y };
}

/** 平移路径点（返回新数组，不改动入参）。 */
export function translatePoints(
  points: readonly PointLike[],
  dx: number,
  dy: number,
): PointLike[] {
  return points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}
