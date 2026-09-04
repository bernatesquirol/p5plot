import * as Matter from 'matter-js'
import { point, Point } from '@flatten-js/core'
import {
  bindHollowBody, centroid, createCircle, createRect, diff, drawFlatten,
  gaussianField, gridify, poligonizeCircle, Star, star5, tangentAngle, WithAttrs,
} from '../../utils'
import { Polygon } from '@flatten-js/core'
import { definePlot, Plot, PlotCtx } from '../../core/plot'
import { cm } from '../../core/paper'
import { Box, BoxType } from '../../components/PhysicsBox'

export enum Scene {
  Start = 'start',
  Explode = 'explode',
  End = 'end',
}

export type StarOpts = {
  center?: { x: number, y: number }
  angle?: number
  /** default point density, before the panel overrides it */
  density?: number
  /** default grid resolution */
  grid?: number
}

/**
 * A five pointed star packed with hatched circles that settle under gravity.
 * Click inside the star to drop more in.
 */
export class Star5Plot extends Plot {
  engine: Matter.Engine
  boxes: Box[] = []
  starShape: Star
  sphereShape: WithAttrs<Polygon>
  maxSizeBox: number
  private explodedAt?: Scene

  constructor(ctx: PlotCtx, opts: StarOpts = {}) {
    super(ctx)

    const gravity = this.num('gravity', 0, { min: -1, max: 1, step: 0.01 })
    // A sheet of stars asks for lighter defaults than a single one.
    const density = this.num('density', opts.density ?? 0.6, { min: 0, max: 1, step: 0.05 })
    const grid = this.num('grid', opts.grid ?? 20, { min: 4, max: 60, step: 1 })
    const innerToOuter = this.rng.between(0.2, 0.4)

    this.engine = Matter.Engine.create()
    this.engine.gravity.y = -gravity
    bindHollowBody(this.engine.world, createRect(
      { x: this.x, y: this.y, w: this.width, h: this.height }, 'NO'))

    const outerR = this.box.shortSide / 2
    this.maxSizeBox = this.box.shortSide * 0.005
    const center = opts.center ?? { x: this.box.cx, y: this.box.cy }
    this.starShape = star5({
      ...center,
      innerR: outerR * innerToOuter,
      outerR,
      innerVariation: 0.05,
      outerVariation: 0,
      angleVariation: 0.5,
    }).rotate(opts.angle ?? -Math.PI / 2, new Point(center.x, center.y)) as Star

    const snowBody = createCircle({ x: this.box.cx, y: this.box.cy, r: this.box.shortSide * 0.75 }) as any
    this.sphereShape = diff(poligonizeCircle(snowBody), this.starShape.polygon)!

    this.scatter(density, grid)

    this.button('scatter more', () => this.scatter(density, grid))
    this.ctx.onPointer((pos, kind) => {
      if (kind === 'up') this.addAt(pos)
    })
  }

  /** Fill the star with circles on a grid, sized by a gaussian falloff. */
  scatter(probability: number, gridSize: number) {
    const polygon = this.starShape.polygon
    const field = gaussianField(this.starShape.box.center, this.starShape.box.height * 1.5)
    const lineField = gaussianField(this.starShape.box.center, this.starShape.box.height * 0.3)
    const c = centroid(polygon)

    const grid = gridify(polygon, gridSize, gridSize, true) as [number, number][]
    grid.forEach(([x, y]) => {
      if (!polygon.contains(point(x, y))) return
      if (this.rng.random() > probability) return
      const size = 1.1 * this.rng.between(7, 10) * field(x, y) * this.maxSizeBox / 2
      this.boxes.push(new Box({
        fill: this.p5.color('white'),
        stroke: this.p5.color('black'),
        x, y,
        type: BoxType.circle,
        anglePattern: tangentAngle(point(x, y), c),
        r: size,
        w: 2 * size,
        h: 2 * size,
        bodyBuffer: 1.3,
        textureWidth: 1.1 * lineField(x, y) + 2.7,
      }, { world: this.engine.world, p5: this.p5 }))
    })
  }

  addAt({ x, y }: { x: number, y: number }) {
    if (!this.starShape.polygon.contains(point(x, y))) return
    this.boxes.push(new Box({
      fill: this.p5.color('white'),
      stroke: this.p5.color('black'),
      x, y,
      type: BoxType.circle,
      anglePattern: this.rng.between(0, Math.PI),
      r: this.rng.between(3, 10) * this.maxSizeBox / 2,
    }, { world: this.engine.world, p5: this.p5 }))
  }

  step(dt: number) {
    const scene = this.scene(Object.values(Scene))
    if (scene === Scene.Explode && this.explodedAt !== Scene.Explode) {
      this.explodedAt = Scene.Explode
      this.scatter(1, this.get('grid'))
    }
    if (scene === Scene.End) return false
    Matter.Engine.update(this.engine, dt)
    return true
  }

  draw() {
    // registered on draw as well, so the control is there before the first step
    this.scene(Object.values(Scene))
    this.layer('star', () => drawFlatten(this.p5, this.starShape.polygon), { visible: false })
    this.layer('boxes', () => this.boxes.forEach(b => b.draw()))
  }
}

export default definePlot({
  title: 'Star',
  sheet: 'A5',
  orientation: 'portrait',
  create: ctx => new Star5Plot(ctx.child('star', ctx.box.inset(cm(1)))),
})
