import { definePlot, Plot, PlotCtx } from '../../core/plot'
import { Margins } from '../../components/Margins'
import { Signature } from '../../components/Signature'
import { Star5Plot } from '../260119_star'

/** A sheet of stars: same subplot repeated, one param folder for all of them. */
export class StarSheet extends Plot {
  margins: Margins
  stars: Star5Plot[] = []
  signatures: Signature[] = []

  constructor(ctx: PlotCtx) {
    super(ctx)

    const cols = this.num('cols', 4, { min: 1, max: 8, step: 1 })
    const rows = this.num('rows', 4, { min: 1, max: 8, step: 1 })
    const pad = `${this.num('padding_cm', 0.5, { min: 0, max: 4, step: 0.1 })}cm`
    const gutter = `${this.num('signature_cm', 0.8, { min: 0, max: 3, step: 0.1 })}cm`

    this.margins = new Margins(this.p5, {
      ...this.box,
      xTracks: [pad, ...Array.from({ length: cols }, () => `1 ${gutter}`), pad].join(' '),
      yTracks: [pad, ...Array.from({ length: rows }, () => '1'), pad].join(' '),
    })

    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const cell = this.margins.regions[1 + 2 * col][1 + row]
        this.stars.push(new Star5Plot(ctx.child('star', cell), { density: 0.35, grid: 12 }))

        const gutterCell = this.margins.regions[2 + 2 * col][1 + row]
        this.signatures.push(new Signature(this.p5, {
          x: gutterCell.toX(0.42),
          y: gutterCell.toY(0.8),
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
    this.stars.forEach(star => star.draw())
    this.layer('signature', () => this.signatures.forEach(s => s.draw()))
  }
}

export default definePlot({
  title: 'Star sheet',
  sheet: 'A3',
  orientation: 'landscape',
  create: ctx => new StarSheet(ctx),
})
