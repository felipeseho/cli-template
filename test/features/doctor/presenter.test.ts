import {describe, expect, it} from 'vitest'

import {presentDiagnosticsHuman} from '@/features/doctor/cli/presenter.js'
import type {DiagnosticReport} from '@/features/doctor/index.js'

const diagnosticReport: DiagnosticReport = {
  checks: [
    {id: 'node', label: 'Node.js', message: 'Node.js is supported.', status: 'pass'},
    {
      id: 'tty',
      label: 'TTY',
      message: 'Not interactive.',
      remediation: 'Open a terminal.',
      status: 'warn',
    },
  ],
  ok: true,
  summary: {fail: 0, pass: 1, warn: 1},
}

describe('doctor CLI presentation', () => {
  it('renders the summary and remediation without terminal controls', () => {
    const output = presentDiagnosticsHuman(diagnosticReport)

    expect(output).toContain('1 passed, 1 warning, 0 failed.')
    expect(output).toContain('- TTY: Open a terminal.')
    expect(output).not.toContain('\u001B')
  })
})
