import { Signature } from "../../components/Signature";
import { Margins } from "../../components/Margins";
import { DisplayMode, PAPER_SIZES, Plot } from "../../components/Plot";
import { inRange } from "../../utils";
import { Plot as StarPlot } from "../260119_star";
import p5 from "p5"
export class MultiStarPlot extends Plot {
    // list of plots
    // draw function -> boxes
    // displayMode = 
    static displayMode = DisplayMode.PRINT;
    static paper = PAPER_SIZES.A3_h
    margins: Margins
    plots: Plot[]
    constructor(p5: p5,{height, width, saveSVG, }){
        super({p5, })
        // let widthSubplot = width/cols
        // let heightSubplot = height/rows
        this.plots = []
        let paddingLateral = `0.5cm`
        let firmaSize = `0.8cm`
        this.margins = new Margins(p5,{
            x:0, 
            y:0, 
            width, 
            height, 
            xTracks:`${paddingLateral} 1 ${firmaSize} 1 ${firmaSize} 1 ${firmaSize} 1 ${firmaSize} ${paddingLateral}`, 
            yTracks:`${paddingLateral} 1 1 1 1 ${paddingLateral}`
        })
        // debugger
        this.margins.regions.forEach((row, rowIndex)=>{
            row.forEach((cell, colIndex)=>{
                let selectedRows = [1,3,5,7]
                let selectedCols = [1,2,3,4]
                if (selectedRows.includes(rowIndex) && selectedCols.includes(colIndex)){
                    // debugger
                let plot = new StarPlot(p5,{
                    x: cell.x,
                    y: cell.y,
                    centerTree: {x: cell.width/2, y: cell.height/2},
                    angleTree: -Math.PI/2,
                    width: cell.width,
                    height: cell.height,
                    saveSVG
                });
                plot.randomize(0.2)
                plot.gui.close()
                this.plots.push(plot)
                }
                if (selectedRows.includes(rowIndex-1) && selectedCols.includes(colIndex)){
                    let signature = new Signature(p5,{
                        x: cell.x+cell.width*0.5,
                        y: cell.y+cell.height*0.8,
                        width: cell.width*0.3,
                        height: cell.height,
                    })
                    this.plots.push(signature)
                }
            })
        })
        // inRange(cols).forEach(c=>{
        //     inRange(rows).forEach(r=>{
                
        //     })
        // })
        
    }
    draw(){
        this.plots.forEach(plot=>{
            plot.draw()
        })
        this.margins.draw()
    }
}