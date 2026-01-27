import { Circle, Matrix, Point, Polygon, Segment, Vector, point, segment } from "@flatten-js/core";
import * as martinez from 'martinez-polygon-clipping';
export function equilateralTriangleCentroidDown({x,y,w,h}:{x:number, y:number, w:number, h:number}) {
  // const h = Math.sqrt(3) / 2 * s
  let p = new Polygon()
  p.addFace([
    // bottom-left
    point(x - w / 2, y + h / 2),
    // bottom-right
    point(x + w / 2, y + h / 2),
    // up
    point(x, y -  h / 2)
  ])
  return p
}
type StarParams = {
  x: number
  y: number
  outerR: number
  innerR: number
  outerVariation?: number
  innerVariation?: number
  angleVariation?: number
}
export class Star {
  inners: Point[]
  outers: Point[]
  polygon: Polygon
  
  constructor({
    x,
    y,
    outerR,
    innerR,
    outerVariation = 0.2,
    innerVariation = 0.2,
    angleVariation = 0.3,
  }: StarParams) {
    this.inners = []
    this.outers = []
    const points: Point[] = []
    const tips = 5
    const baseStep = (Math.PI * 2) / tips // 72° between tips

    // Start pointing up
    const startAngle = -Math.PI / 2
    const radiusVariation = (1 - outerVariation) + Math.random() * (2 * outerVariation)
    for (let i = 0; i < tips; i++) {
      // Outer point (tip) - randomize within outer range
      const outerAngleOffset = (Math.random() - 0.5) * angleVariation
      const outerAngle = startAngle + i * baseStep + outerAngleOffset
      const outerRadius = outerR * radiusVariation

      let outer = point(
        x + Math.cos(outerAngle) * outerRadius,
        y + Math.sin(outerAngle) * outerRadius
      )
      this.outers.push(outer)
      points.push(outer)

      // Inner point (valley) - randomize within inner range
      const innerAngleOffset = (Math.random() - 0.5) * angleVariation
      const innerAngle = startAngle + i * baseStep + baseStep / 2 + innerAngleOffset
      const innerRadius = innerR * radiusVariation

      let inner = point(
        x + Math.cos(innerAngle) * innerRadius,
        y + Math.sin(innerAngle) * innerRadius
      )
      points.push(inner)
      this.inners.push(inner) // Fixed: was pushing outer instead of inner
    }

    this.polygon = new Polygon()
    this.polygon.addFace(points)
  }
  
  scale(sx: number, sy?: number): Star {
    const newStar = new Star({ x: 0, y: 0, outerR: 1, innerR: 1 }) // dummy params
    
    const actualSy = sy ?? sx
    newStar.polygon = this.polygon.scale(sx, actualSy) as Polygon
    
    const center = this.polygon.box.center
    
    newStar.inners = this.inners.map(p => 
      point(
        center.x + (p.x - center.x) * sx,
        center.y + (p.y - center.y) * actualSy
      )
    )
    
    newStar.outers = this.outers.map(p => 
      point(
        center.x + (p.x - center.x) * sx,
        center.y + (p.y - center.y) * actualSy
      )
    )
    
    return newStar
  }
  
  rotate(angle: number, center?: Point): Star {
    const newStar = new Star({ x: 0, y: 0, outerR: 1, innerR: 1 }) // dummy params
    
    newStar.polygon = this.polygon.rotate(angle, center) as Polygon
    
    const rotationCenter = center ?? this.polygon.box.center
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    
    const rotatePoint = (p: Point) => {
      const dx = p.x - rotationCenter.x
      const dy = p.y - rotationCenter.y
      return point(
        rotationCenter.x + dx * cos - dy * sin,
        rotationCenter.y + dx * sin + dy * cos
      )
    }
    
    newStar.inners = this.inners.map(rotatePoint)
    newStar.outers = this.outers.map(rotatePoint)
    
    return newStar
  }
  
  translate(vector: Vector): Star {
  const newStar = new Star({ x: 0, y: 0, outerR: 1, innerR: 1 }) // dummy params
  
  newStar.polygon = this.polygon.translate(vector) as Polygon
  
  newStar.inners = this.inners.map(p => point(p.x + vector.x, p.y + vector.y))
  newStar.outers = this.outers.map(p => point(p.x + vector.x, p.y + vector.y))
  
  return newStar
}
  
  // Delegate common polygon methods if needed
  get box() {
    return this.polygon.box
  }
  
  get vertices() {
    return this.polygon.vertices
  }
  
  svg(attrs?: any) {
    return this.polygon.svg(attrs)
  }
}
export function pointsToSegments(points: Point[]): Segment[] {
  const segments: Segment[] = []
  
  for (let i = 0; i < points.length - 1; i++) {
    segments.push(segment(points[i], points[i + 1]))
  }
  
  return segments
}

