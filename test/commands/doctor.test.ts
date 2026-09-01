import {describe, expect, it} from 'vitest'

import {expectThrownError, type JsonRecord, parseJson, setupCliTestEnvironment} from './support.js'

const {createWorkspace, runCli} = setupCliTestEnvironment()

describe.sequential('doctor command', () => {
  it('returns a JSON doctor report with deterministic structure', async () => {
    const workspace = await createWorkspace({test: 'vitest run'})
    process.chdir(workspace)

    const {error, stdout} = await runCli(['doctor', '--json'])
    const payload = parseJson(stdout)
    const checks = payload.checks as JsonRecord[]

    expect(error).toBeUndefined()
    expect(payload.ok).toBe(true)
    expect(payload.summary).toEqual({fail: 0, pass: 5, warn: 1})
    expect(checks.map(({id}) => id)).toEqual([
      'node',
      'npm',
      'git',
      'tty',
      'workspace',
      'package-json',
    ])
    expect(checks.find(({id}) => id === 'tty')).toMatchObject({status: 'warn'})
  })

  it('rejects --interactive when stdin and stdout are not TTYs', async () => {
    const workspace = await createWorkspace({test: 'vitest run'})
    process.chdir(workspace)

    const {error} = await runCli(['doctor', '--interactive'])

    expectThrownError(error, 2, '--interactive requires stdin and stdout')
  })
})
