import {render} from 'ink'

import {App, type AppProps} from '@/tui/app.js'

import {InteractiveTerminalRequiredError, isInteractiveTerminal} from './tty.js'

export interface RenderTuiOptions extends Omit<AppProps, 'onExit' | 'stdinIsTTY' | 'stdoutIsTTY'> {
  readonly alternateScreen?: boolean
  readonly stderr?: NodeJS.WriteStream
  readonly stdin?: NodeJS.ReadStream
  readonly stdout?: NodeJS.WriteStream
}

/**
 * Owns Ink's lifecycle. Keeping this boundary outside oclif guarantees that
 * commands and screens can share the same use cases without calling each other.
 */
export async function renderTui({
  alternateScreen = true,
  stderr = process.stderr,
  stdin = process.stdin,
  stdout = process.stdout,
  ...appProps
}: RenderTuiOptions): Promise<number> {
  if (!isInteractiveTerminal({stdin, stdout})) {
    throw new InteractiveTerminalRequiredError()
  }

  const instance = render(
    <App {...appProps} stdinIsTTY={stdin.isTTY === true} stdoutIsTTY={stdout.isTTY === true} />,
    {
      alternateScreen,
      exitOnCtrlC: false,
      interactive: true,
      patchConsole: true,
      stderr,
      stdin,
      stdout,
    },
  )

  try {
    const result = await instance.waitUntilExit()
    return typeof result === 'number' ? result : 0
  } finally {
    // cleanup() also removes Ink's stream-scoped instance. Ink itself restores
    // raw mode, cursor state and the primary screen during this teardown.
    instance.cleanup()
  }
}
