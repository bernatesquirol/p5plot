
import { Point } from '@flatten-js/core';
import *  as Matter from 'matter-js'
export function edgeToBoundary(v1:Point, v2:Point, thickness = 10) {
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