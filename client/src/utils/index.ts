export * from './math'
export * from './geo'
export * from './flatten'
export * from './matter'
export * from './misc'

import * as flatten from './flatten'
import * as geo from './geo'
import * as math from './math'
import * as matter from './matter'
import * as misc from './misc'
const utils = {
  ...flatten,
  ...geo,
  ...math,
  ...matter,
  ...misc
}

export default utils