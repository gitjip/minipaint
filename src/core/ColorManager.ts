export const DEFAULT_PALETTE: string[] = [
  '#000000', '#808080', '#800000', '#808000', '#008000', '#008080', '#000080',
  '#800080', '#808040', '#004040', '#0080ff', '#004080', '#8000ff', '#804000',
  '#ffffff', '#c0c0c0', '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff',
  '#ff00ff', '#ffff80', '#00ff80', '#80ffff', '#8080ff', '#ff0080', '#ff8040',
];

export const MAX_RECENT_COLORS = 10;

export type ColorListener = () => void;

function normalize(color: string): string {
  const value = color.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(value)) return value;
  if (/^#[0-9a-f]{3}$/.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  }
  throw new Error(`非法颜色值: ${color}`);
}

export function hexToRgba(hex: string): [number, number, number, number] {
  const value = normalize(hex);
  return [
    parseInt(value.slice(1, 3), 16),
    parseInt(value.slice(3, 5), 16),
    parseInt(value.slice(5, 7), 16),
    255,
  ];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const hex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

export class ColorManager {
  private foregroundColor = '#000000';
  private backgroundColor = '#ffffff';
  private recentColors: string[] = [];
  private listeners = new Set<ColorListener>();

  get foreground(): string {
    return this.foregroundColor;
  }

  get background(): string {
    return this.backgroundColor;
  }

  get recent(): readonly string[] {
    return this.recentColors;
  }

  subscribe(listener: ColorListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  private addRecent(color: string): void {
    this.recentColors = [color, ...this.recentColors.filter((c) => c !== color)].slice(
      0,
      MAX_RECENT_COLORS,
    );
  }

  setForeground(color: string): void {
    const value = normalize(color);
    if (value === this.foregroundColor) return;
    this.foregroundColor = value;
    this.addRecent(value);
    this.notify();
  }

  setBackground(color: string): void {
    const value = normalize(color);
    if (value === this.backgroundColor) return;
    this.backgroundColor = value;
    this.notify();
  }

  swap(): void {
    const tmp = this.foregroundColor;
    this.foregroundColor = this.backgroundColor;
    this.backgroundColor = tmp;
    this.notify();
  }
}
