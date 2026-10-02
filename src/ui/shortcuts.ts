export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;
  const element = target as { tagName?: string; isContentEditable?: boolean };
  if (element.isContentEditable) return true;
  const tag = element.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return false;
}

function keyMatches(eventKey: string, expected: string): boolean {
  if (expected === 'Space') return eventKey === ' ' || eventKey === 'Spacebar';
  if (expected.length === 1) return eventKey.toLowerCase() === expected.toLowerCase();
  return eventKey.toLowerCase() === expected.toLowerCase();
}

/** 组合格式：Mod+Shift+Z、Mod+0、Space。Mod = Ctrl（macOS 为 Meta）。 */
export function eventMatchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const parts = shortcut.split('+');
  const key = parts.pop();
  if (!key) return false;
  const needMod = parts.includes('Mod');
  const needShift = parts.includes('Shift');
  const needAlt = parts.includes('Alt');
  const mod = event.ctrlKey || event.metaKey;
  if (mod !== needMod) return false;
  if (event.shiftKey !== needShift) return false;
  if (event.altKey !== needAlt) return false;
  return keyMatches(event.key, key);
}
