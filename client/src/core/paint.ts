import p5 from 'p5'
import p5plot from 'p5.plotsvg'
import { pxToMm } from './paper'
import { Rect } from './rect'
import { makeRng, Rng } from './rng'
import { circlePath, cutAt, dist, polylineLength, XY } from '../utils/polyline'
import { drawWash, drawWashLoop, WashOpts } from '../utils/wash'

/**
 * Painting with the plotter instead of drawing with it.
 *
 * The machine holds one brush. To lay down colour it has to go to a bucket,
 * stir the brush round in the paint, come back to the paper, and paint until
 * the brush runs dry — then go back for more. So unlike a pen plot, *the order
 * of the paths is the drawing*: a job is a sequence of moves, and the exported
 * SVG has to hold them in exactly that order, in one layer.
 *
 * That is what PaintJob is: you add brush strokes as you build the plot, it
 * works out where the dips go, and it emits everything in painting order.
 * On screen the same job is drawn as a watercolour wash (see utils/wash), so
 * what you are looking at is a guess at the painting, not the tool path.
 */

/** A pot of paint at the side of the sheet. */
export type Bucket = {
  id: string
  index: number
  /** hex, as p5 and the SVG both want it */
  hex: string
  /** centre on the bed, in paper pixels */
  x: number
  y: number
  /** inner radius: the brush has to stay inside this */
  r: number
  side: 'left' | 'right'
  label?: string
}

export type BucketSpec = { hex: string; id?: string; label?: string }

export type BucketRackOpts = {
  /** the whole plotter bed */
  bed: Rect
  /** where the sheet is taped down on it */
  sheet: Rect
  /** one per bucket: the first half goes down the left column, the rest right */
  buckets: (string | BucketSpec)[]
  /** bucket inner radius, in paper pixels */
  radius: number
  /** vertical space between two buckets in a column */
  gap?: number
  /** space between the edge of the sheet and the edge of the bucket */
  inset?: number
}

/**
 * Two columns of buckets, one either side of the sheet — the physical setup:
 * a landscape sheet in the middle of the bed with the paint beside it.
 *
 * Buckets are clamped inside the bed, so a sheet taped too close to one edge
 * pushes its column back onto the paper instead of off the machine, where you
 * can see the problem and move the sheet.
 */
export class BucketRack {
  buckets: Bucket[] = []
  readonly bed: Rect
  readonly sheet: Rect

  constructor(o: BucketRackOpts) {
    this.bed = o.bed
    this.sheet = o.sheet
    const specs: BucketSpec[] = o.buckets.map(b => (typeof b === 'string' ? { hex: b } : b))
    const gap = o.gap ?? o.radius * 0.5
    const inset = o.inset ?? o.radius * 0.5
    const perColumn = Math.ceil(specs.length / 2)
    const pitch = 2 * o.radius + gap

    specs.forEach((spec, index) => {
      const side: 'left' | 'right' = index < perColumn ? 'left' : 'right'
      const row = side === 'left' ? index : index - perColumn
      const inColumn = side === 'left' ? Math.min(perColumn, specs.length) : specs.length - perColumn
      const x = side === 'left'
        ? o.sheet.x - inset - o.radius
        : o.sheet.right + inset + o.radius
      // each column centred on the sheet, so a short column sits beside the
      // middle of the paper rather than at the top of the bed
      const top = o.sheet.cy - ((inColumn - 1) * pitch) / 2
      this.buckets.push({
        id: spec.id ?? `c${index}`,
        index,
        hex: spec.hex,
        label: spec.label,
        r: o.radius,
        side,
        x: clamp(o.bed.x + o.radius, o.bed.right - o.radius, x),
        y: clamp(o.bed.y + o.radius, o.bed.bottom - o.radius, top + row * pitch),
      })
    })
  }

  get(id: string): Bucket | undefined {
    return this.buckets.find(b => b.id === id)
  }

  at(index: number): Bucket | undefined {
    return this.buckets[index]
  }

  /** Does a bucket end up on top of the paper? Then the sheet is in the way. */
  get clash() {
    return this.buckets.some(b => this.sheet.contains(b.x, b.y))
  }

  /**
   * The pots themselves, as a guide on screen. Never exported: the plotter
   * must not draw the rims, it only ever dips inside them.
   */
  draw(p: p5) {
    if (isPlotting()) return
    p.push()
    p.strokeWeight(1)
    for (const b of this.buckets) {
      p.noFill()
      p.stroke(120, 116, 108)
      p.circle(b.x, b.y, b.r * 2)
      p.noStroke()
      p.fill(b.hex)
      p.circle(b.x, b.y, b.r * 0.9)
    }
    p.pop()
  }
}

