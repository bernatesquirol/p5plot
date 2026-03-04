import p5 from 'p5';
import * as Matter from 'matter-js'
import { Circle, Point, Polygon, Segment, Vector } from '@flatten-js/core';
import { createCircle, createRect, createSegment, drawFlatten, InvisibleColor } from '../../utils';
// import { InvisibleColor } from '@/utils/p5';
export enum BoxType {
  rect, circle
}
export class Box {
  body: Matter.Body
  p5: p5
  r?:number
  w?:number
  h?:number
  x:number
  y:number
  bodyPolygon: Polygon|Circle
  anglePattern:number
  type: BoxType
  world: Matter.World
  stroke: p5.Color
  fill?: p5.Color
  textureWidth:number
  constructor (
    {x,y,w,r,h, bodyBuffer=1.25, anglePattern=0, type, stroke,fill, isStatic,textureWidth}: {
      isStatic?:boolean,
      stroke: p5.Color,fill?: p5.Color,x:number, y:number, w?:number, h?:number,r?:number, bodyBuffer?:number,anglePattern?:number, type: BoxType, textureWidth?:number},
    {world, p5}:{world: Matter.World, p5: p5}
  ){
    this.textureWidth = textureWidth||3
    this.stroke = stroke
    this.fill = fill
    this.type = type
    
    var options = {
      friction:0,
      restitution: 0,
      angle: p5.PI,
      isStatic: isStatic??false
    }
    // debugger
    this.world = world
    if (type == BoxType.rect){
      let [wRect,hRect] = [w!*bodyBuffer, h!*bodyBuffer]
      this.bodyPolygon = createRect({x,y,w:wRect,h:hRect})
      this.body = Matter.Bodies.rectangle(x, y, wRect,hRect, options);
    }else{
      let rCircle = r!*bodyBuffer
      this.bodyPolygon = createCircle({x,y,r:rCircle})
      this.body = Matter.Bodies.circle(x, y, rCircle, options);
    }
    
    this.w = w;
    this.h = h;
    this.x = x
    this.r = r;
    this.anglePattern = anglePattern!
    this.y = y
    this.p5 = p5
    Matter.World.add(world, this.body);
  }
  delete(){
    Matter.World.remove(this.world, this.body)
  }
  show(){
    let p5= this.p5  
    var pos = this.body.position;
    var angle = this.body.angle;

    p5.push();
    p5.stroke(this.stroke);
    p5.strokeWeight(2);
    if (this.fill){
      p5.fill(this.fill)
    }else{
      p5.fill(255,255,255,100);
    }
    let p: Circle|Polygon;
    if (this.type === BoxType.rect){
      const hw = this.w! / 2;
      const hh = this.h! / 2;
  
     const localCorners = [
        new Point(-hw, -hh),
        new Point( hw, -hh),
        new Point( hw,  hh),
        new Point(-hw,  hh)
      ];
      p = new Polygon()
      p.addFace(localCorners)
      p = p.rotate(angle)
      p = p.translate(new Vector(pos.x, pos.y))
    }else{
      p = new Circle(new Point(pos.x, pos.y), this.r!)
    }
    this.bodyPolygon = this.bodyPolygon.translate(new Vector(pos.x-this.bodyPolygon.box.center.x, pos.y-this.bodyPolygon.box.center.y))
    let {xmin, xmax, ymin, ymax} = p!.box
    const width  = xmax - xmin;
    const height = ymax - ymin;
    const diagonal = Math.hypot(width, height);
    let segment = createSegment(p.box.center, diagonal, this.anglePattern)
    // const _splitSegmentQ = (segment:Segment, nPoints:number)=>{
    //   return (new Array(nPoints)).fill(1).map((_p, i)=>{
    //     return segment.pointAtLength(i*segment.length/nPoints)
    //   })
    // }
    const splitSegment = (segment:Segment, lengthSize:number)=>{
      let i = 0
      let allPoints: Point[] = []
      while (i<=segment.length){
        allPoints.push(segment.pointAtLength(i)!)
        i += lengthSize 
      }
      return allPoints 
    }
    const texture = (p: Polygon|Circle,lengthSize:number)=>{
      let points = splitSegment(segment, lengthSize)
          let lines = points.map(p2=>{
            let s = createSegment(p2, diagonal, this.anglePattern+ Math.PI / 2)
            return s
          })
          let linesSegmented  = lines.map<Segment>((l:any)=>{
            const [start, end] = p.intersect(l);
            if (start && end){
              let f = new Segment(start,end)
              return f
            }
            return null!
          }).filter(d=>d)
      return linesSegmented
    }
    
    // p.face
    // draw pattern
    // p5.translate(pos.x, pos.y);
    // p5.rotate(angle);
    p5.rectMode(p5.CENTER);
    // p5.rect(0, 0, this.w, this.h);
    drawFlatten(p5, [  ...texture(p!, this.textureWidth)])
    // drawFlatten(p5, [this.bodyPolygon], {fill:p5.color(InvisibleColor), stroke: p5.color("black")})
    p5.pop();
  }
  
}