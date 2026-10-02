import { describe, expect, it } from 'vitest';
import { floodFill, type FillImage } from '../src/tools/floodFill';

function makeImage(width: number, height: number, fill: [number, number, number, number]): FillImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fill[0];
    data[i + 1] = fill[1];
    data[i + 2] = fill[2];
    data[i + 3] = fill[3];
  }
  return { width, height, data };
}

function pixelAt(image: FillImage, x: number, y: number): number[] {
  const i = (y * image.width + x) * 4;
  return [image.data[i], image.data[i + 1], image.data[i + 2], image.data[i + 3]];
}

function setRect(
  image: FillImage,
  x: number,
  y: number,
  w: number,
  h: number,
  color: [number, number, number, number],
): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      const i = (yy * image.width + xx) * 4;
      image.data[i] = color[0];
      image.data[i + 1] = color[1];
      image.data[i + 2] = color[2];
      image.data[i + 3] = color[3];
    }
  }
}

function setPixel(
  image: FillImage,
  x: number,
  y: number,
  color: [number, number, number, number],
): void {
  const i = (y * image.width + x) * 4;
  image.data[i] = color[0];
  image.data[i + 1] = color[1];
  image.data[i + 2] = color[2];
  image.data[i + 3] = color[3];
}

/** 空心方框边框：(x,y) 左上角，w×h 外框，仅周长涂黑。 */
function hollowBox(
  image: FillImage,
  x: number,
  y: number,
  w: number,
  h: number,
  color: [number, number, number, number],
): void {
  for (let xx = x; xx < x + w; xx++) {
    setPixel(image, xx, y, color);
    setPixel(image, xx, y + h - 1, color);
  }
  for (let yy = y; yy < y + h; yy++) {
    setPixel(image, x, yy, color);
    setPixel(image, x + w - 1, yy, color);
  }
}

const WHITE: [number, number, number, number] = [255, 255, 255, 255];
const BLACK: [number, number, number, number] = [0, 0, 0, 255];
const RED: [number, number, number, number] = [255, 0, 0, 255];
const BLUE: [number, number, number, number] = [0, 0, 255, 255];

describe('floodFill', () => {
  it('封闭区域内部填充，外部不变', () => {
    const image = makeImage(10, 10, WHITE);
    hollowBox(image, 3, 3, 4, 4, BLACK); // 空心黑框
    const result = floodFill(image, 4, 4, RED, 0);
    expect(result).not.toBeNull();
    expect(pixelAt(image, 4, 4)).toEqual(RED);
    expect(pixelAt(image, 5, 5)).toEqual(RED);
    expect(pixelAt(image, 0, 0)).toEqual(WHITE);
    expect(pixelAt(image, 9, 9)).toEqual(WHITE);
    expect(pixelAt(image, 3, 3)).toEqual(BLACK); // 边界不被填充
    expect(pixelAt(image, 4, 3)).toEqual(BLACK);
    expect(result!.rect).toEqual({ x: 4, y: 4, width: 2, height: 2 });
    expect(result!.changed).toBe(4);
  });

  it('返回脏矩形与填充像素数', () => {
    const image = makeImage(10, 10, WHITE);
    const result = floodFill(image, 2, 3, BLUE, 0)!;
    expect(result.rect).toEqual({ x: 0, y: 0, width: 10, height: 10 });
    expect(result.changed).toBe(100);
  });

  it('无障碍时填充整个连通区域', () => {
    const image = makeImage(6, 6, WHITE);
    const result = floodFill(image, 0, 0, RED, 0)!;
    expect(result.changed).toBe(36);
    expect(pixelAt(image, 5, 5)).toEqual(RED);
  });

  it('墙体隔断两侧（4 连通不穿墙）', () => {
    const image = makeImage(6, 6, WHITE);
    setRect(image, 3, 0, 1, 6, BLACK); // x=3 一列黑墙
    const result = floodFill(image, 0, 0, RED, 0)!;
    expect(result.rect).toEqual({ x: 0, y: 0, width: 3, height: 6 });
    expect(result.changed).toBe(18);
    expect(pixelAt(image, 2, 5)).toEqual(RED);
    expect(pixelAt(image, 4, 0)).toEqual(WHITE);
    expect(pixelAt(image, 3, 0)).toEqual(BLACK);
  });

  it('对角不算连通', () => {
    const image = makeImage(3, 3, WHITE);
    // 上排 + 右列黑墙留出对角缺口
    setRect(image, 0, 1, 2, 1, BLACK);
    setRect(image, 1, 0, 1, 2, BLACK);
    // (0,0) 白 与 (2,2) 白 只对角相邻
    const result = floodFill(image, 0, 0, RED, 0)!;
    expect(pixelAt(image, 0, 0)).toEqual(RED);
    expect(pixelAt(image, 2, 2)).toEqual(WHITE);
    expect(result.changed).toBe(1);
  });

  it('填充色与目标相同返回 null', () => {
    const image = makeImage(4, 4, WHITE);
    expect(floodFill(image, 1, 1, WHITE, 0)).toBeNull();
  });

  it('越界种子返回 null', () => {
    const image = makeImage(4, 4, WHITE);
    expect(floodFill(image, -1, 0, RED, 0)).toBeNull();
    expect(floodFill(image, 0, 4, RED, 0)).toBeNull();
    expect(floodFill(image, 4, 0, RED, 0)).toBeNull();
  });

  it('容差内的邻近色与种子连通全部填充', () => {
    const image = makeImage(4, 4, [250, 250, 250, 255]);
    const result = floodFill(image, 0, 0, [255, 255, 255, 255], 10)!;
    expect(result.changed).toBe(16);
    expect(pixelAt(image, 3, 3)).toEqual([255, 255, 255, 255]);
  });

  it('容差外颜色不视为相同', () => {
    const image = makeImage(4, 4, [200, 200, 200, 255]);
    const result = floodFill(image, 0, 0, [255, 255, 255, 255], 10);
    expect(result).not.toBeNull();
    expect(result!.changed).toBe(16);
    expect(pixelAt(image, 0, 0)).toEqual([255, 255, 255, 255]);
  });

  it('容差越界抛错', () => {
    const image = makeImage(2, 2, WHITE);
    expect(() => floodFill(image, 0, 0, RED, 300)).toThrow();
  });
});
