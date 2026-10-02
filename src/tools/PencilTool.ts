import type { Editor } from '../app/Editor';
import type { Rect } from '../core/patches';
import { pixelRect, unionRects, type Point } from './geometry';
import { StrokeTool } from './Tool';

export class PencilTool extends StrokeTool {
  readonly id = 'pencil';
  readonly label = '铅笔';

  constructor(editor: Editor) {
    super(editor);
  }

  protected getSize(): number {
    return 1;
  }

  protected getColor(): string {
    return this.editor.colors.foreground;
  }

  protected paintShape(ctx: CanvasRenderingContext2D, pixels: readonly Point[]): void {
    ctx.fillStyle = this.strokeColor;
    ctx.globalAlpha = this.strokeOpacity;
    for (const pixel of pixels) {
      const rect = pixelRect(pixel.x, pixel.y, 1);
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    }
    ctx.globalAlpha = 1;
  }

  protected bounds(pixels: readonly Point[]): Rect | null {
    return unionRects(pixels.map((pixel) => pixelRect(pixel.x, pixel.y, 1)));
  }
}
