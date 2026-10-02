import type { Editor } from '../app/Editor';
import { clampRect, createPatchEntry, type Rect } from '../core/patches';
import type { Point } from './geometry';
import { paintShape, type ShapeKind, type ShapeStyle } from './shapes';
import type { Tool } from './Tool';

/**
 * 形状工具基类：拖拽期间在预览层绘制，提交时一次性写入文档层并登记历史。
 * Shift 约束由子类实现；坐标取整由 paintShape 统一处理。
 */
export abstract class ShapeTool implements Tool {
  abstract readonly id: string;
  abstract readonly label: string;

  protected editor: Editor;
  private start: Point | null = null;
  private current: Point | null = null;
  private shiftHeld = false;
  private style: ShapeStyle = {
    mode: 'stroke',
    lineWidth: 1,
    strokeColor: '#000000',
    fillColor: '#ffffff',
  };

  constructor(editor: Editor) {
    this.editor = editor;
  }

  protected abstract readonly kind: ShapeKind;

  /** Shift 约束：直线 45° 吸附 / 矩形正方形 / 椭圆正圆。 */
  protected abstract snap(from: Point, to: Point): Point;

  private captureStyle(): ShapeStyle {
    const options = this.editor.options;
    return {
      mode: this.kind === 'line' ? 'stroke' : options.shapeMode,
      lineWidth: options.shapeStrokeWidth,
      strokeColor: this.editor.colors.foreground,
      fillColor: this.editor.colors.background,
    };
  }

  private resolve(raw: Point): Point {
    if (!this.start) return raw;
    return this.shiftHeld ? this.snap(this.start, raw) : raw;
  }

  onPointerDown(point: Point, _event: PointerEvent): void {
    if (this.start) return;
    this.start = point;
    this.current = point;
    this.shiftHeld = false;
    this.style = this.captureStyle();
    this.editor.renderer.requestRender();
  }

  onPointerMove(point: Point, event: PointerEvent): void {
    if (!this.start) return;
    this.shiftHeld = event.shiftKey;
    this.current = this.resolve(point);
    this.editor.renderer.requestRender();
  }

  onPointerUp(point: Point, event: PointerEvent): void {
    if (!this.start) return;
    this.shiftHeld = event.shiftKey;
    this.current = this.resolve(point);
    const start = this.start;
    const end = this.current;
    this.start = null;
    this.current = null;
    if (Math.abs(end.x - start.x) >= 1 || Math.abs(end.y - start.y) >= 1) {
      this.commit(start, end);
    }
    this.editor.renderer.requestRender();
  }

  cancel(): void {
    if (!this.start) return;
    this.start = null;
    this.current = null;
    this.editor.renderer.requestRender();
  }

  drawPreview(ctx: CanvasRenderingContext2D): void {
    if (!this.start || !this.current) return;
    paintShape(ctx, this.kind, this.start, this.current, this.style);
  }

  private commit(start: Point, end: Point): void {
    const doc = this.editor.document;
    const bounds = this.shapeBounds(start, end);
    const rect = clampRect(bounds, doc.width, doc.height);
    if (rect.width <= 0 || rect.height <= 0) return;

    const before = doc.readRect(rect);
    paintShape(doc.ctx, this.kind, start, end, this.style);
    const after = doc.readRect(rect);
    this.editor.history.push(createPatchEntry(doc, this.label, [{ rect, before, after }]));
  }

  private shapeBounds(a: Point, b: Point): Rect {
    const pad = Math.ceil(this.style.lineWidth / 2) + 1;
    const minX = Math.round(Math.min(a.x, b.x));
    const maxX = Math.round(Math.max(a.x, b.x));
    const minY = Math.round(Math.min(a.y, b.y));
    const maxY = Math.round(Math.max(a.y, b.y));
    return {
      x: minX - pad,
      y: minY - pad,
      width: maxX - minX + pad * 2,
      height: maxY - minY + pad * 2,
    };
  }
}
