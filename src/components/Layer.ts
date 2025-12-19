import p5plot from 'p5.plotsvg';

type LayerProps = {
  vel?:    number,
  zIndex?: number
}
export class Layer {
  visible: boolean
  name: string
  attrs?:LayerProps
  constructor(name:string,attrs?:LayerProps){
    this.name=name
    this.visible = true
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
}
