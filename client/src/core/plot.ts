import p5 from 'p5'
import { LayerOpts, LayerRegistry } from './layers'
import { ParamOpts, ParamScope } from './params'
import { Orientation, Paper, SheetName } from './paper'
import { Rect, RectLike } from './rect'
import { makeRng, Rng } from './rng'

/**
 * Anything the sketch can put on paper. `step` is optional and only called
 * while the sketch is running (see the `run` toggle): plots that simulate keep
 * their physics there, so pausing freezes the world instead of the drawing.
 */
export type Drawable = {
  draw: () => void
  /** return false when there is nothing left to simulate, and the loop stops */
  step?: (dt: number) => void | boolean
}

export type PointerEventKind = 'down' | 'up' | 'drag'
export type PointerPos = { x: number; y: number }
export type PointerHandler = (pos: PointerPos, kind: PointerEventKind) => void

/** Everything a plot needs from its host, plus the means to spawn subplots. */
export class PlotCtx {
  p5: p5
  paper: Paper
  box: Rect
  params: ParamScope
  layers: LayerRegistry
  rng: Rng
  /** session seed — subplot streams are derived from it */
  seed: number
  exportSVG: () => void
  /** current pointer position, in paper coordinates */
  pointer: () => PointerPos
  /** handlers are dropped on every rebuild, so they can never pile up */
  onPointer: (handler: PointerHandler) => void
  private counters: Record<string, number>

  constructor(init: {
    p5: p5
    paper: Paper
    box: Rect
    params: ParamScope
    layers: LayerRegistry
    seed: number
    exportSVG: () => void
    pointer: () => PointerPos
    onPointer: (handler: PointerHandler) => void
    rng?: Rng
    counters?: Record<string, number>
  }) {
    this.p5 = init.p5
    this.paper = init.paper
    this.box = init.box
    this.params = init.params
    this.layers = init.layers
    this.seed = init.seed
    this.exportSVG = init.exportSVG
    this.pointer = init.pointer
    this.onPointer = init.onPointer
    this.rng = init.rng ?? makeRng(init.seed)
    this.counters = init.counters ?? {}
  }

  /**
   * Context for a subplot of kind `kind` drawing inside `box`.
   * All subplots of a kind share one param scope (one folder in the panel),
   * but each gets its own rng stream so they stay visually distinct.
   */
  child(kind: string, box: RectLike): PlotCtx {
    const index = (this.counters[kind] = (this.counters[kind] ?? -1) + 1)
    return new PlotCtx({
      p5: this.p5,
      paper: this.paper,
      box: box instanceof Rect ? box : new Rect(box),
      params: this.params.child(kind),
      layers: this.layers,
      seed: this.seed,
      exportSVG: this.exportSVG,
      pointer: this.pointer,
      onPointer: this.onPointer,
      rng: makeRng(`${this.seed}:${kind}:${index}`),
      counters: this.counters,
    })
  }

  /** Same params & rng, different region — for laying a plot out by hand. */
  at(box: RectLike): PlotCtx {
    return new PlotCtx({ ...this, box: box instanceof Rect ? box : new Rect(box), counters: this.counters } as any)
  }
}

/**
 * Base class for anything drawn on paper. Build in the constructor: the host
 * throws the tree away and reconstructs it whenever a param changes, so a
 * constructor is effectively `build()`.
 */
export abstract class Plot {
  readonly ctx: PlotCtx
  readonly p5: p5
  readonly box: Rect
  readonly params: ParamScope
  readonly layers: LayerRegistry
  readonly rng: Rng

  constructor(ctx: PlotCtx) {
    this.ctx = ctx
    this.p5 = ctx.p5
    this.box = ctx.box
    this.params = ctx.params
    this.layers = ctx.layers
    this.rng = ctx.rng
  }

  get x() { return this.box.x }
  get y() { return this.box.y }
  get width() { return this.box.width }
  get height() { return this.box.height }
  get paper() { return this.ctx.paper }
  /** pointer position in paper coordinates */
  get pointer() { return this.ctx.pointer() }

  // --- params (all shared per plot kind) ---
  num(key: string, def: number, opts?: ParamOpts) { return this.params.num(key, def, opts) }
  bool(key: string, def: boolean, opts?: ParamOpts) { return this.params.bool(key, def, opts) }
  color(key: string, def: string, opts?: ParamOpts) { return this.p5.color(this.params.color(key, def, opts)) }
  choice<T>(key: string, def: T, options: T[] | Record<string, T>, opts?: ParamOpts) { return this.params.choice(key, def, options, opts) }
  button(label: string, fn: () => void) { this.params.button(label, fn) }
  /**
   * A scene the plot walks through, with the `nextScene` button beside it.
   * Changing scene never rebuilds, so a simulation keeps its state.
   */
  scene<T extends string>(scenes: T[]): T {
    const current = this.params.choice<T>('scene', scenes[0], scenes, { rebuild: false })
    this.params.button('nextScene', () => {
      const at = scenes.indexOf(this.params.get<T>('scene'))
      this.params.set('scene', scenes[(at + 1) % scenes.length], { rebuild: false })
    })
    return current
  }
  get<T = any>(key: string) { return this.params.get<T>(key) }

  /** Queue a draw callback into a named layer. */
  layer(name: string, draw: () => void, opts?: LayerOpts) {
    this.layers.use(name, draw, opts)
  }

  abstract draw(): void
}

export type Sizing = 'paper' | 'screen'

/** What a plot module default-exports; the registry maps a route to one. */
export type PlotDef = {
  title: string
  /** default sheet; the panel can override it at runtime */
  sheet?: SheetName
  orientation?: Orientation
  /** 'paper' = fixed sheet letterboxed on screen (default), 'screen' = canvas-sized & rebuilt on resize */
  sizing?: Sizing
  /** drawn every frame on top of the paper, e.g. animated sketches */
  animated?: boolean
  create: (ctx: PlotCtx) => Drawable
  /** shown in the index gallery */
  note?: string
}

export const definePlot = (def: PlotDef): PlotDef => def
