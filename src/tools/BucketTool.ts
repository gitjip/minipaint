import type { Editor } from '../app/Editor';
import { hexToRgba } from '../core/ColorManager';
import { createPatchEntry } from '../core/patches';
import { floodFill } from './floodFill';
import { BaseTool } from './Tool';
import type { Point } from './geometry';

export class BucketTool extends BaseTool {
  readonly id = 'bucket';
  readonly label = '填充';

  private readonly editor: Editor;

  constructor(editor: Editor) {
    super();
    this.editor = editor;
  }

  onPointerDown(point: Point, _event: PointerEvent): void {
    const doc = this.editor.document;
    const x = Math.round(point.x);
    const y = Math.round(point.y);
    if (x < 0 || y < 0 || x >= doc.width || y >= doc.height) return;

    const image = doc.ctx.getImageData(0, 0, doc.width, doc.height);
    const color = hexToRgba(this.editor.colors.foreground);
    const result = floodFill(image, x, y, color, this.editor.options.fillTolerance);
    if (!result) return;

    const rect = result.rect;
    const before = doc.readRect(rect);
    doc.ctx.putImageData(image, 0, 0);
    const after = doc.readRect(rect);
    this.editor.history.push(createPatchEntry(doc, this.label, [{ rect, before, after }]));
  }
}
