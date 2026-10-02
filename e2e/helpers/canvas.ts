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
