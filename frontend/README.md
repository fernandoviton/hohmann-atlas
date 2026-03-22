# Hohmann Atlas — Frontend

Single-page UI for the Hohmann Atlas mission planner. No build tools.

## Architecture

| File | Role |
|------|------|
| `index.html` | DOM, rendering, event wiring, Proxy-based change detection |
| `atlas.js` | Pure state & logic (no DOM). Exported functions mutate state; tested with Node.js |
| `debug.js` | Togglable console logger. Off by default |

## State Management

All state lives in a plain object created by `createState()` (in `atlas.js`). The object is wrapped in a `Proxy` (in `index.html`) whose `set` trap batches changes via `queueMicrotask` and triggers rendering.

**Flow:** state mutation → Proxy `set` trap → microtask queued → `render()` or `renderSelection()` called.

- If only `hoveredIdx` changed → `renderSelection()` (lightweight)
- Otherwise → full `render()` → `renderControls`, `renderOrbits`, `renderArcs`, `renderTable`, `renderSelection`

## Rendering Pipeline

```
render()
  ├─ renderControls()     — mode toggle, dropdowns, date input
  ├─ renderOrbits()       — SVG orbit rings + planet dots
  ├─ renderArcs()         — SVG transfer arc paths + event listeners
  ├─ renderTable()        — HTML table rows (transfer or tour) + wireRowEvents()
  └─ renderSelection()    — .active class on rows/arcs, arc visibility, play button
```

## Debug Logging

Open browser console and run:

```js
window.atlasDebug.enable()   // turn on
window.atlasDebug.disable()  // turn off
```

Log categories: `proxy`, `render`, `selection`, `event`, `fetch`.

## Testing

**Unit tests** (pure state logic):
```bash
cd frontend && node --test atlas.test.js
```

**E2e tests** (Playwright, requires backend):
```bash
cd backend && pytest tests/test_e2e_selection.py -m e2e
```
