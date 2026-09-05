import GUI, { Controller } from 'lil-gui'

/**
 * One single lil-gui panel for the whole app. Everything — app settings,
 * layer toggles, per-plot params — is a folder inside it, so multiplots no
 * longer stack a panel per subplot: subplots of the same kind share a scope.
 *
 * Values live in the store, not in the plot instances, which means the plot
 * tree can be thrown away and rebuilt on every change without losing state.
 */

export type ParamOpts = {
  /** slider bounds (numbers only) */
  min?: number
  max?: number
  step?: number
  /** show a dropdown of these values */
  options?: any[] | Record<string, any>
  /** display name, defaults to the key */
  label?: string
  /** rebuild the plot tree when this changes (default true) */
  rebuild?: boolean
  /** keep the control out of the panel */
  hidden?: boolean
  /** never persisted: comes back at its default on every reload */
  transient?: boolean
}

type Entry = { v: any; d: any }

/** Where a route's params live between sessions — and what a saved file holds. */
export const paramsStorageKey = (route: string) => `p5plot:params:${route}`
/**
 * Set alongside the params to mark them as loaded from a file rather than
 * carried over from the last session, which decides who wins when a default
 * has changed in the code since: the file, or the code.
 */
export const paramsLoadedKey = (route: string) => `${paramsStorageKey(route)}:loaded`

export class ParamStore {
  gui: GUI
  /** registered this session: what the panel shows */
  private entries: Record<string, Entry> = {}
  /** values restored from localStorage, consumed on registration */
  private stored: Record<string, Entry> = {}
  private controllers: Record<string, Controller> = {}
  private folders = new Map<string, GUI>()
  /** ids that are deliberately not remembered between sessions */
  private transient = new Set<string>()
  /** values set before their param was registered — applied when it shows up */
  private pending: Record<string, any> = {}
  /** button callbacks, refreshed on every rebuild so none of them go stale */
  private buttonFns: Record<string, { fn: () => void }> = {}
  private storageKey?: string
  /** values came from a file the user picked, so they outrank code defaults */
  private restoreAll = false
  private onChange: (rebuild: boolean) => void
  private saveTimer?: number

  constructor({ container, storageKey, onChange, title = 'params' }: {
    container?: HTMLElement
    storageKey?: string
    onChange: (rebuild: boolean) => void
    title?: string
  }) {
    this.gui = new GUI({ container, title })
    this.storageKey = storageKey
    this.onChange = onChange
    this.load()
  }

  scope(path = ''): ParamScope {
    return new ParamScope(this, path)
  }

  /** lil-gui folder for a `a/b/c` path, created lazily. */
  folder(path: string): GUI {
    if (!path) return this.gui
    const cached = this.folders.get(path)
    if (cached) return cached
    const cut = path.lastIndexOf('/')
    const parent = cut < 0 ? this.gui : this.folder(path.slice(0, cut))
    const created = parent.addFolder(cut < 0 ? path : path.slice(cut + 1))
    this.folders.set(path, created)
    return created
  }

  /** Show/hide a folder without touching the values inside it. */
  showFolder(path: string, visible: boolean) {
    this.folders.get(path)?.show(visible)
  }

  /** Show/hide a single control, for params that only apply in some modes. */
  showControl(path: string, key: string, visible: boolean) {
    this.controllers[path ? `${path}/${key}` : key]?.show(visible)
  }

  has(key: string) {
    return key in this.entries
  }

  get<T = any>(key: string): T {
    return this.entries[key]?.v
  }

  set(key: string, v: any, { silent = false, rebuild = true } = {}) {
    const e = this.entries[key]
    // a param that doesn't exist yet (a folder about to be built) gets its
    // value parked, so callers don't have to care when the rebuild lands
    if (!e) {
      this.pending[key] = v
      if (!silent) this.onChange(rebuild)
      return
    }
    e.v = v
    this.controllers[key]?.updateDisplay()
    this.persist()
    if (!silent) this.onChange(rebuild)
  }