/** A brush stroke on the paper, in the order it should be painted. */
export type PaintStroke = {
  /** which bucket's paint it is in */
  bucket: string
  points: XY[]
  /** brush width in paper pixels; defaults to the job's */
  width?: number
  /** let this one run dry rather than breaking it up for another dip */
  runDry?: boolean
}

/**
 * One thing the machine does, in order. A dip and a paint stroke are both a
 * path the plotter follows; the travel in between is a pen-up move.
 */
export type PaintMove =
  | { kind: 'dip'; bucket: Bucket; path: XY[]; rinse: boolean }
  | {
    kind: 'paint'
    bucket: Bucket
    path: XY[]
    width: number
    /** paint left in the brush at the start and the end of the stroke, 0..1 */
    load: [number, number]
  }

export type PaintJobOpts = {
  rack: BucketRack
  /** brush width in paper pixels */
  brush: number
  /** how much line one dip is good for, in paper pixels */
  capacity: number
  /** times round the bucket per dip */
  dipTurns?: number
  /** how much of the bucket radius the stir uses, 0..1 */
  dipRadius?: number
  /**
   * 'given' paints strokes in the order they were added — right for a
   * composition where colours overlap in a particular order.
   * 'byBucket' paints a whole colour before moving to the next, which is far
   * fewer dips and colour changes, but changes what lies over what.
   */
  order?: 'given' | 'byBucket'
  /** bucket to rinse the brush in when the colour changes, e.g. 'water' */
  rinse?: string
  /** for the wash preview; a job with no rng gets its own */
  rng?: Rng
}

export type PaintStats = {
  strokes: number
  dips: number
  /** length actually painted, in paper pixels */
  painted: number
  /** pen-up travel between moves, in paper pixels */
  travel: number
  /** how many times the brush changes colour */
  changes: number
}

export type PaintDrawOpts = {
  /** the watercolour preview (default true) */
  wash?: boolean
  /** the plotter's paths on top of it, in painting order */
  paths?: boolean
  /** dashed pen-up moves */
  travel?: boolean
  /** passed through to every wash stroke */
  washOpts?: Partial<WashOpts>
}

export class PaintJob {
  private strokes: PaintStroke[] = []
  private compiled?: PaintMove[]
  private rng: Rng

  constructor(private o: PaintJobOpts) {
    this.rng = o.rng ?? makeRng('paint')
  }

  /**
   * Add a stroke. Build the plot by calling this as you go: nothing is
   * ordered or split until the job is asked for its moves.
   */
  stroke(bucket: string, points: XY[], opts: Omit<PaintStroke, 'bucket' | 'points'> = {}) {
    if (points.length > 1) {
      this.strokes.push({ bucket, points, ...opts })
      this.compiled = undefined
    }
    return this
  }

  /** Several strokes of one colour, painted in the order given. */
  strokeAll(bucket: string, lines: XY[][], opts: Omit<PaintStroke, 'bucket' | 'points'> = {}) {
    lines.forEach(line => this.stroke(bucket, line, opts))
    return this
  }

  /**
   * The whole job, in painting order: dip, paint, paint, dip, ... Worked out
   * once and kept, since both the preview and the export ask for it.
   */
  moves(): PaintMove[] {
    if (!this.compiled) this.compiled = this.compile()
    return this.compiled
  }

  stats(): PaintStats {
    const moves = this.moves()
    let travel = 0
    let changes = 0
    let last: XY | undefined
    let colour: string | undefined
    for (const move of moves) {
      if (last) travel += dist(last, move.path[0])
      last = move.path[move.path.length - 1]
      if (move.kind === 'paint') {
        if (colour !== undefined && colour !== move.bucket.id) changes++
        colour = move.bucket.id
      }
    }
    return {
      strokes: this.strokes.length,
      dips: moves.filter(m => m.kind === 'dip').length,
      painted: moves.filter(m => m.kind === 'paint').reduce((s, m) => s + polylineLength(m.path), 0),
      travel,
      changes,
    }
  }

