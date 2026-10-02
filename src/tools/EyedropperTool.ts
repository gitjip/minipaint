import type { Editor } from '../app/Editor';
import type { Point } from './geometry';
import { BaseTool } from './Tool';

export class EyedropperTool extends BaseTool {
  readonly id = 'eyedropper';
  readonly label = '取色';

  private readonly editor: Editor;

  constructor(editor: Editor) {
    super();
    this.editor = editor;
  }

  onPointerDown(point: Point, _event: PointerEvent): void {
    this.editor.pickColorAt(point);
  }
}
