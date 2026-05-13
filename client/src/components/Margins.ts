import { InvisibleColor } from '../utils/p5';
import { createRect, createSegment, createSegmentPoints, drawFlatten } from '../utils';
import p5 from 'p5'
import { DPI, Plot } from './Plot';
import { Polygon, Segment } from '@flatten-js/core';
// "1 m 2 m 1"

type RectContainer = { x: number; y: number; width: number; height: number; };

type Track = {
  sizeSpec: string;
  fixed?: number;
  flex?: number;
  size?: number;   // resolved pixel size
  start?: number;  // resolved pixel offset from container origin
  name?: string;
};


function buildGrid(container: RectContainer, xTracksStr: string, yTracksStr: string) {
    const regions: RectContainer[][] = [];
    const namedRegions: Record<string, RectContainer[]> = {};
    const { x: x0, y: y0, width: totalWidth, height: totalHeight } = container;

    // --- Helper: parse tracks ---
    const parseTracks = (str: string): Track[] => {
        return str.split(/\s+/).map(token => {
            let sizeSpec = token;
            let name: string | undefined;

            if (token.includes("-")) {
                const parts = token.split("-");
                sizeSpec = parts[0];
                name = parts[1].replace(/[\[\]]/g, "");
            }

            const t: Track = { sizeSpec, name };
            if (sizeSpec.endsWith("cm")) t.fixed = parseFloat(sizeSpec) * (DPI / 2.54); // cm → px (1 inch = 2.54 cm)
            else if (sizeSpec.endsWith("px")) t.fixed = parseFloat(sizeSpec);
            else if (sizeSpec.endsWith("fr")) t.flex = parseFloat(sizeSpec) || 1;
            else t.flex = parseFloat(sizeSpec) || 1;

            return t;
        });
    };

    // --- Helper: resolve track sizes ---
    const resolveTracks = (tracks: Track[], total: number) => {
        const fixedTotal = tracks.reduce((s, t) => s + (t.fixed ?? 0), 0);
        const flexTotal = tracks.reduce((s, t) => s + (t.flex ?? 0), 0);
        const unit = flexTotal > 0 ? (total - fixedTotal) / flexTotal : 0;

        let cursor = 0;
        tracks.forEach(t => {
            t.size = t.fixed ?? (t.flex! * unit);
            t.start = cursor;
            cursor += t.size;
        });
    };

    const xTracks = parseTracks(xTracksStr);
    const yTracks = parseTracks(yTracksStr);

    resolveTracks(xTracks, totalWidth);
    resolveTracks(yTracks, totalHeight);

    // --- Build grid ---
    for (let xi = 0; xi < xTracks.length; xi++) {
        regions[xi] = [];
        const xT = xTracks[xi];

        for (let yi = 0; yi < yTracks.length; yi++) {
            const yT = yTracks[yi];

            const box: RectContainer = {
                x: x0 + xT.start!,
                y: y0 + yT.start!,
                width: xT.size!,
                height: yT.size!
            };

            regions[xi][yi] = box;

            // Collect named regions
            if (xT.name) {
                namedRegions[xT.name] ??= [];
                namedRegions[xT.name].push(box);
            }
            if (yT.name) {
                namedRegions[yT.name] ??= [];
                namedRegions[yT.name].push(box);
            }
        }
    }

    return { regions, namedRegions, xTracks, yTracks };
}

export class Margins extends Plot{
    namedRegions: Record<string, RectContainer[]>
    regions: RectContainer[][]
    drawingSegments:  (Segment|Polygon)[]
    constructor(p5: p5, params: { x?: number, y?: number, width: number, height: number, xTracks: string, yTracks: string }) {
        super({p5, useGui: false})
        let { x, y, width, height, xTracks, yTracks } = params

        let { regions, namedRegions } = buildGrid({ x:x||0, y:y||0, width, height }, xTracks, yTracks)
        this.namedRegions = namedRegions
        this.regions = regions
        this.drawingSegments = []
        this.regions.forEach((columnRegion, columnIndex, arrayCols)=>{
            
            columnRegion.forEach((cell, rowIndex, arrayRows)=>{
                let geo;
                let cellMidX = cell.x+cell.width/2
                let finalX = cell.x+cell.width
                let cellMidY = cell.y+cell.height/2
                let finalY = cell.y+cell.height
                let firstRow = rowIndex===0
                let lastRow = rowIndex===arrayRows.length-1
                let firstCol = columnIndex ===0
                let lastCol = columnIndex ===arrayCols.length-1
                if (firstRow  && !firstCol){
                    geo = createSegmentPoints({
                        x0:cell.x,
                        y0:0,
                        xf:cell.x,
                        yf:cellMidY
                    })
                }
                if (lastRow && !firstCol ){
                    geo = createSegmentPoints({
                        x0:cell.x,
                        y0:cellMidY,
                        xf:cell.x,
                        yf:finalY
                    })
                }
                if (firstCol && !firstRow ){
                    geo = createSegmentPoints({
                        x0:0,
                        y0:cell.y,
                        xf:cellMidX,
                        yf:cell.y
                    })
                }
                if (lastCol && !firstRow ){
                    geo = createSegmentPoints({
                        x0:cellMidX,
                        y0:cell.y,
                        xf:finalX,
                        yf:cell.y
                    })
                }
                if (geo){
                    this.drawingSegments.push(geo)
                }
                // this.drawingSegments.push(createRect({
                //     x: cell.x,
                //     y: cell.y,
                //     w:cell.width,
                //     h:cell.height
                // }))
                
            })
            
        })
    }
    draw(){
        this.p5.push()
        this.drawingSegments.map(geo=>drawFlatten(this.p5, geo))
        this.p5.pop()
        
    }
}