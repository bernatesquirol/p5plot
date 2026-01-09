import {Point, Segment, Line, Circle, Arc, Box, Polygon, Multiline} from "@flatten-js/core";
import p5 from "p5";
export type WithAttrs<T> = T&{attrs?:{stroke?:p5.Color, fill?: p5.Color}}
export type FlattenObject =
    | Point
    | Segment
    | Line
    | Circle
    | Arc
    | Box
    | Polygon
    | Multiline;
export type FlattenObjectWithAttrs = WithAttrs<FlattenObject>
export function drawFlatten(p5Instance:p5, objs:FlattenObjectWithAttrs|FlattenObjectWithAttrs[]) {
//   p5Instance.noFill();
  if (!Array.isArray(objs)){
    objs = [objs]
  }
  for (let obj of objs){
    if (obj.attrs){
      p5Instance.push()
      if (obj.attrs.fill){
        p5Instance.fill(obj.attrs.fill)
        p5Instance.stroke(255,255,255,0)
      }
      if (obj.attrs.stroke){
        p5Instance.stroke(obj.attrs.stroke)
      }
    }
    if (obj instanceof Point) {
      p5Instance.circle(obj.x, obj.y, 4);
      
    } else if (obj instanceof Segment) {
      p5Instance.line(obj.start.x, obj.start.y, obj.end.x, obj.end.y);
      
    } else if (obj instanceof Circle) {
      p5Instance.circle(obj.pc.x, obj.pc.y, obj.r * 2);
      
    } else if (obj instanceof Arc) {
      p5Instance.arc(obj.center.x, obj.center.y, obj.r * 2, obj.r * 2, obj.startAngle, obj.endAngle);
      
    } else if (obj instanceof Polygon) {
      p5Instance.beginShape();
      for (let edge of obj.edges) {
        p5Instance.vertex(edge.start.x, edge.start.y);
      }
      p5Instance.endShape(p5Instance.CLOSE);
      
    } else if (obj instanceof Box) {
      p5Instance.rect(obj.xmin, obj.ymin, obj.xmax - obj.xmin, obj.ymax - obj.ymin);
    }else if (obj instanceof Line) {
      const pt = obj.pt;        // Point
      const n = obj.norm;       // Vector
      
      // Direction vector along the line = rotate normal 90 degrees
      const dir = n.rotate(Math.PI / 2);
      const L = 1000; 
      // Compute endpoints for a long segment
      const x1 = pt.x - dir.x * L;
      const y1 = pt.y - dir.y * L;
      const x2 = pt.x + dir.x * L;
      const y2 = pt.y + dir.y * L;
      
      p5Instance.line(x1, y1, x2, y2);
    }else if (obj instanceof Multiline) {
      for (let edge of obj.edges) {
        p5Instance.line(edge.start.x, edge.start.y, edge.end.x, edge.end.y);
      }
    }
    if (obj.attrs){
      p5Instance.pop()
    }
  }
}