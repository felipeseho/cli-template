import {cleanup, render} from 'ink-testing-library'
import stringWidth from 'string-width'
import {afterEach, describe, expect, it, vi} from 'vitest'

import type {DiagnosticReport} from '@/features/doctor/index.js'
import {App} from '@/tui/app.js'
import {createServices, resizeTui, workspace} from '../../tui/support.js'

afterEach(cleanup)

describe('doctor TUI', () => {
  it('presents pass, warn and fail metrics with remediation alerts', async () => {
    const report: DiagnosticReport = {
      checks: [
        {id: 'node', label: 'Node.js', message: 'Supported.', status: 'pass'},
        {
          id: 'git',
          label: 'Git',
          message: 'Not found.',
          remediation: 'Install Git and reopen the terminal.',
          status: 'warn',
        },
        {
          id: 'workspace',
          label: 'Workspace',
          message: 'Invalid package.',
          remediation: 'Repair package.json.',
          status: 'fail',
        },
        {id: 'npm', label: 'npm', message: 'Available.', status: 'pass'},
        {id: 'terminal', label: 'Terminal', message: 'Interactive.', status: 'pass'},
        {id: 'package', label: 'package.json', message: 'Valid.', status: 'pass'},
      ],
      ok: false,
      summary: {fail: 1, pass: 4, warn: 1},
    }
    const instance = render(
      <App
        cwd={workspace.path}
        initialRoute="doctor"
        services={createServices({runDiagnostics: () => Promise.resolve(report)})}
        stdinIsTTY
        stdoutIsTTY
      />,
    )

    resizeTui(instance, {columns: 120, rows: 40})
    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('PASS')
      expect(instance.lastFrame()).toContain('WARN')
      expect(instance.lastFrame()).toContain('FAIL')
      expect(instance.lastFrame()).toContain('AÇÕES RECOMENDADAS')
      expect(instance.lastFrame()).toContain('Install Git and reopen the terminal.')
      expect(instance.lastFrame()).toContain('Repair package.json.')
    })

    resizeTui(instance, {columns: 80, rows: 24})
    await vi.waitFor(() => {
      const frame = instance.lastFrame() ?? ''
      const lines = frame.split('\n')
      expect(lines).toHaveLength(24)
      expect(Math.max(...lines.map((line) => stringWidth(line)))).toBeLessThanOrEqual(80)
      expect(frame).toContain('rows 1-4 of 6')
      expect(frame).toContain('Git: Install Git and reopen the terminal.')
    })

    instance.unmount()
  })

  it('reports every completed interactive diagnostic run', async () => {
    const failedDiagnostics: DiagnosticReport = {
      checks: [
        {
          id: 'node',
          label: 'Node.js',
          message: 'Unsupported runtime.',
          remediation: 'Install Node.js 24.15 or newer.',
          status: 'fail',
        },
      ],
      ok: false,
      summary: {fail: 1, pass: 0, warn: 0},
    }
    const onDiagnosticsCompleted = vi.fn()
    const runDiagnostics = vi.fn(() => Promise.resolve(failedDiagnostics))
    const instance = render(
      <App
        cwd={workspace.path}
        initialRoute="doctor"
        onDiagnosticsCompleted={onDiagnosticsCompleted}
        services={createServices({runDiagnostics})}
        stdinIsTTY
        stdoutIsTTY
      />,
    )

    await vi.waitFor(() => {
      expect(onDiagnosticsCompleted).toHaveBeenCalledTimes(1)
      expect(onDiagnosticsCompleted).toHaveBeenLastCalledWith(failedDiagnostics)
    })

    instance.stdin.write('r')
    await vi.waitFor(() => {
      expect(runDiagnostics).toHaveBeenCalledTimes(2)
      expect(onDiagnosticsCompleted).toHaveBeenCalledTimes(2)
      expect(onDiagnosticsCompleted).toHaveBeenLastCalledWith(failedDiagnostics)
    })

    instance.unmount()
  })
})
