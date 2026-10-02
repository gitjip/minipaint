import type { Editor } from '../app/Editor';
import { normalizeDragRect } from '../core/patches';
import type { Point } from './geometry';
import { BaseTool } from './Tool';

type Mode = 'idle' | 'creating';

/**
 * 裁剪工具（M3b）。
 *
 * - 拖拽框选目标区域（复用选区蚂蚁线预览）。
 * - Enter 或点击框内 → 应用裁剪（替换文档、清历史、视口重新居中）。
 * - Esc（含拖拽中）→ 取消框选。
 * - 点击框外 → 重新开始框选。
 */
export class CropTool extends BaseTool {
  readonly id = 'crop';
  readonly label = '裁剪';

  private readonly editor: Editor;
  private mode: Mode = 'idle';
  private origin: Point | null = null;

  constructor(editor: Editor) {
    super();
    this.editor = editor;
  }

  onPointerDown(point: Point, _event: PointerEvent): void {
    const selection = this.editor.selection;
    if (selection.hasSelection && selection.outlineContains(point)) {
      this.editor.cropTo(selection.shape);
      this.reset();
      return;
    }
    this.mode = 'creating';
    this.origin = point;
    selection.setShape(null);
  }

  onPointerMove(point: Point, _event: PointerEvent): void {
    if (this.mode !== 'creating' || !this.origin) return;
    const doc = this.editor.document;
    const rect = normalizeDragRect(this.origin, point, doc.width, doc.height);
    this.editor.selection.setShape(rect.width > 0 && rect.height > 0 ? rect : null);
  }

  onPointerUp(point: Point, event: PointerEvent): void {
    this.onPointerMove(point, event);
    this.reset();
  }

  cancel(): void {
    if (this.mode === 'creating') this.editor.selection.setShape(null);
    this.reset();
  }

  drawPreview(_ctx: CanvasRenderingContext2D): void {}

  private reset(): void {
    this.mode = 'idle';
    this.origin = null;
  }
}
