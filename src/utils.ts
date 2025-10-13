import Flatten from "@flatten-js/core";
import p5 from "p5";
type FlattenObject =
    | Flatten.Point
    | Flatten.Segment
    | Flatten.Line
    | Flatten.Circle
    | Flatten.Arc
    | Flatten.Box
    | Flatten.Polygon
    | Flatten.Multiline;

export function drawFlatten(p5Instance:p5, obj:FlattenObject) {
//   p5Instance.noFill();

  if (obj instanceof Flatten.Point) {
    p5Instance.point(obj.x, obj.y);

  } else if (obj instanceof Flatten.Segment) {
    p5Instance.line(obj.ps.x, obj.ps.y, obj.pe.x, obj.pe.y);

  } else if (obj instanceof Flatten.Circle) {
    p5Instance.circle(obj.pc.x, obj.pc.y, obj.r * 2);

  } else if (obj instanceof Flatten.Arc) {
    p5Instance.arc(obj.center.x, obj.center.y, obj.r * 2, obj.r * 2, obj.startAngle, obj.endAngle);

  } else if (obj instanceof Flatten.Polygon) {
    p5Instance.beginShape();
    for (let edge of obj.edges) {
      p5Instance.vertex(edge.start.x, edge.start.y);
    }
    p5Instance.endShape(p5Instance.CLOSE);

  } else if (obj instanceof Flatten.Box) {
    p5Instance.rect(obj.xmin, obj.ymin, obj.xmax - obj.xmin, obj.ymax - obj.ymin);
  }else if (obj instanceof Flatten.Line) {
    const pt = obj.pt;        // Flatten.Point
    const n = obj.norm;       // Flatten.Vector

    // Direction vector along the line = rotate normal 90 degrees
    const dir = n.rotate(Math.PI / 2);
    const L = 1000; 
    // Compute endpoints for a long segment
    const x1 = pt.x - dir.x * L;
    const y1 = pt.y - dir.y * L;
    const x2 = pt.x + dir.x * L;
    const y2 = pt.y + dir.y * L;

    p5Instance.line(x1, y1, x2, y2);
  }else if (obj instanceof Flatten.Multiline) {
    for (let edge of obj.edges) {
        p5Instance.line(edge.start.x, edge.start.y, edge.end.x, edge.end.y);
    }
  }
}