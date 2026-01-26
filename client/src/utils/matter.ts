
import { Edge, Point, Polygon } from '@flatten-js/core';
import *  as Matter from 'matter-js'
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