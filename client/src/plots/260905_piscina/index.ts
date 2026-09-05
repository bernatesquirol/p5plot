import { Polygon } from '@flatten-js/core'
import { Handle } from '../../components/Handle'
import { PaintRig } from '../../components/PaintRig'
import { cm } from '../../core/paper'
import { definePlot, Plot, PlotCtx } from '../../core/plot'
import { centreSweep, polylineLength, sweepFill, trimEnds, XY } from '../../utils/polyline'
import { Corner, fitTile, insetCell, poolCorner, snakeCells } from './corner'

/**
 * Nothing but shades of blue: it is all the same water, and the corner reads
 * as a corner because the three faces are three values of it.
 *
 * They stay saturated all the way down rather than heading for navy — a wash
 * is translucent, so a near-black blue lands on the paper as grey.
 */
const POOL = ['#d6ecf7', '#a7d5ea', '#6ab8dc', '#2e93c9', '#1668a8', '#0b4680']

/** How a single tile is painted. */
type Style = 'fill' | 'dab'

/**
 * The corner of a pool: three tiled grids meeting at one point, with the
 * tiles painted one by one.
 *
 * The three faces carry three different tints of the same water, which is the
 * whole trick — nothing here is in perspective, the corner reads as a corner
 * because the floor, the left wall and the right wall are different values.
 *
 * Every tile is a cell of one of the grids, so painting one is `sweepFill` on
 * a parallelogram: strokes that follow the tile's own direction, pulled in off
 * the joint so the wash doesn't run into its neighbour. The cells are walked
 * in snake order, face by face, and handed to the rig's PaintJob — which
 * groups them by colour, drops in the dips, and emits the lot in painting
 * order. The pen grid is a separate layer: plot it before or after the paint,
 * whichever your ink survives.
 */
export class Piscina extends Plot {
  rig: PaintRig
  corner: Corner

  constructor(ctx: PlotCtx) {
    super(ctx)
    // A narrower brush than the bands plot wants: it takes three passes to
    // fill a 2cm tile instead of one, and it rounds the tile's corners off by
    // that much less — which is what makes a tile read as a tile.
    this.rig = new PaintRig(this, { palette: POOL, colours: 6, brush_mm: 8, capacity_cm: 25 })

    // --- the corner ---
    const geo = this.params.child('corner')
    const cx = geo.num('x', 0.5, { min: -0.5, max: 1.5, step: 0.005 })
    const cy = geo.num('y', 0.5, { min: -0.5, max: 1.5, step: 0.005 })
    // 30 is a true isometric: the floor tiles come out as 60/120 rhombi, which
    // a round brush can fill squarely. Sharper than that and the acute corners
    // are wedges no brush reaches into.
    const angleRight = geo.num('angleRight', 30, { min: 5, max: 80, step: 0.5, label: 'right edge (deg)' })
    const angleLeft = geo.num('angleLeft', 30, { min: 5, max: 80, step: 0.5, label: 'left edge (deg)' })
    // The pool is tiled the same in every direction: as many courses up each
    // wall as there are tiles along each floor edge. One count, three axes.
    // 6 puts a 2cm tile on an A4 sheet, which a 12mm brush can paint with the
    // joint still showing; push it much past that and the paint fills every
    // cell edge to edge and the tiling disappears
    const perEdge = geo.num('tiles', 6, { min: 1, max: 24, step: 1, label: 'tiles per edge' })
    const counts: [number, number, number] = [perEdge, perEdge, perEdge]
    // How tall a course is, against how long a floor tile is: 1 is a true
    // square tile in axonometric, less looks down into the pool more steeply
    // and leaves the walls room on a landscape sheet.
    const rise = geo.num('rise', 0.6, { min: 0.2, max: 3, step: 0.05, label: 'course height' })
    const fit = geo.bool('fit', true, { label: 'fit to the sheet' })
    const tile_cm = geo.num('tile_cm', 2, { min: 0.3, max: 10, step: 0.05 })
    geo.showControl('tile_cm', !fit)

    // drag the whole figure around by its middle
    Handle.param(this, 'corner/x', 'corner/y', { label: 'pool', clamp: [-0.5, 1.5] })

    const shape = {
      // the floor edges fall away either side of the corner; screen y grows
      // downwards, so both angles are positive and mirrored
      right: (angleRight * Math.PI) / 180,
      left: Math.PI - (angleLeft * Math.PI) / 180,
      rise,
      counts,
    }
    this.corner = poolCorner({
      ...shape,
      centre: { x: this.box.toX(cx), y: this.box.toY(cy) },
      tile: fit ? fitTile(shape, this.width, this.height) : cm(tile_cm),
    })

    // --- the tiles ---
    const tiles = this.params.child('tiles')
    const style = tiles.choice<Style>('style', 'fill', ['fill', 'dab'])
    const coverage = tiles.num('coverage', 0.92, { min: 0, max: 1, step: 0.01, label: 'tiles painted' })
    const accent = tiles.num('accent', 0.08, { min: 0, max: 1, step: 0.01, label: 'accent tiles' })
    const inset = tiles.num('inset', 0.92, { min: 0.2, max: 1, step: 0.01, label: 'tile fill (of a tile)' })
    const overlap = tiles.num('overlap', 0.45, { min: 0, max: 0.9, step: 0.05, label: 'sweep overlap (most)' })
    const waterline = tiles.num('waterline', 0.75, { min: 0, max: 1, step: 0.01, label: 'water up the wall' })
    // 0 stops the paint exactly at the tile's edge, which leaves its corners
    // bare — a round brush cannot get into them. Letting it run on a little
    // pushes into the corners, so the tile reads as a quad and not a pill.
    // Kept well under the joint: bleed as far as the gap between two tiles and
    // they run into each other, and the floor comes out as stripes.
    const bleed = tiles.num('bleed', 0.15, { min: 0, max: 1, step: 0.05, label: 'bleed into corners' })

    const colour = this.params.child('colours')
    const bucket = {
      // deepest under the water, so darkest; then the lit wall and the shaded
      // one. Three values of the one blue is what makes the corner a corner.
      // Spread wide across the palette, not adjacent steps of it: a wash is
      // translucent, so two neighbouring blues come out as the same blue.
      floor: colour.num('floor', 5, { min: 0, max: POOL.length - 1, step: 1 }),
      left: colour.num('left', 1, { min: 0, max: POOL.length - 1, step: 1 }),
      right: colour.num('right', 3, { min: 0, max: POOL.length - 1, step: 1 }),
    }
    // a pale tile here and there, the way light catches the water
    const accentColour = colour.num('accent', 0, { min: 0, max: POOL.length - 1, step: 1 })

    // --- paint them, face by face, in snake order ---
    for (const face of this.corner.faces) {
      const wall = face.id !== 'floor'
      // the water only reaches so far up the wall; above it the tiles are dry
      const wet = Math.round(waterline * counts[2])
      for (const { cell, j } of snakeCells(face)) {
        if (wall && j >= wet) continue
        // a few tiles left bare: a pool nobody has retiled
        if (this.rng.random() > coverage) continue
        const pick = this.rng.random() < accent ? accentColour : bucket[face.id]
        this.rig.job.strokeAll(this.rig.colour(pick), this.tileStrokes(insetCell(cell, inset), face.sweep, style, overlap, bleed))
      }
    }
  }

