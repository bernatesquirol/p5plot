import { Margins } from "../../components/Margins";
import { DisplayMode, PAPER_SIZES, Plot } from "../../components/Plot";
import { inRange } from "../../utils";
import { XmasPlot } from "../251222_xmas";
import p5 from "p5"
export class MultiXmasPlot extends Plot {
    // list of plots
    // draw function -> boxes
    // displayMode = 
    static displayMode = DisplayMode.PRINT;
    static paper = PAPER_SIZES.A3_h
    margins: Margins
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
        this.margins = new Margins(p5,{
            x:0, 
            y:0, 
            width, 
            height, 
            xTracks:"1cm 2 10 2 1cm", 
            yTracks:"1cm 2 2 2 1cm"
        })
    }
    draw(){
        this.plots.forEach(plot=>{
            plot.draw()
        })
        this.margins.draw()
    }
}