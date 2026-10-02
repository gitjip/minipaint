import type { PatchTarget, RawImageData, Rect } from './patches';

export const MAX_DOC_SIZE = 8192;

export type RGBA = [number, number, number, number];

export class Document implements PatchTarget {
  readonly width: number;
  readonly height: number;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;

  constructor(width: number, height: number, background = '#ffffff') {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
      throw new Error(`非法画布尺寸: ${width}×${height}`);
    }
    if (width > MAX_DOC_SIZE || height > MAX_DOC_SIZE) {
      throw new Error(`画布尺寸超过上限 ${MAX_DOC_SIZE}: ${width}×${height}`);
    }
    this.width = width;
    this.height = height;
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('无法创建 2D 上下文');
    this.ctx = ctx;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }

  getPixel(x: number, y: number): RGBA | null {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
    const data = this.ctx.getImageData(x, y, 1, 1).data;
    return [data[0], data[1], data[2], data[3]];
  }

  readRect(rect: Rect): RawImageData {
    if (rect.width <= 0 || rect.height <= 0) {
      return { width: 0, height: 0, data: new Uint8ClampedArray(0) };
    }
    return this.ctx.getImageData(rect.x, rect.y, rect.width, rect.height);
  }

  writeRect(rect: Rect, image: RawImageData): void {
    if (rect.width <= 0 || rect.height <= 0) return;
    if (image.width <= 0 || image.height <= 0) return;
    this.ctx.putImageData(new ImageData(image.data, image.width, image.height), rect.x, rect.y);
  }
}
