import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { docPixel, canvasToScreen, gotoApp, stroke, waitForRender } from './helpers/canvas';

const WHITE = [255, 255, 255, 255];
const BLACK = [0, 0, 0, 255];

test.describe('M1 · 基础绘制与历史', () => {
  test('铅笔绘制 → Ctrl+Z 撤销 → Ctrl+Y / Ctrl+Shift+Z 重做', async ({ page }) => {
    const errors = await gotoApp(page);

    await expect(page.getByTestId('status-tool')).toHaveText('铅笔');
    await stroke(page, [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ]);

    expect(await docPixel(page, 150, 100)).toEqual(BLACK);
    expect(await docPixel(page, 150, 300)).toEqual(WHITE);

    await page.keyboard.press('Control+z');
    await waitForRender(page);
    expect(await docPixel(page, 150, 100)).toEqual(WHITE);

    await page.keyboard.press('Control+y');
    await waitForRender(page);
    expect(await docPixel(page, 150, 100)).toEqual(BLACK);

    await page.keyboard.press('Control+z');
    await waitForRender(page);
    expect(await docPixel(page, 150, 100)).toEqual(WHITE);

    await page.keyboard.press('Control+Shift+z');
    await waitForRender(page);
    expect(await docPixel(page, 150, 100)).toEqual(BLACK);

    expect(errors).toEqual([]);
  });

  test('一次拖拽 = 1 条历史；连续两笔 = 2 条', async ({ page }) => {
    const errors = await gotoApp(page);

    await stroke(page, [
      { x: 100, y: 200 },
      { x: 200, y: 220 },
      { x: 300, y: 200 },
    ]);
    await expect(page.getByTestId('history-item')).toHaveCount(1);

    await stroke(page, [
      { x: 100, y: 300 },
      { x: 250, y: 320 },
    ]);
    await expect(page.getByTestId('history-item')).toHaveCount(2);

    expect(errors).toEqual([]);
  });

  test('Esc 取消进行中的笔画：不落像素、不入历史', async ({ page }) => {
    const errors = await gotoApp(page);

    const start = await canvasToScreen(page, 100, 100);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    const end = await canvasToScreen(page, 300, 100);
    await page.mouse.move(end.x, end.y, { steps: 8 });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await waitForRender(page);

    expect(await docPixel(page, 200, 100)).toEqual(WHITE);
    await expect(page.getByTestId('history-item')).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test('橡皮擦除为背景色，P/E 快捷键切换工具', async ({ page }) => {
    const errors = await gotoApp(page);

    await stroke(page, [
      { x: 100, y: 400 },
      { x: 300, y: 400 },
    ]);
    expect(await docPixel(page, 200, 400)).toEqual(BLACK);
    await expect(page.getByTestId('history-item')).toHaveCount(1);

    await page.keyboard.press('e');
    await expect(page.getByTestId('status-tool')).toHaveText('橡皮');
    await expect(page.getByTestId('tool-eraser')).toHaveClass(/is-active/);

    await stroke(page, [
      { x: 200, y: 400 },
      { x: 210, y: 400 },
    ]);
    expect(await docPixel(page, 200, 400)).toEqual(WHITE);
    expect(await docPixel(page, 120, 400)).toEqual(BLACK);
    await expect(page.getByTestId('history-item')).toHaveCount(2);

    await page.keyboard.press('p');
    await expect(page.getByTestId('status-tool')).toHaveText('铅笔');
    await expect(page.getByTestId('tool-pencil')).toHaveClass(/is-active/);

    await expect(page.getByTestId('tool-select')).toBeDisabled();

    expect(errors).toEqual([]);
  });

  test('调色板切换前景色，绘制使用新颜色', async ({ page }) => {
    const errors = await gotoApp(page);

    await page.getByTestId('swatch-ff0000').click();
    await expect(page.getByTestId('color-fg-input')).toHaveValue('#ff0000');
    await expect(page.getByTestId('recent-ff0000')).toBeVisible();

    await stroke(page, [
      { x: 400, y: 300 },
      { x: 500, y: 300 },
    ]);
    expect(await docPixel(page, 450, 300)).toEqual([255, 0, 0, 255]);

    expect(errors).toEqual([]);
  });

  test('交换前景/背景色', async ({ page }) => {
    const errors = await gotoApp(page);

    await page.getByTestId('swatch-00ff00').click();
    await page.getByTestId('color-swap').click();
    await expect(page.getByTestId('color-fg-input')).toHaveValue('#ffffff');
    await expect(page.getByTestId('color-bg-input')).toHaveValue('#00ff00');

    expect(errors).toEqual([]);
  });

  test('导出 PNG：触发下载且尺寸 = 文档尺寸', async ({ page }) => {
    const errors = await gotoApp(page);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '文件' }).click();
    await page.getByTestId('menu-file.exportPng').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('minipaint-800x600.png');

    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const buffer = await readFile(filePath!);
    expect(buffer.readUInt32BE(0)).toBe(0x89504e47);
    expect(buffer.readUInt32BE(16)).toBe(800);
    expect(buffer.readUInt32BE(20)).toBe(600);

    expect(errors).toEqual([]);
  });

  test('撤销菜单项随历史可用性启停', async ({ page }) => {
    const errors = await gotoApp(page);

    await page.getByRole('button', { name: '编辑' }).click();
    await expect(page.getByTestId('menu-edit.undo')).toBeDisabled();
    await expect(page.getByTestId('menu-edit.redo')).toBeDisabled();
    await page.keyboard.press('Escape');

    await stroke(page, [
      { x: 150, y: 500 },
      { x: 250, y: 500 },
    ]);

    await page.getByRole('button', { name: '编辑' }).click();
    await expect(page.getByTestId('menu-edit.undo')).toBeEnabled();
    await page.getByTestId('menu-edit.undo').click();
    await waitForRender(page);
    expect(await docPixel(page, 200, 500)).toEqual(WHITE);

    await page.getByRole('button', { name: '编辑' }).click();
    await expect(page.getByTestId('menu-edit.redo')).toBeEnabled();

    expect(errors).toEqual([]);
  });
});
