import p5 from "p5";
import firmesTxt from '../assets/firmes5.svg?raw'
import { addCallback, InvisibleColor } from "../utils/p5";
import { point, Point, Polygon, Segment, vector, BooleanOperations } from "@flatten-js/core";
import earcut from 'earcut'
import { createRect, drawFlatten, getCoords, getPolygonFromCoords, getRandomFromList, pointsToSegments, unify } from "../utils";
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
// distinct imports depending on how you load flatten-js
// import { Polygon, Point } from '@flatten-js/core'; 

// function toPolygon(coords) {
//   if (!coords.length) return [];

//   const seen: Record<string,boolean> = {};
//   const ring = [];

//   // Remove all duplicates (global, not just consecutive)
//   for (const [x, y] of coords) {
//     const key = `${x},${y}`;
//     if (!seen[key]) {
//       seen[key] = true
//       ring.push([x, y]);
//     }
//   }

//   // Ensure polygon is closed
//   const first = ring[0];
//   const last = ring[ring.length - 1];

//   if (first[0] !== last[0] || first[1] !== last[1]) {
//     ring.push([...first]);
//   }
//   let p = polygon([
//    ring
//   ]);
//   return p;
// }

// function calculateLength(points: Point[]): number {
//   let len = 0;
//   for (let i = 0; i < points.length - 1; i++) {
//     const dx = points[i + 1].x - points[i].x;
//     const dy = points[i + 1].y - points[i].y;
//     len += Math.sqrt(dx * dx + dy * dy);
//   }
//   return len;
// }

// function removeSelfIntersections(points: Point[]): Line[] {
//   const result: Line[] = [];
  
//   if (points.length < 2) return result;
  
//   let currentLine: Point[] = [];
  
//   for (let i = 0; i < points.length; i++) {
//     currentLine.push(points[i]);
    
//     // Check current segment against all previous segments in current line
//     if (currentLine.length >= 4) {
//       let foundIntersection = false;
      
//       for (let j = 0; j < currentLine.length - 3; j++) {
//         const s1 = new Flatten.Segment(
//           new Flatten.Point(currentLine[j].x, currentLine[j].y),
//           new Flatten.Point(currentLine[j + 1].x, currentLine[j + 1].y)
//         );
        
//         const s2 = new Flatten.Segment(
//           new Flatten.Point(currentLine[currentLine.length - 2].x, currentLine[currentLine.length - 2].y),
//           new Flatten.Point(currentLine[currentLine.length - 1].x, currentLine[currentLine.length - 1].y)
//         );
        
//         const intersections = s1.intersect(s2);
        
//         if (intersections.length > 0) {
//           const intersection = intersections[0];
          
//           // Create closed loop from j+1 to current (including intersection point)
//           const loop = [
//             { x: intersection.x, y: intersection.y },
//             ...currentLine.slice(j + 1, currentLine.length - 1),
//             { x: intersection.x, y: intersection.y }
//           ];
          
//           result.push({
//             points: loop,
//             length: calculateLength(loop)
//           });
          
//           // Start new line from intersection point and continue with remaining input points
//           currentLine = [
//             ...currentLine.slice(0, j + 1),
//             { x: intersection.x, y: intersection.y }
//           ];
          
//           foundIntersection = true;
//           break;
//         }
//       }
      
//       if (foundIntersection) {
//         // Continue processing from current position
//         continue;
//       }
//     }
//   }
  
//   // Add the final line/segment if it has points
//   if (currentLine.length > 1) {
//     result.push({
//       points: currentLine,
//       length: calculateLength(currentLine)
//     });
//   }
  
  
//   return result;
// }

export class Signature extends SinglePlot {
    
    lines: Polygon[]
    // polygon: Polygon
    constructor(p5: p5, params: { x?: number, y?: number, width: number, height: number, }){
        super({p5})
        let paths = getSvgPaths(firmesTxt)
        
        this.lines=[]
        let pathsSelected = paths.filter((p,i)=>i!=3)
        let path = getRandomFromList(pathsSelected)
        // for (let path of pathsSelected){
        let subPaths = processSVG(path)
        let polygons = subPaths.map(p=>new Polygon(p))
        let megaPolygon = polygons.reduce((acc,item)=>acc?unify(acc,item!):item)
        let scaleX = params.width/megaPolygon.box.width
        let scaleY = params.height/megaPolygon.box.height
        let scale = Math.min(scaleX, scaleY)
        // let rect  = createRect({
        //                     x: params.x,
        //                     y: params.y,
        //                     w:params.width,
        //                     h:params.height
        //                 })
        this.lines = [...this.lines,...polygons.map(p=>p.scale(scale,scale).translate(vector(params.x,params.y))), ]
    }
    draw(){
      
        this.lines.map(line=>drawFlatten(this.p5, line))
      
      // this.drawLayers()
    }
}