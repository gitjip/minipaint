import type { Editor } from '../app/Editor';
import type { Rect } from '../core/patches';
import { pixelRect, unionRects, type Point } from './geometry';
import { StrokeTool } from './Tool';

export class BrushTool extends StrokeTool {
  readonly id = 'brush';
  readonly label = '画笔';

  constructor(editor: Editor) {
    super(editor);
  }

  protected getSize(): number {
    return this.editor.options.brushSize;
  }

  protected getColor(): string {
    return this.editor.colors.foreground;
  }

  protected getOpacity(): number {
    return this.editor.options.brushOpacity;
  }

  protected paintShape(ctx: CanvasRenderingContext2D, _pixels: readonly Point[], points: readonly Point[]): void {
    ctx.strokeStyle = this.strokeColor;
    ctx.fillStyle = this.strokeColor;
    ctx.globalAlpha = this.strokeOpacity;
    ctx.lineWidth = this.strokeSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const first = points[0];
    const last = points[points.length - 1];
    const isDot =
      points.length === 1 ||
      (Math.abs(first.x - last.x) < 0.5 && Math.abs(first.y - last.y) < 0.5 &&
        points.every((p) => Math.abs(p.x - first.x) < 0.5 && Math.abs(p.y - first.y) < 0.5));

    if (isDot) {
      ctx.beginPath();
      ctx.arc(first.x, first.y, this.strokeSize / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  protected bounds(pixels: readonly Point[]): Rect | null {
    const size = this.strokeSize;
    const base = unionRects(pixels.map((pixel) => pixelRect(pixel.x, pixel.y, size)));
    if (!base) return null;
    return { x: base.x - 1, y: base.y - 1, width: base.width + 2, height: base.height + 2 };
  }
}
