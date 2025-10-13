import p5 from 'p5';
import p5plot from 'p5.plotsvg';
import GUI from 'lil-gui'; 
const gui = new GUI();
import './style.css';
const settings = {
} as any


// Add sliders to number fields by passing min and max
// gui.add( myObject, 'myNumber', 0, 1 );
// gui.add( myObject, 'myNumber', 0, 100, 2 ); // snap to even numbers

// Create dropdowns by passing an array or object of named values
// gui.add( myObject, 'myNumber', [ 0, 1, 2 ] );
// gui.add( myObject, 'myNumber', { Label1: 0, Label2: 1, Label3: 2 } );

const param = ()=>{
  gui.add
}
type LayerProps = {
  vel?:    number,
  zIndex?: number
}
class Layer {
  visible: boolean
  name: string
  constructor(name:string,attrs?:LayerProps){
    this.name=name
    this.visible = true
    p5plot.beginSvgGroup(name, attrs)
    settings[`layer_${name}`] = true
    gui.add(settings, `layer_${name}`).onChange((v:boolean)=>this.visible=v)
  }
  closeLayer(){
    p5plot.endSvgGroup(this.name)
  }
}
// TODO:
// 1. crear capes visible / no visible - ok
// 2. afegir background: field + pintures (no imprimir) - semi OK
// 4. fer un json que controli la velocitat, repeticions, z-index
// 3. transitions (velocity & z-index)
// 5. server executi el svg + json
// 6. despres fer que json + svg es pugin a "server" desde la web
// 7. executing pipeline feedback
const layers: any = {}
const addLayer = (name:string)=>{
  if (!layers[name]){
    layers[name]=new Layer(name)
  }
  return layers[name]
}
let c = 5
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
class Board {
  margin:number
  height:number
  width:number
  colorGrid?: ColorBoard
  colorMapping?: Record<string,[number,number]>
  colorIds: Record<string,number>
  constructor({width, height, margin, colorBoard}:BoardProps){
    this.height = height
    this.colorIds = {}
    this.margin = margin
    this.width = width
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
  draw(p5Instance:p5){
    let boardLayer = addLayer("board")
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
    let boardLayer = addLayer(`${newColor}${this.colorIds[newColor]}`)
    
  }
}

const _app = new p5((p5Instance: p5) => {
  const p = p5Instance as unknown as p5;
  let bDoExportSvg = false
  const x = 100;
  const y = 100;
  function drawDesign (board:Board){
    board.draw(p5Instance)
    let a = addLayer("squares")
    if (a.visible){
      p5Instance.rectMode(p5Instance.CORNER)
      p5Instance.square(100, 250, 50)
      p5Instance.rectMode(p5Instance.CENTER)
      p5Instance.square(100, 250, 50)
      p5Instance.rectMode(p5Instance.CORNERS)
      p5Instance.square(100, 250, 50)
      p5Instance.rectMode(p5Instance.RADIUS)
      p5Instance.square(100, 250, 50)
      p5Instance.rectMode(p5Instance.CENTER)
      p5Instance.rect(75, 350, 100, 50)
      p5Instance.rectMode(p5Instance.CORNER)
      p5Instance.rect(75, 350, 100, 50)
    }
    a.closeLayer();

    // Tests of circles and ellipses with various ellipseModes
    const b = addLayer("circles")
    if (b.visible){
      p5Instance.ellipseMode(p5Instance.CENTER)
      p5Instance.circle(200, 250, 50)
      p5Instance.ellipseMode(p5Instance.CORNER)
      p5Instance.circle(200, 250, 50)
      p5Instance.ellipseMode(p5Instance.RADIUS)
      p5Instance.circle(200, 250, 50)
      p5Instance.ellipseMode(p5Instance.CORNERS)
      p5Instance.circle(50, 100, 200)
      p5Instance.ellipseMode(p5Instance.CORNER)
      p5Instance.ellipse(175, 350, 100, 50)
      p5Instance.ellipseMode(p5Instance.CENTER)
      p5Instance.ellipse(175, 350, 100, 50)
    }
    b.closeLayer()
  }
  p.setup = function setup() {
    p.createCanvas(612, 792);
    p5plot.setSVGDocumentSize(612, 792); // 6"x8" @ 96dpi
    p5plot.setSvgResolutionDPI(96); // 96 dpi is default. setSvgResolutionDPCM() is also supported. 
    p5plot.setSvgPointRadius(0.25); // a "point" is a 0.25 circle by default
    p5plot.setSvgCoordinatePrecision(4); // how many decimal digits; default is 4
    p5plot.setSvgTransformPrecision(6); // how many decimal digits; default is 6
    p5plot.setSvgIndent(p5plot.SVG_INDENT_SPACES, 2); // or SVG_INDENT_NONE or SVG_INDENT_TABS
    p5plot.setSvgDefaultStrokeColor('black'); 
    p5plot.setSvgDefaultStrokeWeight(1); 
    p5plot.setSvgFlattenTransforms(false); // if true: larger files + greater fidelity to original
  };
  p.keyPressed = ()=>{
     if (p5Instance.key == 's'){ 
      bDoExportSvg = true; 
    }
  }
  
  p.draw = function draw() {
    let board = new Board({width:100, height:200, margin: 5, colorBoard: {
      sizeX:30,
      sizeY:40,
      marginX:10,
      marginY:20,
      paddingX: 4,
      paddingY: 2, 
      colors: [["red", "blue"], ["green", "yellow"]] 
    }})
    // board.draw(p5Instance)
    if (bDoExportSvg) p5plot.beginRecordSVG(p5Instance, "output.svg")
    p.background(255);
    // p.fill('red');
    // p.rect(x, y, 50, 50);
    // if (c<0){
    drawDesign(board)
    // c-=1
    // }
    if (bDoExportSvg) {
      p5plot.endRecordSVG();
      bDoExportSvg = false
    }
  };
}, document.getElementById('app')!);
