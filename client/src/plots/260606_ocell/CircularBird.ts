import { Segment } from '@flatten-js/core'
import { drawFlatten } from '../../utils'
import { definePlot, Plot, PlotCtx } from '../../core/plot'
import { cm } from '../../core/paper'
import { Handle } from '../../components/Handle'
import { handleLabel, overlayStrand, ribs, SpineSample, Strand, TAU } from './spine'

/** Everything about one circular bird. x/y are relative to its box. */
export type CircularBirdSpec = {
  /** centre of the spiral */
  x: number
  y: number
  /** shrinks or grows the whole figure: radii, rib heights, offsets, all of it */
  scale: number
  /** where the spine starts and ends: radius as a fraction of half the short side */
  startRadius: number
  endRadius: number
  /** and at what angle, in radians */
  startAngle: number
  endAngle: number
  /** whole turns between start and end, on top of the angle between them */
  loops: number
  /**
   * How the radius grows between the two ends — where the turns bunch up.
   * 0 grows it evenly, the plain Archimedean spiral. Negative pulls the inner
   * turns together and opens out the rim; positive does the opposite, crowding
   * the outer turns. Ribs stay evenly spaced along the spine either way.
   */
  density: number
  /**
   * How many ribs per centimetre of spine, at the start and at the end. The
   * total follows from how long the spiral turns out to be, so the weave keeps
   * its weight when you add loops or drag an end further out.
   */
  linesPerCm: number
  linesPerCmEnd: number
  /**
   * Ribs dropped off each end, cutting the drawn path short of where the spine
   * actually starts and finishes. The handles stay put at the real ends, and
   * what is left keeps the wave and the heights it had, so trimming reveals
   * part of the spine rather than restyling it.
   */
  cutStart: number
  cutEnd: number
  /** waves of the spine over the whole spiral */
  frequency: number
  phase: number
  /** heights are measured outward from the middle, in paper pixels */
  heightAbove: number
  heightBelow: number
  /** and again at the far end of the spine: the ribs grow or shrink on the way */
  heightAboveEnd: number
  heightBelowEnd: number
  /** how abruptly the heights get there: 1 straight, higher saves it for the end */
  heightCurve: number
  /** nudge of the hinge, along the spiral */
  offsetC: number
  smoothAbove: number
  smoothBelow: number
  /** ribs at the head end, drawn short */
  headN: number
  head: boolean
  /** a second strand over the first, slightly out of phase */
  double: boolean
  doublePhase: number
  doubleOffsetC: number
  doubleSwapHeights: boolean
}

export const CIRCULAR_BIRD: CircularBirdSpec = {
  x: 0.5, y: 0.5, scale: 1,
  startRadius: 0.15, endRadius: 0.95,
  startAngle: 0, endAngle: 0,
  loops: 2,
  density: 0,
  linesPerCm: 14, linesPerCmEnd: 14,
  cutStart: 0, cutEnd: 0,
  // the frequency counts waves over the whole spine, so it scales with the loops
  frequency: 45, phase: 0,
  heightAbove: 12, heightBelow: 9,
  heightAboveEnd: 12, heightBelowEnd: 9,
  heightCurve: 1,
  offsetC: 3,
  smoothAbove: 2, smoothBelow: 2,
  headN: 6, head: true,
  double: true, doublePhase: 0.2, doubleOffsetC: 4, doubleSwapHeights: true,
}

const wrapTau = (a: number) => ((a % TAU) + TAU) % TAU
/** a ceiling on how much ink one bird can ask for */
const MAX_RIBS = 12000

/**
 * A bird wound up: the same ribs as `Bird`, hung off an Archimedean spiral
 * instead of a straight line. Heights are measured outward from the middle
 * and the hinge is nudged along the curve, so a rib reads the same as it does
 * on a straight spine — it just points away from the centre.
 *
 * The spine runs from (startRadius, startAngle) to (endRadius, endAngle),
 * winding `loops` whole turns on the way. Drag the middle to move it, the two
 * end handles to set where the spine begins and finishes.
 */
export class CircularBird extends Plot {
  spine: Segment[]

