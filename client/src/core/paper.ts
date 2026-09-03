/**
 * Paper geometry. Every plot draws in "paper pixels": 1 unit = 1/DPI inch.
 * Screen display only ever applies a view transform on top (see Sketch),
 * so the same geometry is valid for both the screen and the exported SVG.
 */
export const DPI = 100
const MM_PER_INCH = 25.4

/** Sheet sizes in mm, always stored portrait (w < h). */
export const SHEETS_MM = {
  IKEA: [101.6, 152.4], // 4x6 in
  A6: [105, 148],
  A5: [148, 210],
  A4: [210, 297],
  A3: [297, 420],
  A2: [420, 594],
  A1: [594, 841],
  SQUARE: [200, 200],
  /** placeholder: the real size comes from the custom w/h params */
  CUSTOM: [100, 150],
} as const

export type SheetName = keyof typeof SHEETS_MM
export const SHEET_NAMES = Object.keys(SHEETS_MM) as SheetName[]

export type Orientation = 'portrait' | 'landscape'
export const ORIENTATIONS: Orientation[] = ['portrait', 'landscape']

export type Paper = {
  sheet: SheetName | 'screen'
  orientation: Orientation
  /** width in paper pixels */
  w: number
  /** height in paper pixels */
  h: number
  wMm: number
  hMm: number
}

export const mmToPx = (v: number) => (v / MM_PER_INCH) * DPI
export const pxToMm = (v: number) => (v / DPI) * MM_PER_INCH
/** cm in paper pixels — handy inside track specs and offsets. */
export const cm = (v: number) => mmToPx(v * 10)
export const mm = mmToPx
export const inch = (v: number) => v * DPI

/**
 * A sheet in paper pixels. `custom` is only read for the CUSTOM sheet, whose
 * width and height are taken as given — orientation would only scramble them.
 */
export function makePaper(sheet: SheetName, orientation: Orientation = 'portrait', custom?: [number, number]): Paper {
  if (sheet === 'CUSTOM') {
    const [wMm, hMm] = custom ?? SHEETS_MM.CUSTOM
    return { sheet, orientation: wMm >= hMm ? 'landscape' : 'portrait', wMm, hMm, w: mmToPx(wMm), h: mmToPx(hMm) }
  }
  const [pw, ph] = SHEETS_MM[sheet]
  const [wMm, hMm] = orientation === 'portrait' ? [pw, ph] : [ph, pw]
  return { sheet, orientation, wMm, hMm, w: mmToPx(wMm), h: mmToPx(hMm) }
}

/** A "paper" that is just the current viewport, for responsive sketches. */
export function screenPaper(w: number, h: number): Paper {
  return {
    sheet: 'screen',
    orientation: w >= h ? 'landscape' : 'portrait',
    w, h,
    wMm: pxToMm(w),
    hMm: pxToMm(h),
  }
}

export const describePaper = (p: Paper) =>
  p.sheet === 'screen'
    ? `screen ${Math.round(p.w)}x${Math.round(p.h)}px`
    : p.sheet === 'CUSTOM'
      ? `custom — ${round1(p.wMm)}x${round1(p.hMm)}mm`
      : `${p.sheet} ${p.orientation} — ${Math.round(p.wMm)}x${Math.round(p.hMm)}mm`

const round1 = (v: number) => Math.round(v * 10) / 10
