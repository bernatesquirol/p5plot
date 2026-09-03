/**
 * Hash routing: `#/rose`. No server config needed, so it behaves identically
 * on `vite dev`, `vite preview` and a GitHub Pages project subpath.
 */
export const HOME = ''

export function currentRoute(): string {
  return decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('?')[0].replace(/\/$/, '')
}

export function go(route: string) {
  const next = route ? `#/${route}` : '#/'
  if (location.hash !== next) location.hash = next
}

export function onRouteChange(cb: (route: string) => void) {
  window.addEventListener('hashchange', () => cb(currentRoute()))
  cb(currentRoute())
}
