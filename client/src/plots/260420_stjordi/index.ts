import { definePlot, Plot, PlotCtx } from '../../core/plot'
import { Margins } from '../../components/Margins'
import { Signature } from '../../components/Signature'
import { Rose } from './Rose'

/**
 * A sheet of roses for Sant Jordi: a grid of Rose subplots, each with a
 * signature gutter to its right. All roses share one param folder (they are
 * the same kind) and differ only through their own rng stream.
 */
export class StJordi extends Plot {
  margins: Margins
  roses: Rose[] = []
  signatures: Signature[] = []

  constructor(ctx: PlotCtx) {
    super(ctx)

    const cols = this.num('cols', 4, { min: 1, max: 8, step: 1 })
    const rows = this.num('rows', 5, { min: 1, max: 8, step: 1 })
    const pad = `${this.num('padding_cm', 0.5, { min: 0, max: 4, step: 0.1 })}cm`
    const gutter = `${this.num('signature_cm', 0.6, { min: 0, max: 3, step: 0.1 })}cm`
    const offsetX = this.num('roseOffsetX', -0.2, { min: -0.5, max: 0.5, step: 0.01 })

    // pad | 1fr gutter | 1fr gutter | ... | pad   → plot columns sit at 1, 3, 5...
    this.margins = new Margins(this.p5, {
      ...this.box,
      xTracks: [pad, ...Array.from({ length: cols }, () => `1 ${gutter}`), pad].join(' '),
      yTracks: [pad, ...Array.from({ length: rows }, () => '1'), pad].join(' '),
    })

    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const cell = this.margins.regions[1 + 2 * col][1 + row]
        this.roses.push(new Rose(ctx.child('rose', {
          x: cell.x + cell.width * offsetX,
          y: cell.y,
          width: cell.width,
          height: cell.height,
        })))

        const gutterCell = this.margins.regions[2 + 2 * col][1 + row]
        this.signatures.push(new Signature(this.p5, {
          x: gutterCell.toX(0.42),
          y: gutterCell.toY(0.15),
          width: gutterCell.width * 0.35,
          height: gutterCell.height,
          sheet: 'firmes4',
          rotate: -Math.PI / 2,
          rng: this.rng.fork(`sign-${col}-${row}`),
        }))
      }
    }
  }

  draw() {
    this.layer('margins', () => this.margins.draw())
    this.roses.forEach(rose => rose.draw())
    this.layer('signature', () => this.signatures.forEach(s => s.draw()))
  }
}

export default definePlot({
  title: 'Sant Jordi',
  sheet: 'A3',
  orientation: 'landscape',
  animated: false,
  create: ctx => new StJordi(ctx),
})
