import type { Editor } from '../app/Editor';

interface MenuDef {
  label: string;
  items: string[];
}

interface ToolDef {
  id: string;
  label: string;
  key: string;
}

const MENUS: MenuDef[] = [
  { label: '文件', items: ['file.new', 'file.open', 'file.save'] },
  { label: '编辑', items: ['edit.undo', 'edit.redo'] },
  { label: '查看', items: ['view.zoomIn', 'view.zoomOut', 'view.fit'] },
  { label: '帮助', items: ['help.about'] },
];

const TOOLS: ToolDef[] = [
  { id: 'select', label: '选择', key: 'M' },
  { id: 'crop', label: '裁剪', key: 'C' },
  { id: 'pencil', label: '铅笔', key: 'P' },
  { id: 'brush', label: '画笔', key: 'B' },
  { id: 'eraser', label: '橡皮', key: 'E' },
  { id: 'bucket', label: '填充', key: 'G' },
  { id: 'eyedropper', label: '取色', key: 'I' },
  { id: 'text', label: '文本', key: 'T' },
  { id: 'line', label: '直线', key: 'L' },
  { id: 'rect', label: '矩形', key: 'R' },
  { id: 'ellipse', label: '椭圆', key: 'O' },
];

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export class UIManager {
  readonly view: HTMLElement;
  readonly docLayer: HTMLCanvasElement;
  readonly previewLayer: HTMLCanvasElement;
  readonly overlayLayer: HTMLCanvasElement;

  private readonly editor: Editor;
  private readonly statusCoords: HTMLElement;
  private readonly statusSize: HTMLElement;
  private readonly statusZoom: HTMLElement;
  private readonly statusTool: HTMLElement;
  private openMenu: HTMLElement | null = null;

  constructor(root: HTMLElement, editor: Editor) {
    this.editor = editor;
    root.replaceChildren();

    const app = el('div', 'app');

    const menu = el('header', 'app-menu');
    const brand = el('div', 'app-brand', 'MiniPaint');
    menu.append(brand);
    for (const def of MENUS) menu.append(this.buildMenu(def));

    const body = el('div', 'app-body');

    const toolbar = el('aside', 'toolbar');
    toolbar.dataset.testid = 'toolbar';
    for (const tool of TOOLS) {
      const button = el('button', 'tool-button');
      button.type = 'button';
      button.disabled = true;
      button.title = `${tool.label} (${tool.key})`;
      button.dataset.tool = tool.id;
      button.append(el('span', 'tool-key', tool.key));
      button.append(el('span', 'tool-label', tool.label));
      toolbar.append(button);
    }

    const center = el('div', 'center');
    this.view = el('div', 'viewport-wrap');
    this.view.dataset.testid = 'viewport';
    this.docLayer = el('canvas', 'layer layer-doc');
    this.docLayer.dataset.testid = 'canvas-doc';
    this.previewLayer = el('canvas', 'layer layer-preview');
    this.previewLayer.dataset.testid = 'canvas-preview';
    this.overlayLayer = el('canvas', 'layer layer-overlay');
    this.overlayLayer.dataset.testid = 'canvas-overlay';
    this.view.append(this.docLayer, this.previewLayer, this.overlayLayer);
    center.append(this.view);

    const right = el('aside', 'side-panel');
    const props = el('section', 'panel');
    props.dataset.testid = 'panel-properties';
    props.append(el('h2', 'panel-title', '工具属性'));
    props.append(el('div', 'panel-body', 'M1 起可用'));
    const history = el('section', 'panel');
    history.dataset.testid = 'panel-history';
    history.append(el('h2', 'panel-title', '历史'));
    history.append(el('div', 'panel-body', 'M1 起可用'));
    right.append(props, history);

    body.append(toolbar, center, right);

    const status = el('footer', 'status-bar');
    this.statusCoords = el('span', 'status-item', '(-, -)');
    this.statusCoords.dataset.testid = 'status-coords';
    this.statusSize = el('span', 'status-item', '');
    this.statusSize.dataset.testid = 'status-size';
    this.statusZoom = el('span', 'status-item', '100%');
    this.statusZoom.dataset.testid = 'status-zoom';
    this.statusTool = el('span', 'status-item', '—');
    this.statusTool.dataset.testid = 'status-tool';
    status.append(this.statusCoords, this.statusSize, this.statusZoom, this.statusTool);

    app.append(menu, body, status);
    root.append(app);

    document.addEventListener('pointerdown', (event) => {
      if (this.openMenu && !this.openMenu.contains(event.target as Node)) this.closeMenus();
    });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.closeMenus();
    });
  }

  private buildMenu(def: MenuDef): HTMLElement {
    const wrap = el('div', 'menu');
    const trigger = el('button', 'menu-trigger', def.label);
    trigger.type = 'button';
    const dropdown = el('div', 'menu-dropdown');
    dropdown.hidden = true;
    for (const id of def.items) {
      const command = this.editor.registry.get(id);
      if (!command) continue;
      const item = el('button', 'menu-item');
      item.type = 'button';
      item.dataset.command = id;
      const label = el('span', 'menu-item-label', command.label);
      const shortcut = el(
        'span',
        'menu-item-shortcut',
        (command.shortcuts ?? [])[0]?.replace('Mod+', 'Ctrl+') ?? '',
      );
      item.append(label, shortcut);
      const enabled = this.editor.registry.isEnabled(command, this.editor);
      item.disabled = !enabled;
      item.addEventListener('click', () => {
        if (!enabled) return;
        this.closeMenus();
        this.editor.registry.execute(id, this.editor);
      });
      dropdown.append(item);
    }
    trigger.addEventListener('click', () => {
      const wasOpen = !dropdown.hidden;
      this.closeMenus();
      if (!wasOpen) {
        dropdown.hidden = false;
        this.openMenu = dropdown;
      }
    });
    wrap.addEventListener('pointerenter', () => {
      if (this.openMenu && this.openMenu !== dropdown) {
        this.closeMenus();
        dropdown.hidden = false;
        this.openMenu = dropdown;
      }
    });
    wrap.append(trigger, dropdown);
    return wrap;
  }

  private closeMenus(): void {
    if (this.openMenu) {
      this.openMenu.hidden = true;
      this.openMenu = null;
    }
  }

  updateCoords(point: { x: number; y: number } | null): void {
    this.statusCoords.textContent = point
      ? `(${Math.floor(point.x)}, ${Math.floor(point.y)})`
      : '(-, -)';
  }

  updateSize(): void {
    const doc = this.editor.document;
    this.statusSize.textContent = `${doc.width} × ${doc.height}`;
  }

  updateZoom(): void {
    const percent = this.editor.viewport.scale * 100;
    const text =
      percent >= 10 && Number.isInteger(percent) ? `${percent}%` : `${percent.toFixed(1)}%`;
    this.statusZoom.textContent = text;
  }

  updateTool(label: string): void {
    this.statusTool.textContent = label;
  }
}
