import { expect, test } from '@playwright/test';
import {
  canvasToScreen,
  docHash,
  docPixel,
  gotoApp,
  selectionState,
  stroke,
  waitForRender,
} from './helpers/canvas';

const WHITE = [255, 255, 255, 255];
const RED = [255, 0, 0, 255];

/** 绘制红色实心块并把背景切回白色（移动挖洞用）。 */
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

test.describe('M3 · 选区与剪贴板', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('矩形选框：拖拽建立、蚂蚁线覆盖层、点击空白取消', async ({ page }) => {
    const errors = await gotoApp(page);

    await page.keyboard.press('m');
    await expect(page.getByTestId('status-tool')).toHaveText('选择');
    await expect(page.getByTestId('tool-select')).toHaveClass(/is-active/);
    await expect(page.getByTestId('properties-body')).toContainText('矩形选框');

    await stroke(page, [
      { x: 200, y: 150 },
      { x: 320, y: 250 },
    ]);
    await waitForRender(page);

    expect(await selectionState(page)).toEqual({
      shape: { x: 200, y: 150, width: 120, height: 100 },
      float: null,
    });
    await expect(page.getByTestId('properties-body')).toContainText('120×100');
    await expect(page.getByTestId('history-item')).toHaveCount(0);

    const antPixels = await page.evaluate(() => {
      const editor = (window as unknown as { minipaint: import('../src/app/Editor').Editor })
        .minipaint;
      const overlay = editor.ui.overlayLayer;
      const ctx = overlay.getContext('2d')!;
      const data = ctx.getImageData(0, 0, overlay.width, overlay.height).data;
      let count = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) count++;
      return count;
    });
    expect(antPixels).toBeGreaterThan(0);

    await stroke(page, [{ x: 600, y: 450 }]);
    await waitForRender(page);
    expect((await selectionState(page)).shape).toBeNull();
    await expect(page.getByTestId('history-item')).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test('选区内拖拽移动：浮离先于历史，Enter 落定后可撤销还原', async ({ page }) => {
    const errors = await gotoApp(page);

    await drawRedBlock(page, { x: 100, y: 100 }, { x: 160, y: 160 });
    expect(await docPixel(page, 130, 130)).toEqual(RED);
    await expect(page.getByTestId('history-item')).toHaveCount(1);
    const hashDrawn = await docHash(page);

    await page.keyboard.press('m');
    await stroke(page, [
      { x: 100, y: 100 },
      { x: 160, y: 160 },
    ]);
    // Ctrl+拖拽 = 移动（与普通拖拽等价，按需求显式覆盖）
    await page.keyboard.down('Control');
    await stroke(page, [
      { x: 130, y: 130 },
      { x: 230, y: 230 },
    ]);
    await page.keyboard.up('Control');
    await waitForRender(page);

    let state = await selectionState(page);
    expect(state.float).toEqual({ x: 200, y: 200, width: 60, height: 60 });
    expect(await docPixel(page, 130, 130)).toEqual(WHITE);
    expect(await docPixel(page, 230, 230)).toEqual(WHITE);
    await expect(page.getByTestId('history-item')).toHaveCount(1);

    await page.keyboard.press('Enter');
    await waitForRender(page);
    expect(await docPixel(page, 230, 230)).toEqual(RED);
    expect(await docPixel(page, 130, 130)).toEqual(WHITE);
    await expect(page.getByTestId('history-item')).toHaveCount(2);
    state = await selectionState(page);
    expect(state.float).toBeNull();
    expect(state.shape).toEqual({ x: 200, y: 200, width: 60, height: 60 });

    await page.keyboard.press('Control+z');
    await waitForRender(page);
    expect(await docPixel(page, 230, 230)).toEqual(WHITE);
    expect(await docPixel(page, 130, 130)).toEqual(RED);
    expect(await docHash(page)).toBe(hashDrawn);

    expect(errors).toEqual([]);
  });

  test('Alt 复制拖拽：原文保留，副本落定入历史', async ({ page }) => {
    const errors = await gotoApp(page);

    await drawRedBlock(page, { x: 100, y: 100 }, { x: 160, y: 160 });
    const hashDrawn = await docHash(page);

    await page.keyboard.press('m');
    await stroke(page, [
      { x: 100, y: 100 },
      { x: 160, y: 160 },
    ]);

    await page.keyboard.down('Alt');
    await stroke(page, [
      { x: 130, y: 130 },
      { x: 320, y: 180 },
    ]);
    await page.keyboard.up('Alt');
    await waitForRender(page);

    let state = await selectionState(page);
    expect(state.float).toEqual({ x: 290, y: 150, width: 60, height: 60 });
    expect(await docPixel(page, 110, 110)).toEqual(RED);
    await expect(page.getByTestId('history-item')).toHaveCount(1);

    await page.keyboard.press('Enter');
    await waitForRender(page);
    expect(await docPixel(page, 300, 160)).toEqual(RED);
    expect(await docPixel(page, 110, 110)).toEqual(RED);
    await expect(page.getByTestId('history-item')).toHaveCount(2);

    await page.keyboard.press('Control+z');
    await waitForRender(page);
    expect(await docPixel(page, 300, 160)).toEqual(WHITE);
    expect(await docHash(page)).toBe(hashDrawn);

    expect(errors).toEqual([]);
  });

  test('主链：选区 → 复制 → 粘贴(视口左上角浮离) → 移动 → 落定 → Delete → 撤销链逐像素还原', async ({
    page,
  }) => {
    const errors = await gotoApp(page);

    await drawRedBlock(page, { x: 100, y: 100 }, { x: 160, y: 160 });
    const originalHash = await docHash(page);
    await expect(page.getByTestId('history-item')).toHaveCount(1);

    await page.keyboard.press('m');
    await stroke(page, [
      { x: 100, y: 100 },
      { x: 160, y: 160 },
    ]);
    await page.keyboard.press('Control+c');
    await page.keyboard.press('Control+v');
    await expect
      .poll(async () => (await selectionState(page)).float !== null)
      .toBe(true);

    const expectedPaste = await page.evaluate(() => {
      const editor = (window as unknown as { minipaint: import('../src/app/Editor').Editor })
        .minipaint;
      const float = editor.selection.float!;
      const topLeft = editor.viewport.screenToCanvas(0, 0);
      const w = float.canvas.width;
      const h = float.canvas.height;
      return {
        x: Math.max(0, Math.min(editor.document.width - w, Math.round(topLeft.x))),
        y: Math.max(0, Math.min(editor.document.height - h, Math.round(topLeft.y))),
        width: w,
        height: h,
      };
    });
    expect(await selectionState(page)).toEqual({ shape: expectedPaste, float: expectedPaste });
    await expect(page.getByTestId('history-item')).toHaveCount(1);

    const centerX = expectedPaste.x + expectedPaste.width / 2;
    const centerY = expectedPaste.y + expectedPaste.height / 2;
    await stroke(page, [
      { x: centerX, y: centerY },
      { x: 450, y: 400 },
    ]);
    await waitForRender(page);
    let state = await selectionState(page);
    expect(state.float).toEqual({ x: 420, y: 370, width: 60, height: 60 });

    await stroke(page, [{ x: 700, y: 560 }]);
    await waitForRender(page);
    await expect(page.getByTestId('history-item')).toHaveCount(2);
    state = await selectionState(page);
    expect(state.float).toBeNull();
    expect(state.shape).toEqual({ x: 420, y: 370, width: 60, height: 60 });
    expect(await docPixel(page, 430, 410)).toEqual(RED);
    expect(await docPixel(page, 110, 110)).toEqual(RED);

    await page.keyboard.press('Delete');
    await waitForRender(page);
    expect(await docPixel(page, 430, 410)).toEqual(WHITE);
    expect(await docPixel(page, 110, 110)).toEqual(RED);
    await expect(page.getByTestId('history-item')).toHaveCount(3);
    const afterDeleteHash = await docHash(page);

    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+z');
    await waitForRender(page);
    expect(await docHash(page)).toBe(originalHash);
    await expect(page.getByTestId('history-item')).toHaveCount(1);

    await page.keyboard.press('Control+y');
    await page.keyboard.press('Control+y');
    await waitForRender(page);
    expect(await docHash(page)).toBe(afterDeleteHash);
    await expect(page.getByTestId('history-item')).toHaveCount(3);

    expect(errors).toEqual([]);
  });

  test('Ctrl+A 全选后 Delete 清空，撤销逐像素还原；菜单随选区启停', async ({ page }) => {
    const errors = await gotoApp(page);

    await drawRedBlock(page, { x: 100, y: 100 }, { x: 160, y: 160 });
    const hashDrawn = await docHash(page);

    await page.getByRole('button', { name: '编辑' }).click();
    await expect(page.getByTestId('menu-edit.cut')).toBeDisabled();
    await expect(page.getByTestId('menu-edit.copy')).toBeDisabled();
    await expect(page.getByTestId('menu-edit.delete')).toBeDisabled();
    await page.keyboard.press('Escape');

    await page.keyboard.press('Control+a');
    await waitForRender(page);
    expect((await selectionState(page)).shape).toEqual({ x: 0, y: 0, width: 800, height: 600 });

    await page.getByRole('button', { name: '编辑' }).click();
    await expect(page.getByTestId('menu-edit.cut')).toBeEnabled();
    await expect(page.getByTestId('menu-edit.delete')).toBeEnabled();
    await page.keyboard.press('Escape');

    await page.keyboard.press('Delete');
    await waitForRender(page);
    expect(await docPixel(page, 400, 300)).toEqual(WHITE);
    expect(await docPixel(page, 799, 599)).toEqual(WHITE);
    expect(await docPixel(page, 0, 0)).toEqual(WHITE);
    await expect(page.getByTestId('history-item')).toHaveCount(2);

    await page.keyboard.press('Control+z');
    await waitForRender(page);
    expect(await docHash(page)).toBe(hashDrawn);

    expect(errors).toEqual([]);
  });

  test('Esc：取消进行中的选区拖拽 / 取消粘贴浮离，均不入历史', async ({ page }) => {
    const errors = await gotoApp(page);

    await page.keyboard.press('m');
    const down = await canvasToScreen(page, 100, 100);
    await page.mouse.move(down.x, down.y);
    await page.mouse.down();
    const move = await canvasToScreen(page, 300, 280);
    await page.mouse.move(move.x, move.y, { steps: 8 });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await waitForRender(page);

    expect((await selectionState(page)).shape).toBeNull();
    await expect(page.getByTestId('history-item')).toHaveCount(0);

    await drawRedBlock(page, { x: 100, y: 100 }, { x: 160, y: 160 });
    const hashDrawn = await docHash(page);
    await page.keyboard.press('m');
    await stroke(page, [
      { x: 100, y: 100 },
      { x: 160, y: 160 },
    ]);
    await page.keyboard.press('Control+c');
    await page.keyboard.press('Control+v');
    await expect.poll(async () => (await selectionState(page)).float !== null).toBe(true);

    await page.keyboard.press('Escape');
    await waitForRender(page);
    expect(await selectionState(page)).toEqual({ shape: null, float: null });
    await expect(page.getByTestId('history-item')).toHaveCount(1);
    expect(await docHash(page)).toBe(hashDrawn);

    expect(errors).toEqual([]);
  });

  test('剪切：区域清空入历史，粘贴回视口左上角，撤销链还原', async ({ page }) => {
    const errors = await gotoApp(page);

    await drawRedBlock(page, { x: 100, y: 100 }, { x: 160, y: 160 });
    const originalHash = await docHash(page);

    await page.keyboard.press('m');
    await stroke(page, [
      { x: 100, y: 100 },
      { x: 160, y: 160 },
    ]);
    await page.keyboard.press('Control+x');
    await waitForRender(page);
    expect(await docPixel(page, 130, 130)).toEqual(WHITE);
    await expect(page.getByTestId('history-item')).toHaveCount(2);

    await page.keyboard.press('Control+v');
    await expect.poll(async () => (await selectionState(page)).float !== null).toBe(true);
    const float = (await selectionState(page)).float!;
    expect(float.width).toBe(60);
    expect(float.height).toBe(60);
    await expect(page.getByTestId('history-item')).toHaveCount(2);

    await page.keyboard.press('Enter');
    await waitForRender(page);
    expect(await docPixel(page, float.x + 10, float.y + 10)).toEqual(RED);
    await expect(page.getByTestId('history-item')).toHaveCount(3);

    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+z');
    await waitForRender(page);
    expect(await docHash(page)).toBe(originalHash);
    await expect(page.getByTestId('history-item')).toHaveCount(1);

    await page.keyboard.press('Control+z');
    await waitForRender(page);
    expect(await docHash(page)).not.toBe(originalHash);
    await expect(page.getByTestId('history-item')).toHaveCount(0);

    expect(errors).toEqual([]);
  });
});
