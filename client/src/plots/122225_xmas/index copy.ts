import p5 from 'p5';
import { Board } from '../../components/Board';
import { bindHollowBody, createCircle, createRect, diff, drawFlatten, equilateralTriangleCentroidDown, poligonizeCircle, randomBetween, WithAttrs } from '../../utils';
import { Point, Polygon, vector, } from '@flatten-js/core';

import * as Matter from 'matter-js'
import { Box, BoxType } from './Box';
import _ from 'lodash'
import {SinglePlot as ParentPlot } from '../../components/Plot'
export class XmasPlot extends ParentPlot {
  x:number
  y:number
  // board: Board
  engine: Matter.Engine;
  engineSky: Matter.Engine;
  boxes: Box[] = []
  boxesToPlot: Box[] = []
  treeShape: Polygon;
  skyShapeWhole: WithAttrs<Polygon>;
  sphereShape: WithAttrs<Polygon>;
  groundShapeWhole: WithAttrs<Polygon>;
  p5: p5
  heightTriangle:number
  constructor(p5: p5, { centerTree,angleTree,x,y,height, width, saveSVG }: {centerTree?:{x:number,y:number}, angleTree?:number, x?:number,y?:number, height:number, width:number, saveSVG: ()=>void}) {
    super({p5})
    this.p5 = p5
    
    this.x = x||0
    this.y = y||0
    // this.board = new Board(p5, {
    //   width, height,x,y,
    //   margin: 5,
    // })
    this.guiButton("saveSVG", saveSVG, true)
    const t = vector(this.x,this.y)
    this.engine = Matter.Engine.create()
    this.engineSky = Matter.Engine.create()
    let world = this.engine.world;
    this.engine.gravity.y = -this.guiParam("gravityTree", 0.1,)
    let worldSky = this.engineSky.world;
    this.engineSky.gravity.y = this.guiParam("gravitySky", 0.1,)
    this.heightTriangle = height*0.1

    let widthTriangle = width*0.6
    let boundsShape = createRect({ y: 0, x: 0, w: width, h: height }, "NO")
    bindHollowBody(world, boundsShape)
    if (!centerTree){
      centerTree =  {y:height / 2,  x:width / 2}
    }
    let rotationCenter =  new Point(Object.values(centerTree) as any)
    this.treeShape = equilateralTriangleCentroidDown({ ...centerTree, w: widthTriangle, h: this.heightTriangle }).rotate(angleTree||0,rotationCenter).translate(t)
    // shapesToRender.push(this.treeShape)
    bindHollowBody(world, this.treeShape)
    this.skyShapeWhole = createRect({ y: height / 2, x: width / 2, w: this.heightTriangle * 1.5, h: this.heightTriangle * 0.75 }, "S").translate(t)
    this.skyShapeWhole.attrs = { fill: p5.color("#373434") }
    // skyShape = diff(this.skyShapeWhole, this.treeShape)!
    this.skyShapeWhole = createRect({ y: height / 2, x: width / 2, w: width, h: height / 2 }, "S").translate(t)
    // bindHollowBody(worldSky, skyShape)

    this.groundShapeWhole = createRect({ y: height / 2, x: width / 2, w: this.heightTriangle * 1.5, h: this.heightTriangle / 2 }, "N").translate(t)
    // canvies el color de gui i no canvia el fill
    this.groundShapeWhole = createRect({ y: height / 2, x: width / 2, w: width, h: height / 2 }, "N").translate(t)
    let snowBody = createCircle({ y: height / 2, x: width / 2, r: this.heightTriangle * 0.75 }).translate(t) as any
    // groundShape = diff(snowBodyCircle, this.treeShape)!
    this.sphereShape = diff(poligonizeCircle(snowBody), this.treeShape)!
    bindHollowBody(worldSky, this.sphereShape)

    this.guiButton("randomize", () => {
      // make grid in circle
      // addNewClick()
      // make grid in triangle
      // couple stars
    }, true)
    // p5.touchEnded
    let prevTouchEnded = this.p5.touchEnded
    let newTouchEnded = _.throttle(async (_e: any) => {

      await this.enableMotion()
      let newPoint = new Point(this.p5.mouseX, this.p5.mouseY)
      this.addNewClick(newPoint)

    }, 200, {
      leading: true,
      trailing: false
    })
    
    if (this.p5.touchEnded!=null){
      this.p5.touchEnded = (_e)=>{
        prevTouchEnded(_e);
        newTouchEnded(_e)
      }
    }else this.p5.touchEnded = newTouchEnded
    let prevMouseDragged = this.p5.mouseDragged
    let newMouseDragged = _.throttle((_e: any) => {
      this.enableMotion()
      let newPoint = new Point(this.p5.mouseX, this.p5.mouseY)
      this.addNewDrag(newPoint)
    }, 16,
      {
        leading: true,
        trailing: true
      })

    if (this.p5.mouseDragged!=null){
      this.p5.mouseDragged = (_e)=>{
        prevMouseDragged(_e);
        newMouseDragged(_e)
      }
    }else this.p5.mouseDragged = newMouseDragged
  }
  
