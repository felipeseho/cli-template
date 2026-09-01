import {describe, expect, it} from 'vitest'

import {setupCliTestEnvironment} from './support.js'

const {runCli} = setupCliTestEnvironment()

describe.sequential('CLI shell', () => {
  it('shows branded root help when oclif receives no command', async () => {
    const {error, stdout} = await runCli([])

    expect(error).toBeUndefined()
    expect(stdout).toContain('USAGE')
    expect(stdout).toContain('mycli')
    expect(stdout).toContain('COMMANDS')
    expect(stdout).toContain('MYCLI')
    expect(stdout).not.toMatch(/^\s+ui\s/mu)
  })

  it('provides global help and version output', async () => {
    const help = await runCli(['--help'])
    const version = await runCli(['--version'])

    expect(help.error).toBeUndefined()
    expect(help.stdout).toContain('USAGE')
    expect(help.stdout).toContain('TOPICS')
    expect(help.stdout).toContain('task')
    expect(help.stdout).toContain('<> MYCLI')
    expect(help.stdout).not.toMatch(/^\s+base\s*$/mu)
    expect(version.error).toBeUndefined()
    expect(version.stdout).toMatch(/my-cli\/0\.1\.0/u)
  })

  it('uses the branded helper for -h and help command paths', async () => {
    const shortHelp = await runCli(['-h'])
    const topicHelp = await runCli(['task', '--help'])
    const topicHelpCommand = await runCli(['help', 'task'])
    const commandShortHelp = await runCli(['task', 'list', '-h'])
    const commandHelp = await runCli(['help', 'task', 'list'])

    expect(shortHelp.error).toBeUndefined()
    expect(shortHelp.stdout).toContain('<> MYCLI')
    expect(topicHelp.stdout).toContain('<> MYCLI > TASK')
    expect(topicHelpCommand.stdout).toBe(topicHelp.stdout)
    expect(commandShortHelp.stdout).toContain('<> MYCLI > TASK > LIST')
    expect(commandHelp.error).toBeUndefined()
    expect(commandHelp.stdout).toContain('<> MYCLI > TASK > LIST')
    expect(commandHelp.stdout).toContain('--no-interactive')
    expect(commandHelp.stdout).not.toContain('--interactive')
  })

  it('removes the ui command', async () => {
    const {error} = await runCli(['ui'])

    expect(error?.oclif?.exit).toBe(2)
    expect(error?.message).toContain('command ui not found')
  })

  it('uses branded contextual help for parsing errors', async () => {
    const {error, stderr, stdout} = await runCli(['task', 'run', '--definitely-unknown'])

    expect(error?.oclif?.exit).toBe(2)
    expect(stdout).toBe('')
    expect(stderr).toContain('Nonexistent flag: --definitely-unknown')
    expect(stderr).toContain('<> MYCLI > TASK > RUN')
    expect(stderr).toContain('USAGE')
    expect(stderr).toContain('ARGUMENTS')
    expect(stderr).toContain('FLAGS')
  })
})
