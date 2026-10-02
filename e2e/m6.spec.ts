import { expect, test } from '@playwright/test';
import { docPixel, gotoApp, stroke, waitForRender } from './helpers/canvas';

const WHITE = [255, 255, 255, 255];
const RED = [255, 0, 0, 255];
const BLUE = [0, 0, 255, 255];
const BLACK = [0, 0, 0, 255];

test.describe('M6 · 画布尺寸', () => {
  test('放大：背景色填充新增区域、内容左上保留，撤销与重做还原尺寸', async ({ page }) => {
    const errors = await gotoApp(page);

    await page.getByTestId('swatch-0000ff').click({ button: 'right' }); // 背景设蓝
    await page.keyboard.press('l');
    await stroke(page, [
      { x: 50, y: 50 },
      { x: 150, y: 50 },
    ]);
    await waitForRender(page);
    expect(await docPixel(page, 100, 50)).toEqual(BLACK);

    await page.getByRole('button', { name: '图像' }).click();
    await page.getByTestId('menu-image.resize').click();
    const dialog = page.getByTestId('canvas-size-dialog');
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('canvas-width')).toHaveValue('800');
    await expect(page.getByTestId('canvas-height')).toHaveValue('600');
    await page.getByTestId('canvas-width').fill('1000');
    await page.getByTestId('canvas-height').fill('800');
    await page.getByTestId('canvas-size-ok').click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId('status-size')).toHaveText('1000 × 800');
    await waitForRender(page);

    expect(await docPixel(page, 100, 50)).toEqual(BLACK);
    expect(await docPixel(page, 900, 700)).toEqual(BLUE);
    await expect(page.getByTestId('history-item')).toHaveCount(2);
    await expect(page.getByTestId('history-item').last()).toContainText('画布尺寸');

    await page.keyboard.press('Control+z');
    await waitForRender(page);
    await expect(page.getByTestId('status-size')).toHaveText('800 × 600');
    expect(await docPixel(page, 900, 700)).toEqual([]);
    expect(await docPixel(page, 100, 50)).toEqual(BLACK);
    await expect(page.getByTestId('history-item')).toHaveCount(1);

    await page.keyboard.press('Control+Shift+z');
    await waitForRender(page);
    await expect(page.getByTestId('status-size')).toHaveText('1000 × 800');
    expect(await docPixel(page, 900, 700)).toEqual(BLUE);
    await expect(page.getByTestId('history-item')).toHaveCount(2);

    expect(errors).toEqual([]);
  });

  test('缩小：超出部分裁掉，撤销还原原尺寸与内容', async ({ page }) => {
    const errors = await gotoApp(page);

    await page.getByTestId('swatch-ff0000').click({ button: 'right' });
    await page.keyboard.press('r');
    await page.getByTestId('shape-mode-fill').click();
    await stroke(page, [
      { x: 300, y: 300 },
      { x: 350, y: 350 },
    ]);
    await page.getByTestId('swatch-ffffff').click({ button: 'right' });
    await waitForRender(page);

    await page.keyboard.press('Control+e');
    await expect(page.getByTestId('canvas-size-dialog')).toBeVisible();
    await page.getByTestId('canvas-width').fill('400');
    await page.getByTestId('canvas-height').fill('400');
    await page.getByTestId('canvas-size-ok').click();
    await expect(page.getByTestId('status-size')).toHaveText('400 × 400');
    await waitForRender(page);

    expect(await docPixel(page, 320, 320)).toEqual(RED);
    expect(await docPixel(page, 450, 100)).toEqual([]);

    await page.keyboard.press('Control+z');
    await waitForRender(page);
    await expect(page.getByTestId('status-size')).toHaveText('800 × 600');
    expect(await docPixel(page, 320, 320)).toEqual(RED);
    expect(await docPixel(page, 500, 500)).toEqual(WHITE);
    await expect(page.getByTestId('history-item')).toHaveCount(1);

    expect(errors).toEqual([]);
  });

  test('非法尺寸拒绝并提示；取消不生效', async ({ page }) => {
    const errors = await gotoApp(page);

    await page.keyboard.press('Control+e');
    const dialog = page.getByTestId('canvas-size-dialog');
    await expect(dialog).toBeVisible();

    await page.getByTestId('canvas-width').fill('0');
    await page.getByTestId('canvas-size-ok').click();
    await expect(page.getByTestId('toast')).toContainText('画布尺寸需为 1–8192');
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('status-size')).toHaveText('800 × 600');

    await page.getByTestId('canvas-width').fill('9999');
    await page.getByTestId('canvas-size-ok').click();
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('status-size')).toHaveText('800 × 600');

    await page.getByTestId('canvas-width').fill('1000');
    await page.getByTestId('canvas-height').fill('800');
    await page.getByTestId('canvas-size-cancel').click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId('status-size')).toHaveText('800 × 600');
    await expect(page.getByTestId('history-item')).toHaveCount(0);

    expect(errors).toEqual([]);
  });
});
