import {cleanup, render} from 'ink-testing-library'
import {afterEach, describe, expect, it, vi} from 'vitest'

import type {DiagnosticReport} from '@/features/doctor/index.js'
import {App} from '@/tui/app.js'
import {createServices, workspace} from '../../tui/support.js'

afterEach(cleanup)

describe('doctor TUI', () => {
  it('reports every completed interactive diagnostic run', async () => {
    const failedDiagnostics: DiagnosticReport = {
      checks: [
        {
          id: 'node',
          label: 'Node.js',
          message: 'Unsupported runtime.',
          remediation: 'Install Node.js 22 or newer.',
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
