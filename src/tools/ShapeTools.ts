import type { Editor } from '../app/Editor';
import type { Point } from './geometry';
import { snapLineEnd, snapSquare } from './shapes';
import { ShapeTool } from './ShapeTool';

export class LineTool extends ShapeTool {
  readonly id = 'line';
  readonly label = '直线';
  protected readonly kind = 'line' as const;

  constructor(editor: Editor) {
    super(editor);
  }

  protected snap(from: Point, to: Point): Point {
    return snapLineEnd(from, to);
  }
}

export class RectTool extends ShapeTool {
  readonly id = 'rect';
  readonly label = '矩形';
  protected readonly kind = 'rect' as const;

  constructor(editor: Editor) {
    super(editor);
  }

  protected snap(from: Point, to: Point): Point {
    return snapSquare(from, to);
  }
}

export class EllipseTool extends ShapeTool {
  readonly id = 'ellipse';
  readonly label = '椭圆';
  protected readonly kind = 'ellipse' as const;

  constructor(editor: Editor) {
    super(editor);
  }

  protected snap(from: Point, to: Point): Point {
    return snapSquare(from, to);
  }
}
