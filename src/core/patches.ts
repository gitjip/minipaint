import type { HistoryEntry } from './HistoryManager';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RawImageData {
  width: number;
  height: number;
  data: Uint8ClampedArray<ArrayBuffer>;
}

/** 可读写矩形像素的目标（Document 实现，测试用假实现）。 */
export interface PatchTarget {
  readonly width: number;
  readonly height: number;
  readRect(rect: Rect): RawImageData;
  writeRect(rect: Rect, image: RawImageData): void;
}

export interface Patch {
  rect: Rect;
  before: RawImageData;
  after: RawImageData;
}

export function clampRect(rect: Rect, width: number, height: number): Rect {
  const x0 = Math.max(0, Math.floor(rect.x));
  const y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(width, Math.ceil(rect.x + rect.width));
  const y1 = Math.min(height, Math.ceil(rect.y + rect.height));
  return { x: x0, y: y0, width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0) };
}

export function unionRect(a: Rect | null, b: Rect): Rect {
  if (!a) return { ...b };
  const x0 = Math.min(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const x1 = Math.max(a.x + a.width, b.x + b.width);
  const y1 = Math.max(a.y + a.height, b.y + b.height);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

class PatchEntry implements HistoryEntry {
  constructor(
    private readonly target: PatchTarget,
    readonly name: string,
    readonly mergeKey: string | undefined,
    readonly patches: Patch[],
  ) {}

  undo(): void {
    for (let i = this.patches.length - 1; i >= 0; i--) {
      const { rect, before } = this.patches[i];
      this.target.writeRect(rect, before);
    }
  }

  redo(): void {
    for (const { rect, after } of this.patches) {
      this.target.writeRect(rect, after);
    }
  }

  merge(next: HistoryEntry): HistoryEntry | null {
    if (!(next instanceof PatchEntry)) return null;
    if (next.target !== this.target) return null;
    return new PatchEntry(
      this.target,
      this.name,
      this.mergeKey,
      this.patches.concat(next.patches),
    );
  }
}

export function createPatchEntry(
  target: PatchTarget,
  name: string,
  patches: Patch[],
  mergeKey?: string,
): HistoryEntry {
  if (patches.length === 0) throw new Error('补丁不能为空');
  return new PatchEntry(target, name, mergeKey, patches);
}
