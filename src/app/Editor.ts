import { CommandRegistry, commandList } from './commands';
import { EventBus } from './EventBus';
import { ViewportInteractions } from './ViewportInteractions';
import { ColorManager, rgbToHex } from '../core/ColorManager';
import { Document } from '../core/Document';
import {
  clearDraft,
  draftMatches,
  loadDraft,
  saveDraft,
} from '../core/DraftStore';
import { assertImportSize, decodeImage } from '../core/FileManager';
import { HistoryManager } from '../core/HistoryManager';
import { SelectionManager } from '../core/SelectionManager';
import { clampRect, type Rect } from '../core/patches';
import { Viewport } from '../core/Viewport';
import { Renderer } from '../render/Renderer';
import { BrushTool } from '../tools/BrushTool';
import { BucketTool } from '../tools/BucketTool';
import { CropTool } from '../tools/CropTool';
import { EraserTool } from '../tools/EraserTool';
import { EyedropperTool } from '../tools/EyedropperTool';
import { PencilTool } from '../tools/PencilTool';
import { EllipseTool, LineTool, RectTool } from '../tools/ShapeTools';
import { SelectTool } from '../tools/SelectTool';
import { TextTool } from '../tools/TextTool';
import { ToolManager } from '../tools/ToolManager';
import { ShortcutManager } from '../ui/ShortcutManager';
import { UIManager } from '../ui/UIManager';

export type EditorEvents = {
  'viewport:change': { scale: number; offsetX: number; offsetY: number };
  'document:change': { document: Document };
  'command:executed': { id: string };
  'tool:change': { id: string; label: string };
  'colors:change': Record<string, never>;
  'history:change': Record<string, never>;
  'selection:change': Record<string, never>;
};

export interface ToolOptions {
  eraserSize: number;
  brushSize: number;
  brushOpacity: number;
  shapeMode: 'stroke' | 'fill' | 'both';
  shapeStrokeWidth: number;
  fillTolerance: number;
  selectionMode: 'rect' | 'lasso';
  fontFamily: string;
  fontSize: number;
}

export const DEFAULT_DOC_WIDTH = 800;
export const DEFAULT_DOC_HEIGHT = 600;

export class Editor {
  readonly events = new EventBus<EditorEvents>();
  readonly viewport = new Viewport();
  readonly registry = new CommandRegistry();
  readonly history = new HistoryManager(100);
  readonly colors = new ColorManager();
  readonly selection = new SelectionManager(this);
  readonly textTool = new TextTool(this);
  readonly options: ToolOptions = {
    eraserSize: 8,
    brushSize: 8,
    brushOpacity: 1,
    shapeMode: 'stroke',
    shapeStrokeWidth: 2,
    fillTolerance: 0,
    selectionMode: 'rect',
    fontFamily: 'sans-serif',
    fontSize: 24,
  };
  document: Document;
  readonly ui: UIManager;
  readonly renderer: Renderer;
  readonly tools: ToolManager;
  private readonly interactions: ViewportInteractions;
  private readonly shortcuts: ShortcutManager;
  private draftTimer: number | null = null;

  constructor(root: HTMLElement) {
    this.document = new Document(DEFAULT_DOC_WIDTH, DEFAULT_DOC_HEIGHT);
    this.registry.registerAll(commandList);
    this.ui = new UIManager(root, this);
    this.renderer = new Renderer({
      view: this.ui.view,
      docLayer: this.ui.docLayer,
      previewLayer: this.ui.previewLayer,
      overlayLayer: this.ui.overlayLayer,
      viewport: this.viewport,
      getDocument: () => this.document,
    });
    this.renderer.setPreviewPainter((ctx) => this.tools.drawPreview(ctx));
    this.renderer.setOverlayPainter((ctx) => this.selection.paintOverlay(ctx));

    this.tools = new ToolManager(this);
    this.tools.register(new SelectTool(this));
    this.tools.register(new CropTool(this));
    this.tools.register(this.textTool);
    this.tools.register(new PencilTool(this));
    this.tools.register(new BrushTool(this));
    this.tools.register(new EraserTool(this));
    this.tools.register(new BucketTool(this));
    this.tools.register(new EyedropperTool(this));
    this.tools.register(new LineTool(this));
    this.tools.register(new RectTool(this));
    this.tools.register(new EllipseTool(this));

    this.interactions = new ViewportInteractions(this.ui.view, this);
    this.shortcuts = new ShortcutManager(this.registry, this);

    this.history.subscribe(() => {
      this.events.emit('history:change', {});
      this.renderer.requestRender();
      this.scheduleDraftSave();
    });
    this.colors.subscribe(() => this.events.emit('colors:change', {}));

    this.ui.updateSize();
    this.ui.updateZoom();
    this.interactions.attach();
    this.shortcuts.attach();

    window.addEventListener('resize', () => this.renderer.resize());
    this.renderer.resize();
    this.resetView();
    this.tools.select('pencil');
    void this.initDraft();
  }

