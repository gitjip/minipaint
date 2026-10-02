import type { Editor } from '../app/Editor';
import { TOOL_ORDER } from '../app/commands';
import { DEFAULT_PALETTE } from '../core/ColorManager';

interface MenuDef {
  label: string;
  items: string[];
}

const MENUS: MenuDef[] = [
  { label: '文件', items: ['file.new', 'file.open', 'file.save', 'file.exportPng'] },
  { label: '编辑', items: ['edit.undo', 'edit.redo'] },
  { label: '查看', items: ['view.zoomIn', 'view.zoomOut', 'view.fit'] },
  { label: '帮助', items: ['help.about'] },
];

const ERASER_SIZES = [4, 8, 16, 32];

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
  private readonly menuRoot: HTMLElement;
  private readonly toolButtons = new Map<string, HTMLButtonElement>();
  private readonly propertiesBody: HTMLElement;
  private readonly historyBody: HTMLElement;
  private readonly fgSwatch: HTMLLabelElement;
  private readonly bgSwatch: HTMLLabelElement;
  private readonly fgInput: HTMLInputElement;
  private readonly bgInput: HTMLInputElement;
  private readonly recentRow: HTMLElement;
  private openMenu: HTMLElement | null = null;

  constructor(root: HTMLElement, editor: Editor) {
    this.editor = editor;
    root.replaceChildren();

    const app = el('div', 'app');

    const menu = el('header', 'app-menu');
    this.menuRoot = menu;
    menu.append(el('div', 'app-brand', 'MiniPaint'));
    for (const def of MENUS) menu.append(this.buildMenu(def));

    const body = el('div', 'app-body');

    const toolbar = el('aside', 'toolbar');
    toolbar.dataset.testid = 'toolbar';
    for (const id of TOOL_ORDER) {
      const command = editor.registry.get(`tool.${id}`);
      if (!command) continue;
      const button = el('button', 'tool-button');
      button.type = 'button';
      button.dataset.testid = `tool-${id}`;
      button.dataset.tool = id;
      button.title = `${command.label} (${(command.shortcuts ?? [''])[0]})`;
      button.disabled = !editor.registry.isEnabled(command, editor);
      const key = el('span', 'tool-key', (command.shortcuts ?? [''])[0].toUpperCase());
      const label = el('span', 'tool-label', command.label);
      button.append(key, label);
      button.addEventListener('click', () => editor.registry.execute(`tool.${id}`, editor));
      toolbar.append(button);
      this.toolButtons.set(id, button);
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
    this.propertiesBody = el('div', 'panel-body');
    this.propertiesBody.dataset.testid = 'properties-body';
    props.append(this.propertiesBody);
    const history = el('section', 'panel');
    history.dataset.testid = 'panel-history';
    history.append(el('h2', 'panel-title', '历史'));
    this.historyBody = el('div', 'history-list');
    this.historyBody.dataset.testid = 'history-list';
    history.append(this.historyBody);
    right.append(props, history);

    body.append(toolbar, center, right);

    const colorBar = el('footer', 'color-bar');
    colorBar.dataset.testid = 'color-bar';

    const pair = el('div', 'color-pair');
    this.fgSwatch = this.buildColorInput('color-fg', '前景色', (value) =>
      editor.colors.setForeground(value),
    );
    this.bgSwatch = this.buildColorInput('color-bg', '背景色', (value) =>
      editor.colors.setBackground(value),
    );
    this.fgInput = this.fgSwatch.querySelector('input')!;
    this.bgInput = this.bgSwatch.querySelector('input')!;
    const swap = el('button', 'color-swap', '⇄');
    swap.type = 'button';
    swap.dataset.testid = 'color-swap';
    swap.title = '交换前景/背景色 (X)';
    swap.addEventListener('click', () => editor.colors.swap());
    pair.append(this.fgSwatch, this.bgSwatch, swap);

    const palette = el('div', 'palette');
    palette.dataset.testid = 'palette';
    colorBar.append(pair, palette);

    const recent = el('div', 'recent-colors');
    recent.dataset.testid = 'recent-colors';
    colorBar.append(recent);
    this.recentRow = recent;

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

    app.append(menu, body, colorBar, status);
    root.append(app);

    this.buildPalette(palette);

    document.addEventListener('pointerdown', (event) => {
      if (this.openMenu && !this.openMenu.contains(event.target as Node)) this.closeMenus();
    });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.closeMenus();
    });

    editor.events.on('tool:change', ({ id, label }) => {
      this.updateTool(label);
      this.updateActiveTool(id);
      this.renderProperties();
    });
    editor.events.on('colors:change', () => this.syncColors());
    editor.history.subscribe(() => {
      this.refreshMenuStates();
      this.renderHistory();
    });

    this.renderProperties();
    this.renderHistory();
    this.syncColors();
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
      item.dataset.testid = `menu-${id}`;
      item.dataset.command = id;
      const label = el('span', 'menu-item-label', command.label);
      const shortcut = el(
        'span',
        'menu-item-shortcut',
        (command.shortcuts ?? [])[0]?.replace('Mod+', 'Ctrl+') ?? '',
      );
      item.append(label, shortcut);
      item.disabled = !this.editor.registry.isEnabled(command, this.editor);
      item.addEventListener('click', () => {
        if (item.disabled) return;
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

  private refreshMenuStates(): void {
    const items = this.menuRoot.querySelectorAll<HTMLButtonElement>('.menu-item[data-command]');
    for (const item of items) {
      const command = this.editor.registry.get(item.dataset.command!);
      if (!command) continue;
      item.disabled = !this.editor.registry.isEnabled(command, this.editor);
    }
  }

  private closeMenus(): void {
    if (this.openMenu) {
      this.openMenu.hidden = true;
      this.openMenu = null;
    }
  }

  private buildColorInput(
    testid: string,
    title: string,
    onPick: (value: string) => void,
  ): HTMLLabelElement {
    const label = el('label', 'color-swatch');
    label.dataset.testid = testid;
    label.title = title;
    const input = el('input');
    input.type = 'color';
    input.dataset.testid = `${testid}-input`;
    input.value = '#000000';
    input.addEventListener('input', () => onPick(input.value));
    label.append(input);
    return label;
  }

  private buildPalette(palette: HTMLElement): void {
    for (const color of DEFAULT_PALETTE) {
      const swatch = el('button', 'palette-swatch');
      swatch.type = 'button';
      swatch.dataset.testid = `swatch-${color.slice(1)}`;
      swatch.dataset.color = color;
      swatch.style.background = color;
      swatch.title = color.toUpperCase();
      swatch.addEventListener('click', () => this.editor.colors.setForeground(color));
      swatch.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        this.editor.colors.setBackground(color);
      });
      palette.append(swatch);
    }
  }

  private syncColors(): void {
    const { foreground, background, recent } = this.editor.colors;
    this.fgSwatch.style.setProperty('--c', foreground);
    this.bgSwatch.style.setProperty('--c', background);
    this.fgInput.value = foreground;
    this.bgInput.value = background;

    const recentRow = this.recentRow;
    recentRow.replaceChildren();
    for (const color of recent) {
      const swatch = el('button', 'palette-swatch recent-swatch');
      swatch.type = 'button';
      swatch.dataset.testid = `recent-${color.slice(1)}`;
      swatch.dataset.color = color;
      swatch.style.background = color;
      swatch.title = color.toUpperCase();
      swatch.addEventListener('click', () => this.editor.colors.setForeground(color));
      recentRow.append(swatch);
    }
  }

  private renderProperties(): void {
    const body = this.propertiesBody;
    body.replaceChildren();
    const toolId = this.editor.tools?.activeToolId ?? '';
    if (toolId === 'pencil') {
      body.textContent = '铅笔 · 1px 硬边 · 前景色绘制';
      return;
    }
    if (toolId === 'eraser') {
      body.textContent = '橡皮 · 方形 · 擦除为背景色 · 大小:';
      const sizes = el('div', 'size-options');
      for (const size of ERASER_SIZES) {
        const button = el('button', 'size-button', String(size));
        button.type = 'button';
        button.dataset.testid = `eraser-size-${size}`;
        if (this.editor.options.eraserSize === size) button.classList.add('is-active');
        button.addEventListener('click', () => {
          this.editor.options.eraserSize = size;
          this.renderProperties();
          this.editor.renderer.requestRender();
        });
        sizes.append(button);
      }
      body.append(sizes);
      return;
    }
    body.textContent = '该工具未实现（后续里程碑）';
  }

  private renderHistory(): void {
    const body = this.historyBody;
    body.replaceChildren();
    const entries = this.editor.history.entries;
    if (entries.length === 0) {
      body.append(el('div', 'history-empty', '暂无记录'));
      return;
    }
    entries.forEach((entry, index) => {
      const item = el('button', 'history-item', `${index + 1}. ${entry.name}`);
      item.type = 'button';
      item.dataset.testid = 'history-item';
      item.title = '点击回到此步之后的状态';
      item.addEventListener('click', () => this.editor.history.jumpTo(index + 1));
      body.append(item);
    });
  }

  private updateActiveTool(id: string): void {
    for (const [toolId, button] of this.toolButtons) {
      button.classList.toggle('is-active', toolId === id);
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
