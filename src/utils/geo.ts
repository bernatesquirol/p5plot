import { Circle, Point, Polygon, Segment, point } from "@flatten-js/core";
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

    
export const createSegment = (center, length, angle)=>{
  let segment = new Segment(
    point(center.x-length/2, center.y),
    point(center.x+length/2, center.y)
  )
  return segment.rotate(angle, center)
}
// Utility: sample uniformly in a triangle (using barycentric coordinates)
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
