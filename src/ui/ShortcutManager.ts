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
        if (!this.registry.execute(command.id, this.editor)) return;
        event.preventDefault();
        return;
      }
    }
  };
}
