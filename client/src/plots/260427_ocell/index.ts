import p5 from 'p5';
import { drawFlatten } from '../../utils';
import { segment, point } from '@flatten-js/core';
import { DisplayMode, PAPER_SIZES, SinglePlot } from '../../components/Plot'
import { Signature } from '../../components/Signature';
import { Margins } from '../../components/Margins';

export class Plot extends SinglePlot {
  p5: p5
  width: number
  height: number
  signature: Signature
  margins: Margins
  static displayMode = DisplayMode.PRINT;
  static paper = PAPER_SIZES.IKEA_h

  constructor({ p5 }: { p5: p5 }, { height, width, saveSVG }: { height: number, width: number, saveSVG: () => void }) {
    super({ p5 })
    this.p5 = p5
    this.width = width
    this.height = height

    this.guiButton("saveSVG", saveSVG, true)
    this.guiParam("n", 200)
    this.guiParam("frequency", 2.5)

    this.guiParam("centerY", 200)

    this.guiParam("heightAbove1", 52)
    this.guiParam("heightBelow1", 60)
    this.guiParam("offsetC1", 5)

    this.guiParam("heightAbove2", 60)
    this.guiParam("heightBelow2", 52)
    this.guiParam("offsetC2", 9)
    this.guiParam("phase2", 0.2)
    this.guiParam("smoothnessAbove", 10)
    this.guiParam("smoothnessBelow", 10)
    this.guiParam("headN", 5)

    this.margins = new Margins(p5, {
      x: 0, y: 0, width, height,
      xTracks: `1cm 1 1cm`,
      yTracks: `1cm 1 1cm`,
    })

    const scaleSignature = 0.05
    this.signature = new Signature({
      x: width * 0.9,
      y: height * 0.9,
      width: height * scaleSignature,
      height: height * scaleSignature,
    }, { p5 })
  }

  buildLine(n: number, width: number, frequency: number, centerY: number, heightAbove: number, heightBelow: number, offsetC: number, phase = 0, smoothnessAbove = 0, smoothnessBelow = 0, xOffset = 0, startIndex = 0, drawHead=false) {
    const spacing = width / n
    return Array.from({ length: n }, (_, i) => {
      if ((drawHead || i>=startIndex) && i>0){
        
        const cx = xOffset + spacing * (i + 0.5)
        const wave = Math.sin(2 * Math.PI * frequency * i / n + phase)
        const other = wave >= 0
        ? centerY - heightAbove * wave
        : centerY + heightBelow * Math.abs(wave)
        const startY = wave < 0
        ? centerY + smoothnessAbove * Math.abs(wave)
        : centerY - smoothnessBelow * wave
        const C = point(cx + offsetC, (startY + other) / 2)
        // if ((length-i)<5){
        //   return []
        // }
        if (drawHead && i<startIndex){
          return [segment(point(cx, startY), C)]
        }
        return [segment(point(cx, startY), C), segment(C, point(cx, other))]
      }
      return []
    }).flat()
  }

  draw = () => {
    this.p5.fill(255, 255, 255, 0)
    this.addLayer("margins", () => {
      this.margins.draw()
    }, { visible: true })
    this.addLayer("lines", () => {
      const n = this.settings["n"]
      const frequency = this.settings["frequency"]
      const centerY = this.settings["centerY"]
      const smoothnessAbove = this.settings["smoothnessAbove"]
      const smoothnessBelow = this.settings["smoothnessBelow"]
      const cell = this.margins.regions[1][1]
      const headN = this.settings["headN"]
      const line1 = this.buildLine(n, cell.width, frequency,
        centerY, this.settings["heightAbove1"], this.settings["heightBelow1"], this.settings["offsetC1"], 0, smoothnessAbove, smoothnessBelow, cell.x, headN, false)
      const line2 = this.buildLine(n, cell.width, frequency,
        centerY, this.settings["heightAbove2"], this.settings["heightBelow2"], this.settings["offsetC2"], this.settings["phase2"], smoothnessAbove, smoothnessBelow, cell.x, headN, true)
      drawFlatten(this.p5, [...line1, ...line2])
      this.signature.show()
    }, { visible: true })
    this.drawLayers()
  }
}
