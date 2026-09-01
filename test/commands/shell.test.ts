import {describe, expect, it} from 'vitest'

import {setupCliTestEnvironment} from './support.js'

const {runCli} = setupCliTestEnvironment()

describe.sequential('CLI shell', () => {
  it('shows help for the default command when no TTY is available', async () => {
    const {error, stdout} = await runCli([])

    expect(error).toBeUndefined()
    expect(stdout).toContain('USAGE')
    expect(stdout).toContain('mycli')
    expect(stdout).toContain('COMMANDS')
  })

  it('provides global help and version output', async () => {
    const help = await runCli(['--help'])
    const version = await runCli(['--version'])

    expect(help.error).toBeUndefined()
    expect(help.stdout).toContain('USAGE')
    expect(help.stdout).toContain('TOPICS')
    expect(help.stdout).toContain('task')
    expect(help.stdout).not.toMatch(/^\s+base\s*$/mu)
    expect(version.error).toBeUndefined()
    expect(version.stdout).toMatch(/my-cli\/0\.1\.0/u)
  })
})
