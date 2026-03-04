import p5 from "p5";

import { addCallback, InvisibleColor } from "../utils/p5";
import { point, Point, Polygon, Segment, vector, BooleanOperations, Line, Multiline } from "@flatten-js/core";
import earcut from 'earcut'
import { createRect, drawFlatten, getCoords, getPolygonFromCoords, getRandomFromList, iterTwo, pointsToSegments, unify } from "../utils";
// import Flatten from "@flatten-js/core";
import * as martinez from 'martinez-polygon-clipping';
import { Plot, SinglePlot } from "./Plot";
// import unkinkPolygon from "@turf/unkink-polygon";
// import cleanCoords from "@turf/clean-coords";
// import {polygon} from "@turf/turf"
function processSVG(path) {
//   let parser = new DOMParser();
//   let xmlDoc = parser.parseFromString(svgContent, 'text/xml');

//   let svgPaths = xmlDoc.getElementsByTagName('path');
  let svgPaths = [path]
  let paths: Point[][] = []
  for (let i = 0; i < svgPaths.length; i++) {
    let pathData = svgPaths[i].getAttribute('d');
    let subPaths = splitSubPaths(pathData);
    for (let subPath of subPaths) {
      let pathPoints = extractPointsFromPath(subPath);
      paths.push(pathPoints);
    }
  }
  return paths
  
}

function splitSubPaths(pathData) {
  let parts = pathData.split(/(?=[Mm])/);
  return parts;
}
function extractPointsFromPath(pathData, pointDensity=2) {
  let points: Point[] = [];
  
  let pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  pathElement.setAttribute('d', pathData);

  let totalLength = pathElement.getTotalLength();
  let numPoints = totalLength / pointDensity;

  for (let i = 0; i <= numPoints; i++) {
    let pointPosition = i * pointDensity;
    let pointSvg = pathElement.getPointAtLength(pointPosition);
    points.push(point(pointSvg.x, pointSvg.y));
  }

  return points;
}

function getSvgPaths(svgText: string): SVGPathElement[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgText, 'image/svg+xml')

  return Array.from(doc.querySelectorAll('path'))
}

export class Svg  {
    p5: p5
    lines: Multiline[]
    // polygon: Polygon
    constructor( {rawSvg, x, y,scaleRatio}:{ rawSvg: string, x?: number, y?: number, width: number, height: number, scaleRatio:number }, {p5:p5}){
        this.p5=p5
        let paths = getSvgPaths(rawSvg)
        
        this.lines=[]
        let pathsSelected = paths.filter((p,i)=>i!=3)
        for (let path of pathsSelected){
          let subPaths = processSVG(path)
          // debugger
          let lines = subPaths.map((p:  any)=>iterTwo(p).map(([a,b])=>new Segment(a,b))).flat().map(s=>s.scale(scaleRatio, scaleRatio).translate(x,y))
          // let megaPolygon = lines.reduce((acc,item)=>acc.union(l))
          // let scaleX = width/megaPolygon.box.width
          // let scaleY = height/megaPolygon.box.height
          // let scale = Math.min(scaleX, scaleY)
          
          this.lines = [...this.lines,...(lines as any)]
        }
        // let path = getRandomFromList(pathsSelected)
        // for (let path of pathsSelected){
      
      }
    show(){
      
        this.lines.map(line=>drawFlatten(this.p5, line))
      
      // this.drawLayers()
    }
}