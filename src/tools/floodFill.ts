import type { Rect } from '../core/patches';

export interface FillImage {
  width: number;
  height: number;
  data: Uint8ClampedArray<ArrayBuffer>;
}

export interface FillResult {
  rect: Rect;
  changed: number;
}

function matches(
  data: Uint8ClampedArray<ArrayBuffer>,
  index: number,
  target: readonly [number, number, number, number],
  tolerance: number,
): boolean {
  return (
    Math.abs(data[index] - target[0]) <= tolerance &&
    Math.abs(data[index + 1] - target[1]) <= tolerance &&
    Math.abs(data[index + 2] - target[2]) <= tolerance &&
    Math.abs(data[index + 3] - target[3]) <= tolerance
  );
}

/**
 * 扫描线洪水填充（原地修改 image.data，4 连通）。
 * tolerance 为逐通道容差；返回填充覆盖的脏矩形与像素数，
 * 种子越界或颜色无变化时返回 null。
 */
export function floodFill(
  image: FillImage,
  startX: number,
  startY: number,
  color: readonly [number, number, number, number],
  tolerance = 0,
): FillResult | null {
  const { width, height, data } = image;
  if (startX < 0 || startY < 0 || startX >= width || startY >= height) return null;
  if (!Number.isInteger(tolerance) || tolerance < 0 || tolerance > 255) {
    throw new Error(`容差越界: ${tolerance}`);
  }

  const startIndex = (startY * width + startX) * 4;
  const target: [number, number, number, number] = [
    data[startIndex],
    data[startIndex + 1],
    data[startIndex + 2],
    data[startIndex + 3],
  ];

  let minX = startX;
  let maxX = startX;
  let minY = startY;
  let maxY = startY;
  let changed = 0;
  const visited = new Uint8Array(width * height);

  const canFill = (x: number, y: number): boolean => {
    const p = y * width + x;
    if (visited[p]) return false;
    return matches(data, p * 4, target, tolerance);
  };

  const fillPixel = (x: number, y: number): void => {
    const p = y * width + x;
    const index = p * 4;
    if (
      data[index] !== color[0] ||
      data[index + 1] !== color[1] ||
      data[index + 2] !== color[2] ||
      data[index + 3] !== color[3]
    ) {
      data[index] = color[0];
      data[index + 1] = color[1];
      data[index + 2] = color[2];
      data[index + 3] = color[3];
      changed++;
    }
    visited[p] = 1;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };

  const stack: number[] = [startX, startY];
  while (stack.length > 0) {
    const py = stack.pop()!;
    const px = stack.pop()!;

    let left = px;
    while (left > 0 && canFill(left - 1, py)) left--;
    let right = px;
    while (right < width - 1 && canFill(right + 1, py)) right++;

    for (let x = left; x <= right; x++) fillPixel(x, py);

    let spanUp = false;
    let spanDown = false;
    for (let x = left; x <= right; x++) {
      if (py > 0) {
        if (canFill(x, py - 1)) {
          if (!spanUp) {
            stack.push(x, py - 1);
            spanUp = true;
          }
        } else {
          spanUp = false;
        }
      }
      if (py < height - 1) {
        if (canFill(x, py + 1)) {
          if (!spanDown) {
            stack.push(x, py + 1);
            spanDown = true;
          }
        } else {
          spanDown = false;
        }
      }
    }
  }

  if (changed === 0) return null;
  return {
    rect: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
    changed,
  };
}
