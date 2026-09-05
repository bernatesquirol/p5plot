import p5 from 'p5'
import { LayerOpts, LayerSink } from './layers'
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

/**
 * A point the user can drag on the paper. Positions are paper pixels, and the
 * id has to be stable across rebuilds — dragging one writes a param, which
 * throws the plot tree away, so the sketch tracks the drag by id, not identity.
 */
export type HandleSpec = {
  id: string
  x: number
  y: number
  /** hit and draw radius, in paper pixels */
  radius: number
  label?: string
  /** where the drag went, in paper pixels */
  move: (x: number, y: number) => void
}

export type PointerEventKind = 'down' | 'up' | 'drag'
export type PointerPos = { x: number; y: number }
export type PointerHandler = (pos: PointerPos, kind: PointerEventKind) => void

/** Everything a plot needs from its host, plus the means to spawn subplots. */
export class PlotCtx {
  p5: p5
  paper: Paper
  /** the whole plotter bed, in paper pixels: everything is drawn in these */
  bed: Rect
  /** where the sheet is taped down on the bed — the paper itself */
  sheet: Rect
  box: Rect
  params: ParamScope
  layers: LayerSink
  rng: Rng
  /** session seed — subplot streams are derived from it */
  seed: number
  exportSVG: () => void
  /** current pointer position, in paper coordinates */
  pointer: () => PointerPos
  /** handlers are dropped on every rebuild, so they can never pile up */
  onPointer: (handler: PointerHandler) => void
  /** register a draggable point; dropped on every rebuild, like handlers */
  addHandle: (handle: HandleSpec) => void
  private counters: Record<string, number>

  constructor(init: {
    p5: p5
    paper: Paper
    bed: Rect
    sheet: Rect
    box: Rect
    params: ParamScope
    layers: LayerSink
    seed: number
    exportSVG: () => void
    pointer: () => PointerPos
    onPointer: (handler: PointerHandler) => void
    addHandle: (handle: HandleSpec) => void
    rng?: Rng
    counters?: Record<string, number>
  }) {
    this.p5 = init.p5
    this.paper = init.paper
    this.bed = init.bed
    this.sheet = init.sheet
    this.box = init.box
    this.params = init.params
    this.layers = init.layers
    this.seed = init.seed
    this.exportSVG = init.exportSVG
    this.pointer = init.pointer
    this.onPointer = init.onPointer
    this.addHandle = init.addHandle
    this.rng = init.rng ?? makeRng(init.seed)
    this.counters = init.counters ?? {}
  }

  /**
   * Context for a subplot of kind `kind` drawing inside `box`.
   * All subplots of a kind share one param scope (one folder in the panel),
   * but each gets its own rng stream so they stay visually distinct.
   */
  child(kind: string, box: RectLike, opts: { layers?: LayerSink } = {}): PlotCtx {
    const index = (this.counters[kind] = (this.counters[kind] ?? -1) + 1)
    return new PlotCtx({
      p5: this.p5,
      paper: this.paper,
      bed: this.bed,
      sheet: this.sheet,
      box: box instanceof Rect ? box : new Rect(box),
      params: this.params.child(kind),
      layers: opts.layers ?? this.layers,
      seed: this.seed,
      exportSVG: this.exportSVG,
      pointer: this.pointer,
      onPointer: this.onPointer,
      addHandle: this.addHandle,
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
  readonly layers: LayerSink
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
  /** the plotter bed — where the buckets go, beside the sheet */
  get bed() { return this.ctx.bed }
  /** the sheet on the bed; the plot's own box may be a cell inside it */
  get sheet() { return this.ctx.sheet }
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

/**
 * How a plot divides up the paper it is given: a track grid, and which cell of
 * it the drawing goes in. The sketch owns this — none of it reaches the plot's
 * params, so the same drawing nests inside a playground slot with no frame.
 *
 * Where the paper itself sits on the plotter bed is a sheet setting, not this.
 */
export type Frame = {
  xTracks?: string
  yTracks?: string
  /** [column, row] of the grid; defaults to the first cell */
  cell?: [number, number]
}

/** What a plot module default-exports; the registry maps a route to one. */
export type PlotDef = {
  title: string
  /** default sheet; the panel can override it at runtime */
  sheet?: SheetName
  orientation?: Orientation
  /**
   * Default plotter bed, when the plot needs more of it than the sheet: a
   * painting plot wants room for the buckets either side of the paper.
   */
  bed?: SheetName
  bedOrientation?: Orientation
  /** default position of the sheet on the bed, in cm from its top left */
  paperAt?: [number, number]
  /** 'paper' = fixed sheet letterboxed on screen (default), 'screen' = canvas-sized & rebuilt on resize */
  sizing?: Sizing
  /** drawn every frame on top of the paper, e.g. animated sketches */
  animated?: boolean
  /** margins and crop marks drawn around the plot; the plot gets the cell */
  frame?: Frame
  /** put a signature on the sheet, in a layer that starts hidden */
  signature?: boolean
  create: (ctx: PlotCtx) => Drawable
  /** shown in the index gallery */
  note?: string
}

export const definePlot = (def: PlotDef): PlotDef => def
