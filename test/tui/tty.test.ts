import {describe, expect, it} from 'vitest'

import {InteractiveTerminalRequiredError, isInteractiveTerminal} from '@/runtime/tty.js'

describe('terminal detection', () => {
  it('requires both stdin and stdout to be TTYs', () => {
    expect(
      isInteractiveTerminal({
        stdin: {isTTY: true},
        stdout: {isTTY: true},
      }),
    ).toBe(true)

    expect(
      isInteractiveTerminal({
        stdin: {isTTY: true},
        stdout: {isTTY: false},
      }),
    ).toBe(false)
  })

  it('exposes the conventional usage exit code', () => {
    expect(new InteractiveTerminalRequiredError().exitCode).toBe(2)
  })
})
