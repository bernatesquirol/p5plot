import * as Matter from 'matter-js'
import { Point, Polygon } from '@flatten-js/core'
import {
  bindHollowBody, center, createCircle, createRect, diff, drawFlatten,
  equilateralTriangleCentroidDown, holdRatio, poligonizeCircle, randomPointInPolygon, WithAttrs,
} from '../../utils'
import { definePlot, Plot, PlotCtx } from '../../core/plot'
import { cm } from '../../core/paper'
import { Box, BoxType } from '../../components/PhysicsBox'

/** Set once: the device-tilt listener drives whichever sky world is live. */
let tiltTarget: Matter.Engine | null = null
let tiltBound = false

async function enableTilt(engine: Matter.Engine) {
  tiltTarget = engine
  const motion = (window as any).DeviceMotionEvent
  if (motion && typeof motion.requestPermission === 'function') {
    if ((await motion.requestPermission()) !== 'granted') return
  }
  if (tiltBound) return
  tiltBound = true
  window.addEventListener('deviceorientation', event => {
    const { beta, gamma } = event as DeviceOrientationEvent
    if (!tiltTarget || beta == null || gamma == null) return
    tiltTarget.gravity.x = Matter.Common.clamp(gamma / 45, -1, 1) * 0.15
    tiltTarget.gravity.y = Matter.Common.clamp(beta / 45, -1, 1) * 0.15
  })
}

export type XmasOpts = {
  center?: { x: number, y: number }
  angle?: number
  /** default number of baubles, before the panel overrides it */
  count?: number
}

/**
 * A tree filled with hatched baubles, on a snow globe. Two matter worlds: one
 * for the tree (gravity up, so the baubles hang) and one for the sky.
 * Click inside the tree or the globe to add more.
 */
export class XmasPlot extends Plot {
  engine: Matter.Engine
  engineSky: Matter.Engine
  treeShape: Polygon
  skyShape: WithAttrs<Polygon>
  groundShape: WithAttrs<Polygon>
  sphereShape: WithAttrs<Polygon>
  maxSizeBox: number
  boxes: Box[] = []
  redBoxes: Box[] = []
  greenBoxes: Box[] = []

  constructor(ctx: PlotCtx, opts: XmasOpts = {}) {
    super(ctx)

    const gravityTree = this.num('gravityTree', 0, { min: -1, max: 1, step: 0.01 })
    const gravitySky = this.num('gravitySky', 0.1, { min: -1, max: 1, step: 0.01 })
    const density = this.num('density', 0.6, { min: 0, max: 1, step: 0.05 })
    const count = this.num('count', opts.count ?? 100, { min: 0, max: 400, step: 10 })

    this.engine = Matter.Engine.create()
    this.engine.gravity.y = -gravityTree
    this.engineSky = Matter.Engine.create()
    this.engineSky.gravity.y = gravitySky
    bindHollowBody(this.engine.world, createRect(
      { x: this.x, y: this.y, w: this.width, h: this.height }, 'NO'))

    const { w: wTree, h: hTree } = holdRatio({ w: this.width * 0.7, h: this.height * 0.7 }, '2:4')
    this.maxSizeBox = hTree * 0.005
    const treeCenter = opts.center ?? {
      ...center({ w: wTree, h: hTree }, { w: this.width, h: this.height }),
    }
    const anchor = { x: this.x + treeCenter.x, y: this.y + treeCenter.y }
    this.treeShape = equilateralTriangleCentroidDown({ ...anchor, w: wTree, h: hTree })
      .rotate(opts.angle ?? 0, new Point(anchor.x, anchor.y))
    bindHollowBody(this.engine.world, this.treeShape)

    this.skyShape = createRect({ x: this.box.cx, y: this.box.cy, w: this.width, h: this.height / 2 }, 'S')
    this.groundShape = createRect({ x: this.box.cx, y: this.box.cy, w: this.width, h: this.height / 2 }, 'N')
    const globe = createCircle({ x: this.box.cx, y: this.box.cy, r: hTree * 0.75 }) as any
    this.sphereShape = diff(poligonizeCircle(globe), this.treeShape)!
    bindHollowBody(this.engineSky.world, this.sphereShape)

    this.scatter(count, density)
    this.button('scatter more', () => this.scatter(count, density))
    this.button('tilt gravity (phone)', () => enableTilt(this.engineSky))
    this.ctx.onPointer((pos, kind) => {
      if (kind === 'up' || kind === 'drag') this.addAt(pos, kind === 'drag')
    })
  }

