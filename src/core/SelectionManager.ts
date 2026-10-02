import type { Editor } from '../app/Editor';
import {
  clampRect,
  createPatchEntry,
  imagesEqual,
  pointInRect,
  type Patch,
  type Rect,
} from './patches';

export interface FloatState {
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
  /** 取消浮离时要恢复的原选区（粘贴为 null）。 */
  origShape: Rect | null;
  /** 挖洞补丁（移动时产生；复制/粘贴为 null）。 */
  pendingPatch: Patch | null;
  name: string;
}

/**
 * 选区与浮离内容的状态机。
 *
 * - shape：已确定的选区（矩形，始终夹紧在文档内）。
 * - float：浮离层（粘贴 / 拖动移动中），落定（commit）才写入历史，
 *   取消（cancel）恢复文档到浮离前状态。
 * - 系统剪贴板为首选读写路径，失败降级到内部缓冲。
 */
export class SelectionManager {
  shape: Rect | null = null;
  float: FloatState | null = null;
  private internal: HTMLCanvasElement | null = null;
  private antPhase = 0;
  private antsTimer: number | null = null;
  private readonly reducedMotion: boolean;

  constructor(private readonly editor: Editor) {
    this.reducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  get hasSelection(): boolean {
    return this.shape !== null;
  }

  get hasFloat(): boolean {
    return this.float !== null;
  }

  get canPaste(): boolean {
    return this.internal !== null;
  }

  private emit(): void {
    this.syncAnts();
    this.editor.events.emit('selection:change', {});
    this.editor.renderer.requestRender();
  }

  /** 蚂蚁线动画：reduced-motion 下保持静止（测试可确定性断言）。 */
  private syncAnts(): void {
    const active = this.shape !== null;
    if (active && !this.reducedMotion && this.antsTimer === null) {
      this.antsTimer = window.setInterval(() => {
        this.antPhase += 6;
        this.editor.renderer.requestRender();
      }, 80);
    } else if ((!active || this.reducedMotion) && this.antsTimer !== null) {
      window.clearInterval(this.antsTimer);
      this.antsTimer = null;
    }
  }

  setShape(rect: Rect | null): void {
    this.commitFloat();
    this.shape = rect;
    this.emit();
  }

  selectAll(): void {
    this.commitFloat();
    const doc = this.editor.document;
    this.shape = { x: 0, y: 0, width: doc.width, height: doc.height };
    this.emit();
  }

  /** 视觉轮廓：浮离中跟随浮离位置，否则为选区本身。 */
  outlineRect(): Rect | null {
    if (this.float) {
      return {
        x: this.float.x,
        y: this.float.y,
        width: this.float.canvas.width,
        height: this.float.canvas.height,
      };
    }
    return this.shape;
  }

  outlineContains(point: { x: number; y: number }): boolean {
    const outline = this.outlineRect();
    return outline ? pointInRect(outline, point) : false;
  }

  setFloatPosition(x: number, y: number): void {
    if (!this.float || (this.float.x === x && this.float.y === y)) return;
    this.float.x = x;
    this.float.y = y;
    this.emit();
  }

  /**
   * 从当前选区建立浮离层。
   * duplicate=true（Alt）：复制内容，原文档不动；false：挖洞移动，洞立即填背景色。
   */
  startFloatGesture(duplicate: boolean): boolean {
    if (this.float || !this.shape) return false;
    const doc = this.editor.document;
    const rect = this.shape;
    const canvas = document.createElement('canvas');
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.drawImage(doc.canvas, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);

    let pendingPatch: Patch | null = null;
    if (!duplicate) {
      const before = doc.readRect(rect);
      doc.ctx.fillStyle = this.editor.colors.background;
      doc.ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      const after = doc.readRect(rect);
      pendingPatch = { rect: { ...rect }, before, after };
    }
    this.float = {
      canvas,
      x: rect.x,
      y: rect.y,
      origShape: { ...rect },
      pendingPatch,
      name: duplicate ? '复制选区' : '移动选区',
    };
    this.emit();
    return true;
  }

  /** 粘贴：浮离内容出现在视口左上角（夹紧进文档）。 */
  createPasteFloat(source: HTMLCanvasElement): void {
    this.commitFloat();
    const doc = this.editor.document;
    const topLeft = this.editor.viewport.screenToCanvas(0, 0);
    const x = Math.max(0, Math.min(doc.width - source.width, Math.round(topLeft.x)));
    const y = Math.max(0, Math.min(doc.height - source.height, Math.round(topLeft.y)));

    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(source, 0, 0);

    this.float = {
      canvas,
      x,
      y,
      origShape: null,
      pendingPatch: null,
      name: '粘贴',
    };
    this.shape = { x, y, width: canvas.width, height: canvas.height };
    this.emit();
  }

  cancelFloat(): boolean {
    const f = this.float;
    if (!f) return false;
    if (f.pendingPatch) {
      this.editor.document.writeRect(f.pendingPatch.rect, f.pendingPatch.before);
    }
    this.float = null;
    this.shape = f.origShape;
    this.emit();
    return true;
  }

  /** 落定浮离：一次性登记历史（挖洞 + 绘制浮离内容合并为一条）。 */
  commitFloat(): boolean {
    const f = this.float;
    if (!f) return false;
    const doc = this.editor.document;
    const patches: Patch[] = [];
    if (f.pendingPatch) patches.push(f.pendingPatch);

    const target = clampRect(
      { x: f.x, y: f.y, width: f.canvas.width, height: f.canvas.height },
      doc.width,
      doc.height,
    );
    let committed: Rect | null = null;
    if (target.width > 0 && target.height > 0) {
      const before = doc.readRect(target);
      doc.ctx.drawImage(f.canvas, f.x, f.y);
      const after = doc.readRect(target);
      if (!imagesEqual(before, after)) patches.push({ rect: target, before, after });
      committed = target;
    }

    this.float = null;
    this.shape = committed;
    if (patches.length > 0) {
      this.editor.history.push(createPatchEntry(doc, f.name, patches));
    }
    this.emit();
    return true;
  }

  deleteSelection(name = '删除'): boolean {
    this.commitFloat();
    if (!this.shape) return false;
    const doc = this.editor.document;
    const rect = clampRect(this.shape, doc.width, doc.height);
    if (rect.width <= 0 || rect.height <= 0) return false;
    const before = doc.readRect(rect);
    doc.ctx.fillStyle = this.editor.colors.background;
    doc.ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    const after = doc.readRect(rect);
    if (imagesEqual(before, after)) return false;
    this.editor.history.push(createPatchEntry(doc, name, [{ rect, before, after }]));
    return true;
  }

  private extract(rect: Rect): HTMLCanvasElement | null {
    const canvas = document.createElement('canvas');
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(
      this.editor.document.canvas,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      0,
      0,
      rect.width,
      rect.height,
    );
    return canvas;
  }

  copySelection(): boolean {
    this.commitFloat();
    if (!this.shape) return false;
    const doc = this.editor.document;
    const rect = clampRect(this.shape, doc.width, doc.height);
    if (rect.width <= 0 || rect.height <= 0) return false;
    const canvas = this.extract(rect);
    if (!canvas) return false;
    this.internal = canvas;
    void this.writeSystemClipboard(canvas);
    this.emit();
    return true;
  }

  cutSelection(): boolean {
    if (!this.copySelection()) return false;
    return this.deleteSelection('剪切');
  }

  /** 优先系统剪贴板（Clipboard API），失败/超时降级到内部缓冲。 */
  async pasteClipboard(): Promise<void> {
    this.commitFloat();
    const source = (await this.readSystemClipboard()) ?? this.internal;
    if (!source) return;
    this.createPasteFloat(source);
  }

  private async readSystemClipboard(): Promise<HTMLCanvasElement | null> {
    try {
      const readPromise = navigator.clipboard?.read?.();
      if (!readPromise) return null;
      const items = await Promise.race([
        readPromise,
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('clipboard read timeout')), 150);
        }),
      ]);
      for (const item of items) {
        const type = item.types.find((candidate) => candidate.startsWith('image/'));
        if (!type) continue;
        const blob = await item.getType(type);
        const bitmap = await createImageBitmap(blob);
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close?.();
        return canvas;
      }
      return null;
    } catch {
      return null;
    }
  }

  private async writeSystemClipboard(canvas: HTMLCanvasElement): Promise<void> {
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob || typeof ClipboardItem === 'undefined') return;
      if (!navigator.clipboard?.write) return;
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    } catch {
      /* 降级：内部缓冲已保存 */
    }
  }

  /** 覆盖层绘制：浮离内容 + 蚂蚁线（由 Renderer 每帧调用，ctx 已带视口变换）。 */
  paintOverlay(ctx: CanvasRenderingContext2D): void {
    const scale = this.editor.viewport.scale;
    const f = this.float;
    if (f) {
      ctx.save();
      ctx.imageSmoothingEnabled = scale < 1;
      ctx.drawImage(f.canvas, f.x, f.y);
      ctx.restore();
    }
    const outline = this.outlineRect();
    if (!outline || outline.width <= 0 || outline.height <= 0) return;
    const lw = 1 / scale;
    ctx.save();
    ctx.lineWidth = lw;
    ctx.setLineDash([4 / scale, 4 / scale]);
    ctx.strokeStyle = '#000000';
    ctx.lineDashOffset = this.antPhase / scale;
    ctx.strokeRect(outline.x, outline.y, outline.width, outline.height);
    ctx.strokeStyle = '#ffffff';
    ctx.lineDashOffset = (this.antPhase + 4) / scale;
    ctx.strokeRect(outline.x, outline.y, outline.width, outline.height);
    ctx.restore();
  }

  /** 文档被替换（新建/打开/裁剪）时静默清空状态。 */
  handleDocumentReplaced(): void {
    this.float = null;
    this.shape = null;
    this.syncAnts();
    this.editor.events.emit('selection:change', {});
  }
}
