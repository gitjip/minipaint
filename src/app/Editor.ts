import { CommandRegistry, commandList } from './commands';
import { EventBus } from './EventBus';
import { ViewportInteractions } from './ViewportInteractions';
import { ColorManager, rgbToHex } from '../core/ColorManager';
import { Document } from '../core/Document';
import { HistoryManager } from '../core/HistoryManager';
import { Viewport } from '../core/Viewport';
import { Renderer } from '../render/Renderer';
import { BrushTool } from '../tools/BrushTool';
import { BucketTool } from '../tools/BucketTool';
import { EraserTool } from '../tools/EraserTool';
import { EyedropperTool } from '../tools/EyedropperTool';
import { PencilTool } from '../tools/PencilTool';
import { EllipseTool, LineTool, RectTool } from '../tools/ShapeTools';
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
};

export interface ToolOptions {
  eraserSize: number;
  brushSize: number;
  brushOpacity: number;
  shapeMode: 'stroke' | 'fill' | 'both';
  shapeStrokeWidth: number;
  fillTolerance: number;
}

export const DEFAULT_DOC_WIDTH = 800;
export const DEFAULT_DOC_HEIGHT = 600;

export class Editor {
  readonly events = new EventBus<EditorEvents>();
  readonly viewport = new Viewport();
  readonly registry = new CommandRegistry();
  readonly history = new HistoryManager(100);
  readonly colors = new ColorManager();
  readonly options: ToolOptions = {
    eraserSize: 8,
    brushSize: 8,
    brushOpacity: 1,
    shapeMode: 'stroke',
    shapeStrokeWidth: 2,
    fillTolerance: 0,
  };
  document: Document;
  readonly ui: UIManager;
  readonly renderer: Renderer;
  readonly tools: ToolManager;
  private readonly interactions: ViewportInteractions;
  private readonly shortcuts: ShortcutManager;

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

    this.tools = new ToolManager(this);
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

  newDocument(width: number, height: number, background?: string): void {
    this.replaceDocument(new Document(width, height, background));
    this.resetView();
  }

  replaceDocument(doc: Document): void {
    this.document = doc;
    this.history.clear();
    this.ui.updateSize();
    this.renderer.requestRender();
    this.events.emit('document:change', { document: doc });
  }

  setHover(point: { x: number; y: number } | null): void {
    this.ui.updateCoords(point);
  }

  showAbout(): void {
    window.alert(
      `MiniPaint 0.1.0\n本地运行的网页画图工具\n画布上限 8192×8192`,
    );
  }
}
