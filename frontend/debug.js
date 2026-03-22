// Togglable debug logger for Hohmann Atlas
// Off by default. Enable from browser console: window.atlasDebug.enable()

let enabled = false;

export function log(category, ...args) {
  if (enabled) console.debug(`[atlas:${category}]`, ...args);
}

window.atlasDebug = {
  enable()  { enabled = true;  console.debug('[atlas] debug logging enabled'); },
  disable() { enabled = false; console.debug('[atlas] debug logging disabled'); },
};
