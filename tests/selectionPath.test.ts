import { describe, expect, it } from 'vitest';
import { pointInPolygon, polygonBounds, translatePoints } from '../src/core/selectionPath';

describe('pointInPolygon', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];

  it('内部点为 true，外部点为 false（路径视作闭合）', () => {
    expect(pointInPolygon(square, { x: 5, y: 5 })).toBe(true);
    expect(pointInPolygon(square, { x: 9.5, y: 0.5 })).toBe(true);
    expect(pointInPolygon(square, { x: 15, y: 5 })).toBe(false);
    expect(pointInPolygon(square, { x: -1, y: -1 })).toBe(false);
    expect(pointInPolygon(square, { x: 5, y: 15 })).toBe(false);
  });

  it('凹多边形：凹口在外部', () => {
    const lShape = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 4 },
      { x: 4, y: 4 },
      { x: 4, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(pointInPolygon(lShape, { x: 2, y: 8 })).toBe(true);
    expect(pointInPolygon(lShape, { x: 8, y: 8 })).toBe(false);
    expect(pointInPolygon(lShape, { x: 8, y: 2 })).toBe(true);
  });

  it('含水平边不除零', () => {
    const triangle = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 10 },
    ];
    expect(pointInPolygon(triangle, { x: 5, y: 5 })).toBe(true);
    expect(pointInPolygon(triangle, { x: 1, y: 9 })).toBe(false);
    expect(pointInPolygon(triangle, { x: 5, y: 1 })).toBe(true);
  });
});

describe('polygonBounds', () => {
  it('floor 最小值 / ceil 最大值', () => {
    expect(
      polygonBounds([
        { x: 2.3, y: 1.7 },
        { x: 8.9, y: 4.2 },
        { x: 5.1, y: 9.8 },
      ]),
    ).toEqual({ x: 2, y: 1, width: 7, height: 9 });
  });

  it('浮点尾差按整数吸附', () => {
    expect(
      polygonBounds([
        { x: 119.99999999999999, y: 79.99999999999999 },
        { x: 200, y: 80 },
        { x: 200, y: 200 },
      ]),
    ).toEqual({ x: 120, y: 80, width: 80, height: 120 });
  });

  it('点数不足返回 null', () => {
    expect(polygonBounds([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBeNull();
    expect(polygonBounds([])).toBeNull();
  });

  it('退化（所有点重合）返回 null', () => {
    expect(
      polygonBounds([
        { x: 3, y: 3 },
        { x: 3, y: 3 },
        { x: 3, y: 3 },
      ]),
    ).toBeNull();
  });
});

describe('translatePoints', () => {
  it('平移返回新数组，不改动入参', () => {
    const source = [{ x: 1, y: 2 }];
    const moved = translatePoints(source, 3, 4);
    expect(moved).toEqual([{ x: 4, y: 6 }]);
    expect(source).toEqual([{ x: 1, y: 2 }]);
  });
});
