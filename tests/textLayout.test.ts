import { describe, expect, it } from 'vitest';
import {
  lineHeightFor,
  splitLines,
  textBlockHeight,
  TEXT_LINE_HEIGHT_RATIO,
} from '../src/tools/textLayout';

describe('textLayout', () => {
  it('行高 = 字号 × 比例（四舍五入）', () => {
    expect(lineHeightFor(24)).toBe(Math.round(24 * TEXT_LINE_HEIGHT_RATIO));
    expect(lineHeightFor(12)).toBe(Math.round(12 * TEXT_LINE_HEIGHT_RATIO));
    expect(lineHeightFor(24)).toBe(31);
  });

  it('splitLines 统一 CRLF/CR 并拆行', () => {
    expect(splitLines('a\nb')).toEqual(['a', 'b']);
    expect(splitLines('a\r\nb\rc')).toEqual(['a', 'b', 'c']);
    expect(splitLines('')).toEqual(['']);
    expect(splitLines('a\n\nb')).toEqual(['a', '', 'b']);
  });

  it('textBlockHeight = 行数 × 行高', () => {
    expect(textBlockHeight(['a', 'b', 'c'], 24)).toBe(3 * lineHeightFor(24));
    expect(textBlockHeight([''], 16)).toBe(lineHeightFor(16));
  });
});
