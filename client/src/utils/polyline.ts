import { Point, Polygon, point, segment } from '@flatten-js/core'
import { Rect } from '../core/rect'
import { Rng } from '../core/rng'

/**
 * Open polylines, in paper pixels. A brush stroke is a polyline and nothing
 * else: the plotter follows it, and the watercolour simulation is painted
 * around it — so everything the painting utils do lands here first.
 */
export type XY = { x: number; y: number }

export const dist = (a: XY, b: XY) => Math.hypot(b.x - a.x, b.y - a.y)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const lerpXY = (a: XY, b: XY, t: number): XY => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) })
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** Running length at each vertex; the last entry is the whole line. */
export function arcLengths(pts: XY[]): number[] {
  const out = [0]
  for (let i = 1; i < pts.length; i++) out.push(out[i - 1] + dist(pts[i - 1], pts[i]))
  return out
}

export function polylineLength(pts: XY[]): number {
  if (pts.length < 2) return 0
  let total = 0
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1], pts[i])
  return total
}

/** Where the line is at distance `at` along it, clamped to the two ends. */
export function pointAt(pts: XY[], at: number): XY {
  if (!pts.length) return { x: 0, y: 0 }
  const lens = arcLengths(pts)
  const total = lens[lens.length - 1]
  if (at <= 0 || total === 0) return { ...pts[0] }
  if (at >= total) return { ...pts[pts.length - 1] }
  const i = lens.findIndex(l => l >= at)
  const span = lens[i] - lens[i - 1]
  return lerpXY(pts[i - 1], pts[i], span === 0 ? 0 : (at - lens[i - 1]) / span)
}

/**
 * Cut at distance `at` along the line. Both halves keep the cut point, so a
 * stroke split because the brush ran out of paint has no gap in it.
 */
export function cutAt(pts: XY[], at: number): [XY[], XY[]] {
  const lens = arcLengths(pts)
  const total = lens[lens.length - 1]
  if (at <= 0) return [[], [...pts]]
  if (at >= total) return [[...pts], []]
  const i = lens.findIndex(l => l >= at)
  const span = lens[i] - lens[i - 1]
  const cut = lerpXY(pts[i - 1], pts[i], span === 0 ? 0 : (at - lens[i - 1]) / span)
  return [[...pts.slice(0, i), cut], [cut, ...pts.slice(i)]]
}

/**
 * The middle of a line, with `by` taken off each end — a stroke held back
 * from where it would otherwise stop. Undefined when nothing is left.
 */
export function trimEnds(pts: XY[], by: number): XY[] | undefined {
  if (by <= 0) return pts.length > 1 ? [...pts] : undefined
  const total = polylineLength(pts)
  if (total <= 2 * by) return undefined
  const [, rest] = cutAt(pts, by)
  const [kept] = cutAt(rest, polylineLength(rest) - by)
  return kept.length > 1 ? kept : undefined
}

/** Split into pieces no longer than `max` — one dip's worth each. */
export function splitEvery(pts: XY[], max: number): XY[][] {
  const out: XY[][] = []
  let rest = [...pts]
  while (polylineLength(rest) > max && max > 0) {
    const [head, tail] = cutAt(rest, max)
    out.push(head)
    rest = tail
  }
  if (rest.length > 1) out.push(rest)
  return out
}

/** Vertices every `step` along the line, the two endpoints kept as they are. */
export function resample(pts: XY[], step: number): XY[] {
  const total = polylineLength(pts)
  if (pts.length < 2 || total === 0 || step <= 0) return [...pts]
  const n = Math.max(1, Math.round(total / step))
  const out: XY[] = []
  for (let i = 0; i <= n; i++) out.push(pointAt(pts, (total * i) / n))
  return out
}

/**
 * Unit left-hand normal at each vertex, averaged across the joins so a
 * band built on them doesn't pinch at the corners.
 */
export function normalsOf(pts: XY[]): XY[] {
  const dir = (a: XY, b: XY) => {
    const d = dist(a, b)
    return d === 0 ? { x: 1, y: 0 } : { x: (b.x - a.x) / d, y: (b.y - a.y) / d }
  }
  return pts.map((_, i) => {
    const before = i > 0 ? dir(pts[i - 1], pts[i]) : dir(pts[0], pts[1])
    const after = i < pts.length - 1 ? dir(pts[i], pts[i + 1]) : dir(pts[pts.length - 2], pts[pts.length - 1])
    const t = { x: before.x + after.x, y: before.y + after.y }
    const m = Math.hypot(t.x, t.y) || 1
    return { x: -t.y / m, y: t.x / m }
  })
}

/**
 * Closed outline of a band of varying width around a line: down one side and
 * back up the other. `halfWidth` is called with the position along the line
 * (0..1) and which side it is on, so the two edges can wander apart.
 */
