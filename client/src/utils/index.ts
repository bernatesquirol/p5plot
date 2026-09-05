export * from './math'
export * from './geo'
export * from './flatten'
export * from './matter'
export * from './misc'
export * from './p5'
export * from './polyline'
export * from './wash'

import * as flatten from './flatten'
import * as geo from './geo'
import * as math from './math'
import * as matter from './matter'
import * as misc from './misc'
import * as p5 from './p5'
import * as polyline from './polyline'
import * as wash from './wash'
const utils = {
  ...flatten,
  ...geo,
  ...math,
  ...matter,
  ...misc,
  ...p5,
  ...polyline,
  ...wash,
}

export default utils