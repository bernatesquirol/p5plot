import p5 from 'p5';
import * as Matter from 'matter-js'
export class Box {
  body: Matter.Body
  p5: p5
  w:number
  h:number
  x:number
  y:number
  constructor (
    {x,y,w,h, bodyBuffer=1.5, anglePattern}: {x:number, y:number, w:number, h:number, bodyBuffer?:number,anglePattern?:number},
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
    // draw pattern
    p5.translate(pos.x, pos.y);
    p5.rotate(angle);
    p5.rectMode(p5.CENTER);
    p5.rect(0, 0, this.w, this.h);
    p5.pop();
  }
  
}