import { CommandRegistry, commandList } from './commands';
import { EventBus } from './EventBus';
import { ViewportInteractions } from './ViewportInteractions';
import { Document } from '../core/Document';
import { Viewport } from '../core/Viewport';
import { Renderer } from '../render/Renderer';
import { ShortcutManager } from '../ui/ShortcutManager';
import { UIManager } from '../ui/UIManager';

export type EditorEvents = {
  'viewport:change': { scale: number; offsetX: number; offsetY: number };
  'document:change': { document: Document };
  'command:executed': { id: string };
};

export const DEFAULT_DOC_WIDTH = 800;
export const DEFAULT_DOC_HEIGHT = 600;

export class Editor {
  readonly events = new EventBus<EditorEvents>();
  readonly viewport = new Viewport();
  readonly registry = new CommandRegistry();
  document: Document;
  readonly ui: UIManager;
  readonly renderer: Renderer;
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
    this.interactions = new ViewportInteractions(this.ui.view, this);
    this.shortcuts = new ShortcutManager(this.registry, this);

    this.ui.updateSize();
    this.ui.updateZoom();
    this.ui.updateTool('—');
    this.interactions.attach();
    this.shortcuts.attach();

    window.addEventListener('resize', () => this.renderer.resize());
    this.renderer.resize();
    this.resetView();
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

  newDocument(width: number, height: number, background?: string): void {
    this.replaceDocument(new Document(width, height, background));
    this.resetView();
  }

  replaceDocument(doc: Document): void {
    this.document = doc;
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
