import { describe, expect, it } from 'vitest';
import {
  bresenham,
  pixelRect,
  polylineToPixels,
  unionRects,
} from '../src/tools/geometry';

function isContinuous(points: { x: number; y: number }[]): boolean {
  for (let i = 1; i < points.length; i++) {
    const dx = Math.abs(points[i].x - points[i - 1].x);
    const dy = Math.abs(points[i].y - points[i - 1].y);
    if (dx > 1 || dy > 1) return false;
  }
  return true;
}

describe('bresenham', () => {
  it('水平线包含两端全部像素', () => {
    const points = bresenham(0, 0, 4, 0);
    expect(points).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 0 },
    ]);
  });

  it('垂直线', () => {
    const points = bresenham(2, 1, 2, 4);
    expect(points).toHaveLength(4);
    expect(points[0]).toEqual({ x: 2, y: 1 });
    expect(points[3]).toEqual({ x: 2, y: 4 });
  });

  it('45 度对角线', () => {
    const points = bresenham(0, 0, 3, 3);
    expect(points).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ]);
  });

  it('陡峭线连续无断点', () => {
    const points = bresenham(0, 0, 3, 10);
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points[points.length - 1]).toEqual({ x: 3, y: 10 });
    expect(isContinuous(points)).toBe(true);
  });

  it('单点', () => {
    expect(bresenham(5, 5, 5, 5)).toEqual([{ x: 5, y: 5 }]);
  });
});

describe('polylineToPixels', () => {
  it('快速拖拽断点由段间插值补齐', () => {
    const pixels = polylineToPixels([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]);
    expect(isContinuous(pixels)).toBe(true);
    expect(pixels[0]).toEqual({ x: 0, y: 0 });
    expect(pixels[pixels.length - 1]).toEqual({ x: 10, y: 10 });
  });

  it('共享端点不重复', () => {
    const pixels = polylineToPixels([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
    ]);
    const keys = pixels.map((p) => `${p.x},${p.y}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(pixels).toHaveLength(11);
  });

  it('空路径与单点', () => {
    expect(polylineToPixels([])).toEqual([]);
    expect(polylineToPixels([{ x: 2.4, y: 3.6 }])).toEqual([{ x: 2, y: 4 }]);
  });
});

describe('pixelRect / unionRects', () => {
  it('1px 方块', () => {
    expect(pixelRect(3, 4)).toEqual({ x: 3, y: 4, width: 1, height: 1 });
  });

  it('8px 方块以像素为中心', () => {
    expect(pixelRect(10, 10, 8)).toEqual({ x: 6, y: 6, width: 8, height: 8 });
  });

  it('并集覆盖所有矩形', () => {
    const union = unionRects([
      { x: 0, y: 0, width: 2, height: 2 },
      { x: 5, y: 1, width: 3, height: 4 },
    ]);
    expect(union).toEqual({ x: 0, y: 0, width: 8, height: 5 });
  });

  it('空集合返回 null', () => {
    expect(unionRects([])).toBeNull();
  });
});
