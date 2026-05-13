import p5 from 'p5';
import { drawFlatten } from '../../utils';
import { segment, point } from '@flatten-js/core';
import { DisplayMode, PAPER_SIZES, SinglePlot } from '../../components/Plot'
import { Signature } from '../../components/Signature';
import { Margins } from '../../components/Margins';
import { RectContainer } from '../../components/RectContainer';

type SpineConfig = {
  center: { x: number, y: number },
  length: number,
  angle: number,
  n: number, frequency: number,
  heightAbove: number, heightBelow: number,
  offsetC: number, phase: number,
}

export class Plot extends SinglePlot {
  p5: p5
  width: number
  height: number
  signature: Signature
  margins: Margins
  cell: RectContainer
  smallSpines: SpineConfig[]
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

    this.guiParam("centerY", 0.5)

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
      xTracks: `2cm 1 2cm`,
      yTracks: `1cm 2 1 1cm`,
    })

    const region = this.margins.regions[1][1]
    this.cell = new RectContainer(region)

    this.smallSpines = [
      { center: { x: 0.7, y: 0.1 }, length: 0.10, angle: 0.1, n: 30, frequency: 2,   heightAbove: 5, heightBelow: 6, offsetC: 2, phase: 0   },
      { center: { x: 0.3, y: 0.1 }, length: 0.20, angle: -0.15, n: 40, frequency: 2.5,   heightAbove: 6, heightBelow: 8, offsetC: 2, phase: 0   },
      { center: { x: 0.51, y: 0.8 }, length: 0.15, angle: 0.35, n: 50, frequency: 3,  heightAbove: 8, heightBelow: 5,  offsetC: 2, phase: 0.3 },
    ]

    const scaleSignature = 0.05
    this.signature = new Signature({
      x: width * 0.9,
      y: height * 0.9,
      width: height * scaleSignature,
      height: height * scaleSignature,
    }, { p5 })
  }

  buildLine(
    cell: RectContainer,
    n: number,
    frequency: number,
    xA: number, xB: number,
    centerYA: number, centerYB: number,
    heightAbove: number, heightBelow: number, offsetC: number,
    phase = 0, smoothnessAbove = 0, smoothnessBelow = 0,
    startIndex = 0, drawHead = false,
  ) {
    const realCenterYA = cell.toY(centerYA)
    const realCenterYB = cell.toY(centerYB)
    const realXA = cell.toX(xA)
    const realWidth = cell.toX(xB) - realXA
    const spacing = realWidth / n
    return Array.from({ length: n }, (_, i) => {
      if ((drawHead || i >= startIndex) && i > 0) {
        const cx = realXA + spacing * (i + 0.5)
        const realCenterY = realCenterYA + (realCenterYB - realCenterYA) * (i / n)
        const wave = Math.sin(2 * Math.PI * frequency * i / n + phase)
        const other = wave >= 0
          ? realCenterY - heightAbove * wave
          : realCenterY + heightBelow * Math.abs(wave)
        const startY = wave < 0
          ? realCenterY + smoothnessAbove * Math.abs(wave)
          : realCenterY - smoothnessBelow * wave
        const C = point(cx + offsetC, (startY + other) / 2)
        if (drawHead && i < startIndex) {
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
      const headN = this.settings["headN"]
      const line1 = this.buildLine(this.cell, n, frequency,
        0, 1, centerY, centerY,
        this.settings["heightAbove1"], this.settings["heightBelow1"], this.settings["offsetC1"],
        0, smoothnessAbove, smoothnessBelow, headN, false)
      const line2 = this.buildLine(this.cell, n, frequency,
        0, 1, centerY, centerY,
        this.settings["heightAbove2"], this.settings["heightBelow2"], this.settings["offsetC2"],
        this.settings["phase2"], smoothnessAbove, smoothnessBelow, headN, true)
      const smalls = this.smallSpines.flatMap(s => {
        const halfLen = s.length / 2
        const xA = s.center.x - halfLen
        const xB = s.center.x + halfLen
        const yDelta = (s.length * this.cell.width * Math.tan(s.angle)) / 2 / this.cell.height
        return this.buildLine(this.cell, s.n, s.frequency,
          xA, xB, s.center.y - yDelta, s.center.y + yDelta,
          s.heightAbove, s.heightBelow, s.offsetC,
          s.phase, 0, 0, 0, true)
      })
      drawFlatten(this.p5, [...line1, ...line2, ...smalls])
      // this.signature.show()
    }, { visible: true })
    this.drawLayers()
  }
}
