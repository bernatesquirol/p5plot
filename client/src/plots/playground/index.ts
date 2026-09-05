import { definePlot, Drawable, Plot, PlotCtx } from '../../core/plot'
import { prefixLayers } from '../../core/layers'
import { Rect } from '../../core/rect'
import { Handle } from '../../components/Handle'
import { PIECE_NAMES, PIECES } from './pieces'

/** Folders are kept for this many slots, so shrinking the stack cleans up. */
const MAX_SLOTS = 24
const MIN_SIZE = 0.02
/** slot params that only mean something when the slot hands out a box */
const BOX_KEYS = ['x', 'y', 'width', 'height']
/** how far a clone is offset from its original */
const CLONE_NUDGE = 0.04

/** A slot nobody has placed yet: spread around the sheet so they don't stack. */
const strayPlace = (i: number) => ({
  x: (0.5 + 0.618 * i) % 1,
  y: (0.35 + 0.382 * i) % 1,
})

const clamp = (lo: number, hi: number, v: number) => Math.min(hi, Math.max(lo, v))

/** Shift a pair of coordinates if they are there; says whether it did. */
function nudge(values: Record<string, any>, xKey: string, yKey: string) {
  if (typeof values[xKey] !== 'number' || typeof values[yKey] !== 'number') return false
  values[xKey] += CLONE_NUDGE
  values[yKey] += CLONE_NUDGE
  return true
}

/**
 * A sheet you compose: every slot holds one piece — a bird, a rose, a whole
 * flock — with its own box and its own params. Pieces sharing a layer name
 * land in the same pen layer, or you give a slot its own with `own layer`.
 *
 * Nothing here knows what a bird is: slots are built from the piece registry,
 * so a new kind of piece is one line in pieces.ts.
 */
export class Playground extends Plot {
  slots: Drawable[] = []

  constructor(ctx: PlotCtx) {
    super(ctx)

    const count = this.num('slots', 2, { min: 0, max: MAX_SLOTS, step: 1 })

    for (let i = 0; i < count; i++) {
      const slot = this.params.child(`slot${i}`)
      // registered first so they sit at the top of the folder; the callbacks
      // are refreshed every rebuild and read the live count
      slot.button('clone', () => this.cloneSlot(i))
      slot.button('delete', () => this.deleteSlot(i))

      const place = strayPlace(i)
      const kind = slot.choice('type', PIECE_NAMES[i % PIECE_NAMES.length], PIECE_NAMES)
      const piece = PIECES[kind]
      // one layer per slot by default: a plotter wants them apart, and pieces
      // that share a layer name would otherwise land in one group
      const own = slot.bool('ownLayer', true, { label: 'own layer' })

      // A piece that places itself gets the sheet and nothing else: no second
      // set of coordinates, no box handle. The controls stay registered (a
      // slot can be switched back to a boxed piece) but leave the panel.
      const boxed = piece.fit !== 'sheet'
      let box = this.box
      if (boxed) {
        const x = slot.num('x', place.x, { min: -0.5, max: 1.5, step: 0.005 })
        const y = slot.num('y', place.y, { min: -0.5, max: 1.5, step: 0.005 })
        const width = slot.num('width', 0.4, { min: MIN_SIZE, max: 2, step: 0.005 })
        const height = slot.num('height', 0.4, { min: MIN_SIZE, max: 2, step: 0.005 })
        box = new Rect({
          x: this.box.toX(x) - (this.width * width) / 2,
          y: this.box.toY(y) - (this.height * height) / 2,
          width: this.width * width,
          height: this.height * height,
        })

        // drag the middle to move it, the corner to size it
        Handle.param(this, `slot${i}/x`, `slot${i}/y`, { label: `${i}:${kind}`, clamp: [-0.5, 1.5] })
        new Handle(this, {
          id: `slot${i}/size`,
          clamp: [-0.5, 1.5],
          at: () => ({ x: x + width / 2, y: y + height / 2 }),
          move: (cornerX, cornerY) => {
            slot.set('width', clamp(MIN_SIZE, 2, 2 * (cornerX - x)), { silent: true })
            slot.set('height', clamp(MIN_SIZE, 2, 2 * (cornerY - y)))
          },
        })
      }
      for (const key of BOX_KEYS) slot.showControl(key, boxed)

      // The piece's params live one folder deeper, under the piece's own name,
      // so switching type doesn't mix a rose's params into a bird's — but the
      // folders themselves outlive the switch, so hide every kind but the one
      // in play or a slot that was ever a spiral keeps showing spiral controls.
      for (const name of PIECE_NAMES) slot.child(name).show(name === kind)

      const slotCtx = ctx.child(`slot${i}`, box, {
        layers: own ? prefixLayers(this.layers, `slot${i}/`) : undefined,
      })
      this.slots.push(piece.make(slotCtx.child(kind, box)))
    }

    // Folders outlive the plot tree, so a slot that is gone has to be hidden.
    for (let i = 0; i < MAX_SLOTS; i++) this.params.child(`slot${i}`).show(i < count)
  }

  /** Copy a slot — piece params and all — onto the end of the stack. */
  cloneSlot(i: number) {
    const count = this.get<number>('slots')
    if (count >= MAX_SLOTS) return
    const source = this.params.child(`slot${i}`)
    const kind = source.get<string>('type')
    // Switching type leaves the old type's params behind so you can switch
    // back; a clone is of the slot as it stands, so only this piece comes.
    const copy = Object.fromEntries(Object.entries(source.values({ deep: true }))
      .filter(([key]) => !key.includes('/') || key.startsWith(`${kind}/`)))
    // Offset by whatever actually places the piece: the slot's box, or the
    // piece's own coordinates when it places itself.
    if (PIECES[kind]?.fit === 'sheet') nudge(copy, `${kind}/x`, `${kind}/y`)
    else nudge(copy, 'x', 'y')
    // grow first: the new folder's params are created by the rebuild, and the
    // values above are parked until then
    this.params.set('slots', count + 1)
    this.params.child(`slot${count}`).assign(copy)
  }

  /** Drop a slot; the ones after it shift down so there is no hole. */
  deleteSlot(i: number) {
    const count = this.get<number>('slots')
    if (count <= 0) return
    for (let j = i; j < count - 1; j++) {
      const next = this.params.child(`slot${j + 1}`).values({ deep: true })
      this.params.child(`slot${j}`).assign(next, { silent: true })
    }
    // the slot falling off the end goes back to where a fresh one would sit,
    // so growing the stack again doesn't resurrect a copy
    const last = count - 1
    this.params.child(`slot${last}`).assign({
      ...strayPlace(last),
      type: PIECE_NAMES[last % PIECE_NAMES.length],
      width: 0.4,
      height: 0.4,
      ownLayer: false,
    }, { silent: true })
    this.params.set('slots', count - 1)
  }

  /** Physics pieces need stepping; a sheet of static ones stops the loop. */
  step(dt: number) {
    let live = false
    for (const slot of this.slots) {
      if (!slot.step) continue
      live = slot.step(dt) !== false || live
    }
    return live
  }

  draw() {
    this.slots.forEach(slot => slot.draw())
  }
}

export default definePlot({
  title: 'Playground',
  sheet: 'A4',
  orientation: 'landscape',
  note: 'compose plots and pieces on one sheet',
  create: ctx => new Playground(ctx),
})