  /**
   * Idempotent registration: the first call creates the control, later calls
   * (from redraws or from sibling subplots) just read the current value.
   */
  register(path: string, key: string, def: any, kind: 'number' | 'boolean' | 'string' | 'color' | 'choice', opts: ParamOpts = {}): any {
    const id = path ? `${path}/${key}` : key
    const known = this.entries[id]
    if (known) {
      // A changed default in code wins over the value we were carrying.
      if (!deepEqual(known.d, def)) {
        known.d = def
        known.v = def
        this.controllers[id]?.updateDisplay()
      }
      return known.v
    }
    if (opts.transient) {
      this.transient.add(id)
      delete this.stored[id] // drop anything an earlier version of the code saved
    }
    const restored = opts.transient ? undefined : this.stored[id]
    // Ordinarily a default changed in code wins over a carried value; a value
    // out of a saved file wins instead. Either way the default recorded from
    // here on is the current one, so later rebuilds leave the value alone.
    const keep = restored && (this.restoreAll || deepEqual(restored.d, def))
    this.entries[id] = keep ? { v: restored!.v, d: def } : { v: def, d: def }
    // A file records the defaults it was saved against. Write the values back
    // under the current ones, or the next reload would treat them as stale.
    if (keep && this.restoreAll) this.persist()
    if (id in this.pending) {
      this.entries[id].v = this.pending[id]
      delete this.pending[id]
    }

    if (!opts.hidden) {
      // lil-gui writes straight onto the object it is handed, so hand it a
      // proxy that reads/writes the store entry.
      const proxy = {} as any
      Object.defineProperty(proxy, key, {
        get: () => this.entries[id].v,
        set: (v: any) => { this.entries[id].v = v },
        enumerable: true,
      })
      const folder = this.folder(path)
      let ctl: Controller
      if (kind === 'color') ctl = folder.addColor(proxy, key)
      else if (kind === 'choice') ctl = folder.add(proxy, key, opts.options as any)
      else if (kind === 'number' && opts.min != null && opts.max != null) ctl = folder.add(proxy, key, opts.min, opts.max, opts.step)
      else ctl = folder.add(proxy, key)
      if (opts.label) ctl.name(opts.label)
      ctl.onChange(() => {
        this.persist()
        this.onChange(opts.rebuild !== false)
      })
      this.controllers[id] = ctl
    }
    return this.entries[id].v
  }

  /**
   * Buttons are registered once but rebuilt closures replace the callback, so
   * a handler always sees the state of the current build, not the first one.
   */
  button(path: string, label: string, fn: () => void) {
    const id = `${path ? path + '/' : ''}${label}()`
    const known = this.buttonFns[id]
    if (known) {
      known.fn = fn
      return
    }
    const holder = { fn }
    this.buttonFns[id] = holder
    this.controllers[id] = this.folder(path).add({ [label]: () => holder.fn() }, label)
  }

  /**
   * Every value registered under `path`, keyed without it. Shallow by default;
   * `deep` also takes nested folders, whose keys keep their slashes — which is
   * what `assign` expects, so a deep read feeds straight back into a write.
   */
  values(path: string, { deep = false } = {}): Record<string, any> {
    const prefix = path ? `${path}/` : ''
    return Object.fromEntries(Object.entries(this.entries)
      .filter(([id]) => id.startsWith(prefix) && (deep || !id.slice(prefix.length).includes('/')))
      .map(([id, e]) => [id.slice(prefix.length), e.v]))
  }

  /** Write a whole folder at once, rebuilding once at the end (or not at all). */
  assign(path: string, values: Record<string, any>, { silent = false } = {}) {
    const keys = Object.keys(values)
    keys.forEach((key, i) => this.set(path ? `${path}/${key}` : key, values[key], {
      silent: silent || i < keys.length - 1,
    }))
  }

  /** Drop every stored value. The caller is expected to reload afterwards. */
  reset() {
    this.entries = {}
    this.stored = {}
    if (this.storageKey) localStorage.removeItem(this.storageKey)
  }

