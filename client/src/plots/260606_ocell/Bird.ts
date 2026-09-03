import { point, segment, Segment } from '@flatten-js/core'
import { drawFlatten } from '../../utils'
import { Plot, PlotCtx } from '../../core/plot'

const TAU = Math.PI * 2

/** Everything about one bird. Normalised x/y/length are relative to its box. */
export type BirdSpec = {
  x: number
  y: number
  /** span along the centre line, as a fraction of the box width */
  length: number
  /** tilt of the centre line, radians */
  angle: number
  /** number of ribs */
  n: number
  /** waves of the centre line over the whole span */
  frequency: number
  phase: number
  heightAbove: number
  heightBelow: number
  /** sideways nudge of the hinge point, in paper pixels */
  offsetC: number
  smoothAbove: number
  smoothBelow: number
  /** ribs at the head end, drawn short */
  headN: number
  head: boolean
  /** draw a second strand over the first, so the bird reads as two-toned */
  double: boolean
  /** the overlay's phase, relative to the main strand */
  doublePhase: number
  /** the overlay's hinge offset, relative to the main strand */
  doubleOffsetC: number
  /** overlay leans the other way: above/below heights traded */
  doubleSwapHeights: boolean
}

export const BIRD: BirdSpec = {
  x: 0.5, y: 0.5, length: 0.2, angle: 0,
  n: 40, frequency: 2.5, phase: 0,
  heightAbove: 6, heightBelow: 6, offsetC: 2,
  smoothAbove: 0, smoothBelow: 0,
  headN: 0, head: true,
  double: false, doublePhase: 0.2, doubleOffsetC: 4, doubleSwapHeights: true,
}

/** One strand of ribs: what differs between a bird and its overlay. */
type Strand = {
  phase: number
  offsetC: number
  heightAbove: number
  heightBelow: number
  head: boolean
}

/**
 * One fish spine: vertical ribs hanging off a wavy centre line, each rib
 * hinged at a control point so it reads as a bone rather than a stroke.
 *
 * A bird can be `double`: two strands on the same centre line, slightly out
 * of phase, the overlay carrying the short head ribs. Every bird gets its own
 * param folder (see `Ocell`), so a flock is edited bird by bird.
 */
export class Bird extends Plot {
  spine: Segment[]
  /** resolved geometry of the centre line, in paper pixels */
  private line: { x0: number, yA: number, yB: number, spacing: number }
  private n: number
  private frequency: number
  private headN: number
  private smoothAbove: number
  private smoothBelow: number

  constructor(ctx: PlotCtx, spec: Partial<BirdSpec> = {}) {
    super(ctx)
    const d = { ...BIRD, ...spec }

    const x = this.num('x', d.x, { min: -0.5, max: 1.5, step: 0.005 })
    const y = this.num('y', d.y, { min: -0.5, max: 1.5, step: 0.005 })
    const length = this.num('length', d.length, { min: 0.01, max: 2, step: 0.005 })
    const angle = this.num('angle', d.angle, { min: -1.2, max: 1.2, step: 0.01 })
    this.n = this.num('n', d.n, { min: 2, max: 600, step: 1 })
    this.frequency = this.num('frequency', d.frequency, { min: 0.1, max: 12, step: 0.1 })
    const phase = this.num('phase', d.phase, { min: 0, max: TAU, step: 0.01 })
    const heightAbove = this.num('heightAbove', d.heightAbove, { min: 0, max: 120, step: 0.5 })
    const heightBelow = this.num('heightBelow', d.heightBelow, { min: 0, max: 120, step: 0.5 })
    const offsetC = this.num('offsetC', d.offsetC, { min: -40, max: 40, step: 0.5 })
    this.smoothAbove = this.num('smoothAbove', d.smoothAbove, { min: 0, max: 40, step: 0.5 })
    this.smoothBelow = this.num('smoothBelow', d.smoothBelow, { min: 0, max: 40, step: 0.5 })
    this.headN = this.num('headN', d.headN, { min: 0, max: 60, step: 1 })
    const head = this.bool('head', d.head)
    const double = this.bool('double', d.double)

    // The centre line runs through (x, y), tilted by `angle`.
    const halfW = (length * this.width) / 2
    const halfH = halfW * Math.tan(angle)
    this.line = {
      x0: this.box.toX(x) - halfW,
      yA: this.box.toY(y) - halfH,
      yB: this.box.toY(y) + halfH,
      spacing: (2 * halfW) / this.n,
    }

    // The overlay's params only exist while it does, to keep folders short.
    let overlay: Strand | null = null
    if (double) {
      const swap = this.bool('doubleSwapHeights', d.doubleSwapHeights)
      overlay = {
        phase: phase + this.num('doublePhase', d.doublePhase, { min: -TAU, max: TAU, step: 0.01 }),
        offsetC: offsetC + this.num('doubleOffsetC', d.doubleOffsetC, { min: -40, max: 40, step: 0.5 }),
        heightAbove: swap ? heightBelow : heightAbove,
        heightBelow: swap ? heightAbove : heightBelow,
        // the head ribs are drawn once, by the overlay when there is one
        head,
      }
    }

    this.spine = [
      ...this.ribs({ phase, offsetC, heightAbove, heightBelow, head: head && !double }),
      ...(overlay ? this.ribs(overlay) : []),
    ]
  }

  private ribs({ phase, offsetC, heightAbove, heightBelow, head }: Strand): Segment[] {
    const { x0, yA, yB, spacing } = this.line
    return Array.from({ length: this.n }, (_v, i) => {
      if (i === 0 || (!head && i < this.headN)) return []
      const cx = x0 + spacing * (i + 0.5)
      const centerY = yA + (yB - yA) * (i / this.n)
      const wave = Math.sin((TAU * this.frequency * i) / this.n + phase)
      const other = wave >= 0
        ? centerY - heightAbove * wave
        : centerY + heightBelow * Math.abs(wave)
      const startY = wave < 0
        ? centerY + this.smoothAbove * Math.abs(wave)
        : centerY - this.smoothBelow * wave
      const c = point(cx + offsetC, (startY + other) / 2)
      return i < this.headN
        ? [segment(point(cx, startY), c)]
        : [segment(point(cx, startY), c), segment(c, point(cx, other))]
    }).flat()
  }

  draw() {
    this.layer('lines', () => drawFlatten(this.p5, this.spine))
  }
}
