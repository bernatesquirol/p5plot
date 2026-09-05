import { BucketRack, describeLength, isPlotting, PaintJob } from '../core/paint'
import { cm, mm } from '../core/paper'
import { Plot } from '../core/plot'

/** Bucket colours to start from; each one is a param, so this is only a seed. */
export const PALETTE = ['#2f6f9f', '#3f8f7f', '#c8a02f', '#c05a3f', '#7f4f8f', '#33383d']
export const WATER = '#bcd9e6'

export type PaintRigOpts = {
  /** starting colours; the panel keeps a pot per entry whatever the count */
  palette?: string[]
  /** how many of them are in play */
  colours?: number
  brush_mm?: number
  capacity_cm?: number
  order?: 'given' | 'byBucket'
  water?: boolean
}

/**
 * The whole painting setup, off the shelf: pots either side of the sheet, one
 * brush that runs out, a watercolour preview, and the two layers they go in.
 *
 * Every painting plot needs the same three folders of params — how big the
 * pots are, how much line a dip is good for, what the preview shows — so they
 * live here rather than being retyped per plot. What a plot still owns is the
 * only interesting part: which strokes to paint, in which order.
 *
 *   const rig = new PaintRig(this)
 *   rig.job.stroke(rig.colour(0), points)
 *   // in draw():
 *   rig.draw()
 */
export class PaintRig {
  rack: BucketRack
  job: PaintJob
  /** brush width in paper pixels */
  brush: number
  /** bucket ids of the colours in play, in palette order */
  colours: string[]

  constructor(private plot: Plot, opts: PaintRigOpts = {}) {
    const palette = opts.palette ?? PALETTE

    // --- the paint, in pots either side of the sheet ---
    const pots = plot.params.child('buckets')
    const count = pots.num('colours', opts.colours ?? 4, { min: 1, max: palette.length, step: 1 })
    const radius = pots.num('radius_cm', 2, { min: 0.5, max: 6, step: 0.1 })
    const gap = pots.num('gap_cm', 0.8, { min: 0, max: 6, step: 0.1 })
    const inset = pots.num('inset_cm', 1, { min: 0, max: 10, step: 0.1 })
    const water = pots.bool('water', opts.water !== false, { label: 'water pot' })
    // every pot is registered whatever the count, so shrinking the palette and
    // growing it again gives back the colours you mixed, not the defaults
    const mixed = palette.map((hex, i) => pots.color(`c${i}`, hex))
    mixed.forEach((_, i) => pots.showControl(`c${i}`, i < count))

    this.colours = mixed.slice(0, count).map((_, i) => `c${i}`)
    this.rack = new BucketRack({
      bed: plot.bed,
      sheet: plot.sheet,
      buckets: [
        ...mixed.slice(0, count).map((hex, i) => ({ id: `c${i}`, hex })),
        ...(water ? [{ id: 'water', hex: WATER, label: 'water' }] : []),
      ],
      radius: cm(radius),
      gap: cm(gap),
      inset: cm(inset),
    })

    // --- the brush: one of them, and it runs out ---
    const brush = plot.params.child('brush')
    this.brush = mm(brush.num('width_mm', opts.brush_mm ?? 12, { min: 1, max: 60, step: 0.5 }))
    const capacity = cm(brush.num('capacity_cm', opts.capacity_cm ?? 40, { min: 2, max: 400, step: 1, label: 'paint per dip (cm)' }))
    const dipTurns = brush.num('dipTurns', 2, { min: 0.5, max: 8, step: 0.5 })
    const dipRadius = brush.num('dipRadius', 0.6, { min: 0.1, max: 0.95, step: 0.05 })
    const order = brush.choice<'given' | 'byBucket'>('order', opts.order ?? 'byBucket', ['given', 'byBucket'])
    const rinse = brush.bool('rinse', true, { label: 'rinse between colours' })
    brush.showControl('rinse', water)

    this.job = new PaintJob({
      rack: this.rack,
      brush: this.brush,
      capacity,
      dipTurns,
      dipRadius,
      order,
      rinse: water && rinse ? 'water' : undefined,
      rng: plot.rng,
    })

    // --- what the screen shows; none of it reaches the file ---
    const view = plot.params.child('preview')
    view.bool('wash', true, { rebuild: false })
    view.bool('paths', false, { rebuild: false, label: 'plotter paths' })
    view.bool('travel', false, { rebuild: false, label: 'pen-up travel' })
    view.num('passes', 6, { min: 1, max: 14, step: 1, rebuild: false })
    view.num('alpha', 0.16, { min: 0.02, max: 0.5, step: 0.01, rebuild: false })
    view.num('spread', 0.22, { min: 0, max: 1, step: 0.02, rebuild: false })
  }

  /** Bucket id for palette index `i`, wrapped — colours are picked by number. */
  colour(i: number) {
    const n = this.colours.length
    return this.colours[((Math.round(i) % n) + n) % n]
  }

  /**
   * Queue the paint and the pots into their layers. Call it first in draw():
   * the paint layer has to be claimed before anything else, since it is the
   * only one the brush ever sees and its path order is the painting.
   */
  draw() {
    const p = this.plot.p5
    const view = this.plot.params.child('preview')
    this.plot.layer('paint', () => this.job.draw(p, {
      wash: view.get('wash'),
      paths: view.get('paths'),
      travel: view.get('travel'),
      washOpts: {
        passes: view.get('passes'),
        alpha: view.get('alpha'),
        spread: view.get('spread'),
      },
    }))
    this.plot.layer('buckets', () => {
      this.rack.draw(p)
      this.readout()
    })
  }

  /** How long the job is, and whether the setup is physically possible. */
  readout() {
    if (isPlotting()) return
    const p = this.plot.p5
    const bed = this.plot.bed
    const s = this.job.stats()
    p.push()
    p.noStroke()
    p.textSize(cm(0.32))
    p.textAlign(p.LEFT, p.BOTTOM)
    p.fill(90, 86, 80)
    p.text(
      `${s.strokes} strokes · ${s.dips} dips · ${s.changes} colour changes · ${describeLength(s.painted)} painted · ${describeLength(s.travel)} travel`,
      bed.x + cm(0.4), bed.y + cm(0.9),
    )
    if (this.rack.clash) {
      p.fill('#d2431f')
      p.text('a bucket is on top of the sheet — move the paper or shrink the pots', bed.x + cm(0.4), bed.y + cm(1.5))
    }
    p.pop()
  }
}
