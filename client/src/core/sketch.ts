import p5 from 'p5'
import p5plot from 'p5.plotsvg'
import { LayerRegistry } from './layers'
import { ParamStore, paramsLoadedKey, paramsStorageKey } from './params'
import { cm, describePaper, DPI, makePaper, Orientation, ORIENTATIONS, Paper, screenPaper, SHEET_NAMES, SheetName } from './paper'
import { Drawable, HandleSpec, PlotCtx, PlotDef, PointerEventKind, PointerHandler, PointerPos, Sizing } from './plot'
import { Corners } from '../components/Corners'
import { Margins } from '../components/Margins'
import { Signature } from '../components/Signature'
import { Rect } from './rect'
import { makeRng, seedGlobalRng } from './rng'
import { go } from './router'

const SCREEN_PADDING = 16
/**
 * Fixed simulation timestep. p5's deltaTime is the wall clock since the last
 * frame, which after a pause is seconds long — enough to blow a Matter world
 * apart in one update — and it makes a run unreproducible even when it doesn't.
 */
const SIM_DT = 1000 / 60
/** how close a click has to land, in screen pixels, to grab a handle */
const HANDLE_GRAB = 14
/** handles within this many screen pixels of each other count as stacked */
const HANDLE_STACK = 4

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
  /** the plotting area: what the SVG is sized to, and what the screen shows */
  private bed: Paper = makePaper('A3', 'landscape')
  /** the real sheet laid on the bed - what the plot is composed for */
  private paper: Paper = makePaper('A4', 'landscape')
  /** where that sheet sits on the bed */
  private paperBox: Rect = new Rect({ width: 1, height: 1 })
  private view = { scale: 1, dx: 0, dy: 0 }
  private pendingExport = false
  private pendingRebuild = false
  private resizeTimer?: number
  private ready = false
  private inFrame = false
  private redrawQueued = false
  private pointerHandlers: PointerHandler[] = []
  private handles: HandleSpec[] = []
  /** sheet furniture the plot definition asked for, rebuilt with the plot */
  private furniture: { margins?: Margins; signature?: Signature; corners?: Corners } = {}
  /** the handle being dragged, by id: the one it belongs to is rebuilt under us */
  private draggingHandle?: string
  private readout = { size: '', at: '' }
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
      storageKey: paramsStorageKey(route),
      onChange: rebuild => {
        if (rebuild) return this.requestRebuild()
        this.applyRunState()
        this.requestRedraw()
      },
    })
    this.layers = new LayerRegistry(this.store.scope('layers'))
    // the paper's own marks come first in the file, whenever they get turned on
    this.layers.reserve(['corners', 'margins'])
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
    app.choice<SheetName>('bed', this.def!.bed ?? 'A3', SHEET_NAMES, { label: 'plotter bed' })
    app.choice<Orientation>('bedOrientation', this.def!.bedOrientation ?? 'landscape', ORIENTATIONS, { label: 'bed orientation' })
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
    // transient: an editing aid that stayed off between sessions would look
    // exactly like handles being broken
    app.bool('showHandles', true, { rebuild: false, transient: true, label: 'show handles' })
    app.button('save params', () => this.saveParams())
    app.button('load params', () => this.loadParams())
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

  /**
   * Write the whole panel to a json file. Sheet, seed, layer visibility and
   * every plot param are in there, so the file is the plot.
   */
  private saveParams() {
    const doc: SavedParams = {
      plot: this.route,
      title: this.def!.title,
      savedAt: new Date().toISOString(),
      params: this.store!.entriesForSaving(),
    }
    download(`${this.route || 'plot'}-${stamp()}.json`, JSON.stringify(doc, null, 2))
  }

  /** Read a file back and hand the panel over to it. */
  private loadParams() {
    pickFile('application/json,.json', async file => {
      let doc: SavedParams
      try {
        doc = JSON.parse(await file.text())
      } catch {
        alert(`${file.name} is not valid json`)
        return
      }
      if (!doc?.params || typeof doc.params !== 'object') {
        alert(`${file.name} has no params in it`)
        return
      }
      const route = typeof doc.plot === 'string' ? doc.plot : this.route
      const known = route === this.route || Object.values(this.host.routes).includes(route)
      if (!known) {
        alert(`${file.name} is for "${route}", which isn't in this build`)
        return
      }
      // Params are read from storage when a route's panel is built, so writing
      // there and rebuilding the panel is the same path as restoring a session.
      localStorage.setItem(paramsStorageKey(route), JSON.stringify(doc.params))
      // a picked file is authoritative, even where a default has moved since
      localStorage.setItem(paramsLoadedKey(route), '1')
      if (route !== this.route) go(route)
      else this.load(this.route, this.def!)
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

  /** The plotting area. Everything is drawn in its coordinates. */
  private resolveBed(): Paper {
    const app = this.app()
    if (app.get<Sizing>('sizing') === 'screen') return this.resolvePaper()
    return makePaper(
      app.get<SheetName>('bed') ?? 'A3',
      app.get<Orientation>('bedOrientation') ?? 'landscape',
    )
  }

  /**
   * Margins and signature come from the plot definition, so no plot carries
   * params for them. Returns the box the plot should draw in: the framed cell
   * when there is a frame, the whole sheet otherwise.
   */
  private buildFurniture(): Rect {
    const bed = new Rect({ x: 0, y: 0, width: this.bed.w, height: this.bed.h })
    const app = this.app()
    this.furniture = {}

    // Where the sheet is taped down, measured the way the plotter measures:
    // from the top left of the bed, which is 0,0. Its corners get marked so it
    // can be lined up.
    const screen = app.get<Sizing>('sizing') === 'screen'
    const [defX, defY] = this.def!.paperAt ?? [0, 0]
    const atX = app.num('paperAtX_cm', defX, { min: 0, max: 120, step: 0.1, label: 'paper x (cm)' })
    const atY = app.num('paperAtY_cm', defY, { min: 0, max: 120, step: 0.1, label: 'paper y (cm)' })
    const arm = app.num('cornerMark_cm', 1, { min: 0, max: 5, step: 0.1, label: 'corner marks (cm)' })
    this.paperBox = screen ? bed : new Rect({
      x: cm(atX),
      y: cm(atY),
      width: this.paper.w,
      height: this.paper.h,
    })
    this.readout.at = `${atX},${atY}cm`
    if (!screen && arm > 0) this.furniture.corners = new Corners(this.p, this.paperBox, cm(arm))

    // A plot may divide its paper up; those grid lines get their own marks.
    const frame = this.def!.frame
    let box = this.paperBox
    if (frame?.xTracks || frame?.yTracks) {
      const margins = new Margins(this.p, {
        ...this.paperBox,
        xTracks: frame.xTracks ?? '1',
        yTracks: frame.yTracks ?? '1',
      })
      const [col, row] = frame.cell ?? [0, 0]
      this.furniture.margins = margins
      box = margins.regions[col]?.[row] ?? this.paperBox
    }

    if (this.def!.signature) {
      const scale = app.num('signatureScale', 0.05, { min: 0.01, max: 0.3, step: 0.005 })
      this.furniture.signature = new Signature(this.p, {
        x: this.paperBox.toX(0.9),
        y: this.paperBox.toY(0.9),
        width: this.paperBox.height * scale,
        height: this.paperBox.height * scale,
        rng: makeRng(`${app.get<number>('seed') ?? 1}:signature`),
      })
    }
    app.showControl('signatureScale', !!this.def!.signature)
    return box
  }

  /** Show the size fields only where they do something. */
  private syncSheetControls() {
    const app = this.app()
    const onPaper = app.get<Sizing>('sizing') !== 'screen'
    const custom = onPaper && app.get<SheetName>('sheet') === 'CUSTOM'
    app.showControl('width_mm', custom)
    app.showControl('height_mm', custom)
    app.showControl('orientation', onPaper && !custom)
    // a screen-sized sketch has no bed and no sheet to place on it
    for (const key of ['bed', 'bedOrientation', 'paperAtX_cm', 'paperAtY_cm', 'cornerMark_cm', 'sheet']) {
      app.showControl(key, onPaper)
    }
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
    this.bed = this.resolveBed()
    const seed = app.get<number>('seed') ?? 1
    seedGlobalRng(seed)

    const [cw, ch] = this.containerSize()
    if (this.p.width !== cw || this.p.height !== ch) this.p.resizeCanvas(cw, ch, true)
    this.computeView()
    this.pointerHandlers = []
    this.handles = []

    // the furniture decides where the sheet sits, so it runs before the ctx
    // it is handed to is built
    const box = this.buildFurniture()
    const ctx = new PlotCtx({
      p5: this.p,
      paper: this.paper,
      bed: new Rect({ width: this.bed.w, height: this.bed.h }),
      sheet: this.paperBox,
      box,
      params: this.store!.scope('plot'),
      layers: this.layers!,
      seed,
      exportSVG: () => this.requestExport(),
      pointer: () => this.screenToPaper(this.p.mouseX, this.p.mouseY),
      onPointer: handler => this.pointerHandlers.push(handler),
      addHandle: handle => this.handles.push(handle),
    })
    this.plot = this.def!.create(ctx)
    this.readout.size = `${describePaper(this.bed)} · ${describePaper(this.paper)} @ ${this.readout.at}`
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
    const fit = Math.min((usable - 2 * SCREEN_PADDING) / this.bed.w, (ch - 2 * SCREEN_PADDING) / this.bed.h)
    const scale = Math.max(0.02, fit * zoom)
    this.view = {
      scale,
      dx: (usable - this.bed.w * scale) / 2,
      dy: (ch - this.bed.h * scale) / 2,
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
    const pos = this.screenToPaper(this.p.mouseX, this.p.mouseY)
    if (this.dragHandles(pos, kind)) return
    if (!this.pointerHandlers.length) return
    this.pointerHandlers.forEach(h => h(pos, kind))
    this.requestRedraw()
  }

  /**
   * Dragging a handle takes priority over the plot's own pointer handlers, so
   * moving a point can't also drop a bauble. Returns true when it took the event.
   */
  private dragHandles(pos: PointerPos, kind: PointerEventKind): boolean {
    if (!this.handlesVisible()) return false
    if (kind === 'up') {
      const was = this.draggingHandle
      this.draggingHandle = undefined
      return was != null
    }
    if (kind === 'down') {
      // a click grabs the nearest handle within reach and takes it there
      const grab = HANDLE_GRAB / this.view.scale
      const distance = (h: HandleSpec) => Math.hypot(h.x - pos.x, h.y - pos.y)
      const within = this.handles.filter(h => distance(h) < Math.max(grab, h.radius))
      if (!within.length) return false
      // Handles dragged on top of each other would otherwise be swallowed by
      // whichever was registered first, with no way to get the other back, so
      // among the ones this close the last registered wins.
      const nearest = Math.min(...within.map(distance))
      const best = within.filter(h => distance(h) <= nearest + HANDLE_STACK / this.view.scale).pop()
      if (!best) return false
      this.draggingHandle = best.id
      best.move(pos.x, pos.y)
      return true
    }
    const dragged = this.handles.find(h => h.id === this.draggingHandle)
    if (!dragged) return false
    dragged.move(pos.x, pos.y)
    return true
  }

  private handlesVisible() {
    return this.handles.length > 0 && this.app().get<boolean>('showHandles') !== false
  }

  /** Drawn on screen only, after the plot, so handles never reach the SVG. */
  private drawHandles() {
    if (!this.handlesVisible()) return
    const p = this.p
    const scale = this.view.scale
    p.push()
    p.textSize(9 / scale)
    p.textAlign(p.CENTER, p.BOTTOM)
    for (const h of this.handles) {
      const active = h.id === this.draggingHandle
      const r = h.radius / scale
      // a pale ring first, so a handle dropped on dense ink is still visible
      p.stroke(255, 255, 255, 220)
      p.strokeWeight(4 / scale)
      p.noFill()
      p.circle(h.x, h.y, r * 2)
      p.stroke('#d2431f')
      p.strokeWeight(1.5 / scale)
      p.fill(active ? '#d2431f' : 'rgba(210, 67, 31, 0.25)')
      p.circle(h.x, h.y, r * 2)
      if (h.label) {
        p.noStroke()
        p.fill(255, 255, 255, 220)
        p.text(h.label, h.x + 0.5 / scale, h.y - r - 1.5 / scale)
        p.fill('#d2431f')
        p.text(h.label, h.x, h.y - r - 2 / scale)
      }
    }
    p.pop()
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
    // the bed the plotter can reach, then the sheet taped somewhere on it
    p.fill('#dedad0')
    p.rect(0, 0, this.bed.w, this.bed.h)
    p.fill(app.get<string>('sheet color') || '#ffffff')
    p.rect(this.paperBox.x, this.paperBox.y, this.paperBox.width, this.paperBox.height)
    p.pop()
    const stepping = (this.running && !this.settled) || this.pendingStep
    this.pendingStep = false
    this.drawPlot(app.get<boolean>('crisp') ? 1 / this.view.scale : 1, stepping)
    this.drawHandles()
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
    const { corners, margins, signature } = this.furniture
    if (corners) this.layers!.use('corners', () => corners.draw())
    if (margins) this.layers!.use('margins', () => margins.draw())
    if (stepping && this.plot!.step?.(SIM_DT) === false) {
      // nothing moving: stop the loop but leave `run` on, so the next change resumes
      this.settled = true
      this.setLoop(false)
    }
    this.plot!.draw()
    if (signature) this.layers!.use('signature', () => signature.draw(), { visible: false })
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
    const { w, h } = this.bed
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

/** What a saved params file looks like. */
type SavedParams = {
  plot: string
  title?: string
  savedAt?: string
  params: Record<string, { v: any; d: any }>
}

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** One-shot file picker; the input is thrown away with the choice. */
function pickFile(accept: string, then: (file: File) => void) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = accept
  input.className = 'p5plot-file'
  input.style.display = 'none'
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    input.remove()
    if (file) then(file)
  })
  document.body.append(input)
  input.click()
}

const stamp = () => {
  const d = new Date()
  const pad = (n: number) => `${n}`.padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}
