import { point } from '@flatten-js/core';

export class RectContainer {
  x: number
  y: number
  width: number
  height: number

  constructor({ x, y, width, height }: { x: number, y: number, width: number, height: number }) {
    this.x = x
    this.y = y
    this.width = width
    this.height = height
  }

  toX(t: number) {
    return this.x + t * this.width
  }

  toY(t: number) {
    return this.y + t * this.height
  }

  toPoint(tx: number, ty: number) {
    return point(this.toX(tx), this.toY(ty))
  }
}
