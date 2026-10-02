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
    window.addEventListener('pointermove', this.onWindowPointerMove);
    window.addEventListener('pointerup', this.onWindowPointerUp);
    window.addEventListener('pointercancel', this.onWindowPointerUp);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.reset);
  }

  private onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const rect = this.view.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const factor = Math.pow(ZOOM_BASE, -event.deltaY);
    this.editor.zoomAt(x, y, factor);
  };

  private onPointerDown = (event: PointerEvent): void => {
    const wantPan = this.spaceHeld || event.button === 1;
    if (!wantPan) return;
    event.preventDefault();
    this.panning = true;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    this.view.classList.add('is-panning');
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (this.panning) {
      this.pan(event.clientX, event.clientY);
      return;
    }
    const rect = this.view.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    if (localX < 0 || localY < 0 || localX > rect.width || localY > rect.height) {
      this.editor.setHover(null);
      return;
    }
    const point = this.editor.viewport.screenToCanvas(localX, localY);
    this.editor.setHover(point);
  };

  private onPointerLeave = (): void => {
    if (!this.panning) this.editor.setHover(null);
  };

  private onWindowPointerMove = (event: PointerEvent): void => {
    if (this.panning) this.pan(event.clientX, event.clientY);
  };

  private onWindowPointerUp = (): void => {
    if (!this.panning) return;
    this.panning = false;
    this.view.classList.remove('is-panning');
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
    if (event.code !== 'Space' || event.repeat) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
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
