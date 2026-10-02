export const TEXT_LINE_HEIGHT_RATIO = 1.3;

/** 文本行高（px，与覆盖输入框 CSS 行高一致）。 */
export function lineHeightFor(fontSize: number): number {
  return Math.round(fontSize * TEXT_LINE_HEIGHT_RATIO);
}

/** 统一换行符并按行拆分。 */
export function splitLines(text: string): string[] {
  return text.replace(/\r\n?/g, '\n').split('\n');
}

/** 文本块总高度（px）。 */
export function textBlockHeight(lines: readonly string[], fontSize: number): number {
  return lines.length * lineHeightFor(fontSize);
}
