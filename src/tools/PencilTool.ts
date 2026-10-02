import { StrokeTool } from './Tool';

export class PencilTool extends StrokeTool {
  readonly id = 'pencil';
  readonly label = '铅笔';

  protected getSize(): number {
    return 1;
  }

  protected getColor(): string {
    return this.editor.colors.foreground;
  }
}
