import p5 from 'p5';
import { Board } from '../components/Board';
import { drawFlatten } from '../utils';
import {point, circle, segment, line} from '@flatten-js/core';
import * as Matter from 'matter-js'
let board: Board|null = null
let engine: Engine ;
let boxes = []
class Box{
  body: Matter.Body
  w:number
  h:number
  x:number
  y:number
  constructor (
    {x,y,w,h}: {x:number, y:number, w:number, h:number},
    {world, p5}:{world: Matter.World, p5: p5}
  ){
    var options = {
      friction: 0.5,
      restitution: 0.8,
      angle: p5.PI
    }
    this.body = Matter.Bodies.rectangle(x, y, w, h, options);
    this.w = w;
    this.h = h;
    this.x = x

    Matter.World.add(world, this.body);
  }
  show(){
    var pos = this.body.position;
    var angle = this.body.angle;

    push();
    stroke(200);
    strokeWeight(2);
    fill(255, 255, 255, 100);
    translate(pos.x, pos.y);
    rotate(angle);
    rectMode(CENTER);
    rect(0, 0, this.w, this.h);
    pop();
  }
  }
}
export function setup(p5Instance: p5){
  engine = Engine.create()
  let world = engine.world;
  Engine.run(engine);
  p5Instance.mouseDragged = (e)=>{
    console.log()
    boxes.push(new Box(e.mouseX, mouseY, 10, 10));

  }
}
export function draw (p5Instance:p5){
  
    if (!board) board = new Board(p5Instance,{width:500, height:300, margin: 5, 
      colorBoard: {
        sizeX:30,
        sizeY:40,
        marginX:10,
        marginY:20,
        paddingX: 4,
        paddingY: 2, 
        colors: [["red", "blue"], ["green", "yellow"]] 
      }
    })
    board.draw()
    
    let a = board.addLayer("squares").beginLayer()
    if (a.visible){
      let s = segment(0,0, 100, 100)
      drawFlatten(p5Instance, s)
      // p5Instance.rectMode(p5Instance.CORNER)
      // p5Instance.square(100, 250, 50)
      // p5Instance.rectMode(p5Instance.CENTER)
      // p5Instance.square(100, 250, 50)
      // p5Instance.rectMode(p5Instance.CORNERS)
      // p5Instance.square(100, 250, 50)
      // p5Instance.rectMode(p5Instance.RADIUS)
      // p5Instance.square(100, 250, 50)
      // p5Instance.rectMode(p5Instance.CENTER)
      // p5Instance.rect(75, 350, 100, 50)
      // p5Instance.rectMode(p5Instance.CORNER)
      // p5Instance.rect(75, 350, 100, 50)
    }
    a.closeLayer();

    // Tests of circles and ellipses with various ellipseModes
    const b = board.addLayer("circles").beginLayer()
    if (b.visible){
      p5Instance.ellipseMode(p5Instance.CENTER)
      p5Instance.circle(200, 250, 50)
      p5Instance.ellipseMode(p5Instance.CORNER)
      p5Instance.circle(200, 250, 50)
      p5Instance.ellipseMode(p5Instance.RADIUS)
      p5Instance.circle(200, 250, 50)
      p5Instance.ellipseMode(p5Instance.CORNERS)
      p5Instance.circle(50, 100, 200)
      p5Instance.ellipseMode(p5Instance.CORNER)
      p5Instance.ellipse(175, 350, 100, 50)
      p5Instance.ellipseMode(p5Instance.CENTER)
      p5Instance.ellipse(175, 350, 100, 50)
    }
    b.closeLayer()
  }

