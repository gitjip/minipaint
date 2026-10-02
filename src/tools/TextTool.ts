import type { Editor } from '../app/Editor';
import { clampRect, createPatchEntry, imagesEqual } from '../core/patches';
import type { Point } from './geometry';
import { BaseTool } from './Tool';
import { lineHeightFor, splitLines } from './textLayout';

/**
 * 文本工具（M4）：点击画布出现 DOM 覆盖输入框，回车/失焦栅格化入文档，
 * Esc 取消。字体/字号取自属性面板，颜色取提交时的前景色。
 * 编辑中快捷键被 ShortcutManager 跳过（可编辑目标）。
 */
export class TextTool extends BaseTool {
  readonly id = 'text';
  readonly label = '文本';

  private readonly editor: Editor;
  private textarea: HTMLTextAreaElement | null = null;
  private origin: Point | null = null;
  private activeToken = 0;
  private unsubscribers: (() => void)[] = [];

  constructor(editor: Editor) {
    super();
    this.editor = editor;
  }

  get isEditing(): boolean {
    return this.textarea !== null;
  }

  onPointerDown(point: Point, event: PointerEvent): void {
    if (this.textarea) this.finish();
    this.begin(point, event);
  }

  /** 属性面板改字体/字号后同步到正在编辑的输入框。 */
  syncStyle(): void {
    const ta = this.textarea;
    if (!ta) return;
    const { fontSize, fontFamily } = this.editor.options;
    ta.style.fontFamily = fontFamily;
    ta.style.fontSize = `${fontSize}px`;
    ta.style.lineHeight = `${lineHeightFor(fontSize)}px`;
    this.resize(ta);
  }

  /** 棚格化当前文本并收起输入框（回车/失焦/切换工具）。 */
  finish(): void {
    const ta = this.textarea;
    const origin = this.origin;
    if (!ta || !origin) return;
    const value = ta.value;
    this.teardown(ta);
    this.rasterize(value, origin);
  }

  /** 取消编辑（Esc）：不改文档。 */
  cancelEdit(): void {
    const ta = this.textarea;
    if (!ta) return;
    this.teardown(ta);
  }

  cancel(): void {
    if (this.textarea) this.cancelEdit();
  }

  private begin(point: Point, event: PointerEvent): void {
    const ta = document.createElement('textarea');
    ta.dataset.testid = 'text-input';
    ta.className = 'text-overlay';
    ta.rows = 1;
    ta.placeholder = '输入文字…';
    const token = ++this.activeToken;
    this.textarea = ta;
    this.origin = { ...point };
    this.editor.ui.view.append(ta);
    this.syncStyle();
    this.position();
    this.unsubscribers = [
      this.editor.events.on('viewport:change', () => this.position()),
      this.editor.events.on('colors:change', () => {
        if (this.textarea === ta) ta.style.color = this.editor.colors.foreground;
      }),
    ];
    ta.style.color = this.editor.colors.foreground;
    ta.addEventListener('keydown', (e) => this.onKeyDown(e, token));
    ta.addEventListener('blur', () => {
      if (this.activeToken === token && this.textarea === ta) this.finish();
    });
    // 阻止画布夺焦，否则新输入框会立刻因 blur 自动提交
    event.preventDefault();
    ta.focus();
  }

  private teardown(ta: HTMLTextAreaElement): void {
    this.activeToken++;
    this.textarea = null;
    this.origin = null;
    for (const off of this.unsubscribers) off();
    this.unsubscribers = [];
    ta.remove();
  }

  private onKeyDown(event: KeyboardEvent, token: number): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      if (this.activeToken === token) this.finish();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (this.activeToken === token) this.cancelEdit();
    }
  }

  private position(): void {
    const ta = this.textarea;
    const origin = this.origin;
    if (!ta || !origin) return;
    const p = this.editor.viewport.canvasToScreen(origin.x, origin.y);
    ta.style.left = `${p.x}px`;
    ta.style.top = `${p.y}px`;
  }

  private resize(ta: HTMLTextAreaElement): void {
    ta.style.width = `${Math.max(160, this.editor.options.fontSize * 8)}px`;
    ta.style.minHeight = `${lineHeightFor(this.editor.options.fontSize)}px`;
  }

  private rasterize(value: string, origin: Point): void {
    const lines = splitLines(value);
    if (lines.every((line) => line.length === 0)) return;
    const doc = this.editor.document;
    const { fontSize, fontFamily } = this.editor.options;
    const lineHeight = lineHeightFor(fontSize);
    const ctx = doc.ctx;
    ctx.save();
    ctx.font = `${fontSize}px ${fontFamily}`;
    const maxWidth = lines.reduce((max, line) => Math.max(max, ctx.measureText(line).width), 0);
    ctx.restore();
    const rect = clampRect(
      {
        x: Math.floor(origin.x),
        y: Math.floor(origin.y),
        width: Math.ceil(maxWidth) + 1,
        height: lines.length * lineHeight + 1,
      },
      doc.width,
      doc.height,
    );
    if (rect.width <= 0 || rect.height <= 0) return;
    const before = doc.readRect(rect);
    ctx.save();
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.fillStyle = this.editor.colors.foreground;
    ctx.textBaseline = 'top';
    lines.forEach((line, index) => {
      ctx.fillText(line, origin.x, origin.y + index * lineHeight);
    });
    ctx.restore();
    const after = doc.readRect(rect);
    if (imagesEqual(before, after)) return;
    this.editor.history.push(createPatchEntry(doc, '文本', [{ rect, before, after }]));
  }

  drawPreview(_ctx: CanvasRenderingContext2D): void {}
}
