import { PlotDef } from './core/plot'

export type RegistryEntry = {
  /** shown in the gallery and the plot picker */
  title: string
  /** short line for the gallery */
  note?: string
  /** dynamic import so each plot ships as its own chunk */
  load: () => Promise<{ default: PlotDef }>
}

/**
 * Route -> plot. The key is the URL: `#/rose`, `#/stjordi`, ...
 * Add a plot here and it shows up in the gallery, the picker and the URL bar.
 */
export const PLOTS: Record<string, RegistryEntry> = {
  playground: {
    title: 'Playground',
    note: 'compose plots and pieces on one sheet',
    load: () => import('./plots/playground'),
  },
  piscina: {
    title: 'Piscina',
    note: 'the corner of a pool: three grids, painted tile by tile',
    load: () => import('./plots/260905_piscina'),
  },
  acuarella: {
    title: 'Aquarel·la',
    note: 'watercolour bands: buckets either side, one brush',
    load: () => import('./plots/260905_acuarella'),
  },
  ocell: {
    title: 'Ocell',
    note: 'spine waves, IKEA 4x6',
    load: () => import('./plots/260606_ocell'),
  },
  'circular-bird': {
    title: 'Circular bird',
    note: 'the same ribs, wound round a spiral',
    load: () => import('./plots/260606_ocell/CircularBird'),
  },
  rose: {
    title: 'Rose',
    note: 'single golden-angle chord rose',
    load: () => import('./plots/260420_stjordi/Rose'),
  },
  stjordi: {
    title: 'Sant Jordi',
    note: 'sheet of roses, A3 landscape',
    load: () => import('./plots/260420_stjordi'),
  },
  star: {
    title: 'Star',
    note: 'hatched circles packed in a star',
    load: () => import('./plots/260119_star'),
  },
  'star-multi': {
    title: 'Star sheet',
    note: 'sheet of stars, A3 landscape',
    load: () => import('./plots/260125_star_multi'),
  },
  xmas: {
    title: 'Xmas tree',
    note: 'baubles in a tree, in a snow globe',
    load: () => import('./plots/251222_xmas'),
  },
  'xmas-multi': {
    title: 'Xmas sheet',
    note: 'grid of trees, A3 landscape',
    load: () => import('./plots/251230_xmas_plot'),
  },
  cycles: {
    title: 'Cycles',
    note: 'wheels and cycloids',
    load: () => import('./plots/260225_cycles'),
  },
}

export const routeTitles = (): Record<string, string> =>
  Object.fromEntries(Object.entries(PLOTS).map(([route, e]) => [e.title, route]))
