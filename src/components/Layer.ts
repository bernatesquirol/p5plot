import p5plot from 'p5.plotsvg';

type LayerProps = {
  vel?:    number,
  zIndex?: number,
  visible?: boolean
}
export class Layer {
  visible: boolean
  name: string
  drawFunc: ()=>void
  attrs?:LayerProps
  constructor(name:string,draw:()=>void,attrs?:LayerProps){
    this.name=name
    this.drawFunc = draw
    this.visible = attrs?.visible!=null?attrs.visible:true
    this.attrs = attrs
  }
  beginLayer(){
    p5plot.beginSvgGroup(this.name, this.attrs)
    return this
  }
  closeLayer(){
    p5plot.endSvgGroup(this.name)
    return this
  }
  draw(){
    this.beginLayer()
    if (this.visible){
      this.drawFunc()
    }
    this.closeLayer()
  }
}
