import type { Page } from '@playwright/test';
import type { Editor } from '../../src/app/Editor';

export interface ViewportSnapshot {
  scale: number;
  offsetX: number;
  offsetY: number;
  viewW: number;
  viewH: number;
  docW: number;
  docH: number;
}

export async function gotoApp(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${String(error)}`));
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as unknown as { minipaint?: unknown }).minipaint));
  return errors;
}

export async function viewportSnapshot(page: Page): Promise<ViewportSnapshot> {
  return page.evaluate(() => {
    const editor = (window as unknown as { minipaint: Editor }).minipaint;
    const { scale, offsetX, offsetY, viewW, viewH } = editor.viewport;
    return {
      scale,
      offsetX,
      offsetY,
      viewW,
      viewH,
      docW: editor.document.width,
      docH: editor.document.height,
    };
  });
}

export async function screenToCanvas(
  page: Page,
  x: number,
  y: number,
): Promise<{ x: number; y: number }> {
  return page.evaluate(([sx, sy]) => {
    const editor = (window as unknown as { minipaint: Editor }).minipaint;
    const rect = editor.ui.view.getBoundingClientRect();
    return editor.viewport.screenToCanvas(sx - rect.left, sy - rect.top);
  }, [x, y] as [number, number]);
}

export async function docPixel(page: Page, x: number, y: number): Promise<number[]> {
  return page.evaluate(([px, py]) => {
    const editor = (window as unknown as { minipaint: Editor }).minipaint;
    return [...(editor.document.getPixel(px, py) ?? [])];
  }, [x, y] as [number, number]);
}

/** 文档坐标 → 页面绝对坐标（用于鼠标交互）。 */
export async function canvasToScreen(
  page: Page,
  x: number,
  y: number,
): Promise<{ x: number; y: number }> {
  return page.evaluate(
    ([cx, cy]) => {
      const editor = (window as unknown as { minipaint: Editor }).minipaint;
      const point = editor.viewport.canvasToScreen(cx, cy);
      const rect = editor.ui.view.getBoundingClientRect();
      return { x: rect.left + point.x, y: rect.top + point.y };
    },
    [x, y] as [number, number],
  );
}

/** 按文档坐标依次按下/拖拽/抬起，模拟一笔。 */
export async function stroke(
  page: Page,
  points: { x: number; y: number }[],
): Promise<void> {
  const first = await canvasToScreen(page, points[0].x, points[0].y);
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  for (const point of points.slice(1)) {
    const target = await canvasToScreen(page, point.x, point.y);
    await page.mouse.move(target.x, target.y, { steps: 8 });
  }
  await page.mouse.up();
}

/** 等待两帧 rAF，确保 Renderer 已完成绘制。 */
export async function waitForRender(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

export function textOf(locator: { textContent(): Promise<string | null> }): Promise<string> {
  return locator.textContent().then((text) => text ?? '');
}
