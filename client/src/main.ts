import './style.css'
import { Sketch } from './core/sketch'
import { currentRoute, onRouteChange } from './core/router'
import { PLOTS, routeTitles } from './registry'
import { renderGallery } from './gallery'

const app = document.getElementById('app')!
const stage = document.createElement('div')
stage.id = 'stage'
const gallery = document.createElement('div')
gallery.id = 'gallery'
app.append(stage, gallery)

let sketch: Sketch | undefined
let loading = ''

onRouteChange(async route => {
  const entry = PLOTS[route]
  if (!entry) {
    document.title = 'plots'
    stage.style.display = 'none'
    gallery.style.display = ''
    sketch?.hide()
    renderGallery(gallery)
    return
  }

  document.title = entry.title
  gallery.style.display = 'none'
  stage.style.display = ''

  loading = route
  const mod = await entry.load()
  // A fast click through the picker can resolve imports out of order.
  if (loading !== route || currentRoute() !== route) return

  sketch ??= new Sketch(stage, { routes: routeTitles() })
  sketch.show()
  sketch.load(route, mod.default)
})
