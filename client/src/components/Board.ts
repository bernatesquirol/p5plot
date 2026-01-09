import p5 from "p5"
import GUI from 'lil-gui'; 
import { Layer } from "./Layer";
import { p5ColorToHex } from "../utils/p5";

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
  x?: number
  y?: number
}

      // colorBoard: {
      //   sizeX:30,
      //   sizeY:40,
      //   marginX:10,
      //   marginY:20,
      //   paddingX: 4,
      //   paddingY: 2, 
      //   colors: [["red", "blue"], ["green", "yellow"]] 
      // }
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
  isProd: boolean
  x:number
  y:number
  constructor(p5Instance:p5, {x,y,width, height, margin, colorBoard}:BoardProps){
    this.isProd = import.meta.env.VITE_ENV === 'production'
    this.gui = new GUI();
    if (this.isProd){
      this.gui.close()
    }
    this.settings = {}
    this.layers = {}
    this.p5 = p5Instance
    this.width = width
    this.x = x||0
    this.y = y||0
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
  addLayer(name:string, attrs: {visible?:boolean} = {visible:true}){
    if (!this.layers[name]){
        this.layers[name] = new Layer(0, name, attrs)
        this.guiParam(`layer_${name}`,attrs.visible!=null?attrs.visible:true, )
    }
    return this.layers[name]
  }
  guiColor(label, defaultValue: p5.Color, showInProd:boolean=false){
    if (!this.settings[label]){
      this.settings[label]  = p5ColorToHex(this.p5, defaultValue)
      if (!this.isProd || showInProd){
        this.gui.addColor(this.settings, label,).onChange((v:any)=>{
          this.settings[label] = v
        })
      }
    }
    let src = this.settings[label]
    return this.p5.color(src);
  }
  guiParam(label, defaultValue, showInProd:boolean=false, _args=[]){
    // gui.add( object, 'property' );
    // gui.add( object, 'number', 0, 100, 1 );
    // gui.add( object, 'options', [ 1, 2, 3 ] );
    if (!this.settings[label]){
      this.settings[label]  = defaultValue
      if (!this.isProd || showInProd){
        this.gui.add(this.settings, label,).onChange((v:any)=>this.settings[label] = v)
      }
    }
    return this.settings[label]
  }
  guiButton(label, functionToExecute, showInProd:boolean=false, args=[]){
    // gui.add( object, 'property' );
    // gui.add( object, 'number', 0, 100, 1 );
    // gui.add( object, 'options', [ 1, 2, 3 ] );
    if (!this.settings[label]){
      this.settings[label]  = functionToExecute
      if (!this.isProd || showInProd){
        this.gui.add(this.settings, label, ...args)
      }
    }
  }
  draw(){
    let p5Instance = this.p5    
    let boardLayer = this.addLayer("board")
    boardLayer.beginLayer()
    if (boardLayer.visible){
      p5Instance.push()
      // p5Instance.fill(150,255,255,100)
      p5Instance.rectMode(p5Instance.CORNER)
      p5Instance.rect(this.x,this.y, this.width, this.height)
      if (this.colorMapping && this.colorGrid){
        // console.log(p5Instance.FILL)
        p5Instance.rectMode(p5Instance.CENTER)
        Object.entries(this.colorMapping).forEach(([color, [x,y]])=>{
          p5Instance.fill(color)
          p5Instance.rect(x, y, this.colorGrid!.sizeX, this.colorGrid!.sizeY)
        })
        p5Instance.fill("white")
      }
      p5Instance.pop()
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