import { describe, expect, it } from 'vitest';
import {
  MAX_SCALE,
  MIN_SCALE,
  Viewport,
  canvasToScreen,
  clampScale,
  fitToRect,
  isFullyVisible,
  panBy,
  screenToCanvas,
  zoomAt,
} from '../src/core/Viewport';

const state = { scale: 1, offsetX: 100, offsetY: 50 };

describe('坐标转换', () => {
  it('屏幕 ↔ 画布互为逆运算', () => {
    for (const point of [
      { x: 0, y: 0 },
      { x: 123.4, y: 567.8 },
      { x: -40, y: -10 },
    ]) {
      const canvas = screenToCanvas(state, point.x, point.y);
      const back = canvasToScreen(state, canvas.x, canvas.y);
      expect(back.x).toBeCloseTo(point.x, 10);
      expect(back.y).toBeCloseTo(point.y, 10);
    }
  });

  it('缩放 200% 时画布坐标减半', () => {
    const zoomed = { scale: 2, offsetX: 0, offsetY: 0 };
    expect(screenToCanvas(zoomed, 200, 100)).toEqual({ x: 100, y: 50 });
  });
});

describe('zoomAt', () => {
  it('锚点下的画布坐标保持不变', () => {
    const next = zoomAt(state, 300, 200, 2.5);
    const before = screenToCanvas(state, 300, 200);
    const after = screenToCanvas(next, 300, 200);
    expect(after.x).toBeCloseTo(before.x, 10);
    expect(after.y).toBeCloseTo(before.y, 10);
    expect(next.scale).toBeCloseTo(2.5, 10);
  });

  it('超出上限时钳制且锚点不漂移', () => {
    const next = zoomAt({ scale: MAX_SCALE, offsetX: 0, offsetY: 0 }, 10, 10, 10);
    expect(next.scale).toBe(MAX_SCALE);
    const clamped = zoomAt({ scale: MAX_SCALE * 0.9, offsetX: 7, offsetY: 3 }, 50, 60, 100);
    expect(clamped.scale).toBe(MAX_SCALE);
    const before = screenToCanvas({ scale: MAX_SCALE * 0.9, offsetX: 7, offsetY: 3 }, 50, 60);
    const after = screenToCanvas(clamped, 50, 60);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it('缩到下限时钳制', () => {
    expect(clampScale(0.0001)).toBe(MIN_SCALE);
    const next = zoomAt({ scale: MIN_SCALE, offsetX: 0, offsetY: 0 }, 0, 0, 0.001);
    expect(next.scale).toBe(MIN_SCALE);
  });
});

describe('panBy', () => {
  it('平移只改偏移', () => {
    const next = panBy(state, 30, -20);
    expect(next).toEqual({ scale: 1, offsetX: 130, offsetY: 30 });
  });
});

describe('fitToRect', () => {
  it('文档完整可见且居中', () => {
    const fitted = fitToRect(1000, 700, 800, 600);
    expect(fitted.scale).toBeLessThanOrEqual(1);
    expect(isFullyVisible(fitted, 1000, 700, 800, 600)).toBe(true);
    expect(fitted.offsetX).toBeCloseTo((1000 - 800 * fitted.scale) / 2, 10);
    expect(fitted.offsetY).toBeCloseTo((700 - 600 * fitted.scale) / 2, 10);
  });

  it('超大文档按比例缩小到可视区内', () => {
    const fitted = fitToRect(1000, 700, 8192, 8192);
    expect(fitted.scale).toBeLessThan(1);
    expect(isFullyVisible(fitted, 1000, 700, 8192, 8192)).toBe(true);
  });

  it('小文档不超过 100%', () => {
    const fitted = fitToRect(2000, 2000, 100, 80);
    expect(fitted.scale).toBe(1);
  });
});

describe('Viewport 类', () => {
  it('状态变更返回 true，无变化返回 false', () => {
    const vp = new Viewport();
    vp.setViewSize(1000, 700);
    expect(vp.zoomAt(100, 100, 2)).toBe(true);
    expect(vp.panBy(10, 10)).toBe(true);
    const before = vp.state;
    expect(vp.panBy(0, 0)).toBe(false);
    expect(vp.scale).toBe(before.scale);
  });

  it('fit 后 isFullyVisible 为 true', () => {
    const vp = new Viewport();
    vp.setViewSize(640, 480);
    vp.fit(4096, 4096);
    expect(vp.isFullyVisible(4096, 4096)).toBe(true);
  });
});