  /**
   * The strokes that paint one tile.
   *
   * `fill` covers the tile: the sweeps run parallel to its own edges and are
   * fitted to it, so the tile comes out as a painted square-in-projection
   * rather than as a line down the middle. A tile the width of the brush gets
   * one sweep, a wider one gets as many as it takes.
   *
   * `dab` is the other way to do it: one pass, one tile, whatever its size —
   * quick to plot, but it reads as a stroke, not as a tile.
   */
  private tileStrokes(cell: Polygon, angle: number, style: Style, overlap: number, bleed: number): XY[][] {
    const brush = this.rig.brush
    const step = Math.max(2, brush / 2)
    // how far inside the tile a stroke has to stop for its paint to land on
    // the edge: half a brush, less whatever bleed is allowed past it
    const margin = (brush / 2) * (1 - bleed)
    if (style === 'fill') {
      const sweeps = sweepFill(cell, {
        spacing: Math.max(1, brush * (1 - overlap)),
        brush,
        fit: true,
        angle,
        margin,
        step,
      })
      if (sweeps.length) return sweeps
    }
    // One pass down the middle, held back from the ends as above — but never
    // by more than three eighths of the tile, or a tile no bigger than the
    // brush would have nothing left to paint at all.
    const spine = centreSweep(cell, { angle, margin: 0, step })
    if (!spine) return []
    return [trimEnds(spine, Math.min(margin, polylineLength(spine) * 0.375)) ?? spine]
  }

  draw() {
    // the paint layer is claimed first: its path order is the painting
    this.rig.draw()
    // the joints, for a pen. A separate layer, so which goes on the paper
    // first is a decision at the plotter, not here.
    this.layer('grid', () => {
      const p = this.p5
      p.push()
      p.noFill()
      for (const face of this.corner.faces) {
        for (const line of face.lines) {
          p.beginShape()
          for (const pt of line) p.vertex(pt.x, pt.y)
          p.endShape()
        }
      }
      p.pop()
    }, { visible: false })
  }
}

export default definePlot({
  title: 'Piscina',
  note: 'the corner of a pool: three grids, painted tile by tile',
  sheet: 'A4',
  orientation: 'landscape',
  // the sheet is taped in the middle of the bed, so both bucket columns fit
  bed: 'A3',
  bedOrientation: 'landscape',
  paperAt: [6.15, 4.35],
  animated: false,
  frame: { xTracks: '1cm 1 1cm', yTracks: '1cm 1 1cm', cell: [1, 1] },
  create: ctx => new Piscina(ctx),
})
