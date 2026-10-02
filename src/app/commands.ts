import type { Editor } from './Editor';
import { exportPng } from '../core/FileManager';

export interface Command {
  id: string;
  label: string;
  shortcuts?: string[];
  enabled?: (editor: Editor) => boolean;
  run?: (editor: Editor) => void;
}

export const TOOL_ORDER = [
  'select',
  'crop',
  'pencil',
  'brush',
  'eraser',
  'bucket',
  'eyedropper',
  'text',
  'line',
  'rect',
  'ellipse',
] as const;

export const commandList: Command[] = [
  { id: 'file.new', label: '新建…', shortcuts: ['Mod+N'] },
  { id: 'file.open', label: '打开…', shortcuts: ['Mod+O'] },
  { id: 'file.save', label: '保存', shortcuts: ['Mod+S'] },
  {
    id: 'file.exportPng',
    label: '导出 PNG…',
    run: async (editor) => {
      try {
        await exportPng(editor.document);
      } catch (error) {
        window.alert(`导出失败: ${String(error)}`);
      }
    },
  },
  {
    id: 'edit.undo',
    label: '撤销',
    shortcuts: ['Mod+Z'],
    enabled: (editor) => editor.history.canUndo,
    run: (editor) => {
      editor.history.undo();
    },
  },
  {
    id: 'edit.redo',
    label: '重做',
    shortcuts: ['Mod+Y', 'Mod+Shift+Z'],
    enabled: (editor) => editor.history.canRedo,
    run: (editor) => {
      editor.history.redo();
    },
  },
  {
    id: 'view.zoomIn',
    label: '放大',
    shortcuts: ['Mod+='],
    run: (editor) => editor.zoomBy(1.25),
  },
  {
    id: 'view.zoomOut',
    label: '缩小',
    shortcuts: ['Mod+-'],
    run: (editor) => editor.zoomBy(1 / 1.25),
  },
  {
    id: 'view.fit',
    label: '适应窗口',
    shortcuts: ['Mod+0'],
    run: (editor) => editor.fitToWindow(),
  },
  { id: 'help.about', label: '关于 MiniPaint', run: (editor) => editor.showAbout() },
  { id: 'tool.select', label: '选择', shortcuts: ['M'] },
  { id: 'tool.crop', label: '裁剪', shortcuts: ['C'] },
  {
    id: 'tool.pencil',
    label: '铅笔',
    shortcuts: ['P'],
    run: (editor) => editor.selectTool('pencil'),
  },
  { id: 'tool.brush', label: '画笔', shortcuts: ['B'] },
  {
    id: 'tool.eraser',
    label: '橡皮',
    shortcuts: ['E'],
    run: (editor) => editor.selectTool('eraser'),
  },
  { id: 'tool.bucket', label: '填充', shortcuts: ['G'] },
  { id: 'tool.eyedropper', label: '取色', shortcuts: ['I'] },
  { id: 'tool.text', label: '文本', shortcuts: ['T'] },
  { id: 'tool.line', label: '直线', shortcuts: ['L'] },
  { id: 'tool.rect', label: '矩形', shortcuts: ['R'] },
  { id: 'tool.ellipse', label: '椭圆', shortcuts: ['O'] },
];

export class CommandRegistry {
  private commands = new Map<string, Command>();

  register(command: Command): void {
    this.commands.set(command.id, command);
  }

  registerAll(commands: Command[]): void {
    for (const command of commands) this.register(command);
  }

  get(id: string): Command | undefined {
    return this.commands.get(id);
  }

  list(): Command[] {
    return [...this.commands.values()];
  }

  isEnabled(command: Command, editor: Editor): boolean {
    return !!command.run && (!command.enabled || command.enabled(editor));
  }

  execute(id: string, editor: Editor): boolean {
    const command = this.commands.get(id);
    if (!command || !this.isEnabled(command, editor)) return false;
    command.run!(editor);
    editor.events.emit('command:executed', { id });
    return true;
  }
}
