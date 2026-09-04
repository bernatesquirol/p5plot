import { definePlot, Plot, PlotCtx } from '../../core/plot'
import { Margins } from '../../components/Margins'
import { XmasPlot } from '../251222_xmas'

/** A grid of trees on one sheet. */
export class XmasSheet extends Plot {
  margins: Margins
  trees: XmasPlot[] = []

  constructor(ctx: PlotCtx) {
    super(ctx)

    const cols = this.num('cols', 3, { min: 1, max: 8, step: 1 })
    const rows = this.num('rows', 3, { min: 1, max: 8, step: 1 })
    const pad = `${this.num('padding_cm', 1, { min: 0, max: 4, step: 0.1 })}cm`

    this.margins = new Margins(this.p5, {
      ...this.box,
      xTracks: [pad, ...Array.from({ length: cols }, () => '1'), pad].join(' '),
      yTracks: [pad, ...Array.from({ length: rows }, () => '1'), pad].join(' '),
    })

    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const cell = this.margins.regions[1 + col][1 + row]
        this.trees.push(new XmasPlot(ctx.child('xmas', cell), { count: 40 }))
      }
    }
  }

  step(dt: number) {
    this.trees.forEach(tree => tree.step(dt))
  }

  draw() {
    this.layer('margins', () => this.margins.draw())
    this.trees.forEach(tree => tree.draw())
  }
}

export default definePlot({
  title: 'Xmas sheet',
  sheet: 'A3',
  orientation: 'landscape',
  create: ctx => new XmasSheet(ctx),
})
