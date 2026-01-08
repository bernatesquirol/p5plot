import { DisplayMode, PAPER_SIZES, Plot } from "../../components/Plot";
import { inRange } from "../../utils";
import { XmasPlot } from "../122225_xmas";
import p5 from "p5"
export class MultiXmasPlot extends Plot {
    // list of plots
    // draw function -> boxes
    // displayMode = 
    static displayMode = DisplayMode.PRINT;
    static paper = PAPER_SIZES.A3_h
    plots: Plot[]
    constructor(p5: p5,{height, width, saveSVG, cols, rows}){
        super({p5, })
        let widthSubplot = width/cols
        let heightSubplot = height/rows
        this.plots = []
        inRange(cols).forEach(c=>{
            inRange(rows).forEach(r=>{
                let plot = new XmasPlot(p5,{
                    x: c*widthSubplot,
                    y: r*heightSubplot,
                    centerTree: {x: 0.87*widthSubplot/2, y: heightSubplot/4},
                    angleTree: -Math.PI/2,
                    width: widthSubplot,
                    height: heightSubplot,
                    saveSVG
                });
                plot.randomize(0.2)
                plot.gui.close()
                this.plots.push(plot)
            })
        })
    }
    draw(){
        this.plots.forEach(plot=>{
            plot.draw()
        })
    }
}