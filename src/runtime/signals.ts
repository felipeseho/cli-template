export interface SignalController {
  readonly signal: AbortSignal
  abort(reason?: unknown): void
  dispose(): void
}

export function createSignalController(
  signals: readonly NodeJS.Signals[] = ['SIGINT', 'SIGTERM'],
): SignalController {
  const controller = new AbortController()
  const listeners = new Map<NodeJS.Signals, () => void>()

  for (const signal of signals) {
    const listener = () => controller.abort(new Error(`Received ${signal}`))
    listeners.set(signal, listener)
    process.once(signal, listener)
  }

  return {
    abort: (reason) => controller.abort(reason),
    dispose() {
      for (const [signal, listener] of listeners) {
        process.off(signal, listener)
      }

      listeners.clear()
    },
    signal: controller.signal,
  }
}