  snapshot(): Record<string, any> {
    return Object.fromEntries(Object.entries(this.entries).map(([k, e]) => [k, e.v]))
  }

  /**
   * Everything worth keeping, in the shape localStorage (and a saved file)
   * uses: value plus the default it was based on. Transient params are left
   * out — a saved plot shouldn't decide whether a simulation is running.
   */
  entriesForSaving(): Record<string, Entry> {
    return Object.fromEntries(Object.entries(this.entries)
      .filter(([id]) => !this.transient.has(id))
      .map(([id, e]) => [id, { v: e.v, d: e.d }]))
  }

  destroy() {
    this.gui.destroy()
    this.folders.clear()
    this.controllers = {}
  }

  private persist() {
    if (!this.storageKey) return
    clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => {
      try {
        const keep = Object.fromEntries(Object.entries(this.entries).filter(([id]) => !this.transient.has(id)))
        localStorage.setItem(this.storageKey!, JSON.stringify({ ...this.stored, ...keep }))
      } catch { /* quota / private mode */ }
    }, 200) as unknown as number
  }

  private load() {
    if (!this.storageKey) return
    try {
      const raw = localStorage.getItem(this.storageKey)
      if (raw) this.stored = JSON.parse(raw)
      // one-shot: the flag is consumed by the panel it was written for
      const loadedKey = `${this.storageKey}:loaded`
      if (localStorage.getItem(loadedKey)) {
        this.restoreAll = true
        localStorage.removeItem(loadedKey)
      }
    } catch { this.stored = {} }
  }
}

/** A namespaced view on the store — what plots actually talk to. */
export class ParamScope {
  constructor(private store: ParamStore, readonly path: string) { }

  child(name: string) {
    return new ParamScope(this.store, this.path ? `${this.path}/${name}` : name)
  }

  num(key: string, def: number, opts: ParamOpts = {}): number {
    return this.store.register(this.path, key, def, 'number', opts)
  }
  bool(key: string, def: boolean, opts: ParamOpts = {}): boolean {
    return this.store.register(this.path, key, def, 'boolean', opts)
  }
  str(key: string, def: string, opts: ParamOpts = {}): string {
    return this.store.register(this.path, key, def, 'string', opts)
  }
  /** hex string, e.g. '#ff0000' — call p5.color() on it if you need a p5.Color */
  color(key: string, def: string, opts: ParamOpts = {}): string {
    return this.store.register(this.path, key, def, 'color', opts)
  }
  choice<T>(key: string, def: T, options: T[] | Record<string, T>, opts: ParamOpts = {}): T {
    return this.store.register(this.path, key, def, 'choice', { ...opts, options: options as any })
  }
  button(label: string, fn: () => void) {
    this.store.button(this.path, label, fn)
  }
  get<T = any>(key: string): T {
    return this.store.get(this.path ? `${this.path}/${key}` : key)
  }
  set(key: string, v: any, opts?: { silent?: boolean; rebuild?: boolean }) {
    this.store.set(this.path ? `${this.path}/${key}` : key, v, opts)
  }
  /** every value in this scope, keyed relative to it */
  values(opts?: { deep?: boolean }) {
    return this.store.values(this.path, opts)
  }
  /** write several values, rebuilding once */
  assign(values: Record<string, any>, opts?: { silent?: boolean }) {
    this.store.assign(this.path, values, opts)
  }
  folder() {
    return this.store.folder(this.path)
  }
  /** Hide this scope's folder when the thing it configures isn't there. */
  show(visible: boolean) {
    this.store.showFolder(this.path, visible)
  }
  /** Hide one control when it doesn't apply, e.g. custom size on a fixed sheet. */
  showControl(key: string, visible: boolean) {
    this.store.showControl(this.path, key, visible)
  }
}

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true
  if (typeof a !== typeof b || a == null || b == null) return false
  if (typeof a !== 'object') return false
  const ka = Object.keys(a), kb = Object.keys(b)
  return ka.length === kb.length && ka.every(k => deepEqual(a[k], b[k]))
}
