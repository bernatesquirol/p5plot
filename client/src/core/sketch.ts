import p5 from 'p5'
import p5plot from 'p5.plotsvg'
import { LayerRegistry } from './layers'
import { ParamStore } from './params'
import { describePaper, DPI, makePaper, Orientation, ORIENTATIONS, Paper, screenPaper, SHEET_NAMES, SheetName } from './paper'
import { Drawable, PlotCtx, PlotDef, PointerEventKind, PointerHandler, Sizing } from './plot'
import { Rect } from './rect'
import { seedGlobalRng } from './rng'
import { go } from './router'

const SCREEN_PADDING = 16
/**
 * Fixed simulation timestep. p5's deltaTime is the wall clock since the last
 * frame, which after a pause is seconds long — enough to blow a Matter world
 * apart in one update — and it makes a run unreproducible even when it doesn't.
 */
const SIM_DT = 1000 / 60

export type SketchHost = {
  /** title -> route, the shape lil-gui wants for a dropdown */
  routes: Record<string, string>
}

/**
 * Owns the p5 instance, the canvas size, the view transform and SVG export.
 * Plots know nothing about the screen: they draw in paper pixels, and the
 * sketch maps that onto whatever canvas the window happens to give us.
 */
export class Sketch {
  private p!: p5
  private store?: ParamStore
  private layers?: LayerRegistry
  private def?: PlotDef
  private route = ''
  private plot?: Drawable
  private paper: Paper = makePaper('A4', 'landscape')
  private view = { scale: 1, dx: 0, dy: 0 }
  private pendingExport = false
  private pendingRebuild = false
  private resizeTimer?: number
  private ready = false
  private inFrame = false
  private redrawQueued = false
  private pointerHandlers: PointerHandler[] = []
  private readout = { size: '' }
  /** true while the gallery is showing and the sketch is paused */
  private parked = false
  /** is p5 looping right now? it starts out that way, until told otherwise */
  private looping = true
  /** is the simulation of an animated plot advancing? */
  private running = false
  /** advance one frame, then stop again */
  private pendingStep = false
  /** the plot reported nothing left to simulate, so the loop was stopped */
  private settled = false

  constructor(private container: HTMLElement, private host: SketchHost) {
    this.p = new p5((instance: p5) => {
      instance.setup = () => this.setup(instance)
      instance.draw = () => this.frame()
      instance.windowResized = () => this.onResize()
      instance.mousePressed = () => this.onPointer('down')
      instance.mouseReleased = () => this.onPointer('up')
      instance.mouseDragged = () => this.onPointer('drag')
    }, container)
    // p5's keyPressed can't stop the browser's save dialog, so listen directly
    window.addEventListener('keydown', e => this.onKey(e))
  }

  private setup(instance: p5) {
    const [w, h] = this.containerSize()
    instance.createCanvas(w, h)
    p5plot.setSvgResolutionDPI(DPI)
    p5plot.setSvgPointRadius(0.25)
    p5plot.setSvgCoordinatePrecision(4)
    p5plot.setSvgTransformPrecision(6)
    p5plot.setSvgIndent(p5plot.SVG_INDENT_SPACES, 2)
    p5plot.setSvgDefaultStrokeColor('black')
    p5plot.setSvgDefaultStrokeWeight(1)
    p5plot.setSvgFlattenTransforms(false)
    this.ready = true
    if (this.def) this.rebuild()
  }

  /** Swap in a plot definition (route change): fresh panel, fresh canvas. */
  load(route: string, def: PlotDef) {
    this.route = route
    this.def = def
    this.store?.destroy()
    this.store = new ParamStore({
      title: def.title,
      storageKey: `p5plot:params:${route}`,
      onChange: rebuild => {
        if (rebuild) return this.requestRebuild()
        this.applyRunState()
        this.requestRedraw()
      },
    })
    this.layers = new LayerRegistry(this.store.scope('layers'))
    this.buildAppControls()
    if (this.ready) this.rebuild()
  }

  /** Static sketches sit in noLoop(), so an export has to ask for a frame. */
  requestExport() {
    this.pendingExport = true
    this.requestRedraw()
  }

