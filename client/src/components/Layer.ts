import p5plot from 'p5.plotsvg';

type LayerProps = {
  vel?:    number,
  zIndex?: number,
  visible?: boolean,
}
type LayerAttrs = LayerProps&{
  "inkscape:groupmode": string,
  "inkscape:label": string
}
export class Layer {
  visible: boolean
  name: string
  drawFunc: ()=>void
  attrs?: LayerAttrs
  constructor(index:number, name:string,draw:()=>void,attrs?:LayerProps){
    this.name=name
    this.drawFunc = draw
    this.visible = attrs?.visible!=null?attrs.visible:true
    this.attrs = {"inkscape:groupmode":"layer", "inkscape:label": `${index} - ${name}`,...(attrs||{})}     
  }
  beginLayer(){
    p5plot.beginSvgGroup(this.name, this.attrs) //
    
    return this
  }
  closeLayer(){
    p5plot.endSvgGroup(this.name)
    return this
  }
  addDraw(newDraw:()=>void){
    let oldDraw = this.drawFunc
    let newAddedDraw = ()=>{
      oldDraw()
      newDraw()
    }
    this.drawFunc = newAddedDraw
  }
  draw(){
    this.beginLayer()
    if (this.visible){
      this.drawFunc()
    }
    this.closeLayer()
  }
}
