import type { Editor } from '../app/Editor';
import type { Point } from './geometry';
import type { Tool } from './Tool';

export class ToolManager {
  private tools = new Map<string, Tool>();
  private active: Tool | null = null;
  private strokeActive = false;

  constructor(private editor: Editor) {}

  register(tool: Tool): void {
    this.tools.set(tool.id, tool);
  }

  get activeToolId(): string {
    return this.active?.id ?? '';
  }

  get activeLabel(): string {
    return this.active?.label ?? '—';
  }

  get isStrokeActive(): boolean {
    return this.strokeActive;
  }

  select(id: string): boolean {
    const tool = this.tools.get(id);
    if (!tool) return false;
    if (this.strokeActive) this.cancel();
    if (this.active === tool) return true;
    this.active = tool;
    this.editor.events.emit('tool:change', { id: tool.id, label: tool.label });
    this.editor.renderer.requestRender();
    return true;
  }

  pointerDown(point: Point, event: PointerEvent): void {
    if (!this.active || this.strokeActive) return;
    this.strokeActive = true;
    this.active.onPointerDown(point, event);
  }

  pointerMove(point: Point, event: PointerEvent): void {
    if (!this.strokeActive || !this.active) return;
    this.active.onPointerMove(point, event);
  }

  pointerUp(point: Point, event: PointerEvent): void {
    if (!this.strokeActive || !this.active) return;
    this.strokeActive = false;
    this.active.onPointerUp(point, event);
  }

  cancel(): void {
    if (!this.strokeActive || !this.active) return;
    this.strokeActive = false;
    this.active.cancel();
  }

  drawPreview(ctx: CanvasRenderingContext2D): void {
    this.active?.drawPreview(ctx);
  }
}