  constructor(ctx: PlotCtx, spec: Partial<CircularBirdSpec> = {}) {
    super(ctx)
    const d = { ...CIRCULAR_BIRD, ...spec }

    const x = this.num('x', d.x, { min: -0.5, max: 1.5, step: 0.005 })
    const y = this.num('y', d.y, { min: -0.5, max: 1.5, step: 0.005 })
    const scale = this.num('scale', d.scale, { min: 0.05, max: 4, step: 0.01 })
    const startRadius = this.num('startRadius', d.startRadius, { min: 0, max: 1.5, step: 0.005 })
    const endRadius = this.num('endRadius', d.endRadius, { min: 0, max: 1.5, step: 0.005 })
    const startAngle = this.num('startAngle', d.startAngle, { min: -Math.PI, max: Math.PI, step: 0.01 })
    const endAngle = this.num('endAngle', d.endAngle, { min: -Math.PI, max: Math.PI, step: 0.01 })
    const loops = this.num('loops', d.loops, { min: 0, max: 12, step: 0.05 })
    const density = this.num('density', d.density, { min: -3, max: 3, step: 0.05 })
    const linesPerCm = this.num('linesPerCm', d.linesPerCm, { min: 0.5, max: 60, step: 0.5 })
    const linesPerCmEnd = this.num('linesPerCmEnd', d.linesPerCmEnd, { min: 0.5, max: 60, step: 0.5 })
    const cutStart = this.num('cutStart', d.cutStart, { min: 0, max: 2000, step: 1 })
    const cutEnd = this.num('cutEnd', d.cutEnd, { min: 0, max: 2000, step: 1 })
    const frequency = this.num('frequency', d.frequency, { min: 0.1, max: 200, step: 0.5 })
    const phase = this.num('phase', d.phase, { min: 0, max: TAU, step: 0.01 })
    const heightAbove = this.num('heightAbove', d.heightAbove, { min: 0, max: 120, step: 0.5 })
    const heightAboveEnd = this.num('heightAboveEnd', d.heightAboveEnd, { min: 0, max: 120, step: 0.5 })
    const heightBelow = this.num('heightBelow', d.heightBelow, { min: 0, max: 120, step: 0.5 })
    const heightBelowEnd = this.num('heightBelowEnd', d.heightBelowEnd, { min: 0, max: 120, step: 0.5 })
    const heightCurve = this.num('heightCurve', d.heightCurve, { min: 0.1, max: 6, step: 0.05 })
    const offsetC = this.num('offsetC', d.offsetC, { min: -40, max: 40, step: 0.5 })
    const smoothAbove = this.num('smoothAbove', d.smoothAbove, { min: 0, max: 40, step: 0.5 })
    const smoothBelow = this.num('smoothBelow', d.smoothBelow, { min: 0, max: 40, step: 0.5 })
    const headN = this.num('headN', d.headN, { min: 0, max: 60, step: 1 })
    const head = this.bool('head', d.head)
    const double = this.bool('double', d.double)

    // one knob for the whole figure: radii and every height read through it
    const unit = (this.box.shortSide / 2) * scale
    const centre = { x: this.box.toX(x), y: this.box.toY(y) }
    // the angle between the ends, plus however many whole turns were asked for
    const sweep = wrapTau(endAngle - startAngle) + loops * TAU

    const strand: Strand = {
      phase, head, heightCurve,
      offsetC: offsetC * scale,
      heightAbove: heightAbove * scale,
      heightBelow: heightBelow * scale,
      heightAboveEnd: heightAboveEnd * scale,
      heightBelowEnd: heightBelowEnd * scale,
    }
    const ribOpts = {
      frequency, headN,
      smoothAbove: smoothAbove * scale,
      smoothBelow: smoothBelow * scale,
    }
    const overlay = double ? overlayStrand(this, strand, d, scale) : null

    const whole = spiralSpine({
      centre, sweep, density, startAngle,
      r0: startRadius * unit,
      r1: endRadius * unit,
      perPx: [linesPerCm / cm(1), linesPerCmEnd / cm(1)],
    })
    // cut the ends off, keeping at least a rib or two to draw
    const last = Math.max(cutStart + 2, whole.length - cutEnd)
    const samples = whole.slice(Math.min(cutStart, Math.max(0, whole.length - 2)), last)
    this.spine = [
      ...ribs(samples, { ...strand, head: head && !double }, ribOpts),
      ...(overlay ? ribs(samples, overlay, ribOpts) : []),
    ]

    Handle.param(this, 'x', 'y', { label: handleLabel(this.params.path) })
    this.endHandle('start', 'startRadius', 'startAngle', startRadius, startAngle, unit, x, y)
    this.endHandle('end', 'endRadius', 'endAngle', endRadius, endAngle, unit, x, y)
  }

