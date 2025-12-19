import p5 from "p5"
import GUI from 'lil-gui'; 
import { Layer } from "./Layer";

type ColorBoard = {
  paddingX?:number, 
  paddingY?:number, 
  marginX:number, 
  marginY: number, 
  sizeX:number, 
  sizeY:number, 
  colors: string[][]
}
 
type BoardProps = {
  width:number,
  height:number,
  margin:number,
  colorBoard?: ColorBoard
}
export class Board {
  margin:number
  height:number
  width:number
  colorGrid?: ColorBoard
  colorMapping?: Record<string,[number,number]>
  colorIds: Record<string,number>
  p5: p5
  layers: Record<string,Layer>
  gui: GUI
  settings: Record<string,any>
  constructor(p5Instance:p5, {width, height, margin, colorBoard}:BoardProps){
    this.gui = new GUI();
    this.settings = {}
    this.layers = {}
    this.p5 = p5Instance
    this.width = width
    this.height = height
    this.colorIds = {}
    this.margin = margin
    if (colorBoard){
      this.colorGrid = colorBoard
      let {sizeX, sizeY, marginX, marginY, paddingX, paddingY} = colorBoard
      let colorMapping = {} as Record<string,[number,number]>
      for (let i=0;i<colorBoard.colors.length;i++){
        for (let j=0;j<colorBoard.colors[0].length;j++){
          colorMapping[colorBoard.colors[i][j]]=[
            this.width+marginX+(i+0.5)*sizeX+i*(paddingX||0), 
            marginY+(j+0.5)*sizeY+j*(paddingY||0)
          ]
        }
      }
      this.colorMapping = colorMapping
    }
  }
  addLayer(name:string){
    if (!this.layers[name]){
        this.layers[name]=new Layer(name)
        this.settings[`layer_${name}`] = true
        this.gui.add(this.settings, `layer_${name}`).onChange((v:boolean)=>this.layers[name].visible=v)
    }
    return this.layers[name]
  }
  draw(){
    let p5Instance = this.p5
    let boardLayer = this.addLayer("board")
    boardLayer.beginLayer()
    if (boardLayer.visible){
      p5Instance.rectMode(p5Instance.CORNER)
      p5Instance.rect(this.margin,this.margin, this.width, this.height)
      if (this.colorMapping && this.colorGrid){
        // console.log(p5Instance.FILL)
        p5Instance.rectMode(p5Instance.CENTER)
        Object.entries(this.colorMapping).forEach(([color, [x,y]])=>{
          p5Instance.fill(color)
          p5Instance.rect(x, y, this.colorGrid!.sizeX, this.colorGrid!.sizeY)
        })
        p5Instance.fill("white")
      }
    }
    boardLayer.closeLayer()
  }
  changeColor(newColor:string){
    if (!this.colorIds[newColor]){
      this.colorIds[newColor] = 0 
    }
    this.colorIds[newColor] += 1
    // let boardLayer = this.addLayer(`${newColor}${this.colorIds[newColor]}`)

  }
}