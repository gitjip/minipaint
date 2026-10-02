import type { Editor } from '../app/Editor';
import { createPatchEntry, clampRect, type Rect } from '../core/patches';
import { polylineToPixels, type Point } from './geometry';

export interface Tool {
  readonly id: string;
  readonly label: string;
  onPointerDown(point: Point, event: PointerEvent): void;
  onPointerMove(point: Point, event: PointerEvent): void;
  onPointerUp(point: Point, event: PointerEvent): void;
  cancel(): void;
  /** 在预览层绘制，ctx 已设置视口变换，坐标为文档坐标。 */
  drawPreview(ctx: CanvasRenderingContext2D): void;
}

/** 无状态工具的空实现基类。 */
export abstract class BaseTool implements Tool {
  abstract readonly id: string;
  abstract readonly label: string;

  onPointerDown(_point: Point, _event: PointerEvent): void {}
  onPointerMove(_point: Point, _event: PointerEvent): void {}
  onPointerUp(_point: Point, _event: PointerEvent): void {}
  cancel(): void {}
  drawPreview(_ctx: CanvasRenderingContext2D): void {}
}

/**
 * 自由绘制工具基类：拖拽期间在预览层按最终像素效果绘制，
 * 提交时围绕笔画包围盒截取前后补丁写入文档层并登记历史。
 */
export abstract class StrokeTool extends BaseTool {
  abstract readonly id: string;
  abstract readonly label: string;

  protected editor: Editor;
  protected strokePoints: Point[] | null = null;
  protected strokeSize = 1;
  protected strokeColor = '#000000';
  protected strokeOpacity = 1;

  constructor(editor: Editor) {
    super();
    this.editor = editor;
  }

  /** 笔画宽度（文档像素）。 */
  protected abstract getSize(): number;
  /** 笔画颜色（提交与预览一致）。 */
  protected abstract getColor(): string;
  /** 不透明度 0–1，默认不透明。 */
  protected getOpacity(): number {
    return 1;
  }

  /** 把整条笔画绘制到给定上下文（预览层与文档层共用，保证一致）。 */
  protected abstract paintShape(
    ctx: CanvasRenderingContext2D,
    pixels: readonly Point[],
    points: readonly Point[],
  ): void;

  /** 笔画覆盖的保守包围盒，空则该笔不产生历史。 */
  protected abstract bounds(pixels: readonly Point[]): Rect | null;

  onPointerDown(point: Point, _event: PointerEvent): void {
    if (this.strokePoints) return;
    this.strokePoints = [point];
    this.strokeSize = this.getSize();
    this.strokeColor = this.getColor();
    this.strokeOpacity = this.getOpacity();
    this.editor.renderer.requestRender();
  }

  onPointerMove(point: Point, _event: PointerEvent): void {
    if (!this.strokePoints) return;
    this.strokePoints.push(point);
    this.editor.renderer.requestRender();
  }

  onPointerUp(point: Point, event: PointerEvent): void {
    if (!this.strokePoints) return;
    this.onPointerMove(point, event);
    const points = this.strokePoints;
    this.strokePoints = null;
    this.commit(points);
    this.editor.renderer.requestRender();
  }

  cancel(): void {
    if (!this.strokePoints) return;
    this.strokePoints = null;
    this.editor.renderer.requestRender();
  }

  drawPreview(ctx: CanvasRenderingContext2D): void {
    if (!this.strokePoints) return;
    const pixels = polylineToPixels(this.strokePoints);
    this.paintShape(ctx, pixels, this.strokePoints);
  }

  protected commit(points: readonly Point[]): void {
    const doc = this.editor.document;
    const pixels = polylineToPixels(points);
    if (pixels.length === 0) return;
    const bounds = this.bounds(pixels);
    if (!bounds) return;
    const rect = clampRect(bounds, doc.width, doc.height);
    if (rect.width <= 0 || rect.height <= 0) return;

    const before = doc.readRect(rect);
    doc.ctx.save();
    this.paintShape(doc.ctx, pixels, points);
    doc.ctx.restore();
    const after = doc.readRect(rect);
    this.editor.history.push(createPatchEntry(doc, this.label, [{ rect, before, after }]));
  }
}
