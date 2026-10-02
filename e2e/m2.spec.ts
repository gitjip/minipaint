import { expect, test, type Page } from '@playwright/test';
import { docPixel, canvasToScreen, gotoApp, stroke, waitForRender } from './helpers/canvas';
import type { Editor } from '../src/app/Editor';

const WHITE = [255, 255, 255, 255];
const BLACK = [0, 0, 0, 255];
const RED = [255, 0, 0, 255];
const BLUE = [0, 0, 255, 255];

interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 精确缩放到目标倍数（绕视口原点缩放），并让文档点位于视口中心。 */
async function zoomAndCenter(page: Page, scale: number, center: { x: number; y: number }): Promise<void> {
  await page.evaluate(
    ([target, cx, cy]) => {
      const editor = (window as unknown as { minipaint: Editor }).minipaint;
      const current = editor.viewport.scale;
      if (current !== target) editor.zoomAt(0, 0, target / current);
      const screen = editor.viewport.canvasToScreen(cx, cy);
      editor.viewport.panBy(editor.viewport.viewW / 2 - screen.x, editor.viewport.viewH / 2 - screen.y);
      editor.afterViewportChange();
    },
    [scale, center.x, center.y] as [number, number, number],
  );
  await waitForRender(page);
}

/** 扫描区域内非纯白像素的包围盒（文档坐标），全白返回 null。 */
async function bboxIn(page: Page, region: Region): Promise<Region | null> {
  return page.evaluate((r: Region) => {
    const editor = (window as unknown as { minipaint: Editor }).minipaint;
    const image = editor.document.ctx.getImageData(r.x, r.y, r.width, r.height);
    const { data } = image;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < r.height; y++) {
      for (let x = 0; x < r.width; x++) {
        const i = (y * r.width + x) * 4;
        if (data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null;
    return { x: r.x + minX, y: r.y + minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  }, region);
}

/** Shift 按住完成一次拖拽。 */
async function shiftStroke(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  const start = await canvasToScreen(page, from.x, from.y);
  await page.mouse.move(start.x, start.y);
  await page.keyboard.down('Shift');
  await page.mouse.down();
  const end = await canvasToScreen(page, to.x, to.y);
  await page.mouse.move(end.x, end.y, { steps: 10 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
}

test.describe('M2 · 形状与填充', () => {
  test('Shift 正方形约束在 100% / 50% / 200% 缩放下等宽高', async ({ page }) => {
    const errors = await gotoApp(page);

    await page.getByTestId('tool-rect').click();
    await expect(page.getByTestId('status-tool')).toHaveText('矩形');

    const cases = [
      {
        scale: 1,
        from: { x: 150, y: 150 },
        to: { x: 280, y: 220 },
        region: { x: 130, y: 130, width: 175, height: 175 },
        zoomText: '100%',
      },
      {
        scale: 0.5,
        from: { x: 420, y: 150 },
        to: { x: 550, y: 220 },
        region: { x: 400, y: 130, width: 175, height: 175 },
        zoomText: '50%',
      },
      {
        scale: 2,
        from: { x: 300, y: 350 },
        to: { x: 430, y: 420 },
        region: { x: 280, y: 330, width: 175, height: 175 },
        zoomText: '200%',
      },
    ];

    const sizes: { width: number; height: number }[] = [];
    for (const item of cases) {
      const center = { x: (item.from.x + item.to.x) / 2, y: (item.from.y + item.to.y) / 2 };
      await zoomAndCenter(page, item.scale, center);
      await expect(page.getByTestId('status-zoom')).toHaveText(item.zoomText);
      await shiftStroke(page, item.from, item.to);
      await waitForRender(page);
      const box = await bboxIn(page, item.region);
      expect(box, `缩放 ${item.zoomText} 下应画出图形`).not.toBeNull();
      expect(box!.width).toBe(box!.height);
      sizes.push({ width: box!.width, height: box!.height });
    }

    expect(sizes[1]).toEqual(sizes[0]);
    expect(sizes[2]).toEqual(sizes[0]);
    expect(sizes[0].width).toBeGreaterThanOrEqual(132);

    expect(errors).toEqual([]);
  });

  test('矩形填充模式：内部为背景色、外部不变、1 条历史', async ({ page }) => {
    const errors = await gotoApp(page);

    await page.getByTestId('tool-rect').click();
    await page.getByTestId('swatch-0000ff').click({ button: 'right' });
    await expect(page.getByTestId('color-bg-input')).toHaveValue('#0000ff');
    await page.getByTestId('shape-mode-fill').click();

    await stroke(page, [
      { x: 200, y: 200 },
      { x: 320, y: 280 },
    ]);
    await waitForRender(page);

    expect(await docPixel(page, 260, 240)).toEqual(BLUE);
    expect(await docPixel(page, 200, 200)).toEqual(BLUE);
    expect(await docPixel(page, 350, 300)).toEqual(WHITE);
    await expect(page.getByTestId('history-item')).toHaveCount(1);

    await page.keyboard.press('Control+z');
    await waitForRender(page);
    expect(await docPixel(page, 260, 240)).toEqual(WHITE);

    expect(errors).toEqual([]);
  });

  test('油漆桶：封闭区域不泄漏，破口后按 4 连通泄漏到外部', async ({ page }) => {
    const errors = await gotoApp(page);

    await page.getByTestId('tool-rect').click();
    await stroke(page, [
      { x: 200, y: 200 },
      { x: 340, y: 300 },
    ]);
    await waitForRender(page);

    await page.getByTestId('swatch-ff0000').click();
    await page.getByTestId('tool-bucket').click();
    await expect(page.getByTestId('status-tool')).toHaveText('填充');
    await stroke(page, [{ x: 270, y: 250 }]);
    await waitForRender(page);

    expect(await docPixel(page, 270, 250)).toEqual(RED);
    expect(await docPixel(page, 320, 280)).toEqual(RED);
    expect(await docPixel(page, 200, 250)).toEqual(BLACK);
    expect(await docPixel(page, 150, 250)).toEqual(WHITE);
    expect(await docPixel(page, 600, 450)).toEqual(WHITE);
    await expect(page.getByTestId('history-item')).toHaveCount(2);

    await page.getByTestId('tool-eraser').click();
    await stroke(page, [
      { x: 260, y: 200 },
      { x: 280, y: 200 },
    ]);
    await waitForRender(page);
    expect(await docPixel(page, 270, 200)).toEqual(WHITE);

    await page.getByTestId('swatch-ff0000').click();
    await page.getByTestId('tool-bucket').click();
    await stroke(page, [{ x: 150, y: 150 }]);
    await waitForRender(page);

    expect(await docPixel(page, 150, 150)).toEqual(RED);
    expect(await docPixel(page, 270, 250)).toEqual(RED);
    expect(await docPixel(page, 200, 260)).toEqual(BLACK);
    await expect(page.getByTestId('history-item')).toHaveCount(4);

    expect(errors).toEqual([]);
  });

  test('油漆桶：空白画布按图像边界填充整幅，Ctrl+Z 恢复', async ({ page }) => {
    const errors = await gotoApp(page);

    await page.getByTestId('swatch-ff0000').click();
    await page.getByTestId('tool-bucket').click();
    await stroke(page, [{ x: 0, y: 0 }]);
    await waitForRender(page);

    expect(await docPixel(page, 0, 0)).toEqual(RED);
    expect(await docPixel(page, 799, 599)).toEqual(RED);
    expect(await docPixel(page, 400, 300)).toEqual(RED);
    await expect(page.getByTestId('history-item')).toHaveCount(1);

    await page.keyboard.press('Control+z');
    await waitForRender(page);
    expect(await docPixel(page, 400, 300)).toEqual(WHITE);

    expect(errors).toEqual([]);
  });

  test('取色工具与 Alt+点击 采样画布颜色', async ({ page }) => {
    const errors = await gotoApp(page);

    await page.getByTestId('swatch-ff0000').click();
    await stroke(page, [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ]);
    await expect(page.getByTestId('history-item')).toHaveCount(1);

    await page.getByTestId('swatch-0000ff').click();
    await expect(page.getByTestId('color-fg-input')).toHaveValue('#0000ff');

    await page.keyboard.press('i');
    await expect(page.getByTestId('status-tool')).toHaveText('取色');
    await stroke(page, [{ x: 150, y: 100 }]);
    await expect(page.getByTestId('color-fg-input')).toHaveValue('#ff0000');
    await expect(page.getByTestId('history-item')).toHaveCount(1);

    await page.keyboard.press('p');
    await expect(page.getByTestId('status-tool')).toHaveText('铅笔');
    await page.getByTestId('swatch-00ff00').click();
    await expect(page.getByTestId('color-fg-input')).toHaveValue('#00ff00');

    const target = await canvasToScreen(page, 150, 100);
    await page.keyboard.down('Alt');
    await page.mouse.click(target.x, target.y);
    await page.keyboard.up('Alt');
    await expect(page.getByTestId('color-fg-input')).toHaveValue('#ff0000');
    await expect(page.getByTestId('status-tool')).toHaveText('铅笔');
    await expect(page.getByTestId('history-item')).toHaveCount(1);

    expect(errors).toEqual([]);
  });

  test('快捷键切换形状工具，Esc 取消进行中的形状', async ({ page }) => {
    const errors = await gotoApp(page);

    await page.keyboard.press('l');
    await expect(page.getByTestId('status-tool')).toHaveText('直线');
    await expect(page.getByTestId('tool-line')).toHaveClass(/is-active/);
    await page.keyboard.press('o');
    await expect(page.getByTestId('status-tool')).toHaveText('椭圆');
    await page.keyboard.press('r');
    await expect(page.getByTestId('status-tool')).toHaveText('矩形');

    const start = await canvasToScreen(page, 150, 150);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    const end = await canvasToScreen(page, 320, 260);
    await page.mouse.move(end.x, end.y, { steps: 8 });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await waitForRender(page);

    expect(await docPixel(page, 150, 150)).toEqual(WHITE);
    expect(await docPixel(page, 320, 260)).toEqual(WHITE);
    expect(await docPixel(page, 235, 205)).toEqual(WHITE);
    await expect(page.getByTestId('history-item')).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test('直线与椭圆落笔，各 1 条历史；撤销恢复', async ({ page }) => {
    const errors = await gotoApp(page);

    await page.keyboard.press('l');
    await stroke(page, [
      { x: 100, y: 100 },
      { x: 300, y: 200 },
    ]);
    await waitForRender(page);
    expect(await docPixel(page, 200, 150)).toEqual(BLACK);
    await expect(page.getByTestId('history-item')).toHaveCount(1);

    await page.keyboard.press('o');
    await stroke(page, [
      { x: 400, y: 300 },
      { x: 560, y: 420 },
    ]);
    await waitForRender(page);
    expect(await docPixel(page, 480, 300)).not.toEqual(WHITE);
    expect(await docPixel(page, 480, 360)).toEqual(WHITE);
    await expect(page.getByTestId('history-item')).toHaveCount(2);

    await page.keyboard.press('Control+z');
    await waitForRender(page);
    expect(await docPixel(page, 480, 300)).toEqual(WHITE);
    expect(await docPixel(page, 200, 150)).toEqual(BLACK);

    expect(errors).toEqual([]);
  });

  test('画笔：大小与不透明度属性生效，单击出圆点', async ({ page }) => {
    const errors = await gotoApp(page);

    await page.keyboard.press('b');
    await expect(page.getByTestId('status-tool')).toHaveText('画笔');
    await expect(page.getByTestId('brush-size-8')).toHaveClass(/is-active/);

    await page.getByTestId('brush-size-16').click();
    await stroke(page, [
      { x: 100, y: 400 },
      { x: 200, y: 400 },
    ]);
    await waitForRender(page);
    expect(await docPixel(page, 150, 400)).toEqual(BLACK);
    expect(await docPixel(page, 150, 393)).toEqual(BLACK);
    expect(await docPixel(page, 150, 411)).toEqual(WHITE);
    await expect(page.getByTestId('history-item')).toHaveCount(1);

    await page.getByTestId('brush-opacity-50').click();
    await stroke(page, [
      { x: 300, y: 500 },
      { x: 400, y: 500 },
    ]);
    await waitForRender(page);
    const half = await docPixel(page, 350, 500);
    expect(half[0]).toBeGreaterThanOrEqual(120);
    expect(half[0]).toBeLessThanOrEqual(135);
    expect(half[3]).toBe(255);
    await expect(page.getByTestId('history-item')).toHaveCount(2);

    await page.getByTestId('brush-opacity-100').click();
    await stroke(page, [{ x: 600, y: 450 }]);
    await waitForRender(page);
    expect(await docPixel(page, 600, 450)).toEqual(BLACK);
    expect(await docPixel(page, 610, 450)).toEqual(WHITE);
    await expect(page.getByTestId('history-item')).toHaveCount(3);

    await page.keyboard.press('Control+z');
    await waitForRender(page);
    expect(await docPixel(page, 600, 450)).toEqual(WHITE);

    expect(errors).toEqual([]);
  });

  test('直线 / 矩形 / 椭圆 渲染视觉回归', async ({ page }) => {
    const errors = await gotoApp(page);

    await page.keyboard.press('l');
    await stroke(page, [
      { x: 100, y: 80 },
      { x: 280, y: 200 },
    ]);
    await page.keyboard.press('r');
    await stroke(page, [
      { x: 320, y: 80 },
      { x: 500, y: 200 },
    ]);
    await page.keyboard.press('o');
    await stroke(page, [
      { x: 100, y: 300 },
      { x: 280, y: 460 },
    ]);
    await waitForRender(page);

    expect(errors).toEqual([]);
    await expect(page.getByTestId('viewport')).toHaveScreenshot('m2-shapes.png');
  });
});
