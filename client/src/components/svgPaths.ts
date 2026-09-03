import { point, Point, Polygon, Segment } from '@flatten-js/core'
import { iterTwo } from '../utils/geo'

/**
 * Turning raw SVG text into flatten geometry. Was copy-pasted three times
 * (Signature, SignaturePlot, Svg); this is the one copy.
 */

/** A sampled subpath: plain coordinates, no flatten bookkeeping. */
export type XY = { x: number; y: number }
export type Ring = XY[]

export function getSvgPaths(svgText: string): SVGPathElement[] {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml')
  return Array.from(doc.querySelectorAll('path'))
}

/** `M x y ...` subpaths of a single path element. */
function splitSubPaths(d: string): string[] {
  return d.split(/(?=[Mm])/)
}

/**
 * Walk a path with getPointAtLength, one point every `density` source units.
 *
 * The scans are high resolution and get drawn a few centimetres wide, so a
 * flat density means tens of thousands of DOM calls per signature for detail
 * nobody can see (a sheet of twenty took minutes). `maxPoints` coarsens the
 * step for long paths instead.
 */
function samplePath(d: string, density: number, maxPoints: number): Ring {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  el.setAttribute('d', d)
  const total = el.getTotalLength()
  if (!total) return []
  const step = Math.max(density, total / maxPoints)
  const points: Ring = []
  for (let at = 0; at <= total; at += step) {
    const p = el.getPointAtLength(at)
    points.push(point(p.x, p.y))
  }
  return points
}

export type SampleOpts = {
  /** distance between samples, in the source SVG units */
  density?: number
  /** cap on samples per subpath */
  maxPoints?: number
}

/** One ring of points per subpath of `path`. */
export function pathToRings(path: SVGPathElement, { density = 2, maxPoints = 600 }: SampleOpts = {}): Ring[] {
  const d = path.getAttribute('d')
  if (!d) return []
  return splitSubPaths(d).map(sub => samplePath(sub, density, maxPoints)).filter(r => r.length > 1)
}

export function pathToPolygons(path: SVGPathElement, opts?: SampleOpts): Polygon[] {
  return pathToRings(path, opts).map(ring => new Polygon(ring as Point[]))
}

export function pathToSegments(path: SVGPathElement, opts?: SampleOpts): Segment[] {
  return pathToRings(path, opts)
    .flatMap(ring => iterTwo(ring).map(([a, b]: [Point, Point]) => new Segment(a, b)))
}
