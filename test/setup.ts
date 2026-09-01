process.env.CI = 'true'
process.env.NO_COLOR = '1'
process.env.NO_MOTION = '1'
process.env.NO_UNICODE = '1'
Reflect.deleteProperty(process.env, 'FORCE_COLOR')

// Ink falls back to the parent terminal when a test stream omits one of the
// dimensions. Keep the baseline viewport independent from the developer's
// actual terminal; individual TUI tests can still emit resize events.
Object.defineProperties(process.stdout, {
  columns: {configurable: true, value: 100},
  rows: {configurable: true, value: 24},
})
