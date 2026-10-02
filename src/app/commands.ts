import type { Editor } from './Editor';
import { exportImage, exportPng, JPEG_QUALITY, WEBP_QUALITY } from '../core/FileManager';

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

async function runExportPng(editor: Editor): Promise<void> {
  try {
    await exportPng(editor.document);
  } catch (error) {
    window.alert(`导出失败: ${String(error)}`);
  }
}

export const commandList: Command[] = [
  {
    id: 'file.new',
    label: '新建…',
    shortcuts: ['Mod+N'],
    run: (editor) => editor.newDocument(),
  },
  {
    id: 'file.open',
    label: '打开…',
    shortcuts: ['Mod+O'],
    run: (editor) => editor.ui.pickFile(),
  },
  {
    id: 'file.save',
    label: '保存',
    shortcuts: ['Mod+S'],
    run: (editor) => runExportPng(editor),
  },
  {
    id: 'file.exportPng',
    label: '导出 PNG…',
    run: (editor) => runExportPng(editor),
  },
  {
    id: 'file.exportJpeg',
    label: '导出 JPEG…',
    run: async (editor) => {
      try {
        await exportImage(editor.document, 'image/jpeg', 'jpg', JPEG_QUALITY);
      } catch (error) {
        window.alert(`导出失败: ${String(error)}`);
      }
    },
  },
  {
    id: 'file.exportWebp',
    label: '导出 WebP…',
    run: async (editor) => {
      try {
        await exportImage(editor.document, 'image/webp', 'webp', WEBP_QUALITY);
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
    id: 'edit.selectAll',
    label: '全选',
    shortcuts: ['Mod+A'],
    run: (editor) => editor.selection.selectAll(),
  },
  {
    id: 'edit.cut',
    label: '剪切',
    shortcuts: ['Mod+X'],
    enabled: (editor) => editor.selection.hasSelection,
    run: (editor) => {
      editor.selection.cutSelection();
    },
  },
  {
    id: 'edit.copy',
    label: '复制',
    shortcuts: ['Mod+C'],
    enabled: (editor) => editor.selection.hasSelection,
    run: (editor) => {
      editor.selection.copySelection();
    },
  },
  {
    id: 'edit.paste',
    label: '粘贴',
    shortcuts: ['Mod+V'],
    run: (editor) => {
      void editor.selection.pasteClipboard();
    },
  },
  {
    id: 'edit.delete',
    label: '删除',
    shortcuts: ['Delete', 'Backspace'],
    enabled: (editor) => editor.selection.hasSelection,
    run: (editor) => {
      editor.selection.deleteSelection();
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
  {
    id: 'image.crop',
    label: '裁剪到选区',
    enabled: (editor) => editor.selection.hasSelection,
    run: (editor) => {
      editor.cropSelection();
    },
  },
  { id: 'help.about', label: '关于 MiniPaint', run: (editor) => editor.showAbout() },
  {
    id: 'tool.select',
    label: '选择',
    shortcuts: ['M'],
    run: (editor) => editor.selectTool('select'),
  },
  { id: 'tool.crop', label: '裁剪', shortcuts: ['C'], run: (editor) => editor.selectTool('crop') },
  {
    id: 'tool.pencil',
    label: '铅笔',
    shortcuts: ['P'],
    run: (editor) => editor.selectTool('pencil'),
  },
  {
    id: 'tool.brush',
    label: '画笔',
    shortcuts: ['B'],
    run: (editor) => editor.selectTool('brush'),
  },
  {
    id: 'tool.eraser',
    label: '橡皮',
    shortcuts: ['E'],
    run: (editor) => editor.selectTool('eraser'),
  },
  {
    id: 'tool.bucket',
    label: '填充',
    shortcuts: ['G'],
    run: (editor) => editor.selectTool('bucket'),
  },
  {
    id: 'tool.eyedropper',
    label: '取色',
    shortcuts: ['I'],
    run: (editor) => editor.selectTool('eyedropper'),
  },
  {
    id: 'tool.text',
    label: '文本',
    shortcuts: ['T'],
    run: (editor) => editor.selectTool('text'),
  },
  {
    id: 'tool.line',
    label: '直线',
    shortcuts: ['L'],
    run: (editor) => editor.selectTool('line'),
  },
  {
    id: 'tool.rect',
    label: '矩形',
    shortcuts: ['R'],
    run: (editor) => editor.selectTool('rect'),
  },
  {
    id: 'tool.ellipse',
    label: '椭圆',
    shortcuts: ['O'],
    run: (editor) => editor.selectTool('ellipse'),
  },
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