  scatter(count: number, probability: number) {
    for (let i = 0; i < count; i++) {
      const { x, y } = randomPointInPolygon(this.treeShape)
      if (this.rng.random() < probability) {
        this.redBoxes.push(new Box({
          fill: this.p5.color('white'),
          stroke: this.p5.color('red'),
          x, y,
          type: BoxType.circle,
          anglePattern: this.rng.between(0, Math.PI),
          r: this.rng.between(3, 10) * this.maxSizeBox / 2,
          friction: 0.3,
          restitution: 0.8,
        }, { world: this.engine.world, p5: this.p5 }))
      } else {
        this.greenBoxes.push(new Box({
          fill: this.p5.color('white'),
          stroke: this.p5.color('green'),
          x, y,
          type: BoxType.rect,
          anglePattern: this.rng.between(0, Math.PI),
          w: this.rng.between(4, 10) * this.maxSizeBox,
          h: this.rng.between(4, 10) * this.maxSizeBox,
          friction: 0.3,
          restitution: 0.8,
        }, { world: this.engine.world, p5: this.p5 }))
      }
    }
  }

  /** Tree click drops a bauble, globe click drops snow. */
  addAt({ x, y }: { x: number, y: number }, dragging = false) {
    const p = new Point(x, y)
    const common = {
      x, y,
      anglePattern: this.rng.between(0, Math.PI),
      friction: 0.3,
      restitution: 0.8,
    }
    if (this.treeShape.contains(p)) {
      const target = dragging ? this.greenBoxes : this.redBoxes
      target.push(new Box({
        ...common,
        fill: this.p5.color('white'),
        stroke: this.p5.color(dragging ? 'green' : 'red'),
        ...(dragging
          ? { type: BoxType.rect, w: this.rng.between(4, 10) * this.maxSizeBox, h: this.rng.between(4, 10) * this.maxSizeBox }
          : { type: BoxType.circle, r: this.rng.between(3, 10) * this.maxSizeBox / 2 }),
      }, { world: this.engine.world, p5: this.p5 }))
    } else if (this.sphereShape.contains(p)) {
      this.boxes.push(new Box({
        ...common,
        stroke: this.p5.color('white'),
        type: BoxType.circle,
        r: this.rng.between(3, 10) * this.maxSizeBox / 2,
      }, { world: this.engineSky.world, p5: this.p5 }))
    }
  }

  step(dt: number) {
    Matter.Engine.update(this.engine, dt)
    Matter.Engine.update(this.engineSky, dt)
  }

  draw() {

    this.layer('sky', () => {
      this.skyShape.attrs = { fill: this.color('skyColor', '#4d4c4c') }
      drawFlatten(this.p5, [this.skyShape])
    }, { visible: false })
    this.layer('ground', () => {
      this.groundShape.attrs = { fill: this.color('groundColor', '#383838') }
      drawFlatten(this.p5, [this.groundShape])
    }, { visible: false })
    this.layer('tree', () => drawFlatten(this.p5, [this.treeShape]), { visible: false })
    this.layer('redboxes', () => this.redBoxes.forEach(b => b.draw()))
    this.layer('greenboxes', () => this.greenBoxes.forEach(b => b.draw()))
    this.layer('boxes', () => this.boxes.forEach(b => b.draw()))
  }
}

export default definePlot({
  title: 'Xmas tree',
  sheet: 'A5',
  orientation: 'portrait',
  create: ctx => new XmasPlot(ctx.child('xmas', ctx.box.inset(cm(1)))),
})