  private resetView(): void {
    const doc = this.document;
    const { viewW, viewH } = this.viewport;
    if (viewW > 0 && viewH > 0 && doc.width <= viewW - 64 && doc.height <= viewH - 64) {
      this.viewport.scale = 1;
      this.viewport.offsetX = (viewW - doc.width) / 2;
      this.viewport.offsetY = (viewH - doc.height) / 2;
    } else {
      this.viewport.fit(doc.width, doc.height);
    }
    this.afterViewportChange();
  }

  zoomAt(screenX: number, screenY: number, factor: number): void {
    if (this.viewport.zoomAt(screenX, screenY, factor)) this.afterViewportChange();
  }

  zoomBy(factor: number): void {
    this.zoomAt(this.viewport.viewW / 2, this.viewport.viewH / 2, factor);
  }

  fitToWindow(): void {
    if (this.viewport.fit(this.document.width, this.document.height)) {
      this.afterViewportChange();
    }
  }

  afterViewportChange(): void {
    this.renderer.requestRender();
    this.ui.updateZoom();
    this.events.emit('viewport:change', this.viewport.state);
  }

  selectTool(id: string): boolean {
    return this.tools.select(id);
  }

  /** 取点颜色设为前景色（取色器与 Alt+点击 共用）。 */
  pickColorAt(point: { x: number; y: number }): boolean {
    const x = Math.round(point.x);
    const y = Math.round(point.y);
    const pixel = this.document.getPixel(x, y);
    if (!pixel) return false;
    this.colors.setForeground(rgbToHex(pixel[0], pixel[1], pixel[2]));
    return true;
  }

  newDocument(
    width: number = DEFAULT_DOC_WIDTH,
    height: number = DEFAULT_DOC_HEIGHT,
    background?: string,
  ): void {
    this.replaceDocument(new Document(width, height, background));
    this.resetView();
  }

  /** 导入图片替换文档（打开/拖拽/粘贴共用）；失败弹出提示且不动当前文档。 */
  async importImage(source: Blob | HTMLCanvasElement): Promise<boolean> {
    try {
      const image = source instanceof HTMLCanvasElement ? source : await decodeImage(source);
      assertImportSize(image.width, image.height);
      const next = new Document(image.width, image.height);
      next.ctx.drawImage(image, 0, 0);
      this.replaceDocument(next);
      this.resetView();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.ui.notify(`打开失败：${message}`);
      return false;
    }
  }

  replaceDocument(doc: Document): void {
    this.document = doc;
    this.selection.handleDocumentReplaced();
    this.history.clear();
    this.ui.updateSize();
    this.renderer.requestRender();
    this.events.emit('document:change', { document: doc });
  }

  /** 裁剪到给定区域：替换文档（清历史）并把视口重新居中。 */
  cropTo(rect: Rect | null): boolean {
    if (!rect) return false;
    const clamped = clampRect(rect, this.document.width, this.document.height);
    if (clamped.width <= 0 || clamped.height <= 0) return false;
    if (clamped.width === this.document.width && clamped.height === this.document.height) {
      return false;
    }
    const next = new Document(clamped.width, clamped.height);
    next.ctx.drawImage(this.document.canvas, -clamped.x, -clamped.y);
    this.replaceDocument(next);
    this.resetView();
    return true;
  }

  /** 裁剪到当前选区（裁剪工具 Enter / 点击框内确认）。 */
  cropSelection(): boolean {
    return this.cropTo(this.selection.shape);
  }

  setHover(point: { x: number; y: number } | null): void {
    this.ui.updateCoords(point);
  }

  showAbout(): void {
    window.alert(
      `MiniPaint 0.1.0\n本地运行的网页画图工具\n画布上限 8192×8192`,
    );
  }

  /** 草稿防抖：最后一次编辑 2s 后写入 IndexedDB。 */
  private scheduleDraftSave(): void {
    if (this.draftTimer !== null) window.clearTimeout(this.draftTimer);
    this.draftTimer = window.setTimeout(() => {
      this.draftTimer = null;
      void this.persistDraft();
    }, 2000);
  }

  private async persistDraft(): Promise<void> {
    const doc = this.document;
    try {
      await saveDraft({
        width: doc.width,
        height: doc.height,
        pixels: doc.ctx.getImageData(0, 0, doc.width, doc.height),
        savedAt: Date.now(),
      });
    } catch {
      /* IndexedDB 不可用时静默 */
    }
  }

  /** 启动时读草稿：与当前（默认）文档一致则静默清理，否则弹恢复提示。 */
  private async initDraft(): Promise<void> {
    const draft = await loadDraft();
    if (!draft) return;
    const doc = this.document;
    const current = doc.ctx.getImageData(0, 0, doc.width, doc.height);
    if (draftMatches(draft, doc.width, doc.height, current)) {
      await clearDraft();
      return;
    }
    this.ui.showDraftPrompt(draft.savedAt, {
      restore: async () => {
        this.ui.hideDraftPrompt();
        const next = new Document(draft.width, draft.height);
        next.ctx.putImageData(draft.pixels, 0, 0);
        this.replaceDocument(next);
        this.resetView();
      },
      discard: async () => {
        this.ui.hideDraftPrompt();
        await clearDraft();
      },
    });
  }
}