export function star5(params: StarParams) {
  return new Star(params)
}
// type Orientation = "N"
export const createCircle = ({x,y,r}, orientation: string = "x")=>{
  let middleX =x;
  let middleY = y;
  if (orientation.toLowerCase().includes("n")){
    middleY += r
  }
  if (orientation.toLowerCase().includes("s")){
    middleY -= r
  }
  if (orientation.toLowerCase().includes("o")){
    middleX += r
  }  
  if (orientation.toLowerCase().includes("e")){
    middleX -= r
  }
  return new Circle(new Point(middleX,middleY), r)
}
export const createRect = ({x,y,w,h}, orientation: string="NO")=>{
  let middleX =x;
  let middleY = y;
  if (orientation.toLowerCase().includes("n")){
    middleY += h/2
  }
  if (orientation.toLowerCase().includes("s")){
    middleY -= h/2
  }
  if (orientation.toLowerCase().includes("o")){
    middleX += w/2
  }  
  if (orientation.toLowerCase().includes("e")){
    middleX -= w/2
  }
  return createRectCentroid({x:middleX,y:middleY,w,h})
}
export const createSegmentPoints = ({x0,y0,xf,yf})=>{
  let s = new Segment(new Point(x0, y0), new Point(xf, yf))
  return s
}
export const createRectCentroid = ({x,y,w,h})=>{
  let p = new Polygon()
  p.addFace([
    // top-left
    point(x - w / 2, y + h / 2),
    // top-right
    point(x + w / 2, y + h / 2),
    // bottom right
    point(x + w / 2, y - h / 2),
    // bottom left
    point(x - w / 2, y - h / 2),
    
  ])
  return p
}
export const createRectTopLeft = ({x,y,w,h})=>{
  let p = new Polygon()
  p.addFace([
    // top-left
    point(x, y),
    // top-right
    point(x + w, y),
    // bottom right
    point(x + w, y + h ),
    // bottom left
    point(x, y + h),
    point(x, y)
  ])
  return p
}
export const getCoordsPoint = (p: Point)=>{
  return [p.x, p.y]
}
export const center = (square:{w:number,h:number}, total:{w:number,h:number})=>{
  return {
    x: (total.w-square.w)/2+square.w/2,
    y: (total.h-square.h)/2+square.h/2
  }
}
export const holdRatio = (
  {w,h}:{w: number,
  h: number},
  ratio: string
): { w: number; h: number } => {
  const [rw, rh] = ratio.split(":").map(Number);

  if (!rw || !rh || rw <= 0 || rh <= 0) {
    throw new Error("Invalid ratio format. Use something like '16:9'.");
  }

  const targetRatio = rw / rh;
  const maxRatio = w / h;

  let w_2: number;
  let h_2: number;

  if (maxRatio > targetRatio) {
    // height is the limiting factor
    h_2 = h;
    w_2 = h * targetRatio;
  } else {
    // width is the limiting factor
    w_2 = w;
    h_2 = w / targetRatio;
  }

  return {
    w: w_2,
    h: h_2,
  };
};
export const poligonizeCircle = (c:Circle)=>{
// TODO get coords -> polygon
let p = new Polygon()
p.addFace(getCoordsCircle(c).map(p=>point(p[0], p[1])))
return p
}
export function getCoordsCircle(c: Circle, n?:number) {
  let {pc, r} = c
  if (!n){
    n = Math.round(Math.PI*Math.sqrt(r/(2*0.1)))
  }
  let points: [number,number][] = [];
  for (let i = 0; i < n; i++) {
    const angle = (2*Math.PI / n) * i;
    const x = pc.x + r * Math.cos(angle);
    const y = pc.y + r * Math.sin(angle);
    points.push([x, y]);
  }
  return points;
}
export const getCoordsPolygon = (p: Polygon)=>{
  return [...p.edges].map(e=>[getCoordsPoint(e.shape.ps),getCoordsPoint(e.shape.pe)])
}
export const getCoords = (p: Polygon|Circle)=>{
  if ((p as any).r){
    return [getCoordsCircle(p as Circle)]
  } 
  return getCoordsPolygon(p as Polygon)
}
export const getPolygonFromCoords = (faces)=>{
  let p = new Polygon()
  faces.forEach(coords=>{
    p.addFace(coords.map(c=>point(c)))
  })
  return p
}
export const diff = (p1: Polygon, p2: Polygon)=>{
  // let polygon1 = new Polygon();
  // polygon1.addFace([point(0,0), point(0, 50), point(50, 50), point(50, 0)]);

  // let polygon2 = new Polygon();
  // polygon2.addFace([point(25, 25), point(25, 75), point(75,75), point(75,25)]);
  // let polygon_res = diff(polygon1, polygon2)
  let result = martinez.diff(getCoords(p1) as any, getCoords(p2) as any)
  // return new Polygon(result)
  if (result&&result.length>0){
    let a = result.map(p=>getPolygonFromCoords(p))
    if (a.length>=1 ) return a[0]
  }
  return null
}
export function scalePolygonAroundPoint(polygon, center, scaleFactor) {
  // Create transformation matrix
  const matrix = new Matrix();
  
  // 1. Translate so center is at origin
  matrix.translate(-center.x, -center.y);
  
  // 2. Scale
  matrix.scale(scaleFactor, scaleFactor);
  
  // 3. Translate back
  matrix.translate(center.x, center.y);
  
  // Apply transformation
  return polygon.transform(matrix);
}

