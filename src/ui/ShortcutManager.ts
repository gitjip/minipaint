import type { CommandRegistry } from '../app/commands';
import type { Editor } from '../app/Editor';
import { eventMatchesShortcut, isEditableTarget } from './shortcuts';

export class ShortcutManager {
  private readonly registry: CommandRegistry;
  private readonly editor: Editor;

  constructor(registry: CommandRegistry, editor: Editor) {
    this.registry = registry;
    this.editor = editor;
  }

  attach(): void {
    window.addEventListener('keydown', this.onKeyDown);
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (isEditableTarget(event.target)) return;
    for (const command of this.registry.list()) {
      for (const shortcut of command.shortcuts ?? []) {
        if (!eventMatchesShortcut(event, shortcut)) continue;
        // Ctrl+V 交由浏览器原生 paste 事件处理（携带剪贴板文件）：
        // 在此执行命令并 preventDefault 会挡掉 paste 事件，
        // 而 navigator.clipboard.read 常因权限被拒，导致无法粘贴系统图片。
        if (command.id === 'edit.paste') return;
        if (!this.registry.execute(command.id, this.editor)) return;
        event.preventDefault();
        return;
      }
    }
  };
}
