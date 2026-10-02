import type { Editor } from './Editor';

const ZOOM_BASE = 1.0015;

export class ViewportInteractions {
  private spaceHeld = false;
  private panning = false;
  private lastX = 0;
  private lastY = 0;
  private readonly view: HTMLElement;
  private readonly editor: Editor;

  constructor(view: HTMLElement, editor: Editor) {
    this.view = view;
    this.editor = editor;
  }

  attach(): void {
    this.view.addEventListener('wheel', this.onWheel, { passive: false });
    this.view.addEventListener('pointerdown', this.onPointerDown);
    this.view.addEventListener('pointermove', this.onPointerMove);
    this.view.addEventListener('pointerleave', this.onPointerLeave);
    this.view.addEventListener('contextmenu', (event) => event.preventDefault());
    window.addEventListener('pointermove', this.onWindowPointerMove);
    window.addEventListener('pointerup', this.onWindowPointerUp);
    window.addEventListener('pointercancel', this.onWindowPointerUp);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.reset);
  }

  private localPoint(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.view.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  private onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const { x, y } = this.localPoint(event.clientX, event.clientY);
    const factor = Math.pow(ZOOM_BASE, -event.deltaY);
    this.editor.zoomAt(x, y, factor);
  };

  private onPointerDown = (event: PointerEvent): void => {
    const wantPan = this.spaceHeld || event.button === 1;
    if (wantPan) {
      event.preventDefault();
      this.panning = true;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      this.view.classList.add('is-panning');
      return;
    }
    if (event.button !== 0) return;
    event.preventDefault();
    const { x, y } = this.localPoint(event.clientX, event.clientY);
    const point = this.editor.viewport.screenToCanvas(x, y);
    if (event.altKey) {
      this.editor.pickColorAt(point);
      return;
    }
    this.editor.tools.pointerDown(point, event);
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (this.panning) {
      this.pan(event.clientX, event.clientY);
      return;
    }
    if (this.editor.tools.isStrokeActive) {
      const { x, y } = this.localPoint(event.clientX, event.clientY);
      const point = this.editor.viewport.screenToCanvas(x, y);
      this.editor.tools.pointerMove(point, event);
      return;
    }
    const { x, y } = this.localPoint(event.clientX, event.clientY);
    const rect = this.view.getBoundingClientRect();
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
      this.editor.setHover(null);
      return;
    }
    this.editor.setHover(this.editor.viewport.screenToCanvas(x, y));
  };

  private onPointerLeave = (): void => {
    if (!this.panning && !this.editor.tools.isStrokeActive) this.editor.setHover(null);
  };

  private onWindowPointerMove = (event: PointerEvent): void => {
    if (this.panning) {
      this.pan(event.clientX, event.clientY);
      return;
    }
    if (this.editor.tools.isStrokeActive) {
      const { x, y } = this.localPoint(event.clientX, event.clientY);
      const point = this.editor.viewport.screenToCanvas(x, y);
      this.editor.tools.pointerMove(point, event);
    }
  };

  private onWindowPointerUp = (event: PointerEvent): void => {
    if (this.panning) {
      this.panning = false;
      this.view.classList.remove('is-panning');
    }
    if (this.editor.tools.isStrokeActive) {
      const { x, y } = this.localPoint(event.clientX, event.clientY);
      const point = this.editor.viewport.screenToCanvas(x, y);
      this.editor.tools.pointerUp(point, event);
    }
  };

  private pan(clientX: number, clientY: number): void {
    const dx = clientX - this.lastX;
    const dy = clientY - this.lastY;
    this.lastX = clientX;
    this.lastY = clientY;
    if (dx === 0 && dy === 0) return;
    this.editor.viewport.panBy(dx, dy);
    this.editor.afterViewportChange();
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      this.editor.tools.cancel();
      return;
    }
    if (event.code !== 'Space' || event.repeat) return;
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
    ) {
      return;
    }
    event.preventDefault();
    this.spaceHeld = true;
    this.view.classList.add('can-pan');
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    if (event.code !== 'Space') return;
    this.reset();
  };

  private reset = (): void => {
    this.spaceHeld = false;
    this.panning = false;
    this.view.classList.remove('can-pan', 'is-panning');
  };
}
