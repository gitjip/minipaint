export interface HistoryEntry {
  name: string;
  mergeKey?: string;
  undo(): void;
  redo(): void;
  /** 若可与自身合并则返回合并后的新条目，否则返回 null。 */
  merge?(next: HistoryEntry): HistoryEntry | null;
}

export type HistoryListener = () => void;

export class HistoryManager {
  readonly limit: number;
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private listeners = new Set<HistoryListener>();

  constructor(limit = 100) {
    this.limit = limit;
  }

  get entries(): readonly HistoryEntry[] {
    return this.undoStack;
  }

  /** 待重做的条目（时间顺序：下一次重做排最前），用于历史面板前跳。 */
  get redoEntries(): readonly HistoryEntry[] {
    return [...this.redoStack].reverse();
  }

  /** 已应用的条目数，jumpTo 的目标值域为 [0, entries.length]。 */
  get appliedCount(): number {
    return this.undoStack.length;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  subscribe(listener: HistoryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  push(entry: HistoryEntry): void {
    const top = this.undoStack[this.undoStack.length - 1];
    if (
      top &&
      entry.mergeKey !== undefined &&
      entry.mergeKey === top.mergeKey &&
      top.merge
    ) {
      const merged = top.merge(entry);
      if (merged) {
        this.undoStack[this.undoStack.length - 1] = merged;
        this.redoStack = [];
        this.notify();
        return;
      }
    }
    this.undoStack.push(entry);
    this.redoStack = [];
    while (this.undoStack.length > this.limit) this.undoStack.shift();
    this.notify();
  }

  undo(): boolean {
    const entry = this.undoStack.pop();
    if (!entry) return false;
    entry.undo();
    this.redoStack.push(entry);
    this.notify();
    return true;
  }

  redo(): boolean {
    const entry = this.redoStack.pop();
    if (!entry) return false;
    entry.redo();
    this.undoStack.push(entry);
    this.notify();
    return true;
  }

  jumpTo(appliedCount: number): void {
    const maxApplied = this.undoStack.length + this.redoStack.length;
    const target = Math.max(0, Math.min(appliedCount, maxApplied));
    while (this.undoStack.length > target) this.undo();
    while (this.undoStack.length < target) this.redo();
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }
}
