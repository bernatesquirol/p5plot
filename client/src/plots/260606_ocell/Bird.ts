import { Segment } from '@flatten-js/core'
import { drawFlatten } from '../../utils'
import { Plot, PlotCtx } from '../../core/plot'
import { Handle } from '../../components/Handle'
import { handleLabel, overlayStrand, ribs, SpineSample, Strand, TAU } from './spine'

/** Everything about one bird. Normalised x/y/length are relative to its box. */
export type BirdSpec = {
  x: number
  y: number
  /** length along the centre line, as a fraction of the box width */
  length: number
  /** shrinks or grows the whole bird: lengths, rib heights, offsets, all of it */
  scale: number
  /** tilt of the centre line, radians; past ±90° the bird points the other way */
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
  x: 0.5, y: 0.5, length: 0.2, angle: 0, scale: 1,
  n: 40, frequency: 2.5, phase: 0,
  heightAbove: 6, heightBelow: 6, offsetC: 2,
  smoothAbove: 0, smoothBelow: 0,
  headN: 0, head: true,
  double: false, doublePhase: 0.2, doubleOffsetC: 4, doubleSwapHeights: true,
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

  constructor(ctx: PlotCtx, spec: Partial<BirdSpec> = {}) {
    super(ctx)
    const d = { ...BIRD, ...spec }

    const x = this.num('x', d.x, { min: -0.5, max: 1.5, step: 0.005 })
    const y = this.num('y', d.y, { min: -0.5, max: 1.5, step: 0.005 })
    const length = this.num('length', d.length, { min: 0.01, max: 2, step: 0.005 })
    const scale = this.num('scale', d.scale, { min: 0.05, max: 4, step: 0.01 })
    const angle = this.num('angle', d.angle, { min: -Math.PI, max: Math.PI, step: 0.01 })
    const n = this.num('n', d.n, { min: 2, max: 600, step: 1 })
    const frequency = this.num('frequency', d.frequency, { min: 0.1, max: 12, step: 0.1 })
    const phase = this.num('phase', d.phase, { min: 0, max: TAU, step: 0.01 })
    const heightAbove = this.num('heightAbove', d.heightAbove, { min: 0, max: 120, step: 0.5 })
    const heightBelow = this.num('heightBelow', d.heightBelow, { min: 0, max: 120, step: 0.5 })
    const offsetC = this.num('offsetC', d.offsetC, { min: -40, max: 40, step: 0.5 })
    const smoothAbove = this.num('smoothAbove', d.smoothAbove, { min: 0, max: 40, step: 0.5 })
    const smoothBelow = this.num('smoothBelow', d.smoothBelow, { min: 0, max: 40, step: 0.5 })
    const headN = this.num('headN', d.headN, { min: 0, max: 60, step: 1 })
    const head = this.bool('head', d.head)
    const double = this.bool('double', d.double)

    // The centre line runs through (x, y) at `angle`. Swing past a right angle
    // and dx goes negative: the ribs march the other way and the bird reverses.
    const half = (length * scale * this.width) / 2
    const dx = half * Math.cos(angle)
    const dy = half * Math.sin(angle)
    const x0 = this.box.toX(x) - dx
    const yA = this.box.toY(y) - dy
    const yB = this.box.toY(y) + dy

    // everything with a size in it reads through the scale
    const strand: Strand = {
      phase, head,
      offsetC: offsetC * scale,
      heightAbove: heightAbove * scale,
      heightBelow: heightBelow * scale,
    }
    const ribOpts = {
      frequency, headN,
      smoothAbove: smoothAbove * scale,
      smoothBelow: smoothBelow * scale,
    }
    // The overlay's params only exist while it does, to keep folders short.
    const overlay = double ? overlayStrand(this, strand, d, scale) : null

    const samples = straightSpine({ x0, yA, yB, dx, n })
    this.spine = [
      ...ribs(samples, { ...strand, head: head && !double }, ribOpts),
      ...(overlay ? ribs(samples, overlay, ribOpts) : []),
    ]

    // drag the middle to move the bird, the tip to aim and stretch it — all
    // the way round, so dragging the tip past the middle reverses the bird
    Handle.param(this, 'x', 'y', { label: handleLabel(this.params.path) })
    new Handle(this, {
      id: 'tip',
      at: () => ({ x: x + dx / this.width, y: y + dy / this.height }),
      move: (tipX, tipY) => {
        const armX = (tipX - x) * this.width
        const armY = (tipY - y) * this.height
        const arm = Math.hypot(armX, armY)
        if (arm < 1) return // dropped on the middle: no direction to read
        this.params.set('length', (2 * arm) / this.width / scale, { silent: true })
        this.params.set('angle', Math.atan2(armY, armX))
      },
    })
  }

  draw() {
    this.layer('lines', () => drawFlatten(this.p5, this.spine))
  }
}

/**
 * Ribs march along x in even steps while the centre line slides from yA to yB.
 * They stay vertical whatever the tilt — that is what makes a bird a bird.
 */
function straightSpine({ x0, yA, yB, dx, n }: {
  x0: number, yA: number, yB: number, dx: number, n: number,
}): SpineSample[] {
  const spacing = (2 * dx) / n
  return Array.from({ length: n }, (_v, i) => ({
    at: { x: x0 + spacing * (i + 0.5), y: yA + (yB - yA) * (i / n) },
    out: { x: 0, y: -1 },
    along: { x: 1, y: 0 },
  }))
}
