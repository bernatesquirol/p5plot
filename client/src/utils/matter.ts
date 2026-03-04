
import { Circle, Edge, Point, Polygon } from '@flatten-js/core';
import *  as Matter from 'matter-js'
export const bindHollowCircle = (
  world: Matter.World, 
  circleBelow: Circle,
  segments = 32, 
  thickness = 10
) => {
  let bodies: Matter.Body[] = [];
  const angleStep = (Math.PI * 2) / segments;
  let center = circleBelow.pc
  let radius = circleBelow.r
  for (let i = 0; i < segments; i++) {
    // Calculate start and end points of the segment
    const angle1 = i * angleStep;
    const angle2 = (i + 1) * angleStep;

    const start = new Point(
      center.x + radius * Math.cos(angle1),
      center.y + radius * Math.sin(angle1)
    );
    const end = new Point(
     center.x + radius * Math.cos(angle2),
      center.y + radius * Math.sin(angle2)
    );

    // Reuse your existing edgeToBoundary logic
    let wall = edgeToBoundary(start, end, thickness);
    
    Matter.World.add(world, wall);
    bodies.push(wall);
  }

  return bodies;
};
export const bindHollowBody = (world: Matter.World, polygon:Polygon, thickness = 10)=>{
    let b: Matter.Body[] = []
    polygon.edges.forEach((e:Edge)=>{
      let w = edgeToBoundary(e.start, e.end, thickness)
      Matter.World.add(world, w);
      b.push(w)
    })
    return b
  }
  export const forceTowardsPoint = (box: Matter.Body, targetPoint: Flatten.Point, forceMagnitude=0.001)=>{
    // Calculate direction vector from box to target point
const dx = targetPoint.x - box.position.x;
const dy = targetPoint.y - box.position.y;

// Calculate distance
const distance = Math.sqrt(dx * dx + dy * dy);

// Normalize and scale by force magnitude

const forceX = (dx / distance) * forceMagnitude;
const forceY = (dy / distance) * forceMagnitude;

// Apply force to the box
Matter.Body.applyForce(box, box.position, { x: forceX, y: forceY });
  }
export function edgeToBoundary(v1:Point, v2:Point, thickness: number) {
  const length = Matter.Vector.magnitude(
    Matter.Vector.sub(v2, v1)
  );

  const angle = Math.atan2(v2.y - v1.y, v2.x - v1.x);

  const center = {
    x: (v1.x + v2.x) / 2,
    y: (v1.y + v2.y) / 2
  };

  const boundary = Matter.Bodies.rectangle(
    center.x,
    center.y,
    length,
    thickness,
    {
      isStatic: true
    }
  );

  Matter.Body.setAngle(boundary, angle);
  return boundary;
}