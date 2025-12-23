import p5 from 'p5';
import { Board } from '../../components/Board';
import { drawFlatten, edgeToBoundary, equilateralTriangleCentroidDown, randomBetween } from '../../utils';
import { Edge, Point, Polygon, } from '@flatten-js/core';
import * as Matter from 'matter-js'
import { Box } from './Box';
import _ from 'lodash'
let board: Board|null = null
let engine: Matter.Engine ;
let boxes:any[] = []
let treeShape: Polygon;
export function setup(p5: p5){
  engine = Matter.Engine.create()
  var runner =  Matter.Runner.create();
  Matter.Runner.run(runner, engine);
  let world = engine.world;
  world.gravity.y = 0
  // let ground = Matter.Bodies.rectangle(200, p5.height, p5.width, 10, {
  //   isStatic: true
  // });
  // Matter.World.add(world, ground);
  boxes = [new Box({x:50, y:50, anglePattern: Math.random()*Math.PI, w:50, h:50}, {world, p5:p5})]
  treeShape = equilateralTriangleCentroidDown({y:p5.height/2, x:p5.width/2, w:200, h:400})
  treeShape.edges.forEach((e:Edge)=>{
    let w = edgeToBoundary(e.start, e.end)
    Matter.World.add(world, w);
  })
  Matter.Events.on(engine, 'collisionActive', event => {
  event.pairs.forEach(pair => {
    const { bodyA, bodyB } = pair;

    if (bodyA.isStatic || bodyB.isStatic) return;

    const normal = pair.collision.normal;
    const strength = 1.25;

    const force = Matter.Vector.mult(normal, strength);

    Matter.Body.applyForce(bodyA, bodyA.position, force);
    Matter.Body.applyForce(bodyB, bodyB.position, Matter.Vector.neg(force));
  });
});
  p5.mouseDragged = _.throttle((e:any)=>{
    if (treeShape.contains(new Point(p5.mouseX,p5.mouseY))){
      boxes = [...boxes, new Box({x:p5.mouseX, y:p5.mouseY, anglePattern: randomBetween(0,180), w:randomBetween(7,15), h:randomBetween(7,15)}, {world, p5:p5})].slice(-150)
    }
  },32,
  {
    leading: true,
    trailing: true
  })
}
export function draw (p5:p5){
    if (!board) board = new Board(p5,{
      width:500, 
      height:300, 
      margin: 5, 
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
    let treeLayer = board.addLayer("tree").beginLayer()
    if (treeLayer.visible){
      drawFlatten(p5, [treeShape])
      // p5.rectMode(p5.CORNER)
      // p5.square(100, 250, 50)
      // p5.rectMode(p5.CENTER)
      // p5.square(100, 250, 50)
      // p5.rectMode(p5.CORNERS)
      // p5.square(100, 250, 50)
      // p5.rectMode(p5.RADIUS)
      // p5.square(100, 250, 50)
      // p5.rectMode(p5.CENTER)
      // p5.rect(75, 350, 100, 50)
      // p5.rectMode(p5.CORNER)
      // p5.rect(75, 350, 100, 50)
    }
    treeLayer.closeLayer();
    let boxesLayer= board.addLayer("boxes").beginLayer()
    if (boxesLayer.visible){
      for (var i = 0; i < boxes.length; i++)
      {
          boxes[i].show();
      }
      // p5.rectMode(p5.CORNER)
      // p5.square(100, 250, 50)
      // p5.rectMode(p5.CENTER)
      // p5.square(100, 250, 50)
      // p5.rectMode(p5.CORNERS)
      // p5.square(100, 250, 50)
      // p5.rectMode(p5.RADIUS)
      // p5.square(100, 250, 50)
      // p5.rectMode(p5.CENTER)
      // p5.rect(75, 350, 100, 50)
      // p5.rectMode(p5.CORNER)
      // p5.rect(75, 350, 100, 50)
    }
    boxesLayer.closeLayer();

    // Tests of circles and ellipses with various ellipseModes
   
  }

