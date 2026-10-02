import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { docHash, docPixel, gotoApp, selectionState, stroke, waitForRender } from './helpers/canvas';

const WHITE = [255, 255, 255, 255];
const RED = [255, 0, 0, 255];
const BLUE = [0, 0, 255, 255];

const FIXTURE = join(process.cwd(), 'e2e', 'fixtures', 'm4-pattern.png');
const FIXTURE_BASE64 = readFileSync(FIXTURE).toString('base64');

async function waitForApp(page: Parameters<typeof gotoApp>[0]): Promise<void> {
  await page.waitForFunction(
    () => Boolean((window as unknown as { minipaint?: unknown }).minipaint),
  );
}

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

test.describe('M4 · 文本与文件', () => {
  test('文本工具：点击输入、回车栅格化入历史、撤销逐像素还原', async ({ page }) => {
    const errors = await gotoApp(page);
    const before = await docHash(page);

    await page.keyboard.press('t');
    await expect(page.getByTestId('status-tool')).toHaveText('文本');
    await expect(page.getByTestId('tool-text')).toHaveClass(/is-active/);
    await expect(page.getByTestId('properties-body')).toContainText('字体');
    await expect(page.getByTestId('font-size-24')).toHaveClass(/is-active/);

    await page.getByTestId('swatch-ff0000').click();
    await expect(page.getByTestId('color-fg-input')).toHaveValue('#ff0000');

    await stroke(page, [{ x: 200, y: 200 }]);
    const input = page.getByTestId('text-input');
    await expect(input).toBeVisible();
    await input.fill('Hi');
    await page.keyboard.press('Enter');
    await expect(input).toHaveCount(0);
    await waitForRender(page);

    await expect(page.getByTestId('history-item')).toHaveCount(1);
    await expect(page.getByTestId('history-item').first()).toContainText('文本');
    expect(await docPixel(page, 400, 400)).toEqual(WHITE);
    const redPixels = await page.evaluate(() => {
      const editor = (window as unknown as { minipaint: import('../src/app/Editor').Editor })
        .minipaint;
      const data = editor.document.ctx.getImageData(200, 200, 140, 40).data;
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 200 && data[i + 1] < 60 && data[i + 2] < 60) count++;
      }
      return count;
    });
    expect(redPixels).toBeGreaterThan(0);

    await page.keyboard.press('Control+z');
    await waitForRender(page);
    expect(await docHash(page)).toBe(before);
    await expect(page.getByTestId('history-item')).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test('文本工具：Esc 取消不改文档，点击工具按钮失焦自动落定', async ({ page }) => {
    const errors = await gotoApp(page);
    const before = await docHash(page);

    await page.keyboard.press('t');
    await stroke(page, [{ x: 300, y: 300 }]);
    await page.getByTestId('text-input').fill('X');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('text-input')).toHaveCount(0);
    await expect(page.getByTestId('history-item')).toHaveCount(0);
    expect(await docHash(page)).toBe(before);

    await stroke(page, [{ x: 300, y: 300 }]);
    await page.getByTestId('text-input').fill('Y');
    await page.getByTestId('tool-brush').click();
    await expect(page.getByTestId('text-input')).toHaveCount(0);
    await expect(page.getByTestId('status-tool')).toHaveText('画笔');
    await expect(page.getByTestId('history-item')).toHaveCount(1);
    expect(await docHash(page)).not.toBe(before);

    expect(errors).toEqual([]);
  });

  test('打开：setInputFiles 载入 fixture，尺寸更新且像素匹配', async ({ page }) => {
    const errors = await gotoApp(page);

    await page.setInputFiles('[data-testid="file-input"]', FIXTURE);
    await expect(page.getByTestId('status-size')).toHaveText('6 × 4');
    await expect(page.getByTestId('history-item')).toHaveCount(0);

    expect(await docPixel(page, 0, 0)).toEqual(RED);
    expect(await docPixel(page, 2, 0)).toEqual(RED);
    expect(await docPixel(page, 3, 0)).toEqual(BLUE);
    expect(await docPixel(page, 5, 3)).toEqual(BLUE);
    expect(await docPixel(page, 0, 3)).toEqual(RED);
    expect((await docPixel(page, 1, 1)).length).toBe(4);

    expect(errors).toEqual([]);
  });

  test('拖拽导入：drop 图片文件替换文档', async ({ page }) => {
    const errors = await gotoApp(page);

    await page.evaluate((base64) => {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const file = new File([bytes], 'm4-pattern.png', { type: 'image/png' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      const view = document.querySelector('[data-testid="viewport"]')!;
      view.dispatchEvent(new DragEvent('drop', { dataTransfer, bubbles: true, cancelable: true }));
    }, FIXTURE_BASE64);

    await expect(page.getByTestId('status-size')).toHaveText('6 × 4');
    expect(await docPixel(page, 3, 1)).toEqual(BLUE);
    expect(await docPixel(page, 0, 1)).toEqual(RED);

    expect(errors).toEqual([]);
  });

  test('粘贴图片：paste 事件携带文件 → 浮离而非替换文档', async ({ page }) => {
    const errors = await gotoApp(page);
    const before = await docHash(page);

    await page.evaluate((base64) => {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const file = new File([bytes], 'pasted.png', { type: 'image/png' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      document.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: dataTransfer, bubbles: true, cancelable: true }),
      );
    }, FIXTURE_BASE64);

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
    expect(await docPixel(page, float.x + 3, float.y)).toEqual(BLUE);

    expect(errors).toEqual([]);
  });

  test('草稿恢复：编辑后 reload 出现提示，恢复后像素一致', async ({ page }) => {
    const errors = await gotoApp(page);

    await drawRedBlock(page, { x: 100, y: 100 }, { x: 160, y: 160 });
    const hashDrawn = await docHash(page);

    await page.waitForTimeout(2400); // 防抖 2s 落盘
    await page.reload();
    await waitForApp(page);
    await expect(page.getByTestId('draft-prompt')).toBeVisible();
    await page.getByTestId('draft-restore').click();
    await expect(page.getByTestId('draft-prompt')).toHaveCount(0);

    expect(await docHash(page)).toBe(hashDrawn);
    expect(await docPixel(page, 130, 130)).toEqual(RED);
    await expect(page.getByTestId('history-item')).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test('草稿丢弃：回到原始状态且再次启动不再提示', async ({ page }) => {
    const errors = await gotoApp(page);
    const blankHash = await docHash(page);

    await drawRedBlock(page, { x: 100, y: 100 }, { x: 160, y: 160 });
    await page.waitForTimeout(2400);
    await page.reload();
    await waitForApp(page);
    await expect(page.getByTestId('draft-prompt')).toBeVisible();
    await page.getByTestId('draft-discard').click();
    await expect(page.getByTestId('draft-prompt')).toHaveCount(0);

    expect(await docHash(page)).toBe(blankHash);
    expect(await docPixel(page, 130, 130)).toEqual(WHITE);

    await page.reload();
    await waitForApp(page);
    await page.waitForTimeout(800);
    await expect(page.getByTestId('draft-prompt')).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test('损坏文件：给出错误提示且当前文档不受影响', async ({ page }) => {
    const errors = await gotoApp(page);

    await drawRedBlock(page, { x: 100, y: 100 }, { x: 160, y: 160 });
    const hashDrawn = await docHash(page);

    await page.setInputFiles('[data-testid="file-input"]', {
      name: 'broken.png',
      mimeType: 'image/png',
      buffer: Buffer.from('这不是一张图片，只是坏文件'),
    });
    await expect(page.getByTestId('toast')).toContainText('打开失败');

    expect(await docHash(page)).toBe(hashDrawn);
    await expect(page.getByTestId('status-size')).toHaveText('800 × 600');
    await expect(page.getByTestId('history-item')).toHaveCount(1);

    expect(errors).toEqual([]);
  });

  test('导出 JPEG / WebP：触发下载', async ({ page }) => {
    const errors = await gotoApp(page);

    const jpegPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '文件' }).click();
    await page.getByTestId('menu-file.exportJpeg').click();
    const jpeg = await jpegPromise;
    expect(jpeg.suggestedFilename()).toBe('minipaint-800x600.jpg');
    expect(await jpeg.path()).toBeTruthy();

    const webpPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '文件' }).click();
    await page.getByTestId('menu-file.exportWebp').click();
    const webp = await webpPromise;
    expect(webp.suggestedFilename()).toBe('minipaint-800x600.webp');
    expect(await webp.path()).toBeTruthy();

    expect(errors).toEqual([]);
  });
});
