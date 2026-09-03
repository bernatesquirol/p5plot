import p5 from 'p5'
import * as Matter from 'matter-js'
import { Circle, Point, Polygon, Segment, Vector } from '@flatten-js/core'
import { createCircle, createRect, createSegment, drawFlatten } from '../utils'

export enum BoxType {
  rect,
  circle,
}

export type BoxOpts = {
  x: number
  y: number
  w?: number
  h?: number
  r?: number
  type: BoxType
  stroke: p5.Color
  fill?: p5.Color
  /** physics body is this much bigger than the drawn shape */
  bodyBuffer?: number
  /** angle of the hatching, radians */
  anglePattern?: number
  /** spacing between hatch lines */
  textureWidth?: number
  isStatic?: boolean
  friction?: number
  restitution?: number
}

/**
 * A matter.js body drawn as a hatched shape. Shared by the tree/star plots,
 * which used to keep a copy each.
 */
export class Box {
  body: Matter.Body
  bodyPolygon: Polygon | Circle
  world: Matter.World
  type: BoxType
  x: number
  y: number
  w?: number
  h?: number
  r?: number
  anglePattern: number
  textureWidth: number
  stroke: p5.Color
  fill?: p5.Color
  private p: p5
  private cache?: { x: number; y: number; angle: number; segments: Segment[] }

  constructor(
    opts: BoxOpts,
    { world, p5: p }: { world: Matter.World; p5: p5 },
  ) {
    const { x, y, w, h, r, type, bodyBuffer = 1.25, anglePattern = 0 } = opts
    this.stroke = opts.stroke
    this.fill = opts.fill
    this.type = type
    this.textureWidth = opts.textureWidth || 3
    this.anglePattern = anglePattern
    this.x = x
    this.y = y
    this.w = w
    this.h = h
    this.r = r
    this.p = p
    this.world = world

    const options: Matter.IChamferableBodyDefinition = {
      friction: opts.friction ?? 0,
      restitution: opts.restitution ?? 0,
      angle: Math.PI,
      isStatic: opts.isStatic ?? false,
    }

    if (type === BoxType.rect) {
      const [wRect, hRect] = [w! * bodyBuffer, h! * bodyBuffer]
      this.bodyPolygon = createRect({ x, y, w: wRect, h: hRect })
      this.body = Matter.Bodies.rectangle(x, y, wRect, hRect, options)
    } else {
      const rCircle = r! * bodyBuffer
      this.bodyPolygon = createCircle({ x, y, r: rCircle })
      this.body = Matter.Bodies.circle(x, y, rCircle, options)
    }
    Matter.World.add(world, this.body)
  }

  delete() {
    Matter.World.remove(this.world, this.body)
  }

  /** Current outline, following the physics body. */
  shape(): Polygon | Circle {
    const { position: pos, angle } = this.body
    if (this.type !== BoxType.rect) return new Circle(new Point(pos.x, pos.y), this.r!)
    const hw = this.w! / 2
    const hh = this.h! / 2
    const poly = new Polygon()
    poly.addFace([
      new Point(-hw, -hh),
      new Point(hw, -hh),
      new Point(hw, hh),
      new Point(-hw, hh),
    ])
    return poly.rotate(angle).translate(new Vector(pos.x, pos.y))
  }

  /** Parallel hatching clipped to the shape — what actually gets plotted. */
  texture(): Segment[] {
    const { position: pos, angle } = this.body
    const c = this.cache
    if (c && Math.abs(c.x - pos.x) < 0.01 && Math.abs(c.y - pos.y) < 0.01 && Math.abs(c.angle - angle) < 0.001) {
      return c.segments
    }
    const segments = this.computeTexture()
    this.cache = { x: pos.x, y: pos.y, angle, segments }
    return segments
  }

  /** Cached while the body sits still, which is most of the time. */
  private computeTexture(): Segment[] {
    const shape = this.shape()
    const { xmin, xmax, ymin, ymax } = shape.box
    const diagonal = Math.hypot(xmax - xmin, ymax - ymin)
    const spine = createSegment(shape.box.center, diagonal, this.anglePattern)

    const points: Point[] = []
    for (let at = 0; at <= spine.length; at += this.textureWidth) {
      points.push(spine.pointAtLength(at)!)
    }
    return points
      .map(from => {
        const [start, end] = shape.intersect(createSegment(from, diagonal, this.anglePattern + Math.PI / 2))
        return start && end ? new Segment(start, end) : null
      })
      .filter((s): s is Segment => !!s)
  }

  draw() {
    const p = this.p
    const pos = this.body.position
    this.bodyPolygon = this.bodyPolygon.translate(
      new Vector(pos.x - this.bodyPolygon.box.center.x, pos.y - this.bodyPolygon.box.center.y))

    p.push()
    p.stroke(this.stroke)
    p.fill(this.fill ?? p.color(255, 255, 255, 100))
    p.rectMode(p.CENTER)
    drawFlatten(p, this.texture())
    p.pop()
  }

  show() {
    this.draw()
  }
}
