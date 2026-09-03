import { point } from '@flatten-js/core'

export type RectLike = { x?: number; y?: number; width: number; height: number }

/** A drawing region in paper pixels, with normalised (0..1) accessors. */
export class Rect {
  x: number
  y: number
  width: number
  height: number

  constructor({ x, y, width, height }: RectLike) {
    this.x = x || 0
    this.y = y || 0
    this.width = width
    this.height = height
  }

  get w() { return this.width }
  get h() { return this.height }
  get right() { return this.x + this.width }
  get bottom() { return this.y + this.height }
  get cx() { return this.x + this.width / 2 }
  get cy() { return this.y + this.height / 2 }
  get shortSide() { return Math.min(this.width, this.height) }
  get longSide() { return Math.max(this.width, this.height) }

  /** normalised x (0 = left, 1 = right) → paper pixels */
  toX(t: number) { return this.x + t * this.width }
  /** normalised y (0 = top, 1 = bottom) → paper pixels */
  toY(t: number) { return this.y + t * this.height }
  toPoint(tx: number, ty: number) { return point(this.toX(tx), this.toY(ty)) }
  center() { return point(this.cx, this.cy) }

  /** shrink by a margin, either uniform or per axis */
  inset(dx: number, dy = dx) {
    return new Rect({ x: this.x + dx, y: this.y + dy, width: this.width - 2 * dx, height: this.height - 2 * dy })
  }

  /** scale about the centre, keeping the same middle point */
  scale(f: number) {
    return this.inset((this.width * (1 - f)) / 2, (this.height * (1 - f)) / 2)
  }

  /** the largest rect of the given aspect ratio (w/h) that fits, centred */
  fitAspect(aspect: number) {
    const [w, h] = this.width / this.height > aspect
      ? [this.height * aspect, this.height]
      : [this.width, this.width / aspect]
    return new Rect({ x: this.cx - w / 2, y: this.cy - h / 2, width: w, height: h })
  }

  /** regular cols x rows split, row-major: cells[col][row] */
  split(cols: number, rows: number, gap = 0): Rect[][] {
    const cw = (this.width - gap * (cols - 1)) / cols
    const ch = (this.height - gap * (rows - 1)) / rows
    return Array.from({ length: cols }, (_, c) =>
      Array.from({ length: rows }, (_, r) =>
        new Rect({ x: this.x + c * (cw + gap), y: this.y + r * (ch + gap), width: cw, height: ch })))
  }

  contains(px: number, py: number) {
    return px >= this.x && px <= this.right && py >= this.y && py <= this.bottom
  }
}

/** Older plots imported this name. */
export const RectContainer = Rect
export type RectContainer = Rect