  addNewClick = (newPoint: Point) => {
    let inTree = this.treeShape.contains(newPoint)
    let inSphere = this.sphereShape.contains(newPoint)
    // let inGround = groundShape.contains(newPoint)
    // TODO: height and width depending on own height and width
    const maxSize = this.heightTriangle*0.005
    if (inTree) {
      this.boxesToPlot = [...this.boxesToPlot, new Box({
        fill: this.p5.color("white"),
        stroke: this.p5.color("red"),
        x: this.p5.mouseX, y: this.p5.mouseY, type: BoxType.circle, anglePattern: randomBetween(0, 180), r: randomBetween(3, 10)*maxSize/2
      }, { world: this.engine.world, p5: this.p5 })]
    } else if (inSphere) {
      this.boxes = [...this.boxes, new Box({
        fill: undefined,
        stroke: this.p5.color("white"),
        x: this.p5.mouseX, y: this.p5.mouseY, type: BoxType.circle, anglePattern: randomBetween(0, 180), r: randomBetween(3, 10)*maxSize/2
      }, { world: this.engineSky.world, p5: this.p5 })]
    } else {
      if (this.skyShapeWhole.contains(newPoint)) {
        this.boxes = [...this.boxes, new Box({
          isStatic: true,
          fill: undefined,
          stroke: this.p5.color("yellow"),
          x: this.p5.mouseX, y: this.p5.mouseY, type: BoxType.circle, anglePattern: randomBetween(0, 180), r: randomBetween(3, 10)*maxSize
        }, { world: this.engineSky.world, p5: this.p5 })]
      }
    }
  }
  addNewDrag = (newPoint: Point) => {
    let inTree = this.treeShape.contains(newPoint)
    let inSphere = this.sphereShape.contains(newPoint)
    const maxSize = this.heightTriangle*0.005
    if (inTree) {
      this.boxesToPlot = [...this.boxesToPlot, new Box({
        fill: this.p5.color("white"),
        stroke: this.p5.color("green"),
        x: this.p5.mouseX,
        y: this.p5.mouseY,
        type: BoxType.rect,
        anglePattern: randomBetween(0, 180),
        w: randomBetween(4, 10)*maxSize,
        h: randomBetween(4, 10)*maxSize,
      }, { world: this.engine.world, p5: this.p5 })]
    } else if (inSphere) {//|| inGround || inSky){
      this.boxes = [...this.boxes, new Box({
        stroke: this.p5.color("white"),
        x: this.p5.mouseX,
        y: this.p5.mouseY,
        type: BoxType.rect,
        anglePattern: randomBetween(0, 180),
        w: randomBetween(4, 10)*maxSize,
        h: randomBetween(4, 10)*maxSize,
      }, { world: this.engineSky.world, p5: this.p5 })]
    }
  }
  enableMotion = async () => {
    if (typeof DeviceMotionEvent !== "undefined" &&
      typeof (DeviceMotionEvent as any).requestPermission === "function") {
      const permission = await (DeviceMotionEvent as any).requestPermission();
      if (permission !== "granted") return;
    }
    // console.log()
    this.startMotion();
  }
  startMotion = () => {
    window.addEventListener("deviceorientation", (event) => {
      const { beta, gamma } = event as any;

      // Normalize values (-1 to 1)
      const x = Matter.Common.clamp(gamma / 45, -1, 1);
      const y = Matter.Common.clamp(beta / 45, -1, 1);
      console.log({ x, y })
      if (x > 0 || y > 0) {
        this.engineSky.gravity.x = x * 0.15;
        this.engineSky.gravity.y = y * 0.15;
      }
    });

  }
  
  draw = ( ) => {
    // super.draw()
    let p5 = this.p5
    Matter.Engine.update(this.engine, p5.deltaTime)
    Matter.Engine.update(this.engineSky, p5.deltaTime)
    // this.board.draw()
    let skyLayer = this.addLayer("sky", ()=>{
      this.skyShapeWhole.attrs = { fill: this.guiColor("skyColor", p5.color("#4d4c4c")) }
      drawFlatten(p5, [this.skyShapeWhole])
    }, { visible: true })
    let groundLayer = this.addLayer("ground", ()=>{
      this.groundShapeWhole.attrs = { fill: this.guiColor("groundColor", p5.color("#383838")) }
      drawFlatten(p5, [this.groundShapeWhole])
    }, { visible: true })
    
    let treeLayer = this.addLayer("tree", ()=>{
      drawFlatten(p5, [this.treeShape])
    }, { visible: false })
    
    let boxesLayer = this.addLayer("boxes", ()=>{
      for (var i = 0; i < this.boxes.length; i++) {
        this.boxes[i].show();
      }

    })
    
    let boxesToPlotLayer = this.addLayer("boxesToPlot", ()=>{
      for (var i = 0; i < this.boxesToPlot.length; i++) {
        this.boxesToPlot[i].show();
      }
    })
    // Tests of circles and ellipses with various ellipseModes
    this.drawLayers()
  }
}
// let shapesToRender: Polygon[] = [];

