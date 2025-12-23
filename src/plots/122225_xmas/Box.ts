import p5 from 'p5';
import * as Matter from 'matter-js'
import { Point, Polygon, Segment, Vector } from '@flatten-js/core';
import { createSegment, drawFlatten } from '../../utils';
export class Box {
  body: Matter.Body
  p5: p5
  w:number
  h:number
  x:number
  y:number
  anglePattern:number
  constructor (
    {x,y,w,h, bodyBuffer=1.5, anglePattern=0}: {x:number, y:number, w:number, h:number, bodyBuffer?:number,anglePattern?:number},
    {world, p5}:{world: Matter.World, p5: p5}
  ){
    var options = {
      friction: 0.3,
      restitution: 0.8,
      angle: p5.PI
    }
    this.body = Matter.Bodies.rectangle(x, y, w*bodyBuffer, h*bodyBuffer, options);
    this.w = w;
    this.h = h;
    this.x = x
    this.anglePattern = anglePattern!
    this.y = y
    this.p5 = p5
    Matter.World.add(world, this.body);
  }
  show(){
    let p5= this.p5  
    var pos = this.body.position;
    var angle = this.body.angle;

    p5.push();
    p5.stroke(200);
    p5.strokeWeight(2);
    p5.fill(255, 255, 255, 100);
    const hw = this.w / 2;
    const hh = this.h / 2;

   const localCorners = [
      new Point(-hw, -hh),
      new Point( hw, -hh),
      new Point( hw,  hh),
      new Point(-hw,  hh)
    ];
    
    let p = new Polygon()
    let face = p.addFace(localCorners)
    face.length
    p = p.rotate(angle)
    p = p.translate(new Vector(pos.x, pos.y))
    let {xmin, xmax, ymin, ymax} = p.box
    const width  = xmax - xmin;
    const height = ymax - ymin;
    const diagonal = Math.hypot(width, height);
    let segment = createSegment(p.box.center, diagonal, this.anglePattern)
    const splitSegmentQ = (segment:Segment, nPoints:number)=>{
      return (new Array(nPoints)).fill(1).map((p, i)=>{
        return segment.pointAtLength(i*segment.length/nPoints)
      })
    }
    const splitSegment = (segment:Segment, lengthSize:number)=>{
      let i = 0
      let allPoints: Point[] = []
      while (i<=segment.length){
        allPoints.push(segment.pointAtLength(i)!)
        i += lengthSize 
      }
      return allPoints 
    }
    let points = splitSegment(segment, 5)
    let lines = points.map(p2=>{
      let s = createSegment(p2, diagonal, this.anglePattern+ Math.PI / 2)
      let final = s.intersect(p2)
      return final
    })
    // p.face
    // draw pattern
    // p5.translate(pos.x, pos.y);
    // p5.rotate(angle);
    p5.rectMode(p5.CENTER);
    // p5.rect(0, 0, this.w, this.h);
    drawFlatten(p5, [p, ...lines])
    p5.pop();
  }
  
}