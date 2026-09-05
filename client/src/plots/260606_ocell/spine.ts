import { point, segment, Segment } from '@flatten-js/core'

export const TAU = Math.PI * 2

type Vec = { x: number, y: number }

/**
 * The spine sampled at one place: where a rib is rooted, which way it points
 * ("out", the direction heights are measured along) and which way the spine is
 * heading ("along", the direction the hinge is nudged). Both are unit vectors.
 *
 * A straight bird's ribs point up and its spine runs sideways; a spiral one's
 * ribs point away from the middle and its spine runs round. Same ribs either way.
 */
export type SpineSample = {
  at: Vec
  out: Vec
  along: Vec
  /**
   * How far along the spine this rib sits, 0..1 — by *length*, not by count.
   * Only needed where ribs aren't evenly spaced: the wave and the height taper
   * read it, so they stay put on the paper however the spacing is ramped.
   * Left out, the rib's position in the list stands in for it.
   */
  t?: number
}

/** One strand of ribs: what differs between a bird and its overlay. */
export type Strand = {
  phase: number
  offsetC: number
  /** rib height at the head end of the spine */
  heightAbove: number
  heightBelow: number
  /** and at the far end, if the ribs are to grow or shrink along the way */
  heightAboveEnd?: number
  heightBelowEnd?: number
  /**
   * How the ramp between the two gets there. 1 is a straight line; higher
   * holds the near value and swings hard at the far end; lower does the change
   * up front and then holds. Sharper either way than a straight ramp can be.
   */
  heightCurve?: number
  head: boolean
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export type RibOpts = {
  frequency: number
  headN: number
  smoothAbove: number
  smoothBelow: number
}

/**
 * Vertical ribs hanging off a wavy centre line, each hinged at a control point
 * so it reads as a bone rather than a stroke. The wave carries the rib out one
 * side and then the other; near the head only the root half is drawn.
 */
export function ribs(spine: SpineSample[], strand: Strand, opts: RibOpts): Segment[] {
  const n = spine.length
  const out: Segment[] = []
  spine.forEach((sample, i) => {
    if (i === 0 || (!strand.head && i < opts.headN)) return
    const t = sample.t ?? i / n
    const wave = Math.sin(TAU * opts.frequency * t + strand.phase)
    // ribs may grow or shrink along the spine, which is how a long spiral keeps
    // an even weight when its middle is tight and its rim is wide
    const curve = strand.heightCurve ?? 1
    const ramp = curve === 1 ? t : Math.pow(t, curve)
    const above = lerp(strand.heightAbove, strand.heightAboveEnd ?? strand.heightAbove, ramp)
    const below = lerp(strand.heightBelow, strand.heightBelowEnd ?? strand.heightBelow, ramp)
    // both ends of a rib lean the same way; the root leans much less
    const tip = wave >= 0 ? above * wave : -below * Math.abs(wave)
    const root = wave >= 0 ? opts.smoothBelow * wave : -opts.smoothAbove * Math.abs(wave)
    const a = { x: sample.at.x + sample.out.x * root, y: sample.at.y + sample.out.y * root }
    const b = { x: sample.at.x + sample.out.x * tip, y: sample.at.y + sample.out.y * tip }
    const c = {
      x: (a.x + b.x) / 2 + sample.along.x * strand.offsetC,
      y: (a.y + b.y) / 2 + sample.along.y * strand.offsetC,
    }
    out.push(segment(point(a.x, a.y), point(c.x, c.y)))
    if (i >= opts.headN) out.push(segment(point(c.x, c.y), point(b.x, b.y)))
  })
  return out
}

/**
 * What to write next to a bird's middle handle: the folder it lives in, which
 * is 'bird3' in a flock or 'spiral' in a playground slot. A plot that owns the
 * whole sheet has no interesting folder name, so it gets no label.
 */
export function handleLabel(path: string) {
  const folder = path.split('/').pop()
  return folder === 'plot' ? undefined : folder
}

/** The overlay half of a doubled bird, or nothing when it is single. */
export function overlayStrand(
  plot: { num: (k: string, d: number, o?: any) => number, bool: (k: string, d: boolean) => boolean },
  base: Strand,
  defaults: { doublePhase: number, doubleOffsetC: number, doubleSwapHeights: boolean },
  /** the figure's scale, so the overlay's offset shrinks with everything else */
  scale = 1,
): Strand {
  const swap = plot.bool('doubleSwapHeights', defaults.doubleSwapHeights)
  return {
    phase: base.phase + plot.num('doublePhase', defaults.doublePhase, { min: -TAU, max: TAU, step: 0.01 }),
    offsetC: base.offsetC + plot.num('doubleOffsetC', defaults.doubleOffsetC, { min: -40, max: 40, step: 0.5 }) * scale,
    heightAbove: swap ? base.heightBelow : base.heightAbove,
    heightBelow: swap ? base.heightAbove : base.heightBelow,
    heightAboveEnd: swap ? base.heightBelowEnd : base.heightAboveEnd,
    heightBelowEnd: swap ? base.heightAboveEnd : base.heightBelowEnd,
    heightCurve: base.heightCurve,
    // the head ribs are drawn once, by the overlay when there is one
    head: base.head,
  }
}
