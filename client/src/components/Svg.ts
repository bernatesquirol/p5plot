import p5 from 'p5'
import { Segment } from '@flatten-js/core'
import { drawFlatten } from '../utils/flatten'
import { getSvgPaths, pathToSegments } from './svgPaths'

export type SvgOpts = {
  rawSvg: string
  x?: number
  y?: number
  /** uniform scale applied to the source coordinates */
  scaleRatio?: number
  /** drop paths by index (the scans have a stray frame path at 3) */
  skip?: number[]
}

/** A raw SVG file drawn as plotter-friendly polylines. */
export class Svg {
  lines: Segment[]

  constructor(private p: p5, { rawSvg, x = 0, y = 0, scaleRatio = 1, skip = [3] }: SvgOpts) {
    this.lines = getSvgPaths(rawSvg)
      .filter((_path, i) => !skip.includes(i))
      .flatMap(path => pathToSegments(path))
      .map(s => s.scale(scaleRatio, scaleRatio).translate(x, y) as Segment)
  }

  draw() {
    this.lines.forEach(line => drawFlatten(this.p, line))
  }

  show() {
    this.draw()
  }
}
