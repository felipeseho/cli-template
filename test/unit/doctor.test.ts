import {describe, expect, it} from 'vitest'

import {runDiagnostics} from '@/features/doctor/run-diagnostics.js'
import type {DiagnosticContext, DiagnosticProbe} from '@/features/doctor/types.js'
import type {WorkspaceReader} from '@/features/workspace/types.js'
import {createDoctorChecks} from '@/infrastructure/system/doctor-checks.js'

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
        return Promise.resolve(command === 'npm' ? '11.0.0' : undefined)
      },
      directoryExists() {
        return Promise.resolve(true)
      },
      nodeVersion: '22.14.0',
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
      nodeVersion: '20.0.0',
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
