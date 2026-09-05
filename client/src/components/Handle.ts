import { Plot } from '../core/plot'
import { Rect } from '../core/rect'

export type HandleOpts = {
  /** what the 0..1 coordinates are relative to; defaults to the plot's box */
  box?: Rect
  /** hit and draw radius in paper pixels */
  radius?: number
  label?: string
  /** keep the value inside these bounds; defaults to the box itself */
  clamp?: [number, number]
}

const clampTo = ([lo, hi]: [number, number], v: number) => Math.min(hi, Math.max(lo, v))

/**
 * A point you can drag on the paper instead of typing coordinates.
 *
 * Positions are stored relative to `box` (0..1 on each axis), so they survive
 * a change of sheet: the paper size is only applied when drawing. Turn the
 * markers on and off with `showHandles` in the sketch folder.
 *
 * Handles are drawn on screen only — they never reach the exported SVG.
 */
export class Handle {
  constructor(plot: Plot, opts: HandleOpts & {
    /** unique within the plot's params; the sketch tracks drags by it */
    id: string
    /** current position, relative to the box */
    at: () => { x: number, y: number }
    /** where it was dragged to, relative to the box */
    move: (x: number, y: number) => void
  }) {
    const box = opts.box ?? plot.box
    const clamp = opts.clamp ?? [0, 1]
    const { x, y } = opts.at()
    plot.ctx.addHandle({
      id: `${plot.params.path}/${opts.id}`,
      x: box.toX(x),
      y: box.toY(y),
      radius: opts.radius ?? 4,
      label: opts.label,
      move: (px, py) => opts.move(
        clampTo(clamp, (px - box.x) / box.width),
        clampTo(clamp, (py - box.y) / box.height),
      ),
    })
  }

  /**
   * The common case: a handle bound to two params holding normalised x and y.
   * Both are written in one go, so a drag costs one rebuild, not two.
   */
  static param(plot: Plot, xKey: string, yKey: string, opts: HandleOpts = {}) {
    return new Handle(plot, {
      ...opts,
      id: `${xKey},${yKey}`,
      at: () => ({ x: plot.get<number>(xKey), y: plot.get<number>(yKey) }),
      move: (x, y) => {
        plot.params.set(xKey, x, { silent: true })
        plot.params.set(yKey, y)
      },
    })
  }
}
