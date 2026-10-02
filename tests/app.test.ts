import { describe, expect, it } from 'vitest';
import { EventBus } from '../src/app/EventBus';
import { eventMatchesShortcut, isEditableTarget } from '../src/ui/shortcuts';

function key(init: Partial<KeyboardEvent> & { key: string }): KeyboardEvent {
  return {
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    repeat: false,
    ...init,
  } as unknown as KeyboardEvent;
}

describe('EventBus', () => {
  it('on/emit/off 基本流程', () => {
    const bus = new EventBus<{ ping: number }>();
    const received: number[] = [];
    const off = bus.on('ping', (n) => received.push(n));
    bus.emit('ping', 1);
    bus.emit('ping', 2);
    off();
    bus.emit('ping', 3);
    expect(received).toEqual([1, 2]);
  });

  it('多个监听器都会触发', () => {
    const bus = new EventBus<{ ping: number }>();
    let count = 0;
    bus.on('ping', () => count++);
    bus.on('ping', () => count++);
    bus.emit('ping', 1);
    expect(count).toBe(2);
  });
});

describe('eventMatchesShortcut', () => {
  it('Mod+0 匹配 Ctrl+0，不匹配无 Ctrl', () => {
    expect(eventMatchesShortcut(key({ key: '0', ctrlKey: true }), 'Mod+0')).toBe(true);
    expect(eventMatchesShortcut(key({ key: '0' }), 'Mod+0')).toBe(false);
  });

  it('要求修饰键精确匹配', () => {
    expect(eventMatchesShortcut(key({ key: 'z', ctrlKey: true, shiftKey: true }), 'Mod+Z')).toBe(
      false,
    );
    expect(
      eventMatchesShortcut(key({ key: 'Z', ctrlKey: true, shiftKey: true }), 'Mod+Shift+Z'),
    ).toBe(true);
  });

  it('大小写不敏感', () => {
    expect(eventMatchesShortcut(key({ key: 'Z', ctrlKey: true }), 'Mod+z')).toBe(true);
  });

  it('Meta 键等价 Mod', () => {
    expect(eventMatchesShortcut(key({ key: '0', metaKey: true }), 'Mod+0')).toBe(true);
  });
});

describe('isEditableTarget', () => {
  it('非元素目标不是可编辑', () => {
    expect(isEditableTarget(null)).toBe(false);
  });
});
