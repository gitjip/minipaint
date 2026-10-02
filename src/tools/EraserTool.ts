import { StrokeTool } from './Tool';

export class EraserTool extends StrokeTool {
  readonly id = 'eraser';
  readonly label = '橡皮';

  protected getSize(): number {
    return this.editor.options.eraserSize;
  }

  protected getColor(): string {
    return this.editor.colors.background;
  }
}
