import { definePlot, Plot, PlotCtx } from '../../core/plot'
import { Bird, BIRD, BirdSpec } from './Bird'

/** Folders are kept for this many birds, so shrinking `birds` cleans up. */
const MAX_BIRDS = 24

/** The flock as it was hand-tuned: one big doubled bird plus three small ones. */
const FLOCK: Partial<BirdSpec>[] = [
  { x: 0.50, y: 0.50, length: 1.00, angle: 0.00, n: 200, frequency: 2.5, heightAbove: 52, heightBelow: 60, offsetC: 5, smoothAbove: 10, smoothBelow: 10, headN: 5, double: true, doublePhase: 0.2, doubleOffsetC: 4 },
  { x: 0.70, y: 0.10, length: 0.10, angle: 0.10, n: 30, frequency: 2.0, heightAbove: 5, heightBelow: 6, offsetC: 2 },
  { x: 0.30, y: 0.10, length: 0.20, angle: -0.15, n: 40, frequency: 2.5, heightAbove: 6, heightBelow: 8, offsetC: 2 },
  { x: 0.51, y: 0.80, length: 0.15, angle: 0.35, n: 50, frequency: 3.0, heightAbove: 8, heightBelow: 5, offsetC: 2, phase: 0.3 },
]

/** How far a clone is offset from its original, so it isn't hidden underneath. */
const CLONE_NUDGE = 0.03
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

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

/** The bird a folder starts life as: hand-tuned if there is one, else a stray. */
const specFor = (i: number): Partial<BirdSpec> => FLOCK[i] ?? strayBird(i)

/**
 * A flock of fish spines, one param folder per bird. Birds are placed relative
 * to whatever box the plot is given — the framed cell on its own sheet, a slot
 * in the playground — so nothing here knows about margins or paper.
 */
export class Ocell extends Plot {
  birds: Bird[] = []

  constructor(ctx: PlotCtx) {
    super(ctx)

    const count = this.num('birds', FLOCK.length, { min: 0, max: MAX_BIRDS, step: 1 })

    for (let i = 0; i < count; i++) {
      // registered before the bird, so the buttons sit at the top of every
      // folder; the callbacks are refreshed each rebuild and read the live count
      const bird = this.params.child(`bird${i}`)
      bird.button('clone', () => this.cloneBird(i))
      bird.button('delete', () => this.deleteBird(i))
      this.birds.push(new Bird(ctx.child(`bird${i}`, this.box), specFor(i)))
    }
    // Folders live in the panel, not in the plot tree, so a bird that is gone
    // has to be hidden by hand — its values wait there in case it comes back.
    for (let i = 0; i < MAX_BIRDS; i++) this.params.child(`bird${i}`).show(i < count)
  }

  /** Copy a bird onto the end of the flock, nudged so you can see there are two. */
  cloneBird(i: number) {
    const count = this.get<number>('birds')
    if (count >= MAX_BIRDS) return
    const copy = this.params.child(`bird${i}`).values()
    // grow first: the new folder's params are created by the rebuild, and the
    // values below are parked until then
    this.params.set('birds', count + 1)
    this.params.child(`bird${count}`).assign({
      ...copy,
      x: clamp01(copy.x + CLONE_NUDGE),
      y: clamp01(copy.y + CLONE_NUDGE),
    })
  }

  /** Drop a bird; the ones after it shift down so there is no hole. */
  deleteBird(i: number) {
    const count = this.get<number>('birds')
    if (count <= 0) return
    for (let j = i; j < count - 1; j++) {
      this.params.child(`bird${j}`).assign(this.params.child(`bird${j + 1}`).values(), { silent: true })
    }
    // the folder falling off the end goes back to its default bird, so growing
    // the flock again doesn't resurrect a copy
    this.params.child(`bird${count - 1}`).assign({ ...BIRD, ...specFor(count - 1) }, { silent: true })
    this.params.set('birds', count - 1)
  }

  draw() {
    this.birds.forEach(bird => bird.draw())
  }
}

export default definePlot({
  title: 'Ocell',
  sheet: 'IKEA',
  orientation: 'landscape',
  animated: false,
  // the frame lives here, not in the plot: birds draw in the middle cell,
  // inset 2cm at the sides and 1cm top and bottom of the paper
  frame: { xTracks: '2cm 1 2cm', yTracks: '1cm 2 1 1cm', cell: [1, 1] },
  signature: true,
  create: ctx => new Ocell(ctx),
})
