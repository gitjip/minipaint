import type { Document } from '../core/Document';
import type { Viewport } from '../core/Viewport';

export interface RendererOptions {
  view: HTMLElement;
  docLayer: HTMLCanvasElement;
  previewLayer: HTMLCanvasElement;
  overlayLayer: HTMLCanvasElement;
  viewport: Viewport;
  getDocument: () => Document;
}

export class Renderer {
  private readonly view: HTMLElement;
  private readonly docLayer: HTMLCanvasElement;
  private readonly previewLayer: HTMLCanvasElement;
  private readonly overlayLayer: HTMLCanvasElement;
  private readonly viewport: Viewport;
  private readonly getDocument: () => Document;
  private rafId = 0;
  private dpr = 1;
  private previewPainter: ((ctx: CanvasRenderingContext2D) => void) | null = null;

  constructor(options: RendererOptions) {
    this.view = options.view;
    this.docLayer = options.docLayer;
    this.previewLayer = options.previewLayer;
    this.overlayLayer = options.overlayLayer;
    this.viewport = options.viewport;
    this.getDocument = options.getDocument;
  }

  setPreviewPainter(painter: (ctx: CanvasRenderingContext2D) => void): void {
    this.previewPainter = painter;
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const width = this.view.clientWidth;
    const height = this.view.clientHeight;
    this.dpr = dpr;
    this.viewport.dpr = dpr;
    this.viewport.setViewSize(width, height);
    for (const canvas of [this.docLayer, this.previewLayer, this.overlayLayer]) {
      const backingW = Math.max(1, Math.round(width * dpr));
      const backingH = Math.max(1, Math.round(height * dpr));
      if (canvas.width !== backingW) canvas.width = backingW;
      if (canvas.height !== backingH) canvas.height = backingH;
    }
    this.requestRender();
  }

  requestRender(): void {
    if (this.rafId) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = 0;
      this.render();
    });
  }

  /** 同步渲染，供测试等待帧完成使用。 */
  renderNow(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    this.render();
  }

  private render(): void {
    if ((window.devicePixelRatio || 1) !== this.dpr) {
      this.resize();
    }
    const { scale, offsetX, offsetY } = this.viewport;
    const dpr = this.dpr;
    const doc = this.getDocument();

    const ctx = this.docLayer.getContext('2d');
    if (!ctx) return;
    const w = this.docLayer.width;
    const h = this.docLayer.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const screenLeft = offsetX;
    const screenTop = offsetY;
    const screenW = doc.width * scale;
    const screenH = doc.height * scale;
    const intersects =
      screenW > 0 &&
      screenH > 0 &&
      screenLeft + screenW > 0 &&
      screenTop + screenH > 0 &&
      screenLeft < this.viewport.viewW &&
      screenTop < this.viewport.viewH;

    if (intersects) {
      ctx.save();
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, offsetX * dpr, offsetY * dpr);
      ctx.imageSmoothingEnabled = scale < 1;
      ctx.drawImage(doc.canvas, 0, 0);
      ctx.restore();

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.strokeStyle = '#9aa0a6';
      ctx.lineWidth = 1;
      ctx.strokeRect(screenLeft + 0.5, screenTop + 0.5, screenW - 1, screenH - 1);
    }

    this.clearLayer(this.previewLayer);
    this.clearLayer(this.overlayLayer);

    const previewCtx = this.previewLayer.getContext('2d');
    if (previewCtx && this.previewPainter) {
      previewCtx.save();
      previewCtx.setTransform(scale * dpr, 0, 0, scale * dpr, offsetX * dpr, offsetY * dpr);
      this.previewPainter(previewCtx);
      previewCtx.restore();
    }
  }

  private clearLayer(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}