  requestRebuild() {
    this.pendingRebuild = true
    this.requestRedraw()
  }

  /** Park the sketch while the gallery is showing. */
  hide() {
    this.parked = true
    this.setLoop(false)
    if (this.store) this.store.gui.domElement.style.display = 'none'
  }

  show() {
    this.parked = false
    if (this.store) this.store.gui.domElement.style.display = ''
  }

  private setLoop(on: boolean) {
    if (on === this.looping) return
    this.looping = on
    if (on) this.p.loop()
    else this.p.noLoop()
  }

  /**
   * A parked sketch sits in noLoop(), so changes need an explicit redraw —
   * but never a nested one: p5.redraw() runs draw() synchronously.
   */
  private requestRedraw() {
    if (!this.ready || this.looping) return
    if (this.inFrame) this.redrawQueued = true
    else this.p.redraw()
  }

  /**
   * A simulation only advances while `run` is on, so a plot left open doesn't
   * peg a core and the drawing you exported is the drawing you were looking at.
   */
  private applyRunState() {
    if (!this.def || !this.store) return
    this.running = this.def.animated !== false && this.app().get<boolean>('run') === true
    // any change is a reason to look again: a scene may have work to do
    this.settled = false
    this.setLoop(this.running)
    if (!this.running) this.requestRedraw()
  }

  /** One frame of simulation while paused. */
  private stepOnce() {
    this.pendingStep = true
    this.requestRedraw()
  }

  private app() {
    return this.store!.scope('sketch')
  }

  private buildAppControls() {
    const store = this.store!
    const app = this.app()
    const gui = store.gui

    const picker = { plot: this.route }
    gui.add(picker, 'plot', this.host.routes).name('plot').onChange((r: string) => go(r))
    gui.add({ gallery: () => go('') }, 'gallery').name('all plots')
    gui.add({ exportSVG: () => this.requestExport() }, 'exportSVG').name('export SVG (s / ctrl+s)')
    gui.add(this.readout, 'size').name('paper').listen().disable()

    store.folder('sketch').open()
    app.choice<SheetName>('sheet', this.def!.sheet ?? 'A4', SHEET_NAMES)
    app.choice<Orientation>('orientation', this.def!.orientation ?? 'portrait', ORIENTATIONS)
    // only meaningful for the CUSTOM sheet; hidden otherwise (see syncSheetControls)
    app.num('width_mm', 100, { min: 5, max: 2000, step: 0.5, label: 'custom w (mm)' })
    app.num('height_mm', 150, { min: 5, max: 2000, step: 0.5, label: 'custom h (mm)' })
    app.choice<Sizing>('sizing', this.def!.sizing ?? 'paper', ['paper', 'screen'])
    app.num('zoom', 1, { min: 0.1, max: 4, step: 0.05, rebuild: false })
    app.num('seed', 1, { min: 1, max: 9999, step: 1 })
    app.button('reroll', () => app.set('seed', 1 + Math.floor(Math.random() * 9998)))
    if (this.def!.animated !== false) {
      // transient: a plot opens running, however you left it
      app.bool('run', true, { rebuild: false, transient: true, label: 'run simulation' })
      app.button('step', () => this.stepOnce())
    }
    app.num('strokeWeight', 1, { min: 0.1, max: 8, step: 0.1, rebuild: false })
    app.color('ink', '#000000', { rebuild: false })
    app.color('sheet color', '#ffffff', { rebuild: false })
    app.bool('crisp', true, { rebuild: false, label: 'crisp lines' })
    app.button('reset params', () => {
      store.reset()
      location.reload()
    })
    store.folder('layers')

    // On a deployed page the panel is in the way; while working it's the point.
    if (!guiStartsOpen()) gui.close()
    // Collapsing frees the width the sheet is fitted into, so refit on toggle.
    gui.onOpenClose(changed => {
      if (changed !== gui) return
      this.computeView()
      this.requestRedraw()
    })
  }

