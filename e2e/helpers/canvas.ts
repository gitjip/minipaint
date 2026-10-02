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

/** 整幅文档像素的 FNV-1a 哈希，用于「逐像素还原」断言。 */
export async function docHash(page: Page): Promise<string> {
  return page.evaluate(() => {
    const editor = (window as unknown as { minipaint: Editor }).minipaint;
    const doc = editor.document;
    const image = doc.ctx.getImageData(0, 0, doc.width, doc.height);
    let hash = 2166136261;
    for (let i = 0; i < image.data.length; i++) {
      hash ^= image.data[i];
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  });
}

export interface SelectionSnapshot {
  shape: { x: number; y: number; width: number; height: number } | null;
  float: { x: number; y: number; width: number; height: number } | null;
}

/** 当前选区与浮离状态（仅取可序列化字段）。 */
export async function selectionState(page: Page): Promise<SelectionSnapshot> {
  return page.evaluate(() => {
    const editor = (window as unknown as { minipaint: Editor }).minipaint;
    const { shape, float } = editor.selection;
    return {
      shape: shape ? { x: shape.x, y: shape.y, width: shape.width, height: shape.height } : null,
      float: float
        ? { x: float.x, y: float.y, width: float.canvas.width, height: float.canvas.height }
        : null,
    };
  });
}
