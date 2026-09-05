import p5 from 'p5'
import { Segment, point, segment } from '@flatten-js/core'
import { drawFlatten } from '../utils'
import { Rect } from '../core/rect'

/**
 * The four corners of the real paper, marked with an L on each — where to lay
 * the sheet down on the bed, and where to trim it afterwards.
 *
 * Not a Plot: it is a drawable the sketch puts inside a layer.
 */
export class Corners {
  marks: Segment[]

  constructor(private p: p5, box: Rect, arm: number) {
    const reach = Math.min(arm, box.width / 2, box.height / 2)
    const corner = (x: number, y: number, dx: number, dy: number) => [
      segment(point(x, y), point(x + dx * reach, y)),
      segment(point(x, y), point(x, y + dy * reach)),
    ]
    this.marks = [
      ...corner(box.x, box.y, 1, 1),
      ...corner(box.right, box.y, -1, 1),
      ...corner(box.right, box.bottom, -1, -1),
      ...corner(box.x, box.bottom, 1, -1),
    ]
  }

  draw() {
    this.p.push()
    drawFlatten(this.p, this.marks)
    this.p.pop()
  }
}
