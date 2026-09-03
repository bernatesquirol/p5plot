import { Circle, Point, Segment, point, segment } from '@flatten-js/core'
import { drawFlatten } from '../../utils'
import { definePlot, Plot, PlotCtx } from '../../core/plot'
import { cm } from '../../core/paper'

const phi = (1 + Math.sqrt(5)) / 2
const goldenArc = 2 * Math.PI * (1 - 1 / phi)
const DEFAULT_CHORD_ANGLE = Math.PI / 2 + goldenArc

/** First hit of a ray from A, ignoring hits closer than eps (i.e. A itself). */
function nearestRayHit(A: Point, angle: number, shapes: (Circle | Segment)[], reach: number, eps = 2): Point | null {
  const ray = segment(A, point(A.x + Math.cos(angle) * reach, A.y + Math.sin(angle) * reach))
  let best: Point | null = null
  let bestDist = Infinity
  for (const shape of shapes) {
    for (const hit of shape.intersect(ray) as Point[]) {
      const d = A.distanceTo(hit)[0]
      if (d > eps && d < bestDist) {
        bestDist = d
        best = hit
      }
    }
  }
  return best
}

/** Chop a segment into a dashed line of `ink` marks separated by `gap`. */
function dashSegment(s: Segment, ink: number, gap: number): Segment[] {
  const total = s.length
  if (ink <= 0 || gap <= 0 || ink > total) return [s.clone()]
  const out: Segment[] = []
  for (let at = 0; at < total; at += ink + gap) {
    const end = Math.min(at + ink, total)
    const a = s.pointAtLength(at)
    const b = s.pointAtLength(end)
    if (a && b) out.push(new Segment(a, b))
  }
  return out
}

/**
 * A rose: chords hopping around a circle by a fixed angle, each one bouncing
 * off whatever it hits first, so the petals close in on themselves.
 */
export class Rose extends Plot {
  segs: Segment[]
  dashes: Segment[]

  constructor(ctx: PlotCtx) {
    super(ctx)

    const chordAngle = this.num('chordAngle', DEFAULT_CHORD_ANGLE, { min: 0, max: Math.PI * 2, step: 0.01 })
    const nLines = this.num('lines', 50, { min: 2, max: 300, step: 1 })
    const radiusRatio = this.num('radius', 0.37, { min: 0.05, max: 0.5, step: 0.005 })
    const jitter = this.num('angleJitter', Math.PI * 0.01, { min: 0, max: 0.3, step: 0.001 })
    const ink = this.num('dashInk', 2, { min: 0.2, max: 20, step: 0.1 })
    const gap = this.num('dashGap', 2, { min: 0, max: 20, step: 0.1 })
    // Every instance shares these params but has its own rng, so a sheet of
    // roses is one folder in the panel and still 20 different flowers.
    const startAngle = this.num('startAngle', 0, { min: 0, max: Math.PI * 2, step: 0.01 })
      + (this.bool('randomStart', true) ? this.rng.between(0, Math.PI * 2) : 0)

    const { cx, cy } = this.box
    const r = this.box.shortSide * radiusRatio
    const circle = new Circle(point(cx, cy), r)
    const shapes: (Circle | Segment)[] = [circle]
    const segs: Segment[] = []
    let A = point(cx + r * Math.cos(startAngle), cy + r * Math.sin(startAngle))

    for (let i = 0; i < nLines; i++) {
      const baseAngle = Math.atan2(A.y - cy, A.x - cx)
      const angle = baseAngle + chordAngle + this.rng.between(-jitter, jitter)
      const B = nearestRayHit(A, angle, shapes, r * 4)
      if (!B) break
      const seg = segment(A, B)
      segs.push(seg)
      shapes.push(seg)
      if (i === 4) {
        // close the very first chord onto this one, so the centre knots up
        const C = nearestRayHit(A, angle, [segs[0]], r * 4)
        if (C) {
          segs[0] = segment(C, segs[0].pe)
          shapes[1] = segs[0]
        }
      }
      A = B
    }

    this.segs = segs
    this.dashes = segs.flatMap(s => dashSegment(s, ink, gap))
  }

  draw() {
    this.layer('roses', () => {
      this.p5.push()
      this.p5.noFill()
      drawFlatten(this.p5, this.dashes)
      this.p5.pop()
    })
  }
}

export default definePlot({
  title: 'Rose',
  sheet: 'A5',
  orientation: 'portrait',
  animated: false,
  create: ctx => new Rose(ctx.child('rose', ctx.box.inset(cm(1)))),
})
