import { describe, expect, it } from 'vitest';
import { ColorManager, DEFAULT_PALETTE, MAX_RECENT_COLORS } from '../src/core/ColorManager';

describe('ColorManager', () => {
  it('默认前景黑、背景白', () => {
    const colors = new ColorManager();
    expect(colors.foreground).toBe('#000000');
    expect(colors.background).toBe('#ffffff');
  });

  it('设置前景色写入最近使用并去重', () => {
    const colors = new ColorManager();
    colors.setForeground('#ff0000');
    colors.setForeground('#00ff00');
    colors.setForeground('#ff0000');
    expect(colors.recent[0]).toBe('#ff0000');
    expect(colors.recent.filter((c) => c === '#ff0000')).toHaveLength(1);
    expect(colors.recent).toHaveLength(2);
  });

  it('最近颜色数量有上限', () => {
    const colors = new ColorManager();
    for (let i = 0; i < MAX_RECENT_COLORS + 5; i++) {
      colors.setForeground(`#${i.toString(16).padStart(6, '0')}`);
    }
    expect(colors.recent).toHaveLength(MAX_RECENT_COLORS);
  });

  it('交换前景背景', () => {
    const colors = new ColorManager();
    colors.setForeground('#123456');
    colors.swap();
    expect(colors.foreground).toBe('#ffffff');
    expect(colors.background).toBe('#123456');
  });

  it('简写与大写归一化', () => {
    const colors = new ColorManager();
    colors.setForeground('#ABC');
    expect(colors.foreground).toBe('#aabbcc');
  });

  it('非法颜色抛错', () => {
    const colors = new ColorManager();
    expect(() => colors.setForeground('red')).toThrow();
  });

  it('默认调色板 28 色且无重复', () => {
    expect(DEFAULT_PALETTE).toHaveLength(28);
    expect(new Set(DEFAULT_PALETTE).size).toBe(28);
  });
});
