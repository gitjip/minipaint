import { expect, test } from '@playwright/test';
import {
  canvasToScreen,
  docHash,
  docPixel,
  gotoApp,
  overlayPixelCount,
  selectionState,
  stroke,
  viewportSnapshot,
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

  test('套索剪切：路径包含决定清除像素，粘贴与撤销链还原', async ({ page }) => {
    const errors = await gotoApp(page);

    await drawRedBlock(page, { x: 100, y: 100 }, { x: 160, y: 160 });
    const originalHash = await docHash(page);

    await page.keyboard.press('m');
    await expect(page.getByTestId('properties-body')).toContainText('选区模式');
    await page.getByTestId('select-mode-lasso').click();
    await expect(page.getByTestId('select-mode-lasso')).toHaveClass(/is-active/);

    // 竖条路径 x∈[120,200] 穿过红块：块内 x∈[120,160] 在路径内，x∈[100,120) 在路径外
    await stroke(page, [
      { x: 120, y: 80 },
      { x: 200, y: 80 },
      { x: 200, y: 200 },
      { x: 120, y: 200 },
    ]);
    await waitForRender(page);
    expect((await selectionState(page)).shape).toEqual({ x: 120, y: 80, width: 80, height: 120 });
    await expect(page.getByTestId('properties-body')).toContainText('套索选区');

    await page.keyboard.press('Control+x');
    await waitForRender(page);
    expect(await docPixel(page, 130, 130)).toEqual(WHITE); // 路径内 → 清除
    expect(await docPixel(page, 150, 130)).toEqual(WHITE); // 路径内 → 清除
    expect(await docPixel(page, 110, 130)).toEqual(RED); // 包围盒内但路径外 → 保留
    await expect(page.getByTestId('history-item')).toHaveCount(2);

    await page.keyboard.press('Control+v');
    await expect.poll(async () => (await selectionState(page)).float !== null).toBe(true);
    await page.keyboard.press('Enter');
    await waitForRender(page);
    // 粘贴内容 = 路径内的块部分（相对 x∈[0,40), y∈[20,80)），落于视口左上角 (0,0)
    expect(await docPixel(page, 10, 50)).toEqual(RED);
    expect(await docPixel(page, 110, 130)).toEqual(RED);
    await expect(page.getByTestId('history-item')).toHaveCount(3);

    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+z');
    await waitForRender(page);
    expect(await docHash(page)).toBe(originalHash);
    await expect(page.getByTestId('history-item')).toHaveCount(1);

    expect(errors).toEqual([]);
  });

  test('套索移动：只挖路径内的洞，副本仅含路径内像素，撤销还原', async ({ page }) => {
    const errors = await gotoApp(page);

    await drawRedBlock(page, { x: 100, y: 100 }, { x: 160, y: 160 });
    const hashDrawn = await docHash(page);

    await page.keyboard.press('m');
    await page.getByTestId('select-mode-lasso').click();
    await stroke(page, [
      { x: 120, y: 80 },
      { x: 200, y: 80 },
      { x: 200, y: 200 },
      { x: 120, y: 200 },
    ]);
    await waitForRender(page);

    await stroke(page, [
      { x: 150, y: 130 },
      { x: 350, y: 330 },
    ]);
    await waitForRender(page);

    let state = await selectionState(page);
    expect(state.float).toEqual({ x: 320, y: 280, width: 80, height: 120 });
    expect(await docPixel(page, 130, 130)).toEqual(WHITE); // 路径内挖洞
    expect(await docPixel(page, 110, 130)).toEqual(RED); // 路径外保留
    await expect(page.getByTestId('history-item')).toHaveCount(1);

    await page.keyboard.press('Enter');
    await waitForRender(page);
    expect(await docPixel(page, 330, 330)).toEqual(RED); // 副本 = 块的路径内部分
    expect(await docPixel(page, 130, 130)).toEqual(WHITE);
    expect(await docPixel(page, 110, 130)).toEqual(RED);
    await expect(page.getByTestId('history-item')).toHaveCount(2);

    await page.keyboard.press('Control+z');
    await waitForRender(page);
    expect(await docHash(page)).toBe(hashDrawn);
    await expect(page.getByTestId('history-item')).toHaveCount(1);

    expect(errors).toEqual([]);
  });

  test('裁剪：Esc 取消、Enter 应用，尺寸/状态栏/视口居中一致；点击框内二次确认', async ({
    page,
  }) => {
    const errors = await gotoApp(page);

    await drawRedBlock(page, { x: 100, y: 100 }, { x: 160, y: 160 });
    await expect(page.getByTestId('status-size')).toHaveText('800 × 600');

    await page.keyboard.press('c');
    await expect(page.getByTestId('status-tool')).toHaveText('裁剪');
    await expect(page.getByTestId('tool-crop')).toHaveClass(/is-active/);
    await expect(page.getByTestId('properties-body')).toContainText('拖拽框选');

    await stroke(page, [
      { x: 80, y: 80 },
      { x: 400, y: 300 },
    ]);
    await waitForRender(page);
    expect((await selectionState(page)).shape).toEqual({ x: 80, y: 80, width: 320, height: 220 });

    await page.keyboard.press('Escape');
    await waitForRender(page);
    expect((await selectionState(page)).shape).toBeNull();
    expect((await viewportSnapshot(page)).docW).toBe(800);

    await stroke(page, [
      { x: 80, y: 80 },
      { x: 400, y: 300 },
    ]);
    await waitForRender(page);
    await page.keyboard.press('Enter');
    await waitForRender(page);

    const snapped = await viewportSnapshot(page);
    expect(snapped.docW).toBe(320);
    expect(snapped.docH).toBe(220);
    await expect(page.getByTestId('status-size')).toHaveText('320 × 220');
    await expect(page.getByTestId('status-zoom')).toHaveText('100%');
    expect(snapped.scale).toBeCloseTo(1, 5);
    expect(snapped.offsetX).toBeCloseTo((snapped.viewW - 320) / 2, 5);
    expect(snapped.offsetY).toBeCloseTo((snapped.viewH - 220) / 2, 5);
    // 内容随裁剪平移：原 (100,100)-(160,160) → (20,20)-(80,80)
    expect(await docPixel(page, 30, 30)).toEqual(RED);
    expect(await docPixel(page, 90, 30)).toEqual(WHITE);
    expect((await selectionState(page)).shape).toBeNull();
    await expect(page.getByTestId('history-item')).toHaveCount(0);

    // 二次裁剪：点击框内确认
    await stroke(page, [
      { x: 10, y: 10 },
      { x: 160, y: 100 },
    ]);
    await waitForRender(page);
    expect((await selectionState(page)).shape).toEqual({ x: 10, y: 10, width: 150, height: 90 });
    await stroke(page, [{ x: 80, y: 50 }]);
    await waitForRender(page);
    expect((await viewportSnapshot(page)).docW).toBe(150);
    expect((await viewportSnapshot(page)).docH).toBe(90);
    // 块 (20,20)-(80,80) → (10,10)-(70,70)
    expect(await docPixel(page, 30, 30)).toEqual(RED);
    expect(await docPixel(page, 80, 30)).toEqual(WHITE);
    await expect(page.getByTestId('history-item')).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test('三角套索：蚂蚁线在创建中与成形后可见，移动蒙版裁剪浮离内容', async ({ page }) => {
    const errors = await gotoApp(page);

    await drawRedBlock(page, { x: 100, y: 100 }, { x: 160, y: 160 });
    const hashDrawn = await docHash(page);

    await page.keyboard.press('m');
    await page.getByTestId('select-mode-lasso').click();

    // 手动按住画三角（路径 x+y<260 为内部），松手前先断言创建中的蚂蚁线
    const start = await canvasToScreen(page, 100, 100);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    const cornerB = await canvasToScreen(page, 160, 100);
    await page.mouse.move(cornerB.x, cornerB.y, { steps: 4 });
    const cornerC = await canvasToScreen(page, 100, 160);
    await page.mouse.move(cornerC.x, cornerC.y, { steps: 4 });
    await waitForRender(page);
    expect(await overlayPixelCount(page)).toBeGreaterThan(0); // 创建中可见（回归：曾漏 stroke）
    await page.mouse.up();
    await waitForRender(page);
    expect(await overlayPixelCount(page)).toBeGreaterThan(0); // 成形后可见
    expect((await selectionState(page)).shape).toEqual({ x: 100, y: 100, width: 60, height: 60 });

    // 拖路径内 (110,110)：洞只挖路径内，包围盒内路径外的 (150,150) 保留
    await stroke(page, [
      { x: 110, y: 110 },
      { x: 310, y: 310 },
    ]);
    await waitForRender(page);
    let state = await selectionState(page);
    expect(state.float).toEqual({ x: 300, y: 300, width: 60, height: 60 });
    expect(await docPixel(page, 110, 110)).toEqual(WHITE); // 路径内挖洞
    expect(await docPixel(page, 150, 150)).toEqual(RED); // 路径外保留
    await expect(page.getByTestId('history-item')).toHaveCount(1);

    await page.keyboard.press('Enter');
    await waitForRender(page);
    expect(await docPixel(page, 310, 310)).toEqual(RED); // 路径内内容落定
    // 回归：浮离提取漏 fill 时整块包围盒都会被拷走，此像素会变红
    expect(await docPixel(page, 350, 350)).toEqual(WHITE); // 包围盒内但路径外 → 未拷贝
    expect(await docPixel(page, 150, 150)).toEqual(RED); // 原位路径外不受影响
    await expect(page.getByTestId('history-item')).toHaveCount(2);

    await page.keyboard.press('Control+z');
    await waitForRender(page);
    expect(await docHash(page)).toBe(hashDrawn);
    await expect(page.getByTestId('history-item')).toHaveCount(1);

    expect(errors).toEqual([]);
  });

  test('三角套索：剪切清路径内、粘贴仅含路径内像素', async ({ page }) => {
    const errors = await gotoApp(page);

    await drawRedBlock(page, { x: 100, y: 100 }, { x: 160, y: 160 });
    const originalHash = await docHash(page);

    await page.keyboard.press('m');
    await page.getByTestId('select-mode-lasso').click();
    await stroke(page, [
      { x: 100, y: 100 },
      { x: 160, y: 100 },
      { x: 100, y: 160 },
    ]);
    await waitForRender(page);
    expect((await selectionState(page)).shape).toEqual({ x: 100, y: 100, width: 60, height: 60 });

    await page.keyboard.press('Control+x');
    await waitForRender(page);
    expect(await docPixel(page, 110, 110)).toEqual(WHITE); // 路径内清除
    expect(await docPixel(page, 150, 150)).toEqual(RED); // 包围盒内路径外保留
    await expect(page.getByTestId('history-item')).toHaveCount(2);

    await page.keyboard.press('Control+v');
    await expect.poll(async () => (await selectionState(page)).float !== null).toBe(true);
    await page.keyboard.press('Enter');
    await waitForRender(page);
    expect(await docPixel(page, 10, 10)).toEqual(RED); // 粘贴内容 = 路径内的块部分
    // 回归：extract 蒙版漏 fill 时会把包围盒整块复制，此像素会变红
    expect(await docPixel(page, 50, 50)).toEqual(WHITE); // 包围盒内路径外 → 未复制
    expect(await docPixel(page, 150, 150)).toEqual(RED);
    await expect(page.getByTestId('history-item')).toHaveCount(3);

    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+z');
    await waitForRender(page);
    expect(await docHash(page)).toBe(originalHash);
    await expect(page.getByTestId('history-item')).toHaveCount(1);

    expect(errors).toEqual([]);
  });
});
