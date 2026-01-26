import { InvisibleColor } from '../utils/p5';
import { createRect, drawFlatten } from '../utils';
import p5 from 'p5'
import { DPI } from './Plot';
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
            if (sizeSpec.endsWith("cm")) t.fixed = parseFloat(sizeSpec) * DPI; //37.795; // cm → px
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

export class Margins {
    p5: p5
    namedRegions: Record<string, RectContainer[]>
    regions: RectContainer[][]
    constructor(p5: p5, params: { x?: number, y?: number, width: number, height: number, xTracks: string, yTracks: string }) {
        this.p5 = p5
        let { x, y, width, height, xTracks, yTracks } = params

        let { regions, namedRegions } = buildGrid({ x:x||0, y:y||0, width, height }, xTracks, yTracks)
        this.namedRegions = namedRegions
        this.regions = regions
        
    }
    draw(){
        this.regions.forEach((columnRegion, rowIndex, array)=>{
            // if (rowIndex===0){
                
            // }
            // if (rowIndex===array.length-1){
                
            // }
            columnRegion.forEach((cell, columnIndex, arrayColumn)=>{
                this.p5.push()
                drawFlatten(this.p5, createRect({
                    x: cell.x,
                    y: cell.y,
                    w:cell.width,
                    h:cell.height
                }), {fill: this.p5.color(InvisibleColor), stroke: this.p5.color("red")})
                this.p5.push()
                // if (columnIndex===0){

                // }
                // if (columnIndex===arrayColumn.length-1){
                    
                // }
            })
        })
    }
}