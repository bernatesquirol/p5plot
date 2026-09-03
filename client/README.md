# plots

p5 + SVG plotter sketches. One canvas, one param panel, one plot per URL.

```bash
npm install
npm run dev        # http://localhost:3000/#/ocell
npm run build      # -> dist/
npm run typecheck
```

## How it fits together

```
src/
  core/          the harness — no plot ever touches the screen directly
    paper.ts     sheet sizes in mm -> paper pixels (DPI 100)
    rect.ts      Rect: a region in paper pixels, with 0..1 accessors
    plot.ts      Plot base class, PlotCtx, definePlot()
    params.ts    one lil-gui panel, namespaced param scopes
    layers.ts    named layers -> inkscape groups in the SVG
    sketch.ts    p5 instance, canvas sizing, view transform, SVG export
    router.ts    hash routes
    rng.ts       seeded randomness
  components/    reusable drawables (Margins, Signature, Svg, PhysicsBox)
  plots/         one folder per plot
  registry.ts    route -> plot
```

**Everything is drawn in paper pixels.** 1 unit = 1/100 inch, so an A4 portrait
is 827 x 1169 units whatever the window is doing. The sketch fits the sheet to
the screen with a view transform; the SVG is always recorded at true paper size.

## Adding a plot

```ts
// src/plots/260901_thing/index.ts
import { definePlot, Plot, PlotCtx } from '../../core/plot'

export class Thing extends Plot {
  constructor(ctx: PlotCtx) {
    super(ctx)
    // read params here — the whole tree is rebuilt when one changes
    const n = this.num('n', 40, { min: 1, max: 200, step: 1 })
    this.dots = /* ...build geometry inside this.box... */
  }

  draw() {
    this.layer('dots', () => drawFlatten(this.p5, this.dots))
  }
}

export default definePlot({
  title: 'Thing',
  sheet: 'A4',
  orientation: 'portrait',
  animated: false,          // static: p5 only redraws on change
  create: ctx => new Thing(ctx),
})
```

Then add it to `src/registry.ts` and it appears at `#/thing`, in the gallery
and in the plot picker.

### Params

`this.num / bool / color / choice / button` register into one shared panel.
Values persist per route in localStorage and survive rebuilds; changing a
default in code wins over a stored value. Pass `{ rebuild: false }` for
something read at draw time that shouldn't rebuild the geometry.

### Layers

`this.layer(name, drawFn)` queues a callback. Layers are global to the sketch
and keyed by name, so twenty subplots drawing into `"lines"` all end up in one
inkscape layer. Each layer gets a visibility checkbox in the panel.

### Subplots and sheets

A multiplot builds child contexts and hands each one a `Rect`:

```ts
const cell = this.margins.regions[1][1]
this.roses.push(new Rose(ctx.child('rose', cell)))
```

`ctx.child(kind, box)` gives every subplot of a kind **the same param scope**
(one folder in the panel) and **its own rng stream**, so a sheet of roses is
one set of sliders and twenty different flowers. The panel's `seed` reproduces
the whole sheet exactly.

### Paper vs screen

`sizing: 'paper'` (default) pins the plot to a sheet; `sizing: 'screen'` makes
the box the canvas itself and rebuilds on resize. Both are switchable at
runtime from the `sketch` folder, along with the sheet size and orientation.

### Keys

`s` export SVG · `h` hide the panel · `r` reroll the seed

## Deploying

`.github/workflows/deploy.yml` builds `client/` and publishes `dist/` to GitHub
Pages on every push to `main` (enable Pages -> Source: GitHub Actions once).
The build uses a relative base and hash routing, so it works from any subpath.

## Todo

- [ ] Python code that plots from the SVG (interactive calibrate + layer-by-layer plotting)
- [ ] Genuary interesting (boolean)
