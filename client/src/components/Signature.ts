import p5 from 'p5'
import firmes4 from '../assets/firmes4.svg?raw'
import firmes5 from '../assets/firmes5.svg?raw'
import { globalRng, Rng } from '../core/rng'
import { getSvgPaths, pathToRings, Ring } from './svgPaths'
import { RectLike } from '../core/rect'

const SHEETS = { firmes4, firmes5 }
export type SignatureSheet = keyof typeof SHEETS

type Sampled = { rings: Ring[]; x: number; y: number; width: number; height: number }

const sheetPathsCache = new Map<SignatureSheet, SVGPathElement[]>()
const sampledCache = new Map<string, Sampled>()

/** Parse the scan once per file; the scans carry a frame path at index 3. */
function sheetPaths(sheet: SignatureSheet): SVGPathElement[] {
  let paths = sheetPathsCache.get(sheet)
  if (!paths) {
    paths = getSvgPaths(SHEETS[sheet]).filter((_p, i) => i !== 3)
    sheetPathsCache.set(sheet, paths)
  }
  return paths
}

/**
 * Walking a path with getPointAtLength is slow, so each signature is sampled
 * once and reused, and only the ones actually drawn are ever sampled.
 * The samples stay plain point rings: turning a few thousand of them into
 * flatten Polygons (and again for every scale/rotate) cost seconds per
 * signature, and nothing here needs boolean geometry.
 */
function sample(sheet: SignatureSheet, index: number): Sampled {
  const key = `${sheet}:${index}`
  const hit = sampledCache.get(key)
  if (hit) return hit

  const rings = pathToRings(sheetPaths(sheet)[index])
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const ring of rings) {
    for (const p of ring) {
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
      if (p.x > maxX) maxX = p.x
      if (p.y > maxY) maxY = p.y
    }
  }
  const entry: Sampled = { rings, x: minX, y: minY, width: maxX - minX, height: maxY - minY }
  sampledCache.set(key, entry)
  return entry
}

export type SignatureOpts = RectLike & {
  /** which scan of signatures to pick from */
  sheet?: SignatureSheet
  /** radians, about the signature's own centre (the old SignaturePlot used -PI/2) */
  rotate?: number
  /** pick a specific signature instead of a random one */
  index?: number
  rng?: Rng
}

/**
 * One of the scanned signatures, scaled to fit the given box.
 * Not a Plot — it is a drawable you put inside a layer.
 */
export class Signature {
  rings: Ring[] = []

  constructor(private p: p5, opts: SignatureOpts) {
    const { width, height, sheet = 'firmes5', rotate = 0, rng = globalRng() } = opts
    const x = opts.x || 0
    const y = opts.y || 0

    const paths = sheetPaths(sheet)
    if (!paths.length) return
    const index = (opts.index ?? rng.int(paths.length)) % paths.length
    const src = sample(sheet, index)
    if (!src.rings.length || !src.width || !src.height) return

    // Same placement as before: scale about the source origin, translate, then
    // spin about the signature's own centre.
    const scale = Math.min(width / src.width, height / src.height)
    const [cx, cy] = [x + scale * (src.x + src.width / 2), y + scale * (src.y + src.height / 2)]
    const [cos, sin] = [Math.cos(rotate), Math.sin(rotate)]

    this.rings = src.rings.map(ring => ring.map(pt => {
      const px = x + pt.x * scale
      const py = y + pt.y * scale
      if (!rotate) return { x: px, y: py }
      const [dx, dy] = [px - cx, py - cy]
      return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos }
    }))
  }

  draw() {
    const p = this.p
    p.push()
    for (const ring of this.rings) {
      p.beginShape()
      for (const pt of ring) p.vertex(pt.x, pt.y)
      p.endShape(p.CLOSE)
    }
    p.pop()
  }

  /** older plots called this `show()` */
  show() {
    this.draw()
  }
}
