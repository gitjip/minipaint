import type { Editor } from '../app/Editor';
import { normalizeDragRect } from '../core/patches';
import type { Point } from './geometry';
import { BaseTool } from './Tool';

type Mode = 'idle' | 'creating' | 'dragging';

/**
 * 矩形选框工具（M3a；套索在 M3b 加入）。
 *
 * - 选区外按下拖拽 → 建立新选区（起点在浮离外则先落定浮离）。
 * - 选区内按下拖拽 → 移动浮离（Alt=复制原文；普通/Ctrl=挖洞移动）。
 * - 浮离存在时按下浮离外 → 落定浮离并吞掉本次手势。
 * - Esc → 取消进行中的手势（含刚挖洞的浮离）。
 */
export class SelectTool extends BaseTool {
  readonly id = 'select';
  readonly label = '选择';

  private readonly editor: Editor;
  private mode: Mode = 'idle';
  private origin: Point | null = null;
  private floatStart: { x: number; y: number } | null = null;
  private liftedThisGesture = false;
  private moved = false;

  constructor(editor: Editor) {
    super();
    this.editor = editor;
  }

  onPointerDown(point: Point, event: PointerEvent): void {
    const selection = this.editor.selection;

    if (selection.hasFloat) {
      if (selection.outlineContains(point)) {
        const float = selection.float!;
        this.mode = 'dragging';
        this.origin = point;
        this.floatStart = { x: float.x, y: float.y };
        this.liftedThisGesture = false;
        this.moved = false;
      } else {
        selection.commitFloat();
        this.mode = 'idle';
      }
      return;
    }

    if (selection.hasSelection && selection.outlineContains(point)) {
      if (!selection.startFloatGesture(event.altKey)) return;
      const float = selection.float!;
      this.mode = 'dragging';
      this.origin = point;
      this.floatStart = { x: float.x, y: float.y };
      this.liftedThisGesture = true;
      this.moved = false;
      return;
    }

    this.mode = 'creating';
    this.origin = point;
    this.liftedThisGesture = false;
    this.moved = false;
    if (selection.hasSelection) selection.setShape(null);
  }

  onPointerMove(point: Point, _event: PointerEvent): void {
    const selection = this.editor.selection;
    if (this.mode === 'creating' && this.origin) {
      const doc = this.editor.document;
      const rect = normalizeDragRect(this.origin, point, doc.width, doc.height);
      selection.setShape(rect.width > 0 && rect.height > 0 ? rect : null);
      return;
    }
    if (this.mode === 'dragging' && this.origin && this.floatStart) {
      const dx = Math.round(point.x - this.origin.x);
      const dy = Math.round(point.y - this.origin.y);
      const nextX = this.floatStart.x + dx;
      const nextY = this.floatStart.y + dy;
      if (nextX !== this.floatStart.x || nextY !== this.floatStart.y) this.moved = true;
      selection.setFloatPosition(nextX, nextY);
    }
  }

  onPointerUp(point: Point, event: PointerEvent): void {
    this.onPointerMove(point, event);
    if (this.mode === 'dragging' && this.liftedThisGesture && !this.moved) {
      // 仅按下未拖动：撤销挖洞/复制，不留下空浮离
      this.editor.selection.cancelFloat();
    }
    this.reset();
  }

  cancel(): void {
    if (this.mode === 'creating') {
      if (this.editor.selection.hasSelection) this.editor.selection.setShape(null);
    } else if (this.mode === 'dragging') {
      this.editor.selection.cancelFloat();
    }
    this.reset();
  }

  private reset(): void {
    this.mode = 'idle';
    this.origin = null;
    this.floatStart = null;
    this.liftedThisGesture = false;
    this.moved = false;
  }

  drawPreview(_ctx: CanvasRenderingContext2D): void {}
}
