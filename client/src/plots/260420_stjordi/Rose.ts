import { createCircle, drawFlatten, randomBetween } from '../../utils'
import { Circle, Point, Segment, point, segment } from '@flatten-js/core'
import p5 from 'p5'
import { SinglePlot as ParentPlot, SinglePlot } from '../../components/Plot'

function nearestRayHit(
  A: Point,
  angle: number,
  shapes: (Circle | Segment)[],
  reach: number,
  eps = 2
): Point | null {
  const far = point(A.x + Math.cos(angle) * reach, A.y + Math.sin(angle) * reach)
  const ray = segment(A, far)
  let best: Point | null = null
  let bestDist = Infinity
  for (const shape of shapes) {
    const hits = shape.intersect(ray) as Point[]
    for (const h of hits) {
      const d = A.distanceTo(h)[0]
      if (d > eps && d < bestDist) {
        bestDist = d
        best = h
      }
    }
  }
  return best
}
const toDisc = (s: Flatten.Segment, len: number, lenBuit: number): Flatten.Segment[] => {
    const result: Flatten.Segment[] = [];
    const total = s.length;

    // Safety: return original if length is invalid or too large
    if (len <= 0 || len > total) return [s.clone()];

    // Loop through the distance in steps of 'len'
    let currentDist = 0;
    let lenIter = lenBuit
    // 1. Create all full-length segments
    let i = 0
    while (currentDist + lenIter <= total) {
        const pStart = s.pointAtLength(currentDist);
        const pEnd = s.pointAtLength(currentDist + lenIter);
        currentDist += lenIter;
        if (i%2){
          result.push(new Segment(pStart!, pEnd!));
        }
        lenIter = i%2?lenBuit:len
        i+=1
    }

    // 2. Add the "rest" - the final segment to the original end point (pe)
    if (currentDist < total && i%2) {
        const pStart = s.pointAtLength(currentDist);
        // Use s.pe directly to ensure mathematical precision at the terminus
        result.push(new Segment(pStart!, s.pe!));
    }    

    return result
};
const phi = (1 + Math.sqrt(5)) / 2
const goldenArc = 2 * Math.PI * (1 - 1 / phi)
const DEFAULT_CHORD_ANGLE = Math.PI / 2 + goldenArc  

export class Plot extends ParentPlot {
  x: number
  y: number
  height: number
  width: number
  p5: p5
  lines: { show: () => void }[]
  cx: number
  cy: number
  r: number
  segs: Segment[]

   constructor({p5: p5, parentPlot}: {p5: p5, parentPlot?: SinglePlot}, { x, y, offsetRose, height, width, saveSVG: _saveSVG, }: {offsetRose?: {x?: number, y?: number}, angleTree?: number, x?: number, y?: number, height: number, width: number, saveSVG: () => void}) {
    super({p5, parentPlot})
    this.width = width
    this.height = height
    this.p5 = p5
    this.x = (offsetRose?.x||0) + (x || 0)
    this.y = (offsetRose?.y||0) + (y || 0)

    this.cx =  this.x + this.width / 2
    this.cy =  + this.y + this.height / 2
    this.r = Math.min(width, height) * 0.37
    this.segs = []

    this.settings['chordAngle'] = DEFAULT_CHORD_ANGLE
    this.settings['startAngle'] = Math.random()*Math.PI
    this.gui.add(this.settings, 'chordAngle', 0, Math.PI * 2, 0.01).onChange(() => this.build())
    this.gui.add(this.settings, 'startAngle', 0, Math.PI * 2, 0.01).onChange(() => this.build())

    this.lines = [{
      show: () => {
        this.p5.push()
        this.p5.noFill()
        this.p5.stroke(0)
        drawFlatten(this.p5, [ ...this.segs.map(s=>toDisc(s, 3, 2)).flat()]) //
        this.p5.pop()
      }
    }]

    this.build()
  }

  build() {
    
    const { cx, cy, r } = this
    const chordAngle: number = this.settings['chordAngle']
    const nLines = 50
    const angleJitter = Math.PI * 0.01
    const circle = new Circle(point(cx, cy), r)
    const shapes: (Circle | Segment)[] = [circle]
    const segs: Segment[] = []
    const startAngle: number = this.settings['startAngle']
    let A = point(cx + r * Math.cos(startAngle), cy + r * Math.sin(startAngle))

    for (let i = 0; i < nLines; i++) {  
      
      const baseAngle = Math.atan2(A.y - cy, A.x - cx)
      const angle = baseAngle + chordAngle + randomBetween(-angleJitter, angleJitter)
      const B = nearestRayHit(A, angle, shapes, r * 4)
      if (!B) break
      const seg = segment(A, B)
      segs.push(seg)
      shapes.push(seg)
      if (i==4){
        const C = nearestRayHit(A, angle, [segs[0]], r * 4)
        if (C) {
          segs[0] = segment(C, segs[0].pe)
          shapes[1] = segs[0]
        }
      }
      A = B
    }
    this.segs = segs
  }

  draw = () => {
    this.addLayer('boxes', () => {
      for (let i = 0; i < this.lines.length; i++) {
        this.lines[i].show()
      }
    }, {visible: true}, this)
  }
}
