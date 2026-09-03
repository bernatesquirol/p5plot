import p5 from 'p5'
import { Polygon, Segment } from '@flatten-js/core'
import { createSegmentPoints, drawFlatten } from '../utils'
import { cm, mm } from '../core/paper'
import { Rect, RectLike } from '../core/rect'

/**
 * CSS-grid-ish layout for a sheet, plus the crop marks that show where the
 * cells are. Track specs, space separated:
 *
 *   "2cm 1fr 2cm"        fixed / flexible
 *   "1cm 2 1 1cm"        a bare number is a flex unit
 *   "10mm 1fr-[main] 1"  name a track and read it back from namedRegions
 *
 * Fixed units are cm / mm / px (px = paper pixels, i.e. 1/DPI inch).
 */

type Track = {
  fixed?: number
  flex?: number
  size: number
  start: number
  name?: string
}

function parseTracks(spec: string): Track[] {
  return spec.trim().split(/\s+/).map(token => {
    let sizeSpec = token
    let name: string | undefined
    if (token.includes('-')) {
      const [size, label] = token.split('-')
      sizeSpec = size
      name = label.replace(/[\[\]]/g, '')
    }
    const t: Track = { size: 0, start: 0, name }
    if (sizeSpec.endsWith('cm')) t.fixed = cm(parseFloat(sizeSpec))
    else if (sizeSpec.endsWith('mm')) t.fixed = mm(parseFloat(sizeSpec))
    else if (sizeSpec.endsWith('px')) t.fixed = parseFloat(sizeSpec)
    else t.flex = parseFloat(sizeSpec) || 1
    return t
  })
}

function resolveTracks(tracks: Track[], total: number) {
  const fixedTotal = tracks.reduce((s, t) => s + (t.fixed ?? 0), 0)
  const flexTotal = tracks.reduce((s, t) => s + (t.flex ?? 0), 0)
  const unit = flexTotal > 0 ? (total - fixedTotal) / flexTotal : 0
  let cursor = 0
  tracks.forEach(t => {
    t.size = t.fixed ?? t.flex! * unit
    t.start = cursor
    cursor += t.size
  })
  return tracks
}

export function buildGrid(container: RectLike, xTracksStr: string, yTracksStr: string) {
  const box = container instanceof Rect ? container : new Rect(container)
  const xTracks = resolveTracks(parseTracks(xTracksStr), box.width)
  const yTracks = resolveTracks(parseTracks(yTracksStr), box.height)
  const namedRegions: Record<string, Rect[]> = {}

  // regions[col][row]
  const regions = xTracks.map(xT =>
    yTracks.map(yT => {
      const cell = new Rect({ x: box.x + xT.start, y: box.y + yT.start, width: xT.size, height: yT.size })
      for (const name of [xT.name, yT.name]) {
        if (name) (namedRegions[name] ??= []).push(cell)
      }
      return cell
    }))

  return { regions, namedRegions, xTracks, yTracks }
}

export type MarginsOpts = RectLike & { xTracks: string; yTracks: string }

export class Margins {
  regions: Rect[][]
  namedRegions: Record<string, Rect[]>
  marks: (Segment | Polygon)[]

  constructor(private p: p5, opts: MarginsOpts) {
    const { regions, namedRegions } = buildGrid(opts, opts.xTracks, opts.yTracks)
    this.regions = regions
    this.namedRegions = namedRegions
    this.marks = cropMarks(regions)
  }

  /** every cell, flattened */
  cells(): Rect[] {
    return this.regions.flat()
  }

  /** cells of a named track */
  named(name: string): Rect[] {
    return this.namedRegions[name] || []
  }

  draw() {
    this.p.push()
    this.marks.forEach(geo => drawFlatten(this.p, geo))
    this.p.pop()
  }
}

/** Short ticks on the outer edges marking each grid line. */
function cropMarks(regions: Rect[][]): (Segment | Polygon)[] {
  const marks: (Segment | Polygon)[] = []
  regions.forEach((column, colIndex) => {
    column.forEach((cell, rowIndex) => {
      const firstRow = rowIndex === 0
      const lastRow = rowIndex === column.length - 1
      const firstCol = colIndex === 0
      const lastCol = colIndex === regions.length - 1
      if (firstRow && !firstCol) {
        marks.push(createSegmentPoints({ x0: cell.x, y0: cell.y, xf: cell.x, yf: cell.cy }))
      }
      if (lastRow && !firstCol) {
        marks.push(createSegmentPoints({ x0: cell.x, y0: cell.cy, xf: cell.x, yf: cell.bottom }))
      }
      if (firstCol && !firstRow) {
        marks.push(createSegmentPoints({ x0: cell.x, y0: cell.y, xf: cell.cx, yf: cell.y }))
      }
      if (lastCol && !firstRow) {
        marks.push(createSegmentPoints({ x0: cell.cx, y0: cell.y, xf: cell.right, yf: cell.y }))
      }
    })
  })
  return marks
}
