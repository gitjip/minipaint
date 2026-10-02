import type { Document } from './Document';
import { MAX_DOC_SIZE } from './Document';

export const JPEG_QUALITY = 0.92;
export const WEBP_QUALITY = 0.92;

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

/** 通用导出：按类型生成 Blob 并下载。 */
export async function exportImage(
  doc: Document,
  type: string,
  extension: string,
  quality?: number,
): Promise<void> {
  const blob = await canvasToBlob(doc.canvas, type, quality);
  downloadBlob(blob, `minipaint-${doc.width}x${doc.height}.${extension}`);
}

export async function exportPng(doc: Document): Promise<void> {
  await exportImage(doc, 'image/png', 'png');
}

/** 解码图片（PNG / JPEG / WebP / GIF 首帧）为画布，失败抛错。 */
export async function decodeImage(blob: Blob): Promise<HTMLCanvasElement> {
  const toCanvas = (source: CanvasImageSource, width: number, height: number): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法创建 2D 上下文');
    ctx.drawImage(source, 0, 0);
    return canvas;
  };
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob);
      const canvas = toCanvas(bitmap, bitmap.width, bitmap.height);
      bitmap.close?.();
      return canvas;
    } catch {
      /* 退回 <img> 解码 */
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return toCanvas(image, image.naturalWidth, image.naturalHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 校验导入尺寸（1–8192），非法抛出带尺寸信息的错误。 */
export function assertImportSize(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error(`非法图片尺寸: ${width}×${height}`);
  }
  if (width > MAX_DOC_SIZE || height > MAX_DOC_SIZE) {
    throw new Error(`图片尺寸超过上限 ${MAX_DOC_SIZE}: ${width}×${height}`);
  }
}
