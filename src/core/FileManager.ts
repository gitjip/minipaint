import type { Document } from './Document';

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = 'image/png',
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('toBlob 返回空结果'));
      },
      type,
      quality,
    );
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportPng(doc: Document): Promise<void> {
  const blob = await canvasToBlob(doc.canvas, 'image/png');
  downloadBlob(blob, `minipaint-${doc.width}x${doc.height}.png`);
}