  private resolvePaper(): Paper {
    const app = this.app()
    if (app.get<Sizing>('sizing') === 'screen') {
      const [w, h] = this.containerSize()
      return screenPaper(w, h)
    }
    return makePaper(app.get<SheetName>('sheet'), app.get<Orientation>('orientation'), [
      app.get<number>('width_mm'),
      app.get<number>('height_mm'),
    ])
  }

  /** Show the size fields only where they do something. */
  private syncSheetControls() {
    const app = this.app()
    const custom = app.get<Sizing>('sizing') !== 'screen' && app.get<SheetName>('sheet') === 'CUSTOM'
    app.showControl('width_mm', custom)
    app.showControl('height_mm', custom)
    app.showControl('orientation', !custom)
  }

  private containerSize(): [number, number] {
    const r = this.container.getBoundingClientRect()
    return [Math.max(1, Math.floor(r.width)), Math.max(1, Math.floor(r.height))]
  }

  /** Throw the plot tree away and build it again from the current params. */
  private rebuild() {
    const app = this.app()
    this.syncSheetControls()
    this.paper = this.resolvePaper()
    const seed = app.get<number>('seed') ?? 1
    seedGlobalRng(seed)

    const [cw, ch] = this.containerSize()
    if (this.p.width !== cw || this.p.height !== ch) this.p.resizeCanvas(cw, ch, true)
    this.computeView()
    this.pointerHandlers = []

    const ctx = new PlotCtx({
      p5: this.p,
      paper: this.paper,
      box: new Rect({ x: 0, y: 0, width: this.paper.w, height: this.paper.h }),
      params: this.store!.scope('plot'),
      layers: this.layers!,
      seed,
      exportSVG: () => this.requestExport(),
      pointer: () => this.screenToPaper(this.p.mouseX, this.p.mouseY),
      onPointer: handler => this.pointerHandlers.push(handler),
    })
    this.plot = this.def!.create(ctx)
    this.readout.size = describePaper(this.paper)
    this.pendingRebuild = false

    this.applyRunState()
    this.requestRedraw()
  }

  /** Width the panel steals from the canvas, so the sheet isn't hidden by it. */
  private guiWidth() {
    const gui = this.store?.gui
    const el = gui?.domElement
    if (!el || el.style.display === 'none' || gui!._closed) return 0
    const w = el.offsetWidth
    // On a narrow screen there is nothing to give: let the panel overlap.
    return this.p.width < 2 * w ? 0 : w
  }

  private computeView() {
    const [cw, ch] = [this.p.width, this.p.height]
    if (this.app().get<Sizing>('sizing') === 'screen') {
      this.view = { scale: 1, dx: 0, dy: 0 }
      return
    }
    const usable = cw - this.guiWidth()
    const zoom = this.app().get<number>('zoom') ?? 1
    const fit = Math.min((usable - 2 * SCREEN_PADDING) / this.paper.w, (ch - 2 * SCREEN_PADDING) / this.paper.h)
    const scale = Math.max(0.02, fit * zoom)
    this.view = {
      scale,
      dx: (usable - this.paper.w * scale) / 2,
      dy: (ch - this.paper.h * scale) / 2,
    }
  }

  private onResize() {
    clearTimeout(this.resizeTimer)
    this.resizeTimer = setTimeout(() => {
      if (!this.def) return
      const [cw, ch] = this.containerSize()
      this.p.resizeCanvas(cw, ch, true)
      // A screen-sized plot has to be rebuilt: its geometry depends on the box.
      if (this.app().get<Sizing>('sizing') === 'screen') this.requestRebuild()
      else {
        this.computeView()
        this.requestRedraw()
      }
    }, 150) as unknown as number
  }

  private screenToPaper(mx: number, my: number) {
    return { x: (mx - this.view.dx) / this.view.scale, y: (my - this.view.dy) / this.view.scale }
  }

  private onPointer(kind: PointerEventKind) {
    if (!this.pointerHandlers.length) return
    const pos = this.screenToPaper(this.p.mouseX, this.p.mouseY)
    this.pointerHandlers.forEach(h => h(pos, kind))
    this.requestRedraw()
  }

