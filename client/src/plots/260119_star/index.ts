import p5 from 'p5';
import { Board } from '../../components/Board';
import { bindHollowBody, center, centroid, createCircle, createRect, diff, drawFlatten, equilateralTriangleCentroidDown, forceTowardsPoint, gaussianField, getRandomFromList, getRandomPointOnBox, getRandomPointOnPolygonEdge, gridify, holdRatio, inRange, poligonizeCircle, randomBetween, randomPointInPolygon, Star, star5, tangentAngle, WithAttrs } from '../../utils';
import { point, Point, Polygon, vector, } from '@flatten-js/core';
import d3Scale from 'd3-scale'
import * as Matter from 'matter-js'
import { Box, BoxType } from './Box';
import _ from 'lodash'
import {ScenedSinglePlot as ParentPlot } from '../../components/Plot'
import { Signature } from '../../components/Signature';
export enum Scene {
  Start="start",
  Explode="explode",
  End="end"
}
let sign;
export class Plot extends ParentPlot<Scene> {
  x:number
  y:number
  height:number
  width:number
  // board: Board
  engine: Matter.Engine;
  engineSky: Matter.Engine;
  boxes: Box[] = []
  // greenTreeBoxes: Box[] = []
  // redTreeBoxes: Box[] = []
  // boxesToPlot: Box[] = []
  treeShape: Star;
  skyShapeWhole: WithAttrs<Polygon>;
  sphereShape: WithAttrs<Polygon>;
  groundShapeWhole: WithAttrs<Polygon>;
  p5: p5
  heightTriangle:number
  maxSizeBox : number

