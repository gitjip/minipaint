import type { Editor } from '../app/Editor';
import type { Rect } from '../core/patches';
import { pixelRect, unionRects, type Point } from './geometry';
import { StrokeTool } from './Tool';

export class EraserTool extends StrokeTool {
  readonly id = 'eraser';
  readonly label = '橡皮';

  constructor(editor: Editor) {
    super(editor);
  }

  protected getSize(): number {
    return this.editor.options.eraserSize;
  }

  protected getColor(): string {
    return this.editor.colors.background;
  }

  protected paintShape(ctx: CanvasRenderingContext2D, pixels: readonly Point[]): void {
    ctx.fillStyle = this.strokeColor;
    ctx.globalAlpha = this.strokeOpacity;
    for (const pixel of pixels) {
      const rect = pixelRect(pixel.x, pixel.y, this.strokeSize);
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    }
    ctx.globalAlpha = 1;
  }

  protected bounds(pixels: readonly Point[]): Rect | null {
    const size = this.strokeSize;
    return unionRects(pixels.map((pixel) => pixelRect(pixel.x, pixel.y, size)));
  }
}
