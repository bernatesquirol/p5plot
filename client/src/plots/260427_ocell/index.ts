import p5 from 'p5';
import { drawFlatten } from '../../utils';
import { segment, point } from '@flatten-js/core';
import { DisplayMode, PAPER_SIZES, SinglePlot } from '../../components/Plot'
import { Signature } from '../../components/Signature';

export class Plot extends SinglePlot {
  p5: p5
  width: number
  height: number
  signature: Signature
  static displayMode = DisplayMode.PRINT;
  static paper = PAPER_SIZES.IKEA_h

  constructor({ p5 }: { p5: p5 }, { height, width, saveSVG }: { height: number, width: number, saveSVG: () => void }) {
    super({ p5 })
    this.p5 = p5
    this.width = width
    this.height = height

    this.guiButton("saveSVG", saveSVG, true)
    this.guiParam("n", 120)
    this.guiParam("frequency", 3)

    this.guiParam("centerY", height * 0.5)

    this.guiParam("heightAbove1", height * 0.13)
    this.guiParam("heightBelow1", height * 0.15)
    this.guiParam("offsetC1", 5)

    this.guiParam("heightAbove2", height * 0.15)
    this.guiParam("heightBelow2", height * 0.13)
    this.guiParam("offsetC2", 5)
    this.guiParam("phase2", 0.2)

    const scaleSignature = 0.05
    this.signature = new Signature({
      x: width * 0.9,
      y: height * 0.9,
      width: height * scaleSignature,
      height: height * scaleSignature,
    }, { p5 })
  }

  buildLine(n: number, width: number, frequency: number, centerY: number, heightAbove: number, heightBelow: number, offsetC: number, phase = 0) {
    const spacing = width / n
    return Array.from({ length: n }, (_, i) => {
      const cx = spacing * (i + 0.5)
      const wave = Math.sin(2 * Math.PI * frequency * i / n + phase)
      const other = wave >= 0
        ? centerY - heightAbove * wave
        : centerY + heightBelow * Math.abs(wave)
      const C = point(cx + offsetC, (centerY + other) / 2)
      return [segment(point(cx, centerY), C), segment(C, point(cx, other))]
    }).flat()
  }

  draw = () => {
    this.p5.fill(255, 255, 255, 0)
    this.addLayer("lines", () => {
      const n = this.settings["n"]
      const frequency = this.settings["frequency"]
      const centerY = this.settings["centerY"]
      const line1 = this.buildLine(n, this.width, frequency,
        centerY, this.settings["heightAbove1"], this.settings["heightBelow1"], this.settings["offsetC1"])
      const line2 = this.buildLine(n, this.width, frequency,
        centerY, this.settings["heightAbove2"], this.settings["heightBelow2"], this.settings["offsetC2"], this.settings["phase2"])
      drawFlatten(this.p5, [...line1, ...line2])
      this.signature.show()
    }, { visible: true })
    this.drawLayers()
  }
}
