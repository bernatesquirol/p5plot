import { PaintRig } from '../../components/PaintRig'
import { mm } from '../../core/paper'
import { definePlot, Plot, PlotCtx } from '../../core/plot'
import { Rect } from '../../core/rect'
import { sweepFill, waveify } from '../../utils/polyline'

/**
 * The first painting plot: flat washes laid in bands across the sheet.
 *
 * A band is not a shape to be outlined — it is a region swept by a brush, so
 * it comes out of `sweepFill` as a run of overlapping strokes in the order one
 * brush should paint them. They go to the rig's PaintJob, which works out
 * where the brush has to go back to a bucket and emits the whole thing in
 * painting order: that order is what the exported SVG has to preserve.
 *
 * On screen it is a watercolour guess (utils/wash); the SVG holds only the
 * centrelines and the stirs inside the buckets.
 */
export class Acuarella extends Plot {
  rig: PaintRig

  constructor(ctx: PlotCtx) {
    super(ctx)
    this.rig = new PaintRig(this)

    const wash = this.params.child('bands')
    const rows = wash.num('bands', 5, { min: 1, max: 32, step: 1 })
    const bandGap = wash.num('gap', 0.25, { min: 0, max: 0.9, step: 0.01, label: 'gap (of a band)' })
    const overlap = wash.num('overlap', 0.45, { min: 0, max: 0.9, step: 0.05, label: 'sweep overlap' })
    const slant = wash.num('slant', 0, { min: -45, max: 45, step: 1, label: 'sweep angle (deg)' })
    const amplitude = mm(wash.num('wave_mm', 4, { min: 0, max: 40, step: 0.5 }))
    const waves = wash.num('waves', 1.5, { min: 0, max: 8, step: 0.25 })
    const shift = wash.num('colourShift', 0, { min: 0, max: 5, step: 1 })

    const brush = this.rig.brush
    const height = this.height / rows
    for (let i = 0; i < rows; i++) {
      const band = new Rect({
        x: this.x,
        y: this.y + i * height + (height * bandGap) / 2,
        width: this.width,
        height: height * (1 - bandGap),
      })
      const sweeps = sweepFill(band, {
        // sweeps closer together than the brush is wide, or the wash is stripes
        spacing: Math.max(1, brush * (1 - overlap)),
        angle: (slant * Math.PI) / 180,
        // keep the wet brush half a width inside the band it belongs to
        margin: brush / 2,
        step: Math.max(2, brush / 2),
      })
      const bucket = this.rig.colour(i + shift)
      sweeps.forEach((sweep, k) => this.rig.job.stroke(bucket, waveify(sweep, {
        amplitude,
        waves,
        // every sweep enters the wave at a different point, so a band reads as
        // a wobbly wash rather than a stack of identical curves
        phase: (i * 0.37 + k * 0.11) % 1,
        taper: true,
      })))
    }
  }

  draw() {
    this.rig.draw()
  }
}

export default definePlot({
  title: 'Aquarel·la',
  note: 'watercolour bands: buckets either side, one brush',
  sheet: 'A4',
  orientation: 'landscape',
  // the sheet is taped in the middle of the bed, so both bucket columns fit
  bed: 'A3',
  bedOrientation: 'landscape',
  paperAt: [6.15, 4.35],
  animated: false,
  frame: { xTracks: '1cm 1 1cm', yTracks: '1cm 1 1cm', cell: [1, 1] },
  create: ctx => new Acuarella(ctx),
})
