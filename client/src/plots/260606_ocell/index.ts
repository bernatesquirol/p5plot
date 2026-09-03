import { definePlot, Plot, PlotCtx } from '../../core/plot'
import { Rect } from '../../core/rect'
import { Margins } from '../../components/Margins'
import { Signature } from '../../components/Signature'
import { Bird, BirdSpec } from './Bird'

/** Folders are kept for this many birds, so shrinking `birds` cleans up. */
const MAX_BIRDS = 24

/** The flock as it was hand-tuned: one big doubled bird plus three small ones. */
const FLOCK: Partial<BirdSpec>[] = [
  { x: 0.50, y: 0.50, length: 1.00, angle: 0.00, n: 200, frequency: 2.5, heightAbove: 52, heightBelow: 60, offsetC: 5, smoothAbove: 10, smoothBelow: 10, headN: 5, double: true, doublePhase: 0.2, doubleOffsetC: 4 },
  { x: 0.70, y: 0.10, length: 0.10, angle: 0.10, n: 30, frequency: 2.0, heightAbove: 5, heightBelow: 6, offsetC: 2 },
  { x: 0.30, y: 0.10, length: 0.20, angle: -0.15, n: 40, frequency: 2.5, heightAbove: 6, heightBelow: 8, offsetC: 2 },
  { x: 0.51, y: 0.80, length: 0.15, angle: 0.35, n: 50, frequency: 3.0, heightAbove: 8, heightBelow: 5, offsetC: 2, phase: 0.3 },
]

/** Birds past the hand-tuned ones: spread around the cell, tweak from there. */
const strayBird = (i: number): Partial<BirdSpec> => ({
  x: (0.5 + 0.618 * i) % 1,
  y: (0.2 + 0.382 * i) % 1,
  length: 0.12,
  angle: ((i % 3) - 1) * 0.2,
  n: 40,
  frequency: 2 + (i % 4) * 0.5,
  heightAbove: 4,
  heightBelow: 5,
  offsetC: 2,
  phase: (i * 0.3) % 1,
})

/** A flock of fish spines inside a margined cell, one param folder per bird. */
export class Ocell extends Plot {
  margins: Margins
  cell: Rect
  birds: Bird[] = []
  signature: Signature

  constructor(ctx: PlotCtx) {
    super(ctx)

    const count = this.num('birds', FLOCK.length, { min: 0, max: MAX_BIRDS, step: 1 })

    this.margins = new Margins(this.p5, {
      ...this.box,
      xTracks: '2cm 1 2cm',
      yTracks: '1cm 2 1 1cm',
    })
    this.cell = this.margins.regions[1][1]

    for (let i = 0; i < count; i++) {
      this.birds.push(new Bird(ctx.child(`bird${i}`, this.cell), FLOCK[i] ?? strayBird(i)))
    }
    // Folders live in the panel, not in the plot tree, so a bird that is gone
    // has to be hidden by hand — its values wait there in case it comes back.
    for (let i = 0; i < MAX_BIRDS; i++) this.params.child(`bird${i}`).show(i < count)

    const scale = this.num('signatureScale', 0.05, { min: 0.01, max: 0.3, step: 0.005 })
    this.signature = new Signature(this.p5, {
      x: this.box.toX(0.9),
      y: this.box.toY(0.9),
      width: this.height * scale,
      height: this.height * scale,
      rng: this.rng,
    })
  }

  draw() {
    this.layer('margins', () => this.margins.draw())
    this.birds.forEach(bird => bird.draw())
    this.layer('signature', () => this.signature.draw(), { visible: false })
  }
}

export default definePlot({
  title: 'Ocell',
  sheet: 'IKEA',
  orientation: 'landscape',
  animated: false,
  create: ctx => new Ocell(ctx),
})
