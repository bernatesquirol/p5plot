import Flatten from "@flatten-js/core";

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

  return new Flatten.Point(x, y);
}

// Utility: compute triangle area (absolute value)
function triangleArea(a, b, c) {
  return Math.abs((a.x * (b.y - c.y) +
                   b.x * (c.y - a.y) +
                   c.x * (a.y - b.y)) / 2);
}

// Main: random point inside polygon
function randomPointInPolygon(polygon) {
  // Flatten.js triangulate
  const triangles = polygon.triangulate();

  // Collect all triangles as triplets of points
  const tris = triangles.map(tri => {
    const pts = tri.points;
    return [pts[0], pts[1], pts[2]];
  });

  // Compute areas
  const areas = tris.map(([a,b,c]) => triangleArea(a,b,c));
  const totalArea = areas.reduce((s,a) => s + a, 0);

  // Choose triangle weighted by area
  let r = Math.random() * totalArea;
  let chosen = tris[0];
  for (let i = 0; i < tris.length; i++) {
    if (r < areas[i]) {
      chosen = tris[i];
      break;
    }
    r -= areas[i];
  }

  // Sample a point in the chosen triangle
  const [a,b,c] = chosen;
  return randomPointInTriangle(a,b,c);
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
