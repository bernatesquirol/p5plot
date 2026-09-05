import p5plot from 'p5.plotsvg'
import { ParamScope } from './params'

/**
 * All a plot needs of the registry: somewhere to queue a draw call. Keeping it
 * this narrow means a wrapper can sit in between — see `prefixLayers`.
 */
export type LayerSink = {
  use: (name: string, draw: () => void, opts?: LayerOpts) => void
}

export type LayerOpts = {
  visible?: boolean
  /** extra attributes on the exported <g> */
  attrs?: Record<string, string>
}

/** Same sink, but every layer name is namespaced — one plot's layers kept apart. */
export const prefixLayers = (sink: LayerSink, prefix: string): LayerSink => ({
  use: (name, draw, opts) => sink.use(`${prefix}${name}`, draw, opts),
})

/**
 * Layers are global to the sketch and keyed by name, so N subplots drawing
 * into "lines" all land in the same inkscape layer / SVG group.
 *
 * Plots don't draw during draw(): they *register* callbacks, and the registry
 * runs them grouped by layer. That removes all the dedupe bookkeeping the old
 * MultiPlot/SinglePlot pair needed.
 */
export class LayerRegistry {
  private order: string[] = []
  private opts: Record<string, LayerOpts> = {}
  private queue: Record<string, (() => void)[]> = {}

  constructor(private params: ParamScope) { }

  /**
   * Claim layer names up front, without drawing into them. Order is first-use
   * order, so the sheet's own layers have to be spoken for before any plot
   * runs - otherwise the margins land wherever they happen to be switched on.
   */
  reserve(names: string[], opts: LayerOpts = {}) {
    for (const name of names) {
      if (this.order.includes(name)) continue
      this.order.push(name)
      this.opts[name] = opts
      this.params.bool(name, opts.visible !== false, { rebuild: false })
    }
  }

  /** Queue `draw` into layer `name` for this frame. */
  use(name: string, draw: () => void, opts: LayerOpts = {}) {
    if (!this.order.includes(name)) {
      this.order.push(name)
      this.opts[name] = opts
      this.params.bool(name, opts.visible !== false, { rebuild: false })
    }
    ;(this.queue[name] ??= []).push(draw)
  }

  visible(name: string) {
    return this.params.get<boolean>(name) !== false
  }

  names() {
    return [...this.order]
  }

  /** Run every queued callback, grouped and in registration order. */
  flush() {
    // numbered by what actually lands in the file, so reserved or abandoned
    // layers don't leave gaps in the labels
    let written = 0
    this.order.forEach(name => {
      const cbs = this.queue[name]
      // A layer nobody drew into has nothing to toggle: keep its checkbox out
      // of the panel until it comes back, or composing turns the layers folder
      // into a list of everything you ever tried.
      this.params.showControl(name, !!cbs?.length)
      if (!cbs?.length) return
      const attrs = {
        'inkscape:groupmode': 'layer',
        'inkscape:label': `${written++} - ${name}`,
        ...(this.opts[name]?.attrs || {}),
      }
      p5plot.beginSvgGroup(name, attrs)
      if (this.visible(name)) cbs.forEach(cb => cb())
      p5plot.endSvgGroup(name)
    })
    this.queue = {}
  }

  /** Called at the top of every frame. */
  beginFrame() {
    this.queue = {}
  }
}