  private onKey(e: KeyboardEvent) {
    if (!this.def || !this.store || this.parked) return
    // don't fire shortcuts while typing into a gui field
    const active = document.activeElement
    if (active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)) return
    const key = e.key.toLowerCase()
    // ctrl/cmd+s means "save" everywhere else, so take it before the browser does
    if (key === 's' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      this.requestExport()
      return
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (key === 's') this.requestExport()
    if (key === 'h') this.toggleGui()
    if (key === 'r') this.app().set('seed', 1 + Math.floor(Math.random() * 9998))
  }

  private toggleGui() {
    const el = this.store?.gui.domElement
    if (!el) return
    el.style.display = el.style.display === 'none' ? '' : 'none'
    // the sheet is fitted around the panel, so hiding it changes the view
    this.computeView()
    this.requestRedraw()
  }

  private frame() {
    if (!this.plot || !this.def) return
    this.inFrame = true
    try {
      this.frameBody()
    } finally {
      this.inFrame = false
      if (this.redrawQueued) {
        this.redrawQueued = false
        requestAnimationFrame(() => this.p.redraw())
      }
    }
  }

  private frameBody() {
    if (this.pendingRebuild) this.rebuild()
    if (this.pendingExport) {
      this.pendingExport = false
      this.exportSvg()
      return
    }
    const p = this.p
    const app = this.app()

    this.computeView()
    p.background(235, 233, 228)
    p.push()
    p.translate(this.view.dx, this.view.dy)
    p.scale(this.view.scale)
    p.push()
    p.noStroke()
    p.fill(app.get<string>('sheet color') || '#ffffff')
    p.rect(0, 0, this.paper.w, this.paper.h)
    p.pop()
    const stepping = (this.running && !this.settled) || this.pendingStep
    this.pendingStep = false
    this.drawPlot(app.get<boolean>('crisp') ? 1 / this.view.scale : 1, stepping)
    p.pop()
  }

  private drawPlot(weightScale: number, stepping = false) {
    const p = this.p
    const app = this.app()
    p.push()
    p.stroke(app.get<string>('ink') || '#000000')
    p.strokeWeight((app.get<number>('strokeWeight') ?? 1) * weightScale)
    p.noFill()
    this.layers!.beginFrame()
    if (stepping && this.plot!.step?.(SIM_DT) === false) {
      // nothing moving: stop the loop but leave `run` on, so the next change resumes
      this.settled = true
      this.setLoop(false)
    }
    this.plot!.draw()
    this.layers!.flush()
    p.pop()
  }

  /**
   * Record at true paper size with an identity view, so the SVG is
   * physically correct whatever the screen is doing.
   */
  private exportSvg() {
    const p = this.p
    const [cw, ch] = [p.width, p.height]
    const { w, h } = this.paper
    p.resizeCanvas(Math.ceil(w), Math.ceil(h), true)
    p5plot.setSVGDocumentSize(w, h)
    p5plot.beginRecordSVG(p, `${this.route || 'plot'}-${stamp()}.svg`)
    p5plot.injectSvgHeaderAttribute('xmlns:inkscape', 'http://www.inkscape.org/namespaces/inkscape')
    p.background(255)
    this.drawPlot(1)
    p5plot.endRecordSVG()
    p.resizeCanvas(cw, ch, true)
    this.computeView()
    this.requestRedraw()
  }
}

/**
 * The panel starts open in `vite dev` and collapsed in a build — no env var
 * or Pages setting needed, `import.meta.env.DEV` is set by the build itself.
 * `?gui=0` / `?gui=1` overrides either way, e.g. to debug a preview build.
 */
function guiStartsOpen() {
  const search = new URLSearchParams(location.search)
  const hashQuery = new URLSearchParams(location.hash.split('?')[1] ?? '')
  const flag = search.get('gui') ?? hashQuery.get('gui')
  if (flag != null) return !['0', 'false', 'closed', 'off'].includes(flag)
  return import.meta.env.DEV
}

const stamp = () => {
  const d = new Date()
  const pad = (n: number) => `${n}`.padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}
