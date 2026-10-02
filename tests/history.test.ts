import { describe, expect, it } from 'vitest';
import { HistoryManager } from '../src/core/HistoryManager';
import {
  clampRect,
  createPatchEntry,
  type PatchTarget,
  type RawImageData,
  type Rect,
} from '../src/core/patches';

const W = 8;
const H = 8;

class FakeTarget implements PatchTarget {
  readonly width = W;
  readonly height = H;
  readonly data = new Uint8ClampedArray(W * H * 4);

  readRect(rect: Rect): RawImageData {
    const out = new Uint8ClampedArray(rect.width * rect.height * 4);
    for (let y = 0; y < rect.height; y++) {
      for (let x = 0; x < rect.width; x++) {
        const src = ((rect.y + y) * W + rect.x + x) * 4;
        const dst = (y * rect.width + x) * 4;
        out[dst] = this.data[src];
      }
    }
    return { width: rect.width, height: rect.height, data: out };
  }

  writeRect(rect: Rect, image: RawImageData): void {
    for (let y = 0; y < image.height; y++) {
      for (let x = 0; x < image.width; x++) {
        const dst = ((rect.y + y) * W + rect.x + x) * 4;
        this.data[dst] = image.data[(y * image.width + x) * 4];
      }
    }
  }

  setRegion(rect: Rect, value: number): void {
    for (let y = 0; y < rect.height; y++) {
      for (let x = 0; x < rect.width; x++) {
        this.data[((rect.y + y) * W + rect.x + x) * 4] = value;
      }
    }
  }

  region(rect: Rect): number[] {
    const values: number[] = [];
    for (let y = 0; y < rect.height; y++) {
      for (let x = 0; x < rect.width; x++) {
        values.push(this.data[((rect.y + y) * W + rect.x + x) * 4]);
      }
    }
    return values;
  }
}

function patch(target: FakeTarget, rect: Rect, after: number) {
  const beforeImage = target.readRect(rect);
  target.setRegion(rect, after);
  return createPatchEntry(target, '测试', [
    { rect, before: beforeImage, after: target.readRect(rect) },
  ]);
}

describe('clampRect', () => {
  it('裁剪到画布范围', () => {
    expect(clampRect({ x: -5, y: -3, width: 20, height: 20 }, W, H)).toEqual({
      x: 0,
      y: 0,
      width: W,
      height: H,
    });
  });

  it('完全在外返回空矩形', () => {
    const result = clampRect({ x: 100, y: 100, width: 5, height: 5 }, W, H);
    expect(result.width).toBe(0);
    expect(result.height).toBe(0);
  });
});

describe('HistoryManager', () => {
  const rect: Rect = { x: 0, y: 0, width: 4, height: 4 };

  it('撤销恢复到执行前，重做恢复到执行后', () => {
    const target = new FakeTarget();
    target.setRegion(rect, 0);
    const before = target.region(rect);
    const entry = patch(target, rect, 7);
    const after = target.region(rect);
    expect(after).not.toEqual(before);

    const history = new HistoryManager();
    history.push(entry);
    expect(history.canUndo).toBe(true);

    history.undo();
    expect(target.region(rect)).toEqual(before);
    expect(history.canRedo).toBe(true);

    history.redo();
    expect(target.region(rect)).toEqual(after);
  });

  it('超过上限丢弃最旧记录', () => {
    const target = new FakeTarget();
    const history = new HistoryManager(3);
    for (let i = 1; i <= 5; i++) {
      history.push(patch(target, rect, i));
    }
    expect(history.entries).toHaveLength(3);
    expect(target.region(rect)).toEqual(new Array(16).fill(5));
    let undoCount = 0;
    while (history.undo()) undoCount++;
    expect(undoCount).toBe(3);
  });

  it('新操作清空重做栈', () => {
    const target = new FakeTarget();
    const history = new HistoryManager();
    history.push(patch(target, rect, 1));
    history.undo();
    expect(history.canRedo).toBe(true);
    history.push(patch(target, rect, 2));
    expect(history.canRedo).toBe(false);
  });

  it('jumpTo 在任意步骤间跳转', () => {
    const target = new FakeTarget();
    const history = new HistoryManager();
    history.push(patch(target, rect, 1));
    history.push(patch(target, rect, 2));
    history.push(patch(target, rect, 3));
    expect(target.region(rect)).toEqual(new Array(16).fill(3));

    history.jumpTo(1);
    expect(target.region(rect)).toEqual(new Array(16).fill(1));
    expect(history.appliedCount).toBe(1);

    history.jumpTo(3);
    expect(target.region(rect)).toEqual(new Array(16).fill(3));

    history.jumpTo(0);
    expect(target.region(rect)).toEqual(new Array(16).fill(0));
    expect(history.canUndo).toBe(false);
  });

  it('相同 mergeKey 的连续补丁合并为一步', () => {
    const target = new FakeTarget();
    const history = new HistoryManager();
    const rectA: Rect = { x: 0, y: 0, width: 4, height: 4 };
    const rectB: Rect = { x: 4, y: 0, width: 4, height: 4 };

    const first = createPatchEntry(
      target,
      '铅笔',
      [(() => {
        const before = target.readRect(rectA);
        target.setRegion(rectA, 1);
        return { rect: rectA, before, after: target.readRect(rectA) };
      })()],
      'stroke-1',
    );
    history.push(first);
    const second = createPatchEntry(
      target,
      '铅笔',
      [(() => {
        const before = target.readRect(rectB);
        target.setRegion(rectB, 2);
        return { rect: rectB, before, after: target.readRect(rectB) };
      })()],
      'stroke-1',
    );
    history.push(second);

    expect(history.entries).toHaveLength(1);

    history.undo();
    expect(target.region(rectA)).toEqual(new Array(16).fill(0));
    expect(target.region(rectB)).toEqual(new Array(16).fill(0));

    history.redo();
    expect(target.region(rectA)).toEqual(new Array(16).fill(1));
    expect(target.region(rectB)).toEqual(new Array(16).fill(2));
  });

  it('不同 mergeKey 不合并', () => {
    const target = new FakeTarget();
    const history = new HistoryManager();
    const rectA: Rect = { x: 0, y: 0, width: 2, height: 2 };
    const rectB: Rect = { x: 2, y: 0, width: 2, height: 2 };
    const a = createPatchEntry(
      target,
      'A',
      [(() => {
        const before = target.readRect(rectA);
        target.setRegion(rectA, 1);
        return { rect: rectA, before, after: target.readRect(rectA) };
      })()],
      'k1',
    );
    history.push(a);
    const b = createPatchEntry(
      target,
      'B',
      [(() => {
        const before = target.readRect(rectB);
        target.setRegion(rectB, 2);
        return { rect: rectB, before, after: target.readRect(rectB) };
      })()],
      'k2',
    );
    history.push(b);
    expect(history.entries).toHaveLength(2);
  });

  it('clear 清空两个栈', () => {
    const target = new FakeTarget();
    const history = new HistoryManager();
    history.push(patch(target, rect, 1));
    history.clear();
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
  });
});
