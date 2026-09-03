import p5plot from 'p5.plotsvg'
import { ParamScope } from './params'

export type LayerOpts = {
  visible?: boolean
  /** extra attributes on the exported <g> */
  attrs?: Record<string, string>
}

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
    this.order.forEach((name, index) => {
      const cbs = this.queue[name]
      if (!cbs?.length) return
      const attrs = {
        'inkscape:groupmode': 'layer',
        'inkscape:label': `${index} - ${name}`,
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