export function ribbon(pts: XY[], halfWidth: (t: number, side: 1 | -1) => number): XY[] {
  if (pts.length < 2) return []
  const normals = normalsOf(pts)
  const at = (i: number, side: 1 | -1) => {
    const t = i / (pts.length - 1)
    const w = halfWidth(t, side) * side
    return { x: pts[i].x + normals[i].x * w, y: pts[i].y + normals[i].y * w }
  }
  const left = pts.map((_, i) => at(i, 1))
  const right = pts.map((_, i) => at(i, -1)).reverse()
  return [...left, ...right]
}

/** Chaikin corner cutting — an open line, so the endpoints stay put. */
export function smooth(pts: XY[], passes = 1): XY[] {
  let out = [...pts]
  for (let n = 0; n < passes; n++) {
    if (out.length < 3) return out
    const next: XY[] = [out[0]]
    for (let i = 0; i < out.length - 1; i++) {
      next.push(lerpXY(out[i], out[i + 1], 0.25), lerpXY(out[i], out[i + 1], 0.75))
    }
    next.push(out[out.length - 1])
    out = next
  }
  return out
}

export type WaveOpts = {
  /** peak sideways offset, in paper pixels */
  amplitude: number
  /** how many full waves over the whole line */
  waves?: number
  /** 0..1, where in the wave the line starts */
  phase?: number
  /** fade the wave out at both ends, so tiled lines still meet */
  taper?: boolean
  /** vertex spacing to resample to first; a straight span has none to bend */
  step?: number
}

/** Push a line sideways with a sine wave. */
export function waveify(pts: XY[], o: WaveOpts): XY[] {
  const line = resample(pts, o.step ?? 4)
  if (line.length < 2 || !o.amplitude) return line
  const normals = normalsOf(line)
  const waves = o.waves ?? 1
  const phase = (o.phase ?? 0) * Math.PI * 2
  return line.map((p, i) => {
    const t = i / (line.length - 1)
    const fade = o.taper ? Math.sin(Math.PI * t) : 1
    const off = Math.sin(phase + t * waves * Math.PI * 2) * o.amplitude * fade
    return { x: p.x + normals[i].x * off, y: p.y + normals[i].y * off }
  })
}

export type CirclePathOpts = {
  /** how many times round; more than one is a stir */
  turns?: number
  samples?: number
  /** where on the circle to start, in radians */
  from?: number
  /** 0..1 — wind inwards by this fraction of the radius per turn */
  spiral?: number
}

/** A circle as a polyline: the shape the brush makes inside a paint bucket. */
export function circlePath(c: XY, r: number, o: CirclePathOpts = {}): XY[] {
  const turns = Math.max(0.1, o.turns ?? 1)
  const samples = Math.max(8, o.samples ?? Math.round(48 * turns))
  const from = o.from ?? 0
  const spiral = o.spiral ?? 0
  return Array.from({ length: samples + 1 }, (_, i) => {
    const t = i / samples
    const a = from + t * turns * Math.PI * 2
    const rad = r * (1 - spiral * t)
    return { x: c.x + Math.cos(a) * rad, y: c.y + Math.sin(a) * rad }
  })
}

/** Smooth random -1..1 along t, for wobbling an edge without it looking spiky. */
export function smoothField(rng: Rng, controls = 6): (t: number) => number {
  const values = Array.from({ length: Math.max(2, controls) }, () => rng.between(-1, 1))
  return (t: number) => {
    const u = clamp01(t) * (values.length - 1)
    const i = Math.min(values.length - 2, Math.floor(u))
    // cosine interpolation: no corners where the control points meet
    const f = (1 - Math.cos((u - i) * Math.PI)) / 2
    return lerp(values[i], values[i + 1], f)
  }
}

export type SweepOpts = {
  /**
   * Largest gap between neighbouring sweeps. With `fit` the real pitch is
   * pulled in from this until the region is covered; without it, this is the
   * pitch and the region is covered to whatever extent that manages.
   */
  spacing: number
  /**
   * Brush width. With `fit`, what says whether the sweeps cover the region:
   * each one paints half a width either side of itself.
   */
  brush?: number
  /**
   * Cover the region exactly: the outer sweeps sit half a brush inside its
   * edges and the rest are spread evenly between them, so a region comes out
   * as a filled shape rather than as a row of separate strokes. Needs `brush`.
   */
  fit?: boolean
  /** sweep direction, in radians; 0 sweeps left to right */
  angle?: number
  /** alternate direction row by row, so the brush never doubles back (default true) */
  snake?: boolean
  /** keep the sweep ends this far inside the region, e.g. half a brush width */
  margin?: number
  /** vertex spacing of the returned lines; they get bent afterwards */
  step?: number
}

/**
 * Parallel sweeps covering a region, in the order a single brush should paint
 * them: the way you lay a flat wash. Concave regions come back as several
 * spans per row, and each row is reversed in turn so the brush snakes.
 */
