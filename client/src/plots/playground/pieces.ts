import { Drawable, PlotCtx } from '../../core/plot'
import { Signature } from '../../components/Signature'
import { Bird } from '../260606_ocell/Bird'
import { CircularBird } from '../260606_ocell/CircularBird'
import { Ocell } from '../260606_ocell'
import { Rose } from '../260420_stjordi/Rose'
import { StJordi } from '../260420_stjordi'
import { Star5Plot } from '../260119_star'
import { StarSheet } from '../260125_star_multi'
import { XmasPlot } from '../251222_xmas'
import { XmasSheet } from '../251230_xmas_plot'
import { Cycles } from '../260225_cycles'

/**
 * Anything that can be dropped on the playground. A piece is built from a ctx
 * like any plot and keeps its params in the slot's folder, so every copy is
 * tuned on its own.
 *
 * `fit` says who does the placing. Most pieces centre themselves in whatever
 * box they are handed, so the slot gives them one — x, y, width, height and a
 * pair of handles. A piece marked 'sheet' already carries its own position in
 * its own params: it gets the whole sheet and the slot adds nothing, so there
 * is no second set of coordinates to keep straight.
 */
export type Piece = {
  make: (ctx: PlotCtx) => Drawable
  fit?: 'box' | 'sheet'
}

/** Not every drawable is a Plot; these two want wrapping into a layer. */
const inLayer = (name: string, ctx: PlotCtx, make: () => { draw: () => void }): Drawable => {
  const drawable = make()
  return { draw: () => ctx.layers.use(name, () => drawable.draw()) }
}

export const PIECES: Record<string, Piece> = {
  // a bird knows where it is: x, y, length and angle are its own params
  bird: { make: ctx => new Bird(ctx), fit: 'sheet' },
  spiral: { make: ctx => new CircularBird(ctx), fit: 'sheet' },
  rose: { make: ctx => new Rose(ctx) },
  star: { make: ctx => new Star5Plot(ctx) },
  wheels: { make: ctx => new Cycles(ctx) },
  tree: { make: ctx => new XmasPlot(ctx) },
  // whole plots, nested: their own subplots and folders come along
  flock: { make: ctx => new Ocell(ctx) },
  roses: { make: ctx => new StJordi(ctx) },
  stars: { make: ctx => new StarSheet(ctx) },
  trees: { make: ctx => new XmasSheet(ctx) },
  // margins are the paper's, in the sketch folder — not something you slot in
  signature: { make: ctx => inLayer('signature', ctx, () => new Signature(ctx.p5, { ...ctx.box, rng: ctx.rng })) },
}

export type PieceName = keyof typeof PIECES
export const PIECE_NAMES = Object.keys(PIECES) as PieceName[]
