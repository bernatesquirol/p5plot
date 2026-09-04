import p5 from 'p5'
import * as Matter from 'matter-js'
import { Circle, point, Point, segment, Segment, vector } from '@flatten-js/core'
import hanjian from '../../assets/final_flat3.svg?raw'
import {
  bindHollowBody, bindHollowCircle, createCircle, createRect, diff, diffXY,
  drawFlatten, multXY, newArray, poligonizeCircle, randomPointInPolygon, unitXY,
} from '../../utils'
import { definePlot, Plot, PlotCtx } from '../../core/plot'
import { Signature } from '../../components/Signature'
import { Svg } from '../../components/Svg'

/** Lines from a big circle tangent to a small concentric one, n times round. */
function tangentLines(bigCircle: Circle, smallCircle: Circle, n: number, deltaAngle = 0, clockWise = 1): Segment[] {
  const center = bigCircle.pc
  const R = bigCircle.r
  const alpha = Math.acos(smallCircle.r / R) * clockWise
  return Array.from({ length: n }, (_v, i) => {
    const theta = (2 * Math.PI * (i + deltaAngle)) / n
    return segment(
      point(center.x + R * Math.cos(theta), center.y + R * Math.sin(theta)),
      point(center.x + smallCircle.r * Math.cos(theta + alpha), center.y + smallCircle.r * Math.sin(theta + alpha)),
    )
  })
}

type UniverseCenter = { x: number, y: number, r: number }

/** A spoked wheel that rolls around, leaving an echo of itself behind. */
export class Wheel {
  body: Matter.Body
  main: (Segment | Circle)[] = []
  ecos: (Segment | Circle)[] = []

  constructor(
    private opts: { x: number, y: number, r: number, smallR: number, spikes: number, echo: number, universeCenter: UniverseCenter },
    { p5: _p5, world }: { p5: p5, world: Matter.World },
  ) {
    this.body = Matter.Bodies.circle(opts.x, opts.y, opts.r * 1.3, {
      friction: 0.01,
      restitution: 0.3,
      angle: Math.PI,
      isStatic: false,
    })
    Matter.World.add(world, this.body)
  }

  private texture(bigCircle: Circle, smallCircle: Circle) {
    const { spikes } = this.opts
    return [
      ...tangentLines(bigCircle, smallCircle, spikes),
      ...tangentLines(bigCircle, smallCircle, spikes, 0.25, 1),
      ...tangentLines(bigCircle, smallCircle, spikes, -0.25, -1),
      ...tangentLines(bigCircle, smallCircle, spikes, 0.5, -1),
    ]
  }

  compute() {
    const { position: pos, angle } = this.body
    const { r, smallR, universeCenter, echo } = this.opts
    const bigCircle = createCircle({ x: pos.x, y: pos.y, r })
    const smallCircle = createCircle({ x: pos.x, y: pos.y, r: smallR })

    // offset of the wheel from the rim of the central circle, scaled down:
    // that is the direction the echo is dragged towards.
    const total = diffXY(pos, universeCenter)
    const rim = multXY(unitXY(total), universeCenter.r)
    const drag = multXY(vector(total.x - rim.x, total.y - rim.y), -echo)

    const texture = this.texture(bigCircle, smallCircle).map(l => l.rotate(angle, new Point(pos.x, pos.y)))
    this.main = [...texture, bigCircle]
    this.ecos = [
      ...newArray(1).map(() => createCircle({ x: pos.x, y: pos.y, r }).translate(drag)),
      ...texture.map(t => segment(t.start, t.end).translate(drag)),
    ]
  }
}

type Scene = 'start' | 'end'
/** Only 'end' does anything: it stops the simulation, as it did before. */
const SCENES: Scene[] = ['start', 'end']

/**
 * Wheels tumbling around a central disc, each one trailing an echo.
 */
export class Cycles extends Plot {
  engine: Matter.Engine
  wheels: Wheel[]
  ornaments: { draw: () => void }[]

  constructor(ctx: PlotCtx) {
    super(ctx)

    const count = this.num('wheels', 60, { min: 1, max: 200, step: 1 })
    const rWheel = this.num('wheelRadius', 16, { min: 2, max: 60, step: 1 })
    const spikes = this.num('spikes', 8, { min: 3, max: 24, step: 1 })
    const echo = this.num('echo', 0.03, { min: 0, max: 0.3, step: 0.005 })
    const gravity = this.num('gravity', 0.1, { min: -1, max: 1, step: 0.01 })
    const buffer = this.num('buffer', 30, { min: 0, max: 120, step: 1 })

    this.engine = Matter.Engine.create()
    this.engine.gravity.y = gravity
    const world = this.engine.world

    const bounds = createRect({
      x: this.x + buffer,
      y: this.y + buffer,
      w: this.width - buffer * 2,
      h: this.height * 0.9 - buffer * 2,
    }, 'NO')
    bindHollowBody(world, bounds)

    const universeCenter = { x: this.box.toX(0.5), y: this.box.toY(0.625), r: this.width / 7 }
    const size = 0.6 * 2 * universeCenter.r
    const disc = createCircle(universeCenter)
    bindHollowCircle(world, disc as any)

    this.ornaments = [
      new Svg(this.p5, {
        rawSvg: hanjian,
        x: universeCenter.x - size * 0.7,
        y: universeCenter.y - size * 0.7,
        scaleRatio: 0.4,
      }),
      new Signature(this.p5, {
        x: this.box.toX(0.9),
        y: this.box.toY(0.9),
        width: this.height * 0.05,
        height: this.height * 0.05,
        rng: this.rng,
      }),
    ]

    const free = diff(bounds, poligonizeCircle(disc))!
    this.wheels = newArray(count).map(() => {
      const c = randomPointInPolygon(free)
      return new Wheel(
        { x: c.x, y: c.y, r: rWheel, smallR: rWheel * 0.3, spikes, echo, universeCenter },
        { p5: this.p5, world })
    })
    // geometry follows the bodies, so it needs one pass before the first draw
    this.wheels.forEach(w => w.compute())
  }

  step(dt: number) {
    // 'end' freezes the wheels where they are, which is what you plot
    if (this.scene(SCENES) === 'end') return false
    Matter.Engine.update(this.engine, dt)
    this.wheels.forEach(w => w.compute())
    return true
  }

  draw() {
    // registered on draw as well, so the control is there before the first step
    this.scene(SCENES)
    this.layer('xino', () => this.ornaments.forEach(o => o.draw()))
    this.layer('ecos', () => this.wheels.forEach(w => drawFlatten(this.p5, w.ecos)))
    this.layer('wheels', () => this.wheels.forEach(w => drawFlatten(this.p5, w.main)))
  }
}

export default definePlot({
  title: 'Cycles',
  sheet: 'IKEA',
  orientation: 'landscape',
  create: ctx => new Cycles(ctx),
})