  constructor(p5: p5, { x, y, height, width, saveSVG, centerTree, angleTree }: {centerTree?:{x:number,y:number}, angleTree?:number,x?:number,y?:number, height:number, width:number, saveSVG: ()=>void}) {
    let scenes = [Scene.Start, Scene.Explode, Scene.End]
    super({p5, scenes})
    this.width = width
    this.height = height
    this.p5 = p5
    this.x = x||0
    this.y = y||0
    // sign = new Signature(this.p5, {x:this.x+150,y:this.y,width:this.width/2,height:this.height/2})
    // this.board = new Board(p5, {
    //   width, height,x,y,
    //   margin: 5,
    // })
    this.guiButton("saveSVG", saveSVG, true)
    const t = vector(this.x,this.y)
    this.engine = Matter.Engine.create()
    this.engineSky = Matter.Engine.create()
    let world = this.engine.world;
    this.engine.gravity.y = -this.guiParam("gravityTree", 0,)
    let worldSky = this.engineSky.world;
    this.engineSky.gravity.y = this.guiParam("gravitySky", 0.1,)
    // let { w:wTree, h:hTree } = holdRatio({w:width*0.7, h: height*0.7 },"2:4")

    // let widthTriangle = width*0.4
    let boundsShape = createRect({ y: 0, x: 0, w: width, h: height }, "NO")
    bindHollowBody(world, boundsShape)
    let outerDiameter = Math.min(width*0.7, height*0.7)
    this.heightTriangle = outerDiameter
    let outerR = outerDiameter/2
    this.maxSizeBox = outerDiameter*0.005
    if (!centerTree){
      centerTree = center({w:outerR,h:outerR}, {w:width,h:height})
    }
    let rotationCenter =  new Point(Object.values(centerTree) as any)
    let innerToOuter = randomBetween(0.2,0.4)
    this.treeShape = star5({ ...centerTree, innerR: outerR*innerToOuter, outerR, innerVariation: 0.05, outerVariation:0, angleVariation:0.5}).rotate(angleTree||0, rotationCenter).translate(t) as Star
    // shapesToRender.push(this.treeShape)
    // bindHollowBody(world, this.treeShape)
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
    this.sphereShape = diff(poligonizeCircle(snowBody), this.treeShape.polygon)!
    // let starBody = bindHollowBody(worldSky, this.sphereShape)
    
    this.guiButton("randomize", () => {
      this.randomize(0.6)
      // make grid in circle
      // addNewClick()
      // make grid in triangle
      // couple stars
    }, true)
    // this.guiButton("free", () => {
    //   starBody.forEach(b=>{
    //     Matter.World.remove(worldSky,b)
    //   })
    // }, true)
    // p5.touchEnded
    let prevTouchEnded = this.p5.touchEnded
    let newTouchEnded = _.throttle(async (_e: any) => {

      // await this.enableMotion()
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
    // let prevMouseDragged = this.p5.mouseDragged
    // let newMouseDragged = _.throttle((_e: any) => {
    //   this.enableMotion()
    //   let newPoint = new Point(this.p5.mouseX, this.p5.mouseY)
    //   this.addNewDrag(newPoint)
    // }, 16,
    //   {
    //     leading: true,
    //     trailing: true
    //   })

    // if (this.p5.mouseDragged!=null){
    //   this.p5.mouseDragged = (_e)=>{
    //     prevMouseDragged(_e);
    //     newMouseDragged(_e)
    //   }
    // }else this.p5.mouseDragged = newMouseDragged
  }
  
  addNewClick = (newPoint: Point) => {
    let inTree = this.treeShape.polygon.contains(newPoint)
    let inSphere = this.sphereShape.contains(newPoint)
    // let inGround = groundShape.contains(newPoint)
    // TODO: height and width depending on own height and width
    // const maxSize = this.heightTriangle*0.005
    if (inTree) {
      this.boxes = [...this.boxes, new Box({
        fill: this.p5.color("white"),
        stroke: this.p5.color("red"),
        x: this.p5.mouseX, y: this.p5.mouseY, type: BoxType.circle, anglePattern: randomBetween(0, 180), r: randomBetween(3, 10)*this.maxSizeBox/2
      }, { world: this.engine.world, p5: this.p5 })]
    }
  }
  randomize = (probability:number)=>{
    
    let numSpheres = probability
    let points = gridify(this.treeShape.polygon, 20, 20, true)
    points.forEach(gridPoint=>{
      if (this.treeShape.polygon.contains(point(...gridPoint))){
        let [x,y] = gridPoint
        let isSphere = Math.random()<numSpheres
        let c = centroid(this.treeShape.polygon)
        let angle = tangentAngle(point(x,y), c)
        let fieldSize = gaussianField(this.treeShape.box.center, this.treeShape.box.height*2)
        // randomPointInPolygon
        // let fieldSize = gaussianField(this.treeShape.box.center, this.treeShape.box.height*1.3)
        let r = 1.1*randomBetween(7, 10)*fieldSize(x,y)*this.maxSizeBox/2
        let h = 2*1.1*randomBetween(7, 10)*fieldSize(x,y)*this.maxSizeBox/2
        let w = 2*1.1*randomBetween(7, 10)*fieldSize(x,y)*this.maxSizeBox/2
        // let fieldBodyBuffer = gaussianField(getRandomPointOnPolygonEdge(this.treeShape)!, this.treeShape.box.height/5)
        let outer = getRandomFromList(this.treeShape.outers)
        let fieldLineWidth = gaussianField(this.treeShape.box.center, this.treeShape.box.height/3)
        let red = new Box({
          fill: this.p5.color("white"),
          stroke: this.p5.color("black"),
          x, y, type:isSphere?BoxType.circle:BoxType.rect, 
          anglePattern: angle,
          r,
          w,
          h,
          bodyBuffer: 1.2,//+1.5*fieldBodyBuffer(x,y,)
          textureWidth: 2.5-fieldLineWidth(x,y)
        }, { world: this.engine.world, p5: this.p5 })
        // forceTowardsPoint(red.body,c, 0.0005)
        this.boxes.push(red)
      }
      
    })
    // this.boxesToPlot = [...this.boxesToPlot, ]
    // this.boxesToPlot = [...this.boxesToPlot, new Box({
    //     fill: this.p5.color("white"),
    //     stroke: this.p5.color("green"),
    //     x: this.p5.mouseX,
    //     y: this.p5.mouseY,
    //     type: BoxType.rect,
    //     anglePattern: randomBetween(0, 180),
    //     w: randomBetween(4, 10)*this.maxSizeBox,
    //     h: randomBetween(4, 10)*this.maxSizeBox,
    //   }, { world: this.engine.world, p5: this.p5 })]
  }
  
  
  draw = ( ) => {
    // super.draw()
    // sign.draw()
    // this.once(()=>{
      
      
    // },"firma")
    let p5 = this.p5
    if (this.currentScene === Scene.Explode){
      this.once(()=>this.randomize(1), "randomizeScene")
    }
    if (this.currentScene !== Scene.End){
      Matter.Engine.update(this.engine, p5.deltaTime)
      Matter.Engine.update(this.engineSky, p5.deltaTime)
    }
    // this.board.draw()
    // let skyLayer = this.addLayer("sky", ()=>{
    //   this.skyShapeWhole.attrs = { fill: this.guiColor("skyColor", p5.color("#4d4c4c")) }
    //   drawFlatten(p5, [this.skyShapeWhole])
    // }, { visible: true })
    // let groundLayer = this.addLayer("ground", ()=>{
    //   this.groundShapeWhole.attrs = { fill: this.guiColor("groundColor", p5.color("#383838")) }
    //   drawFlatten(p5, [this.groundShapeWhole])
    // }, { visible: true })
    
    let treeLayer = this.addLayer("tree", ()=>{
      drawFlatten(p5, [this.treeShape.polygon])
    }, { visible: false })
    // let redBoxesLayer = this.addLayer("redboxes", ()=>{
    //   for (var i = 0; i < this.redTreeBoxes.length; i++) {
    //     this.redTreeBoxes[i].show();
    //   }
    // })
    // let greenBoxesLayer = this.addLayer("greenboxes", ()=>{
    //   for (var i = 0; i < this.greenTreeBoxes.length; i++) {
    //     this.greenTreeBoxes[i].show();
    //   }
    // })
    let boxesLayer = this.addLayer("boxes", ()=>{
      for (var i = 0; i < this.boxes.length; i++) {
        this.boxes[i].show();
      }

    })
    
    // let boxesToPlotLayer = this.addLayer("boxesToPlot", ()=>{
    //   for (var i = 0; i < this.boxesToPlot.length; i++) {
    //     this.boxesToPlot[i].show();
    //   }
    // })
    // Tests of circles and ellipses with various ellipseModes
    this.drawLayers()
  }
}
// let shapesToRender: Polygon[] = [];