export const unify = (p1: Polygon, p2: Polygon)=>{
  // let polygon1 = new Polygon();
  // polygon1.addFace([point(0,0), point(0, 50), point(50, 50), point(50, 0)]);

  // let polygon2 = new Polygon();
  // polygon2.addFace([point(25, 25), point(25, 75), point(75,75), point(75,25)]);
  // let polygon_res = diff(polygon1, polygon2)
  let result = martinez.union(getCoords(p1) as any, getCoords(p2) as any)
  // return new Polygon(result)
  if (result&&result.length>0){
    let a = result.map(p=>getPolygonFromCoords(p))
    if (a.length>=1 ) return a[0]
  }
  return null
}
    
export const createSegment = (center, length, angle)=>{
  let segment = new Segment(
    point(center.x-length/2, center.y),
    point(center.x+length/2, center.y)
  )
  return segment.rotate(angle, center)
}
// Utility: sample uniformly in a triangle (using barycentric coordinates)
export const gridify = (p: Polygon, nRows: number, nCols: number, flatten: boolean = true) => {
  let {xmin: x, ymin: y, width, height} = p.box;
  
  const dx = width / nCols;
  const dy = height / nRows;
  
  const grid: Array<Array<[number,number]>> = [];
  
  for (let row = 0; row < nRows; row++) {
    const rowPoints: Array<[number,number]> = [];
    for (let col = 0; col < nCols; col++) {
      rowPoints.push([
        x + col * dx + dx / 2,
        y + row * dy + dy / 2
      ]);
    }
    grid.push(rowPoints);
  }
  
  return flatten ? grid.flat() as [number,number][] : grid as Array<Array<[number,number]>>;
};
function randomPointInTriangle(a, b, c) {
  const r1 = Math.random();
  const r2 = Math.random();
  const sqrtR1 = Math.sqrt(r1);

  const u = 1 - sqrtR1;
  const v = sqrtR1 * (1 - r2);
  const w = sqrtR1 * r2;

  const x = u * a.x + v * b.x + w * c.x;
  const y = u * a.y + v * b.y + w * c.y;

  return point(x, y);
}

// Utility: compute triangle area (absolute value)
export function triangleArea(a, b, c) {
  return Math.abs((a.x * (b.y - c.y) +
                   b.x * (c.y - a.y) +
                   c.x * (a.y - b.y)) / 2);
}

// treeshape is a Flatten.Polygon

// Shorter version
export function getRandomPointOnBox(box) {
    const edge = Math.floor(Math.random() * 4);
    const t = Math.random();
    
    switch(edge) {
        case 0: return point(box.xmin + t * (box.xmax - box.xmin), box.ymin); // top
        case 1: return point(box.xmax, box.ymin + t * (box.ymax - box.ymin)); // right
        case 2: return point(box.xmin + t * (box.xmax - box.xmin), box.ymax); // bottom
        case 3: return point(box.xmin, box.ymin + t * (box.ymax - box.ymin)); // left
    }
}


// Get random point on a random edge of the polygon
export function getRandomPointOnPolygonEdge(polygon) {
    const randomEdge = [...polygon.edges][Math.floor(Math.random() * [...polygon.edges].length)];
    const t = Math.random();
    return randomEdge.pointAtLength(t * randomEdge.length);
}

// Main: random point inside polygon
export function randomPointInPolygon(polygon) {
  const { xmin, ymin, xmax, ymax } = polygon.box;

  while (true) {
    const x = xmin + Math.random() * (xmax - xmin);
    const y = ymin + Math.random() * (ymax - ymin);

    const pt = new Point(x, y);

    if (polygon.contains(pt)) {
      return pt;
    }
  }
}


// -------------------
// Example usage:
// -------------------

// const { Point, Segment, Polygon } = Flatten;

// // Define a polygon (can be convex or concave)
// const pts = [new Point(0,0), new Point(4,0), new Point(4,3), new Point(2,4), new Point(0,3)];
// const segments = pts.map((p, i) => new Segment(p, pts[(i + 1) % pts.length]));
// const poly = new Polygon();
// poly.addFace(segments);

// // Generate random points inside it
// for (let i = 0; i < 5; i++) {
//   const p = randomPointInPolygon(poly);
//   console.log(`Random point: (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`);
// }
