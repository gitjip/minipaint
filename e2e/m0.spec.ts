import { expect, test } from '@playwright/test';
import {
  docPixel,
  gotoApp,
  screenToCanvas,
  viewportSnapshot,
  waitForRender,
} from './helpers/canvas';

test.describe('M0 · 画布与视口', () => {
  test('初始文档 800×600，白色背景，状态栏显示尺寸与缩放', async ({ page }) => {
    const errors = await gotoApp(page);

    await expect(page.getByTestId('status-size')).toHaveText('800 × 600');
    await expect(page.getByTestId('status-zoom')).toHaveText('100%');
    expect(await docPixel(page, 0, 0)).toEqual([255, 255, 255, 255]);
    expect(await docPixel(page, 799, 599)).toEqual([255, 255, 255, 255]);

    expect(errors).toEqual([]);
  });

  test('鼠标移动实时显示画布坐标，离开画布复位', async ({ page }) => {
    const errors = await gotoApp(page);

    await page.mouse.move(640, 400);
    const expected = await screenToCanvas(page, 640, 400);
    await expect(page.getByTestId('status-coords')).toHaveText(
      `(${Math.floor(expected.x)}, ${Math.floor(expected.y)})`,
    );

    await page.mouse.move(640, 790);
    await expect(page.getByTestId('status-coords')).toHaveText('(-, -)');

    expect(errors).toEqual([]);
  });

  test('滚轮缩放以光标为中心，锚点画布坐标不漂移', async ({ page }) => {
    const errors = await gotoApp(page);

    await page.mouse.move(600, 350);
    const before = await screenToCanvas(page, 600, 350);
    const stateBefore = await viewportSnapshot(page);

    await page.mouse.wheel(0, -240);
    await waitForRender(page);

    const after = await screenToCanvas(page, 600, 350);
    const stateAfter = await viewportSnapshot(page);

    expect(stateAfter.scale).toBeGreaterThan(stateBefore.scale);
    expect(Math.abs(after.x - before.x)).toBeLessThan(0.5);
    expect(Math.abs(after.y - before.y)).toBeLessThan(0.5);
    expect(await page.getByTestId('status-zoom').textContent()).not.toBe('100%');

    expect(errors).toEqual([]);
  });

  test('空格 + 拖拽平移视口', async ({ page }) => {
    const errors = await gotoApp(page);

    const before = await viewportSnapshot(page);
    await page.keyboard.down('Space');
    await page.mouse.move(600, 400);
    await page.mouse.down();
    await page.mouse.move(700, 450, { steps: 5 });
    await page.mouse.up();
    await page.keyboard.up('Space');
    await waitForRender(page);

    const after = await viewportSnapshot(page);
    expect(after.offsetX - before.offsetX).toBeCloseTo(100, 5);
    expect(after.offsetY - before.offsetY).toBeCloseTo(50, 5);
    expect(after.scale).toBe(before.scale);

    expect(errors).toEqual([]);
  });

  test('Ctrl+0 适应窗口：文档完整可见并居中', async ({ page }) => {
    const errors = await gotoApp(page);

    await page.mouse.move(600, 350);
    await page.mouse.wheel(0, -400);
    await page.keyboard.down('Space');
    await page.mouse.move(600, 400);
    await page.mouse.down();
    await page.mouse.move(760, 520, { steps: 4 });
    await page.mouse.up();
    await page.keyboard.up('Space');

    await page.keyboard.press('Control+0');
    await waitForRender(page);

    const state = await viewportSnapshot(page);
    expect(state.scale * state.docW).toBeLessThanOrEqual(state.viewW + 0.5);
    expect(state.scale * state.docH).toBeLessThanOrEqual(state.viewH + 0.5);
    expect(state.offsetX).toBeCloseTo((state.viewW - state.docW * state.scale) / 2, 3);
    expect(state.offsetY).toBeCloseTo((state.viewH - state.docH * state.scale) / 2, 3);
    await expect(page.getByTestId('status-zoom')).toHaveText('100%');

    expect(errors).toEqual([]);
  });

  test('查看菜单点击「适应窗口」生效', async ({ page }) => {
    const errors = await gotoApp(page);

    await page.mouse.move(600, 350);
    await page.mouse.wheel(0, -400);

    await page.getByRole('button', { name: '查看' }).click();
    await page.getByRole('button', { name: /^适应窗口/ }).click();
    await waitForRender(page);

    const state = await viewportSnapshot(page);
    expect(state.scale * state.docW).toBeLessThanOrEqual(state.viewW + 0.5);
    expect(state.offsetX).toBeCloseTo((state.viewW - state.docW * state.scale) / 2, 3);

    expect(errors).toEqual([]);
  });

  test('8192×8192 新建画布不卡死，状态栏更新', async ({ page }) => {
    const errors = await gotoApp(page);

    const elapsed = await page.evaluate(() => {
      const editor = (window as unknown as { minipaint: { newDocument(w: number, h: number): void } })
        .minipaint;
      const start = performance.now();
      editor.newDocument(8192, 8192);
      return performance.now() - start;
    });
    await waitForRender(page);

    expect(elapsed).toBeLessThan(1000);
    await expect(page.getByTestId('status-size')).toHaveText('8192 × 8192');
    expect(await docPixel(page, 4096, 4096)).toEqual([255, 255, 255, 255]);

    expect(errors).toEqual([]);
  });

  test('新会话全程无 console 错误', async ({ page }) => {
    const errors = await gotoApp(page);

    await page.mouse.move(640, 400);
    await page.mouse.wheel(0, -120);
    await page.keyboard.press('Control+0');
    await page.getByRole('button', { name: '文件' }).click();
    await page.keyboard.press('Escape');
    await waitForRender(page);

    expect(errors).toEqual([]);
  });
});
