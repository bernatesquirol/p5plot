import { Polygon, point } from '@flatten-js/core'
import { XY } from '../../utils/polyline'

/**
 * The corner of a pool: three tiled grids that meet at one point.
 *
 * All three come off the same corner and the same three axes, so they share
 * their edges by construction — the floor and each wall have a whole edge in
 * common, and every grid line that reaches an edge meets its neighbour's.
 *
 *        \  wall   /
 *         \  ___  /       up:    w = (0, -tile * rise)
 *          \/   \/        right: u = tile at +right
 *          /\   /\        left:  v = tile at +left
 *         /  floor \
 *
 * It is a flat axonometric — no vanishing point — because the plotter draws
 * parallel lines beautifully and a perspective grid would only make the tiles
 * in the distance smaller than the brush.
 */
export type FaceId = 'floor' | 'left' | 'right'

export type CornerSpec = {
  /** the whole figure is centred on this point */
  centre: XY
  /** tile size along the floor, in paper pixels */
  tile: number
  /** screen angle of the left and right floor edges, in radians */
  left: number
  right: number
  /** wall tile height, as a fraction of the tile size */
  rise: number
  /** tiles along the right edge, along the left edge, and up the wall */
  counts: [number, number, number]
}

export type Face = {
  id: FaceId
  /** cells[i][j] — i along the face's first axis, j along its second */
  cells: Polygon[][]
  /** the way a brush should sweep a cell of this face, in radians */
  sweep: number
  /** the tile joints, as polylines: what a pen would draw */
  lines: XY[][]
  /** the four corners of the face */
  outline: XY[]
}

export type Corner = {
  faces: Face[]
  /** the corner point itself, once the figure has been centred */
  at: XY
  /** how big the figure is, in paper pixels */
  extent: { w: number; h: number }
}

const dir = (angle: number, length: number): XY => ({ x: Math.cos(angle) * length, y: Math.sin(angle) * length })
const range = (n: number) => Array.from({ length: n }, (_, i) => i)

/** The three axes coming out of the corner, for a given tile size. */
function axes(spec: Pick<CornerSpec, 'left' | 'right' | 'rise'>, tile: number) {
  return {
    u: dir(spec.right, tile),
    v: dir(spec.left, tile),
    // screen y grows downwards, so up the wall is negative
    w: { x: 0, y: -tile * spec.rise } as XY,
  }
}

/**
 * Where the figure sits relative to its corner, per unit of tile. Every face
 * is a parallelogram, so its four corners bound it and eight points bound the
 * lot — no need to walk the cells.
 */
function bounds(spec: Pick<CornerSpec, 'left' | 'right' | 'rise' | 'counts'>) {
  const { u, v, w } = axes(spec, 1)
  const [nu, nv, nw] = spec.counts
  const corners: XY[] = [
    { x: 0, y: 0 },
    { x: u.x * nu, y: u.y * nu },
    { x: v.x * nv, y: v.y * nv },
    { x: w.x * nw, y: w.y * nw },
    { x: u.x * nu + v.x * nv, y: u.y * nu + v.y * nv },
    { x: u.x * nu + w.x * nw, y: u.y * nu + w.y * nw },
    { x: v.x * nv + w.x * nw, y: v.y * nv + w.y * nw },
  ]
  const xs = corners.map(c => c.x)
  const ys = corners.map(c => c.y)
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)]
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)]
  return { w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }
}

/** The tile size that makes the whole figure fit a box. */
export function fitTile(spec: Pick<CornerSpec, 'left' | 'right' | 'rise' | 'counts'>, width: number, height: number) {
  const b = bounds(spec)
  return Math.min(b.w > 0 ? width / b.w : width, b.h > 0 ? height / b.h : height)
}

export function poolCorner(spec: CornerSpec): Corner {
  const b = bounds(spec)
  // the corner is wherever it has to be for the figure to sit on `centre`
  const at: XY = { x: spec.centre.x - b.cx * spec.tile, y: spec.centre.y - b.cy * spec.tile }
  const { u, v, w } = axes(spec, spec.tile)
  const [nu, nv, nw] = spec.counts
  return {
    at,
    extent: { w: b.w * spec.tile, h: b.h * spec.tile },
    faces: [
      face('floor', at, u, v, nu, nv),
      face('right', at, u, w, nu, nw),
      face('left', at, v, w, nv, nw),
    ],
  }
}

function face(id: FaceId, at: XY, a: XY, b: XY, na: number, nb: number): Face {
  const P = (i: number, j: number): XY => ({ x: at.x + a.x * i + b.x * j, y: at.y + a.y * i + b.y * j })
  const cells = range(na).map(i => range(nb).map(j => quad(P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1))))
  return {
    id,
    cells,
    // along the face's first axis: a brush stroke follows the tiles
    sweep: Math.atan2(a.y, a.x),
    lines: [
      ...range(na + 1).map(i => [P(i, 0), P(i, nb)]),
      ...range(nb + 1).map(j => [P(0, j), P(na, j)]),
    ],
    outline: [P(0, 0), P(na, 0), P(na, nb), P(0, nb)],
  }
}

function quad(a: XY, b: XY, c: XY, d: XY): Polygon {
  const p = new Polygon()
  p.addFace([point(a.x, a.y), point(b.x, b.y), point(c.x, c.y), point(d.x, d.y)])
  return p
}

/**
 * The cells of a face in the order one brush should paint them: down a
 * column, back up the next. The brush never crosses the face to start a row.
 */
export function snakeCells(face: Face): { cell: Polygon; i: number; j: number }[] {
  const out: { cell: Polygon; i: number; j: number }[] = []
  face.cells.forEach((column, i) => {
    const rows = column.map((cell, j) => ({ cell, i, j }))
    out.push(...(i % 2 ? rows.reverse() : rows))
  })
  return out
}

/** The same cell pulled in towards its middle — keeps the wash off the joint. */
export function insetCell(cell: Polygon, factor: number): Polygon {
  if (factor >= 1) return cell
  const c = cell.box.center
  const pts = cell.vertices.map(p => ({ x: c.x + (p.x - c.x) * factor, y: c.y + (p.y - c.y) * factor }))
  return quad(pts[0], pts[1], pts[2], pts[3])
}
