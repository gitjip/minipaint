import { describe, expect, it } from 'vitest';
import { snapLineEnd, snapSquare } from '../src/tools/shapes';

describe('snapSquare', () => {
  it('取两轴较大值为边长，方向跟随拖拽', () => {
    expect(snapSquare({ x: 10, y: 10 }, { x: 30, y: 15 })).toEqual({ x: 30, y: 30 });
    expect(snapSquare({ x: 10, y: 10 }, { x: 15, y: 30 })).toEqual({ x: 30, y: 30 });
    expect(snapSquare({ x: 30, y: 30 }, { x: 10, y: 15 })).toEqual({ x: 10, y: 10 });
  });

  it('边长取整保证等宽高', () => {
    const snapped = snapSquare({ x: 0.6, y: 0.4 }, { x: 100.2, y: 50.9 });
    expect(Math.abs(snapped.x - 0.6)).toBe(Math.abs(snapped.y - 0.4));
    expect(Number.isInteger(Math.abs(snapped.x - 0.6))).toBe(true);
  });
});

describe('snapLineEnd', () => {
  it('吸附到水平、垂直、45°', () => {
    expect(snapLineEnd({ x: 0, y: 0 }, { x: 100, y: 5 })).toEqual({ x: 100, y: 0 });
    expect(snapLineEnd({ x: 0, y: 0 }, { x: 5, y: 100 })).toEqual({ x: 0, y: 100 });
    const diagonal = snapLineEnd({ x: 0, y: 0 }, { x: 80, y: 75 });
    expect(diagonal.x).toBe(diagonal.y);
  });

  it('负方向与端点保持', () => {
    expect(snapLineEnd({ x: 50, y: 50 }, { x: 10, y: 53 })).toEqual({ x: 10, y: 50 });
    expect(snapLineEnd({ x: 50, y: 50 }, { x: 47, y: 100 })).toEqual({ x: 50, y: 100 });
    const diagonal = snapLineEnd({ x: 50, y: 50 }, { x: 20, y: 90 });
    expect(Math.abs(diagonal.x - 50)).toBe(Math.abs(diagonal.y - 50));
  });

  it('零位移返回取整原点', () => {
    expect(snapLineEnd({ x: 3.4, y: 7.8 }, { x: 3.4, y: 7.8 })).toEqual({ x: 3, y: 8 });
  });
});