  /** A handle on one end of the spine, writing back radius and angle. */
  private endHandle(
    id: string, radiusKey: string, angleKey: string,
    radius: number, angle: number, unit: number, x: number, y: number,
  ) {
    new Handle(this, {
      id,
      label: id,
      clamp: [-0.5, 1.5],
      at: () => ({
        x: x + (radius * unit * Math.cos(angle)) / this.width,
        y: y + (radius * unit * Math.sin(angle)) / this.height,
      }),
      move: (px, py) => {
        const armX = (px - x) * this.width
        const armY = (py - y) * this.height
        const arm = Math.hypot(armX, armY)
        this.params.set(radiusKey, arm / unit, { silent: true })
        // right on the middle there is no direction to read, so keep the old one
        this.params.set(angleKey, arm < 1 ? angle : Math.atan2(armY, armX))
      },
    })
  }


  draw() {
    this.layer('lines', () => drawFlatten(this.p5, this.spine))
  }
}

/**
 * Ribs pointing away from the middle, marching round a spiral.
 *
 * Two separate things decide where a rib lands. `density` warps the radius —
 * r = r0 + dr * t^p, with p = 2^-density — so the turns can bunch towards the
 * middle or towards the rim. Then the ribs are placed at equal *lengths* along
 * whatever curve that gives, off a cumulative length table, because stepping
 * the parameter evenly would clot the tight middle and thin out the rim.
 */
function spiralSpine({ centre, sweep, startAngle, r0, r1, density, perPx }: {
  centre: { x: number, y: number }, sweep: number, startAngle: number,
  r0: number, r1: number, density: number,
  /** ribs per paper pixel, at the start and at the end of the spine */
  perPx: [number, number],
}): SpineSample[] {
  const dr = r1 - r0
  const power = Math.pow(2, -density)
  const radiusAt = (t: number) => r0 + dr * (power === 1 ? t : Math.pow(t, power))
  const pointAt = (t: number) => {
    const theta = startAngle + sweep * t
    const r = radiusAt(t)
    return { x: centre.x + r * Math.cos(theta), y: centre.y + r * Math.sin(theta) }
  }

  // Cumulative length, measured off the curve rather than differentiated: the
  // warp's slope runs away at t = 0 for some powers, chords never do.
  const steps = 2048
  const lengths = [0]
  let previous = pointAt(0)
  for (let j = 1; j <= steps; j++) {
    const here = pointAt(j / steps)
    lengths.push(lengths[j - 1] + Math.hypot(here.x - previous.x, here.y - previous.y))
    previous = here
  }
  const total = lengths[steps]

  /** the parameter at which the spine has run `target` long */
  const paramAtLength = (target: number) => {
    let lo = 0
    let hi = steps
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (lengths[mid] < target) lo = mid + 1
      else hi = mid
    }
    if (lo === 0) return 0
    const before = lengths[lo - 1]
    const span = lengths[lo] - before
    const within = span > 0 ? (target - before) / span : 0
    return (lo - 1 + within) / steps
  }

  // Walk the spine dropping a rib every 1/density, with the density ramping
  // from one end to the other. A flat ramp is just even spacing.
  const [per0, per1] = perPx
  const wanted = ((per0 + per1) / 2) * total
  // an over-eager density would take all day to draw: thin it out to fit
  const thin = wanted > MAX_RIBS ? wanted / MAX_RIBS : 1
  const marks: number[] = []
  for (let s = 0; s < total; ) {
    marks.push(s)
    const per = per0 + (per1 - per0) * (s / total)
    s += (thin / Math.max(per, 1e-6))
  }

  const nudge = 0.5 / steps
  return marks.map(s => {
    const fraction = total > 0 ? s / total : 0
    const t = total > 0 ? paramAtLength(s) : 0
    const theta = startAngle + sweep * t
    const at = pointAt(t)
    // heading, from the curve either side: same reason as the length table
    const back = pointAt(Math.max(0, t - nudge))
    const ahead = pointAt(Math.min(1, t + nudge))
    const tx = ahead.x - back.x
    const ty = ahead.y - back.y
    const len = Math.hypot(tx, ty) || 1
    return {
      at,
      out: { x: Math.cos(theta), y: Math.sin(theta) },
      along: { x: tx / len, y: ty / len },
      t: fraction,
    }
  })
}

export default definePlot({
  title: 'Circular bird',
  sheet: 'SQUARE',
  orientation: 'portrait',
  animated: false,
  signature: true,
  create: ctx => new CircularBird(ctx),
})
