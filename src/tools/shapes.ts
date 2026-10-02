import type { Point } from './geometry';

export type ShapeKind = 'line' | 'rect' | 'ellipse';
export type ShapeMode = 'stroke' | 'fill' | 'both';

/** Shift：直线吸附到 45° 的整数倍方向，端点取整。 */
export function snapLineEnd(from: Point, to: Point): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return { x: Math.round(to.x), y: Math.round(to.y) };
  const length = Math.hypot(dx, dy);
  const step = Math.PI / 4;
  const angle = Math.round(Math.atan2(dy, dx) / step) * step;
  return {
    x: Math.round(from.x + Math.cos(angle) * length),
    y: Math.round(from.y + Math.sin(angle) * length),
  };
}

/** Shift：正方形/正圆约束，边长取两轴较大值，方向跟随拖拽。 */
export function snapSquare(from: Point, to: Point): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const side = Math.round(Math.max(Math.abs(dx), Math.abs(dy)));
  const sx = dx >= 0 ? 1 : -1;
  const sy = dy >= 0 ? 1 : -1;
  return { x: from.x + sx * side, y: from.y + sy * side };
}

export interface ShapeStyle {
  mode: ShapeMode;
  lineWidth: number;
  strokeColor: string;
  fillColor: string;
}

/**
 * 绘制形状（预览与提交共用，保证结果一致）。
 * rect / ellipse 坐标取整，保证像素边界清晰。
 */
export function paintShape(
  ctx: CanvasRenderingContext2D,
  kind: ShapeKind,
  a: Point,
  b: Point,
  style: ShapeStyle,
): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = style.lineWidth;
  ctx.strokeStyle = style.strokeColor;
  ctx.fillStyle = style.fillColor;

  if (kind === 'line') {
    const x0 = Math.round(a.x);
    const y0 = Math.round(a.y);
    const x1 = Math.round(b.x);
    const y1 = Math.round(b.y);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.restore();
    return;
  }

  const x = Math.round(Math.min(a.x, b.x));
  const y = Math.round(Math.min(a.y, b.y));
  const w = Math.round(Math.abs(b.x - a.x));
  const h = Math.round(Math.abs(b.y - a.y));

  if (kind === 'rect') {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
  } else {
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  }

  if (style.mode === 'fill' || style.mode === 'both') ctx.fill();
  if (style.mode === 'stroke' || style.mode === 'both') ctx.stroke();
  ctx.restore();
}
