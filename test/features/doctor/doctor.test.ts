import {describe, expect, it} from 'vitest'

import {createDoctorChecks} from '@/features/doctor/adapters/doctor-checks.js'
import {
  type DiagnosticContext,
  type DiagnosticProbe,
  runDiagnostics,
} from '@/features/doctor/index.js'
import type {WorkspaceReader} from '@/features/workspace/index.js'

const context: DiagnosticContext = {
  cwd: '/workspace',
  stdinIsTTY: false,
  stdoutIsTTY: false,
}

describe('runDiagnostics', () => {
  it('aggregates statuses and marks reports with failures as not ok', async () => {
    const statuses = ['pass', 'warn', 'fail'] as const
    const probes: DiagnosticProbe[] = statuses.map((status) => ({
      run() {
        return Promise.resolve({id: status, label: status, message: status, status})
      },
    }))

    const report = await runDiagnostics({probes}, context)

    expect(report.summary).toEqual({fail: 1, pass: 1, warn: 1})
    expect(report.ok).toBe(false)
    expect(report.checks.map(({id}) => id)).toEqual(statuses)
  })
})

describe('createDoctorChecks', () => {
  it('checks Node, npm, Git, TTY, workspace, and package.json', async () => {
    const workspaceReader: WorkspaceReader = {
      read() {
        return Promise.resolve({
          name: 'fixture',
          packageJsonPath: '/workspace/package.json',
          path: '/workspace',
          scripts: {test: 'vitest'},
        })
      },
    }
    const probes = createDoctorChecks({
      commandVersion(command) {
        return Promise.resolve(command === 'npm' ? '12.0.2' : undefined)
      },
      directoryExists() {
        return Promise.resolve(true)
      },
      nodeVersion: '24.15.0',
      workspaceReader,
    })

    const report = await runDiagnostics({probes}, context)

    expect(report.checks.map(({id}) => id)).toEqual([
      'node',
      'npm',
      'git',
      'tty',
      'workspace',
      'package-json',
    ])
    expect(report.summary).toEqual({fail: 0, pass: 4, warn: 2})
    expect(report.ok).toBe(true)
  })

  it('fails unsupported Node, inaccessible workspaces, and invalid package.json', async () => {
    const probes = createDoctorChecks({
      commandVersion() {
        return Promise.resolve(undefined)
      },
      directoryExists() {
        return Promise.resolve(false)
      },
      nodeVersion: '24.14.0',
      workspaceReader: {
        read() {
          return Promise.reject(new Error('broken package'))
        },
      },
    })

    const report = await runDiagnostics({probes}, {...context, stdinIsTTY: true, stdoutIsTTY: true})

    expect(report.summary).toEqual({fail: 4, pass: 1, warn: 1})
    expect(report.ok).toBe(false)
    expect(report.checks.find(({id}) => id === 'package-json')).toMatchObject({
      message: 'broken package',
      status: 'fail',
    })
  })
})
