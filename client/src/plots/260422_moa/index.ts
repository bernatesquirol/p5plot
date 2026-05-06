import p5 from 'p5';
import hanjian from '../../assets/final_flat3.svg?raw'
import { Board } from '../../components/Board';
import { bindHollowBody, bindHollowCircle, center, centroid, createCircle, createRect, diff, diffXY, drawFlatten, equilateralTriangleCentroidDown, FlattenObjectWithAttrs, forceTowardsPoint, gaussianField, getRandomFromList, getRandomPointOnBox, getRandomPointOnPolygonEdge, gridify, holdRatio, inRange, multXY, newArray, poligonizeCircle, randomBetween, randomPointInPolygon, Star, star5, tangentAngle, unitXY, WithAttrs } from '../../utils';
import { Circle, point, Point, Polygon, Segment, segment, vector, } from '@flatten-js/core';
import d3Scale from 'd3-scale'
import * as Matter from 'matter-js'
import _ from 'lodash'
import {DisplayMode, PAPER_SIZES, ScenedSinglePlot as ParentPlot, SinglePlot } from '../../components/Plot'
import { Signature } from '../../components/Signature';
import { Svg } from '../../components/Svg';
function drawTangentLines(bigCircle, smallCircle, n, deltaAngle=0, clockWise=1) {
    const lines: Segment[] = [];
    const center = bigCircle.pc;
    const R = bigCircle.r;
    const r = smallCircle.r;
    const alpha = Math.acos(r / R)*clockWise;
    for (let i = 0; i < n; i++) {
        const theta = (2 * Math.PI * (i+deltaAngle)) / n;
        
        // Point on Big Circle
        const startPt = point(
            center.x + R * Math.cos(theta),
            center.y + R * Math.sin(theta)
        );

        // Tangent Point on Small Circle 
        // We add (or subtract) alpha to the current theta to find the tangent touch point
        const tangentPt = point(
            center.x + r * Math.cos(theta + alpha), 
            center.y + r * Math.sin(theta + alpha)
        );

        lines.push(segment(startPt, tangentPt));
    }
    return lines;
}

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
  p5: p5
  bikes: any[]
  // engineUp: Matter.Engine
  // engineDown: Matter.Engine
  otherGeos : any[]
  otherPlots : any[]
  static displayMode = DisplayMode.PRINT;
  static paper = PAPER_SIZES.IKEA_h
  constructor({p5: p5, parentPlot}: {p5:p5, parentPlot?: SinglePlot}, { x, y, height, width, saveSVG,  }: {x?:number,y?:number, height:number, width:number, saveSVG: ()=>void}) {
    
    let scenes = [Scene.Start, Scene.Explode, Scene.End]
    super({p5, scenes, parentPlot})
    // this.engineUp = Matter.Engine.create()
    // this.engineUp.gravity.y = -0.1
    this.engineDown = Matter.Engine.create()
    this.engineDown.gravity.y = 0.1
    // let worldDown = this.engineUp.world;
    let worldUp = this.engineDown.world;
    this.width = width
    this.height = height
    this.p5 = p5
    this.x = x||0
    this.y = y||0
    let buffer = 30
    let bufferMiddle = 60
    let totalHeight = height*0.9-2*buffer
    let heightUp = totalHeight//*0.7
    let boundsShapeUp = createRect({ y: buffer, x: buffer, w: width-buffer*2, h: heightUp }, "NO")
    // let boundsShapeDown = createRect({ y:heightUp + bufferMiddle/2, x: buffer, w: width-buffer*2, h: totalHeight-heightUp }, "NO")
    bindHollowBody(worldUp, boundsShapeUp)
    // bindHollowBody(worldDown, boundsShapeDown)
    
    // sign = new Signature(this.p5, {x:this.x+150,y:this.y,width:this.width/2,height:this.height/2})
    // this.board = new Board(p5, {
    //   width, height,x,y,
    //   margin: 5,
    // })
    let universeCenter = {x:width/2,y:1.25*height/2, r: width/7}
    let size = 0.6*2*universeCenter.r
    let scaleSignature = 0.05
    let signature = new Signature({
          x: width*0.9,
          y: height*0.9,
          width: height*scaleSignature,
          height: height*scaleSignature,
      }, {p5})
    
    let svg = new Svg({
      x:universeCenter.x-size*.7, 
      y: universeCenter.y-size*0.7, 
      rawSvg: hanjian, 
      width:size , 
      height: size,
      scaleRatio: 0.4
    }, {p5: this.p5})
    // debugger
    // let polygon = svg.lines[0]
    // bindHollowBody(worldUp, polygon)
    let circleBelow = createCircle({...universeCenter  })
    // bindHollowCircle(worldDown, circleBelow as any)
    bindHollowCircle(worldUp, circleBelow as any)
    this.guiButton("saveSVG", saveSVG, true)
    let outCircleUp = diff(boundsShapeUp, poligonizeCircle(circleBelow))!
    // let outCircleDown = diff(boundsShapeDown, poligonizeCircle(circleBelow))!
    
    this.bikes = (new Array(60)).fill(1).map(p=>{
      let wheelCenter = randomPointInPolygon(outCircleUp)
      let rWheel = 16

      let spikes = 8 
      let circle = new Wheel({x:wheelCenter.x,y:wheelCenter.y, r:rWheel, smallR:rWheel*0.3, spikes, universeCenter },{p5, world: worldUp})
      return circle
    })
    this.otherPlots = [svg, signature]
    

    // this.bikes = [...this.bikes,... (new Array(30)).fill(1).map(p=>{
    //   let wheelCenter = randomPointInPolygon(outCircleDown)
    //   let rWheel = 20
    //   let circle = new Wheel({x:wheelCenter.x,y:wheelCenter.y, r:rWheel, smallR:rWheel*0.3, spikes: 6, universeCenter },{p5, world: worldDown})
    //   return circle
    // }) ]
    this.otherGeos = []//[boundsShapeUp, boundsShapeDown, outCircleUp, outCircleDown ]
  }
  
  
  draw = ( ) => {
    let p5 = this.p5
    if (this.currentScene !== Scene.End){
      // Matter.Engine.update(this.engineUp, p5.deltaTime)
      Matter.Engine.update(this.engineDown, p5.deltaTime)
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
    this.p5.fill(255,255,255,0);
    let xinoLayer = this.addLayer("xino", ()=>{
      this.otherPlots.map(p=>p.show())
    }, {visible:true} )
    for (var i = 0; i < this.bikes.length; i++) {
        this.bikes[i].compute();
    }
    let ecosLayer = this.addLayer("ecos", ()=>{
      for (var i = 0; i < this.bikes.length; i++) {
        this.bikes[i].showEco();
      }
    }, {visible:true} )
    let boxesLayer = this.addLayer("boxes", ()=>{
      // drawFlatten(p5, this.otherGeos)
      for (var i = 0; i < this.bikes.length; i++) {
        this.bikes[i].show();
      }
    }, {visible:true} )
    
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

