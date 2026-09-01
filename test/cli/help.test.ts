import stringWidth from 'string-width'
import {describe, expect, it} from 'vitest'

import {brandColors, resolveBrandSymbol} from '@/terminal/brand.js'
import {cliTheme} from '@/tui/theme/index.js'

import {setupCliTestEnvironment} from '../commands/support.js'

const {runCli} = setupCliTestEnvironment()

describe.sequential('branded help', () => {
  it('shares the brand colors and symbols with the TUI theme', () => {
    expect(cliTheme.colors.primary).toBe(brandColors.primary)
    expect(cliTheme.colors.accent).toBe(brandColors.accent)
    expect(cliTheme.colors.mutedForeground).toBe(brandColors.mutedForeground)
    expect(resolveBrandSymbol('mark', true)).toBe('◆')
    expect(resolveBrandSymbol('mark', false)).toBe('<>')
    expect(resolveBrandSymbol('breadcrumb', true)).toBe('›')
    expect(resolveBrandSymbol('breadcrumb', false)).toBe('>')
  })

  it('renders command metadata with an ASCII breadcrumb and no ANSI', async () => {
    const {error, stdout} = await runCli(['task', 'run', '--help'])

    expect(error).toBeUndefined()
    expect(stdout).toContain('<> MYCLI > TASK > RUN')
    expect(stdout).toContain('ARGUMENTS')
    expect(stdout).toContain('FLAGS')
    expect(stdout).toContain('DESCRIPTION')
    expect(stdout).toContain('EXAMPLES')
    expect(stdout).toContain('$ mycli task run SCRIPT')
    expect(stdout).not.toContain(String.fromCodePoint(27))
    expect(stdout).not.toMatch(/[›◆]/u)
  })

  it('caps help at the available terminal width', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(process.stdout, 'columns')
    Object.defineProperty(process.stdout, 'columns', {configurable: true, value: 40})

    try {
      const {error, stdout} = await runCli(['task', 'run', '--help'])

      expect(error).toBeUndefined()
      for (const line of stdout.trimEnd().split('\n')) {
        expect(stringWidth(line)).toBeLessThanOrEqual(40)
      }
    } finally {
      if (descriptor) Object.defineProperty(process.stdout, 'columns', descriptor)
      else Reflect.deleteProperty(process.stdout, 'columns')
    }
  })

  it.each([
    ['NO_COLOR', '1'],
    ['NO_UNICODE', '1'],
    ['TERM', 'dumb'],
  ] as const)('uses plain ASCII help when %s is active', async (name, value) => {
    const originalNoColor = process.env.NO_COLOR
    const originalNoUnicode = process.env.NO_UNICODE
    const originalTerm = process.env.TERM
    Reflect.deleteProperty(process.env, 'NO_COLOR')
    Reflect.deleteProperty(process.env, 'NO_UNICODE')
    Reflect.deleteProperty(process.env, 'TERM')
    process.env[name] = value

    try {
      const {error, stdout} = await runCli(['task', 'list', '--help'])

      expect(error).toBeUndefined()
      expect(stdout).toContain('<> MYCLI > TASK > LIST')
      expect(stdout).not.toContain(String.fromCodePoint(27))
      expect(stdout).not.toMatch(/[›◆]/u)
    } finally {
      if (originalNoColor === undefined) Reflect.deleteProperty(process.env, 'NO_COLOR')
      else process.env.NO_COLOR = originalNoColor
      if (originalNoUnicode === undefined) Reflect.deleteProperty(process.env, 'NO_UNICODE')
      else process.env.NO_UNICODE = originalNoUnicode
      if (originalTerm === undefined) Reflect.deleteProperty(process.env, 'TERM')
      else process.env.TERM = originalTerm
    }
  })
})