export function sweepFill(region: Rect | Polygon, o: SweepOpts): XY[][] {
  const poly = region instanceof Rect ? rectPolygon(region) : region
  const spacing = Math.max(0.5, o.spacing)
  const angle = o.angle ?? 0
  const snake = o.snake !== false
  const box = poly.box
  const centre = { x: (box.xmin + box.xmax) / 2, y: (box.ymin + box.ymax) / 2 }
  // long enough to cross the region whichever way the sweeps point
  const reach = Math.hypot(box.xmax - box.xmin, box.ymax - box.ymin) / 2 + 1
  const u = { x: Math.cos(angle), y: Math.sin(angle) }
  const n = { x: -u.y, y: u.x }
  // how far the region reaches across the sweeps. Measured on its corners, so
  // the rows are placed on the region itself rather than on its bounding box:
  // a slanted tile gets sweeps that fill the tile, not the box around it.
  const across = [...poly.vertices].map(v => (v.x - centre.x) * n.x + (v.y - centre.y) * n.y)
  const near = Math.min(...across)
  const far = Math.max(...across)
  const middle = (near + far) / 2
  /*
   * Rows are spread symmetrically about the middle of the region, which is
   * what makes a fill land the same way whatever the spacing — and means a
   * region thinner than the spacing gets exactly one sweep, straight down the
   * middle of it. That is a single dab of the brush, so `centreSweep` is this
   * same routine with the spacing opened right up.
   */
  const extent = far - near
  /*
   * Two ways to lay the rows out. Fitted: the outer sweeps are half a brush
   * inside the edges, so the painted band is exactly the region — one stroke
   * when the brush is as wide as the region, more as it gets narrower, and
   * the pitch shrinks to whatever divides the rest evenly. Unfitted: the
   * pitch is the spacing asked for, centred on the region.
   */
  const fitted = o.fit && o.brush ? Math.max(0, extent - o.brush) : undefined
  const rows = fitted === undefined
    ? Math.max(1, Math.round(extent / spacing))
    : fitted === 0 ? 1 : Math.ceil(fitted / spacing) + 1
  const pitch = fitted === undefined ? spacing : rows > 1 ? fitted / (rows - 1) : 0
  const out: XY[][] = []
  let laid = 0

  for (let k = 0; k < rows; k++) {
    const offset = k - (rows - 1) / 2
    // guarded, so an infinite spacing still resolves to the middle row
    const d = offset === 0 ? middle : middle + offset * pitch
    const from = { x: centre.x + n.x * d - u.x * reach, y: centre.y + n.y * d - u.y * reach }
    const sweep = segment(point(from.x, from.y), point(from.x + u.x * 2 * reach, from.y + u.y * 2 * reach))
    // edge by edge rather than segment-vs-polygon: works for arcs too, and
    // doesn't depend on which intersection routines flatten has for polygons
    const hits: number[] = []
    for (const edge of poly.edges) {
      for (const hit of sweep.intersect((edge as any).shape) as Point[]) {
        hits.push((hit.x - from.x) * u.x + (hit.y - from.y) * u.y)
      }
    }
    hits.sort((a, b) => a - b)
    // a sweep crossing a vertex is found by both its edges: the duplicate
    // would flip the inside/outside parity for the rest of the row
    const cuts = hits.filter((h, i) => i === 0 || h - hits[i - 1] > 1e-6)
    const spans: XY[][] = []
    for (let i = 0; i + 1 < cuts.length; i += 2) {
      const [a, b] = [cuts[i] + (o.margin ?? 0), cuts[i + 1] - (o.margin ?? 0)]
      if (b <= a) continue
      const at = (s: number) => ({ x: from.x + u.x * s, y: from.y + u.y * s })
      spans.push(resample([at(a), at(b)], o.step ?? 4))
    }
    if (!spans.length) continue
    // snaked on the rows that actually got painted, so a hole in the region
    // doesn't leave two rows running the same way
    if (snake && laid % 2 === 1) out.push(...spans.reverse().map(s => [...s].reverse()))
    else out.push(...spans)
    laid++
  }
  return out
}

/**
 * One stroke down the middle of a region: the whole of a tile no bigger than
 * the brush. Undefined when the margin leaves nothing to paint.
 */
export function centreSweep(region: Rect | Polygon, o: Omit<SweepOpts, 'spacing' | 'snake'> = {}): XY[] | undefined {
  return sweepFill(region, { ...o, spacing: Infinity, snake: false })[0]
}

/** A Rect as a polygon, for the routines that clip against one. */
export function rectPolygon(r: Rect): Polygon {
  const p = new Polygon()
  p.addFace([point(r.x, r.y), point(r.right, r.y), point(r.right, r.bottom), point(r.x, r.bottom)])
  return p
}