  /**
   * Where the dips go. The brush holds `capacity` worth of line; a stroke
   * longer than what is left is cut where the paint runs out and the rest is
   * painted after another dip, so nothing fades unless it was asked to.
   */
  private compile(): PaintMove[] {
    const { rack, capacity: rawCapacity, order = 'given', rinse } = this.o
    // a capacity of zero would dip forever without getting anywhere
    const capacity = Math.max(1, rawCapacity)
    const queue = order === 'byBucket' ? byBucket(this.strokes, rack) : this.strokes
    const moves: PaintMove[] = []
    let load = 0
    let inBrush: string | undefined

    for (const stroke of queue) {
      const bucket = rack.get(stroke.bucket) ?? rack.at(0)
      if (!bucket) continue
      if (inBrush !== undefined && inBrush !== bucket.id) {
        // a single brush carries the last colour into the next one unless it
        // is washed out first, so a colour change costs a trip to the water
        const water = rinse ? rack.get(rinse) : undefined
        if (water) moves.push(this.dip(water, true))
        load = 0
      }
      inBrush = bucket.id

      let rest = stroke.points
      while (rest.length > 1) {
        if (load <= 1e-6) {
          moves.push(this.dip(bucket, false))
          load = capacity
        }
        const length = polylineLength(rest)
        if (length <= load || stroke.runDry) {
          const spent = Math.min(load, length)
          moves.push({
            kind: 'paint',
            bucket,
            path: rest,
            width: stroke.width ?? this.o.brush,
            load: [load / capacity, Math.max(0, load - length) / capacity],
          })
          load -= spent
          rest = []
        } else {
          const [head, tail] = cutAt(rest, load)
          moves.push({
            kind: 'paint',
            bucket,
            path: head,
            width: stroke.width ?? this.o.brush,
            load: [load / capacity, 0],
          })
          load = 0
          rest = tail
        }
      }
    }
    return moves
  }

  private dip(bucket: Bucket, rinse: boolean): PaintMove {
    return {
      kind: 'dip',
      bucket,
      rinse,
      path: circlePath({ x: bucket.x, y: bucket.y }, bucket.r * (this.o.dipRadius ?? 0.6), {
        turns: this.o.dipTurns ?? 2,
        // start somewhere different each time so the stirs don't stack up into
        // one line in the preview
        from: this.rng.between(0, Math.PI * 2),
        spiral: 0.25,
      }),
    }
  }

  /**
   * What the layer callback should call: the plotter's paths while recording,
   * the wash while looking at it. Same order either way — that order *is* the
   * job, so the preview can't disagree with the file.
   */
  draw(p: p5, opts: PaintDrawOpts = {}) {
    if (isPlotting()) return this.drawPaths(p)
    if (opts.wash !== false) this.drawWash(p, opts.washOpts)
    if (opts.travel) this.drawTravel(p)
    if (opts.paths) this.drawPaths(p)
  }

  /** Every move as a polyline, in painting order, coloured by its bucket. */
  drawPaths(p: p5) {
    p.push()
    p.noFill()
    for (const move of this.moves()) {
      p.stroke(move.kind === 'dip' && move.rinse ? '#5b8fa8' : move.bucket.hex)
      p.beginShape()
      for (const pt of move.path) p.vertex(pt.x, pt.y)
      p.endShape()
    }
    p.pop()
  }

  /** The painting as it might come out, built up in painting order. */
  drawWash(p: p5, extra: Partial<WashOpts> = {}) {
    for (const move of this.moves()) {
      const rng = this.rng.fork(`${move.kind}:${move.path[0].x.toFixed(1)}:${move.path[0].y.toFixed(1)}`)
      if (move.kind === 'dip') {
        if (move.rinse) continue
        drawWashLoop(p, move.path, { hex: move.bucket.hex, width: this.o.brush, rng, alpha: 0.1, ...extra })
      } else {
        drawWash(p, move.path, {
          hex: move.bucket.hex,
          width: move.width,
          load: move.load,
          rng,
          ...extra,
        })
      }
    }
  }

  /** Pen-up moves, so it is obvious how much of the job is walking. */
  drawTravel(p: p5) {
    const moves = this.moves()
    p.push()
    p.stroke(120, 116, 108, 90)
    p.strokeWeight(0.5)
    const ctx = (p as any).drawingContext as CanvasRenderingContext2D
    ctx.setLineDash([4, 4])
    for (let i = 1; i < moves.length; i++) {
      const from = moves[i - 1].path[moves[i - 1].path.length - 1]
      const to = moves[i].path[0]
      p.line(from.x, from.y, to.x, to.y)
    }
    ctx.setLineDash([])
    p.pop()
  }
}

/** Group by bucket, keeping the order the buckets are in and the strokes' own. */
function byBucket(strokes: PaintStroke[], rack: BucketRack): PaintStroke[] {
  const order = new Map(rack.buckets.map((b, i) => [b.id, i]))
  return strokes
    .map((stroke, i) => ({ stroke, i, at: order.get(stroke.bucket) ?? 1e6 }))
    .sort((a, b) => a.at - b.at || a.i - b.i)
    .map(e => e.stroke)
}

const clamp = (lo: number, hi: number, v: number) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)))

/** True while the SVG is being recorded: only tool paths may be drawn. */
export const isPlotting = (): boolean => !!p5plot.isRecordingSVG?.()

/** Paper pixels as a readable distance, for on-screen readouts. */
export const describeLength = (px: number) => {
  const mm = pxToMm(px)
  return mm >= 1000 ? `${(mm / 1000).toFixed(2)}m` : `${(mm / 10).toFixed(1)}cm`
}
