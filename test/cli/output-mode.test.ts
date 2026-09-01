import {describe, expect, it} from 'vitest'

import {resolveOutputMode} from '@/cli/base-command.js'

describe('adaptive output mode', () => {
  it.each([
    {expected: 'tui', interactiveTerminal: true, json: false, noInteractive: false},
    {expected: 'text', interactiveTerminal: true, json: false, noInteractive: true},
    {expected: 'json', interactiveTerminal: true, json: true, noInteractive: false},
    {expected: 'json', interactiveTerminal: true, json: true, noInteractive: true},
    {expected: 'text', interactiveTerminal: false, json: false, noInteractive: false},
    {expected: 'text', interactiveTerminal: false, json: false, noInteractive: true},
    {expected: 'json', interactiveTerminal: false, json: true, noInteractive: false},
    {expected: 'json', interactiveTerminal: false, json: true, noInteractive: true},
  ] as const)(
    'selects $expected with tty=$interactiveTerminal json=$json noInteractive=$noInteractive',
    ({expected, ...options}) => {
      expect(resolveOutputMode(options)).toBe(expected)
    },
  )
})
