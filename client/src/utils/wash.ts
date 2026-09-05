import p5 from 'p5'
import { Rng } from '../core/rng'
import { XY, clamp01, dist, lerp, polylineLength, resample, ribbon, smoothField } from './polyline'

/**
 * A watercolour brush stroke, on screen only.
 *
 * The plotter is handed the centreline and nothing else (see PaintJob), so
 * this is purely a preview: what the wet brush is expected to leave behind.
 * It is built the way a wash actually reads — a few translucent passes of the
 * same shape, each with its edge wandering a little differently, so the middle
 * goes solid while the rim stays broken and blotchy.
 *
 * Not p5.brush: that library wants a WEBGL canvas, and this sketch is 2D
 * because p5.plotSvg records 2D drawing calls. Everything here is plain fills.
 */
export type WashOpts = {
  /** hex, as the buckets store it */
  hex: string
  /** brush width in paper pixels — the widest the stroke ever gets */
  width: number
  /** paint left in the brush at the start and at the end of the stroke, 0..1 */
  load?: [number, number]
  /** translucent passes; more is smoother and slower */
  passes?: number
  /** alpha of one pass, 0..1 */
  alpha?: number
  /** how far the edge wanders, as a fraction of the brush width */
  spread?: number
  /** darker rim, the way pigment dries at the edge of a wash, 0..1 */
  edge?: number
  /**
   * Shape of the two ends. 1 is the brush's own round end; higher lifts the
   * brush off more gradually, into a point.
   */
  taper?: number
  /** a closed loop has no ends to cap: a stir in a bucket, a blot */
  closed?: boolean
  rng: Rng
}

const WASH = {
  passes: 6,
  alpha: 0.14,
  spread: 0.22,
  edge: 0.35,
  taper: 1,
  /** vertices per stroke, at least: the ends need room to round off */
  samples: 10,
}

/** Paint one stroke as a wash. Never call this while recording SVG. */
export function drawWash(p: p5, points: XY[], o: WashOpts) {
  if (points.length < 2 || o.width <= 0) return
  const passes = Math.max(1, Math.round(o.passes ?? WASH.passes))
  const alpha = o.alpha ?? WASH.alpha
  const spread = o.spread ?? WASH.spread
  const taper = o.taper ?? WASH.taper
  const [load0, load1] = o.load ?? [1, 1]
  const radius = o.width / 2

  /*
   * What a brush actually leaves is the disc of its tip dragged along the
   * path: the paint reaches half a brush *beyond* each end of the centreline.
   * That is the whole reason a sweep is inset by half a brush from the region
   * it fills (see sweepFill's `margin`) — so the line is stretched by that
   * much at both ends here, and the width rounds off over it.
   */
  const spine = o.closed ? points : padEnds(points, radius)
  const length = polylineLength(spine)
  // Vertices a third of a brush apart is enough for the edge to wobble on and
  // cheap enough for a sheet full of strokes — but a short stroke needs a
  // floor, or a dab ends up with two vertices, both of them ends, and paints
  // nothing at all.
  const line = resample(spine, Math.max(0.5, Math.min(radius / 1.5, length / WASH.samples)))
  const c = p.color(o.hex)
  const [r, g, b] = [p.red(c), p.green(c), p.blue(c)]

  /**
   * Half width along the stroke. The ends round off over half a brush width —
   * measured in paper pixels, so a stroke shorter than the brush comes out as
   * one round dab rather than as nothing.
   *
   * A brush running dry barely narrows: it keeps laying down the width of its
   * tip and gets paler instead (see `wetness`). It has to stay near the full
   * width, or the paint stops covering what the sweeps were spaced to cover.
   */
  const half = (t: number) => {
    const from = Math.min(t, 1 - t) * length
    const cap = o.closed || from >= radius
      ? 1
      : Math.pow(Math.sqrt(Math.max(0, 1 - Math.pow(1 - from / radius, 2))), taper)
    return radius * (0.8 + 0.2 * lerp(load0, load1, clamp01(t))) * cap
  }

  /** How much pigment is left: what a dry brush actually loses. */
  const wetness = 0.35 + 0.65 * ((load0 + load1) / 2)

  p.push()
  p.noStroke()
  for (let i = 0; i < passes; i++) {
    // one wobble per side, so the stroke is blotchy rather than symmetric
    const [left, right] = [smoothField(o.rng, 5 + i), smoothField(o.rng, 5 + i)]
    // the first pass is the full width and every later one pulls in a little,
    // which is what stacks the alpha up into a solid core. Only a little: pull
    // in far and the paint stops covering what the sweeps were spaced to
    // cover, and a filled region reads as a grid of separate strokes.
    const grow = 1 - (i / passes) * 0.2
    p.fill(r, g, b, alpha * wetness * 255)
    shape(p, ribbon(line, (t, side) => half(t) * grow * (1 + spread * (side > 0 ? left : right)(t))))
  }
  if (o.edge ?? WASH.edge) {
    const [left, right] = [smoothField(o.rng, 8), smoothField(o.rng, 8)]
    p.noFill()
    p.stroke(r * 0.75, g * 0.75, b * 0.75, (o.edge ?? WASH.edge) * alpha * wetness * 255)
    p.strokeWeight(Math.max(0.5, o.width * 0.05))
    shape(p, ribbon(line, (t, side) => half(t) * (1 + spread * 0.6 * (side > 0 ? left : right)(t))))
  }
  p.pop()
}

/** Paint a closed loop as a wash — a dip in a bucket, a blot, a filled ring. */
export function drawWashLoop(p: p5, points: XY[], o: WashOpts) {
  if (points.length < 3) return
  drawWash(p, [...points, points[0]], { ...o, closed: true, edge: 0 })
}

/**
 * The line with half a brush width of overshoot at each end, along the
 * direction it was already going: the reach of the brush past the centreline.
 */
function padEnds(pts: XY[], by: number): XY[] {
  const away = (from: XY, to: XY): XY => {
    const d = dist(from, to) || 1
    return { x: (to.x - from.x) / d, y: (to.y - from.y) / d }
  }
  const first = pts[0]
  const last = pts[pts.length - 1]
  const head = away(pts[1], first)
  const tail = away(pts[pts.length - 2], last)
  return [
    { x: first.x + head.x * by, y: first.y + head.y * by },
    ...pts,
    { x: last.x + tail.x * by, y: last.y + tail.y * by },
  ]
}

function shape(p: p5, pts: XY[]) {
  if (pts.length < 3) return
  p.beginShape()
  for (const pt of pts) p.vertex(pt.x, pt.y)
  p.endShape(p.CLOSE)
}
