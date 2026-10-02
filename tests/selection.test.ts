import { describe, expect, it } from 'vitest';
import { imagesEqual, normalizeDragRect, pointInRect, type RawImageData } from '../src/core/patches';

describe('pointInRect', () => {
  const rect = { x: 10, y: 20, width: 30, height: 40 };

  it('内部与四角命中', () => {
    expect(pointInRect(rect, { x: 10, y: 20 })).toBe(true);
    expect(pointInRect(rect, { x: 40, y: 60 })).toBe(true);
    expect(pointInRect(rect, { x: 25, y: 40 })).toBe(true);
  });

  it('含右/下边界（便于抓边线）', () => {
    expect(pointInRect(rect, { x: 40, y: 30 })).toBe(true);
    expect(pointInRect(rect, { x: 20, y: 60 })).toBe(true);
  });

  it('外部不命中', () => {
    expect(pointInRect(rect, { x: 9, y: 30 })).toBe(false);
    expect(pointInRect(rect, { x: 41, y: 30 })).toBe(false);
    expect(pointInRect(rect, { x: 20, y: 19 })).toBe(false);
    expect(pointInRect(rect, { x: 20, y: 61 })).toBe(false);
  });
});

describe('normalizeDragRect', () => {
  it('正向拖拽：两端取整', () => {
    expect(normalizeDragRect({ x: 10.4, y: 20.6 }, { x: 30.4, y: 50.6 }, 800, 600)).toEqual({
      x: 10,
      y: 21,
      width: 20,
      height: 30,
    });
  });

  it('反向拖拽：自动归一化', () => {
    expect(normalizeDragRect({ x: 30, y: 50 }, { x: 10, y: 20 }, 800, 600)).toEqual({
      x: 10,
      y: 20,
      width: 20,
      height: 30,
    });
  });

  it('夹紧到文档边界，宽高非负', () => {
    expect(normalizeDragRect({ x: -20, y: -10 }, { x: 50, y: 30 }, 40, 40)).toEqual({
      x: 0,
      y: 0,
      width: 40,
      height: 30,
    });
    const degenerate = normalizeDragRect({ x: 5, y: 5 }, { x: 5, y: 5 }, 100, 100);
    expect(degenerate.width).toBe(0);
    expect(degenerate.height).toBe(0);
  });
});

describe('imagesEqual', () => {
  const make = (width: number, height: number, fill: number): RawImageData => ({
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4).fill(fill),
  });

  it('同内容相等', () => {
    expect(imagesEqual(make(4, 4, 7), make(4, 4, 7))).toBe(true);
  });

  it('内容或尺寸不同不相等', () => {
    expect(imagesEqual(make(4, 4, 7), make(4, 4, 8))).toBe(false);
    expect(imagesEqual(make(4, 4, 7), make(4, 5, 7))).toBe(false);
  });
});
