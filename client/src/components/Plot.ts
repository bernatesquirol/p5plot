import GUI from "lil-gui";
import { isProd } from "../utils/misc";
import { Layer } from "./Layer";
import p5 from "p5";
import { p5ColorToHex } from "../utils/p5";
export enum DisplayMode {
  PRINT,
  FULLSCREEN
}
export const DPI = 96;
export const PAPER_SIZES = {
  A4_v: { w: 8.27 * DPI, h: 11.69 * DPI },
  A4_h: { w: 11.69 * DPI, h: 8.27 * DPI, },
  A3_v: { w: 11.69 * DPI, h: 16.54 * DPI },
  A3_h: { w: 16.54 * DPI, h: 11.69 * DPI },
  A2_v: { w: 16.54 * DPI, h: 23.39 * DPI },
  A2_h: { w: 23.39 * DPI, h: 16.54 * DPI },
} as const;
export type PaperSize = keyof typeof PAPER_SIZES
export type Paper = {w:number, h:number}
export abstract class Plot {
  gui: GUI
  settings: Record<string, any>
  p5: p5
  static displayMode: DisplayMode
  static paper?: Paper
  constructor({ p5, }:{p5:p5}) {
    this.gui = new GUI();
    this.settings = {}
    this.p5 = p5
    // this.displayMode = displayMode||DisplayMode.FULLSCREEN
    // if (displayMode === DisplayMode.PRINT){
    //   this.paper = PAPER_SIZES[paperSize!]!
    // }
    if (isProd()) {
      this.gui.close()
    }
  }
  guiColor(label, defaultValue: p5.Color, showInProd: boolean = false) {
    if (!this.settings[label]) {
      this.settings[label] = p5ColorToHex(this.p5, defaultValue)
      if (!isProd() || showInProd) {
        this.gui.addColor(this.settings, label,).onChange((v: any) => {
          this.settings[label] = v
        })
      }
    }
    let src = this.settings[label]
    return this.p5.color(src);
  }
  guiParam(label, defaultValue, showInProd: boolean = false, _args = []) {
    // gui.add( object, 'property' );
    // gui.add( object, 'number', 0, 100, 1 );
    // gui.add( object, 'options', [ 1, 2, 3 ] );
    if (!this.settings[label]) {
      this.settings[label] = defaultValue
      if (!isProd() || showInProd) {
        this.gui.add(this.settings, label,).onChange((v: any) => this.settings[label] = v)
      }
    }
    return this.settings[label]
  }
  guiButton(label, functionToExecute, showInProd: boolean = false, args = []) {
    // gui.add( object, 'property' );
    // gui.add( object, 'number', 0, 100, 1 );
    // gui.add( object, 'options', [ 1, 2, 3 ] );
    if (!this.settings[label]) {
      this.settings[label] = functionToExecute
      if (!isProd() || showInProd) {
        this.gui.add(this.settings, label, ...args)
      }
    }
  }
  draw() {
    throw new Error("Abstract method");
  }
}
export abstract class SinglePlot extends Plot {
  layers: Record<string, Layer>
  constructor({ p5: p5, displayMode }: {p5:p5, displayMode?: DisplayMode}) {
    super({ p5, displayMode })
    this.layers = {}
  }
  addLayer(name: string, draw: () => void, attrs: { visible?: boolean } = { visible: true }) {
    if (!this.layers[name]) {
      let index = Object.keys(this.layers).length 
      let newLayer = new Layer(index, name, draw, attrs)
      this.layers[name] = newLayer
      this.guiParam(`layer_${name}`, attrs.visible != null ? attrs.visible : true,)
    }
    // UPDATE draw this.layers.draw = draw
    return this.layers[name]
  }
  drawLayers() {
    Object.entries(this.layers).forEach(([_layerKey, l]) => {
      l.draw()
    })
  }
  draw() {
    throw new Error("Abstract method");
  }
}
export abstract class MultiPlot extends Plot {
  layers: Record<string, Layer>
  layersDrawCount: Record<string, number>
  drawCount: number
  constructor({ p5 }) {
    super({ p5 })
    this.layers = {}
    this.layersDrawCount = {}
    this.drawCount = 0
  }
  draw = () => {
    this.drawCount += 1
  }
  addLayer(name: string, draw: () => void, attrs: { visible?: boolean } = { visible: true }) {
    if (!this.layers[name]) {
      this.layersDrawCount[name] = this.drawCount
      let index = Object.keys(this.layers).length 
      let newLayer = new Layer(index, name, draw, attrs)
      this.layers[name] = newLayer
      this.guiParam(`layer_${name}`, attrs.visible != null ? attrs.visible : true,)
    } else {
      if (this.layersDrawCount[name] === this.drawCount) {
        // ADD draw to already drawn
        this.layers[name].draw = () => {
          this.layers[name].draw()
          draw()
        }
      } else {
        this.layersDrawCount[name] = this.drawCount
        this.layers[name].draw = draw
      }
    }
    return this.layers[name]
  }
}