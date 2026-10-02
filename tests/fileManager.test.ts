import { describe, expect, it } from 'vitest';
import { assertImportSize } from '../src/core/FileManager';
import { draftMatches, type DraftRecord } from '../src/core/DraftStore';

function fakeImageData(width: number, height: number, fill = 255): ImageData {
  return {
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4).fill(fill),
  } as ImageData;
}

function fakeDraft(width: number, height: number, fill = 255, savedAt = 1): DraftRecord {
  return { width, height, pixels: fakeImageData(width, height, fill), savedAt };
}

describe('draftMatches', () => {
  it('尺寸与像素全等 → true', () => {
    expect(draftMatches(fakeDraft(2, 2), 2, 2, fakeImageData(2, 2))).toBe(true);
  });

  it('尺寸不同 → false', () => {
    expect(draftMatches(fakeDraft(2, 2), 3, 2, fakeImageData(3, 2))).toBe(false);
  });

  it('像素不同 → false', () => {
    expect(draftMatches(fakeDraft(2, 2, 255), 2, 2, fakeImageData(2, 2, 0))).toBe(false);
  });

  it('数据长度不同 → false', () => {
    const draft = fakeDraft(2, 2);
    expect(draftMatches(draft, 2, 2, fakeImageData(1, 1))).toBe(false);
  });
});

describe('assertImportSize', () => {
  it('合法尺寸通过', () => {
    expect(() => assertImportSize(1, 1)).not.toThrow();
    expect(() => assertImportSize(6, 4)).not.toThrow();
    expect(() => assertImportSize(8192, 8192)).not.toThrow();
  });

  it('非整数 / 零 / 负数抛错', () => {
    expect(() => assertImportSize(0, 10)).toThrow(/非法/);
    expect(() => assertImportSize(10, -1)).toThrow(/非法/);
    expect(() => assertImportSize(1.5, 10)).toThrow(/非法/);
  });

  it('超过 8192 上限抛错', () => {
    expect(() => assertImportSize(8193, 10)).toThrow(/上限/);
    expect(() => assertImportSize(10, 8193)).toThrow(/上限/);
  });
});
