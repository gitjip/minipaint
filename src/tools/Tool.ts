import type { Editor } from '../app/Editor';
import { createPatchEntry } from '../core/patches';
import { polylineToPixels, pixelRect, unionRects, type Point } from './geometry';

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

/**
 * 自由绘制工具基类：拖拽期间在预览层按最终像素位置绘制，
 * 提交时围绕笔画包围盒截取前后补丁写入文档层并登记历史。
 */
export abstract class StrokeTool implements Tool {
  abstract readonly id: string;
  abstract readonly label: string;

  protected editor: Editor;
  protected strokePoints: Point[] | null = null;
  private strokeSize = 1;
  private strokeColor = '#000000';

  constructor(editor: Editor) {
    this.editor = editor;
  }

  /** 笔画宽度（文档像素）。 */
  protected abstract getSize(): number;
  /** 笔画颜色（提交与预览一致）。 */
  protected abstract getColor(): string;

  onPointerDown(point: Point, _event: PointerEvent): void {
    if (this.strokePoints) return;
    this.strokePoints = [point];
    this.strokeSize = this.getSize();
    this.strokeColor = this.getColor();
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
    ctx.fillStyle = this.strokeColor;
    for (const pixel of pixels) {
      const rect = pixelRect(pixel.x, pixel.y, this.strokeSize);
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    }
  }

  private commit(points: readonly Point[]): void {
    const doc = this.editor.document;
    const pixels = polylineToPixels(points);
    if (pixels.length === 0) return;
    const rects = pixels.map((pixel) => pixelRect(pixel.x, pixel.y, this.strokeSize));
    const union = unionRects(rects);
    if (!union || union.width <= 0 || union.height <= 0) return;
    const clamped = {
      x: Math.max(0, union.x),
      y: Math.max(0, union.y),
      width: Math.min(doc.width, union.x + union.width) - Math.max(0, union.x),
      height: Math.min(doc.height, union.y + union.height) - Math.max(0, union.y),
    };
    if (clamped.width <= 0 || clamped.height <= 0) return;

    const before = doc.readRect(clamped);
    doc.ctx.fillStyle = this.strokeColor;
    for (const rect of rects) {
      doc.ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    }
    const after = doc.readRect(clamped);
    this.editor.history.push(
      createPatchEntry(doc, this.label, [{ rect: clamped, before, after }]),
    );
  }
}
