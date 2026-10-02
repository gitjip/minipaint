import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { docHash, docPixel, gotoApp, selectionState, stroke, waitForRender } from './helpers/canvas';

const WHITE = [255, 255, 255, 255];
const RED = [255, 0, 0, 255];
const BLUE = [0, 0, 255, 255];

const FIXTURE = join(process.cwd(), 'e2e', 'fixtures', 'm4-pattern.png');
const FIXTURE_BASE64 = readFileSync(FIXTURE).toString('base64');

/** 右键设背景红 → 矩形填充画红块 → 背景切回白。 */
async function drawRedBlock(
  page: Parameters<typeof gotoApp>[0],
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  await page.getByTestId('swatch-ff0000').click({ button: 'right' });
  await page.keyboard.press('r');
  await page.getByTestId('shape-mode-fill').click();
  await stroke(page, [from, to]);
  await page.getByTestId('swatch-ffffff').click({ button: 'right' });
  await waitForRender(page);
}

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test.describe('M5 · 打磨与完备', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('快捷键矩阵：工具 / 缩放 / 撤销重做 / 全选逐项接通', async ({ page }) => {
    const errors = await gotoApp(page);

    const tools: [string, string][] = [
      ['p', '铅笔'],
      ['b', '画笔'],
      ['e', '橡皮'],
      ['g', '填充'],
      ['i', '取色'],
      ['t', '文本'],
      ['l', '直线'],
      ['r', '矩形'],
      ['o', '椭圆'],
      ['m', '选择'],
      ['c', '裁剪'],
    ];
    for (const [key, label] of tools) {
      await page.keyboard.press(key);
      await expect(page.getByTestId('status-tool')).toHaveText(label);
    }

    await page.keyboard.press('Control+a');
    await expect(page.getByTestId('status-selection')).toHaveText('选区 800 × 600');

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('status-selection')).toHaveText('—');

    await page.keyboard.press('Control+=');
    await expect(page.getByTestId('status-zoom')).not.toHaveText('100%');
    await page.keyboard.press('Control+-');
    await expect(page.getByTestId('status-zoom')).toHaveText('100%');
    await page.keyboard.press('Control+0');
    await expect(page.getByTestId('status-zoom')).toHaveText(/^\d+(\.\d)?%$/);

    await page.keyboard.press('b');
    await stroke(page, [
      { x: 120, y: 120 },
      { x: 220, y: 180 },
    ]);
    await waitForRender(page);
    await expect(page.getByTestId('history-item')).toHaveCount(1);
    await page.keyboard.press('Control+z');
    await expect(page.getByTestId('history-item')).toHaveCount(0);
    await page.keyboard.press('Control+Shift+z');
    await expect(page.getByTestId('history-item')).toHaveCount(1);

    expect(errors).toEqual([]);
  });

  test('文本框聚焦时屏蔽工具键，失焦后恢复', async ({ page }) => {
    const errors = await gotoApp(page);

    await page.keyboard.press('t');
    await stroke(page, [{ x: 250, y: 250 }]);
    const input = page.getByTestId('text-input');
    await expect(input).toBeVisible();

    await input.fill('ab');
    await page.keyboard.type('m');
    await expect(input).toHaveValue('abm');
    await expect(page.getByTestId('status-tool')).toHaveText('文本');
    await expect(page.getByTestId('tool-select')).not.toHaveClass(/is-active/);
    await expect(page.getByTestId('tool-text')).toHaveClass(/is-active/);

    await page.keyboard.press('Escape');
    await expect(input).toHaveCount(0);
    await expect(page.getByTestId('history-item')).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test('Ctrl+V 粘贴系统剪贴板图片 → 浮离选区，不替换画布', async ({ page }) => {
    const errors = await gotoApp(page);
    const before = await docHash(page);

    await page.evaluate(async (base64) => {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'image/png' });
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    }, FIXTURE_BASE64);

    await page.keyboard.press('Control+v');
    await expect.poll(async () => (await selectionState(page)).float !== null).toBe(true);
    const float = (await selectionState(page)).float!;
    expect(float.width).toBe(6);
    expect(float.height).toBe(4);
    await expect(page.getByTestId('status-size')).toHaveText('800 × 600');
    expect(await docHash(page)).toBe(before);

    await page.keyboard.press('Enter');
    await waitForRender(page);
    await expect(page.getByTestId('history-item')).toHaveCount(1);
    expect(await docPixel(page, float.x, float.y)).toEqual(RED);
    expect(await docPixel(page, float.x + 5, float.y + 3)).toEqual(BLUE);

    expect(errors).toEqual([]);
  });

  test('历史列表点击跳转 = 对应撤销 / 重做', async ({ page }) => {
    const errors = await gotoApp(page);

    await drawRedBlock(page, { x: 80, y: 80 }, { x: 140, y: 140 });
    await drawRedBlock(page, { x: 300, y: 80 }, { x: 360, y: 140 });
    await expect(page.getByTestId('history-item')).toHaveCount(2);
    expect(await docPixel(page, 330, 110)).toEqual(RED);

    await page.getByTestId('history-item').first().click();
    await waitForRender(page);
    expect(await docPixel(page, 110, 110)).toEqual(RED);
    expect(await docPixel(page, 330, 110)).toEqual(WHITE);
    await expect(page.getByTestId('history-item')).toHaveCount(1);
    await expect(page.getByTestId('history-item-redo')).toHaveCount(1);

    await page.getByTestId('history-item-redo').first().click();
    await waitForRender(page);
    expect(await docPixel(page, 330, 110)).toEqual(RED);
    await expect(page.getByTestId('history-item')).toHaveCount(2);
    await expect(page.getByTestId('history-item-redo')).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test('状态栏选区尺寸；图像菜单裁剪到选区且未选中时禁用', async ({ page }) => {
    const errors = await gotoApp(page);

    await page.keyboard.press('m');
    await stroke(page, [
      { x: 200, y: 150 },
      { x: 320, y: 250 },
    ]);
    await waitForRender(page);
    expect((await selectionState(page)).shape).toEqual({
      x: 200,
      y: 150,
      width: 120,
      height: 100,
    });
    await expect(page.getByTestId('status-selection')).toHaveText('选区 120 × 100');

    await page.getByRole('button', { name: '图像' }).click();
    await expect(page.getByTestId('menu-image.crop')).toBeEnabled();
    await page.getByTestId('menu-image.crop').click();
    await waitForRender(page);

    await expect(page.getByTestId('status-size')).toHaveText('120 × 100');
    await expect(page.getByTestId('status-selection')).toHaveText('—');
    await expect(page.getByTestId('history-item')).toHaveCount(0);

    await page.getByRole('button', { name: '图像' }).click();
    await expect(page.getByTestId('menu-image.crop')).toBeDisabled();
    await page.keyboard.press('Escape');

    expect(errors).toEqual([]);
  });

  test('文件菜单：保存 = 下载 PNG', async ({ page }) => {
    const errors = await gotoApp(page);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '文件' }).click();
    await page.getByTestId('menu-file.save').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('minipaint-800x600.png');
    expect(await download.path()).toBeTruthy();

    expect(errors).toEqual([]);
  });

  test('全流程冒烟：新建→绘制→选区→文本→保存→打开→撤销到底', async ({ page }) => {
    const errors = await gotoApp(page);

    await page.keyboard.press('Control+n');
    await waitForRender(page);
    await expect(page.getByTestId('status-size')).toHaveText('800 × 600');

    await drawRedBlock(page, { x: 100, y: 100 }, { x: 200, y: 200 });
    await expect(page.getByTestId('history-item')).toHaveCount(1);

    await page.keyboard.press('m');
    await stroke(page, [
      { x: 100, y: 100 },
      { x: 200, y: 200 },
    ]);
    await waitForRender(page);
    expect((await selectionState(page)).shape).toEqual({
      x: 100,
      y: 100,
      width: 100,
      height: 100,
    });
    await expect(page.getByTestId('status-selection')).toHaveText('选区 100 × 100');

    await page.keyboard.press('t');
    await stroke(page, [{ x: 400, y: 320 }]);
    await page.getByTestId('text-input').fill('M5');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('text-input')).toHaveCount(0);
    await waitForRender(page);
    await expect(page.getByTestId('history-item')).toHaveCount(2);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '文件' }).click();
    await page.getByTestId('menu-file.save').click();
    expect((await downloadPromise).suggestedFilename()).toBe('minipaint-800x600.png');

    await page.setInputFiles('[data-testid="file-input"]', FIXTURE);
    await expect(page.getByTestId('status-size')).toHaveText('6 × 4');
    await expect(page.getByTestId('history-item')).toHaveCount(0);
    await expect(page.getByTestId('status-selection')).toHaveText('—');

    await page.keyboard.press('b');
    await stroke(page, [
      { x: 2, y: 2 },
      { x: 4, y: 3 },
    ]);
    await waitForRender(page);
    await expect(page.getByTestId('history-item')).toHaveCount(1);

    await page.keyboard.press('Control+z');
    await expect(page.getByTestId('history-item')).toHaveCount(0);
    expect(await docPixel(page, 0, 0)).toEqual(RED);
    expect(await docPixel(page, 5, 3)).toEqual(BLUE);

    expect(errors).toEqual([]);
  });

  test('大图：2048×2048 导入、绘制、撤销稳定无报错', async ({ page }) => {
    const errors = await gotoApp(page);

    await page.evaluate(() => {
      const editor = (window as unknown as { minipaint: import('../src/app/Editor').Editor })
        .minipaint;
      const canvas = document.createElement('canvas');
      canvas.width = 2048;
      canvas.height = 2048;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#334455';
      ctx.fillRect(0, 0, 2048, 2048);
      return editor.importImage(canvas);
    });
    await expect(page.getByTestId('status-size')).toHaveText('2048 × 2048');

    await page.keyboard.press('b');
    await stroke(page, [
      { x: 100, y: 100 },
      { x: 160, y: 140 },
    ]);
    await waitForRender(page);
    await expect(page.getByTestId('history-item')).toHaveCount(1);

    await page.keyboard.press('Control+z');
    await expect(page.getByTestId('history-item')).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test('视觉回归：整体 UI 冒烟截图', async ({ page }) => {
    const errors = await gotoApp(page);

    await drawRedBlock(page, { x: 60, y: 60 }, { x: 180, y: 160 });
    await page.keyboard.press('l');
    await stroke(page, [
      { x: 240, y: 80 },
      { x: 420, y: 180 },
    ]);
    await waitForRender(page);

    await page.keyboard.press('t');
    await stroke(page, [{ x: 60, y: 260 }]);
    await page.getByTestId('text-input').fill('MiniPaint M5');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('text-input')).toHaveCount(0);
    await waitForRender(page);

    await page.keyboard.press('m');
    await stroke(page, [
      { x: 300, y: 240 },
      { x: 460, y: 340 },
    ]);
    await waitForRender(page);
    await expect(page.getByTestId('status-selection')).toHaveText('选区 160 × 100');
    await expect(page.getByTestId('history-item')).toHaveCount(3);

    await expect(page).toHaveScreenshot('m5-ui-smoke.png');
    expect(errors).toEqual([]);
  });
});
