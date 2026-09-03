import { PLOTS } from './registry'

/** The `#/` landing page: every plot as a deep link. */
export function renderGallery(host: HTMLElement) {
  host.innerHTML = `
    <div class="gallery">
      <h1>plots</h1>
      <ul>
        ${Object.entries(PLOTS).map(([route, e]) => `
          <li>
            <a href="#/${route}">
              <span class="title">${e.title}</span>
              <code>#/${route}</code>
              ${e.note ? `<span class="note">${e.note}</span>` : ''}
            </a>
          </li>`).join('')}
      </ul>
      <p class="hint"><kbd>s</kbd> export SVG · <kbd>h</kbd> hide panel · <kbd>r</kbd> reroll seed</p>
    </div>`
}
