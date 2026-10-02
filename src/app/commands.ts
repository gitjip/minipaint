import type { Editor } from './Editor';

export interface Command {
  id: string;
  label: string;
  shortcuts?: string[];
  enabled?: (editor: Editor) => boolean;
  run?: (editor: Editor) => void;
}

export const commandList: Command[] = [
  { id: 'file.new', label: '新建…', shortcuts: ['Mod+N'] },
  { id: 'file.open', label: '打开…', shortcuts: ['Mod+O'] },
  { id: 'file.save', label: '保存', shortcuts: ['Mod+S'] },
  { id: 'edit.undo', label: '撤销', shortcuts: ['Mod+Z'] },
  { id: 'edit.redo', label: '重做', shortcuts: ['Mod+Y', 'Mod+Shift+Z'] },
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
