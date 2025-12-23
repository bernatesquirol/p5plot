export * from './math'
export * from './geo'
export * from './flatten'
export * from './matter'

import * as flatten from './flatten'
import * as geo from './geo'
import * as math from './math'
import * as matter from './matter'
const utils = {
  ...flatten,
  ...geo,
  ...math,
  ...matter
}

export default utils