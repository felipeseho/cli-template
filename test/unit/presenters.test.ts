import {describe, expect, it} from 'vitest'
import stringWidth from 'string-width'

import type {DiagnosticReport} from '@/features/doctor/types.js'
import type {TaskResult} from '@/features/tasks/types.js'
import type {Workspace} from '@/features/workspace/types.js'
import {presentDiagnosticsHuman} from '@/presenters/human/doctor.js'
import {formatTable} from '@/presenters/human/table.js'
import {presentTaskListHuman, presentTaskResultHuman} from '@/presenters/human/tasks.js'
import {presentDiagnosticsJson} from '@/presenters/json/doctor.js'
import {presentTaskListJson, presentTaskResultJson} from '@/presenters/json/tasks.js'

const workspace: Workspace = {
  name: 'fixture',
  packageJsonPath: '/workspace/package.json',
  path: '/workspace',
  scripts: {build: 'tsc'},
}

const taskResult: TaskResult = {
  durationMs: 10,
  exitCode: 0,
  outputTruncated: false,
  status: 'succeeded',
  stderr: '',
  stdout: '\u001B[31mdone\u001B[39m',
  task: {command: 'tsc', name: 'build'},
  workspacePath: '/workspace',
}

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

describe('human presenters', () => {
  it('renders a task table and empty state', () => {
    expect(presentTaskListHuman(workspace, [{command: 'tsc', name: 'build'}])).toMatch(
      /TASK\s+COMMAND\n-+\s+-+\nbuild\s+tsc/u,
    )
    expect(presentTaskListHuman({...workspace, scripts: {}}, [])).toBe(
      'No npm scripts found in /workspace/package.json.',
    )
  })

  it('renders task summaries and diagnostics with remediation', () => {
    expect(presentTaskResultHuman(taskResult)).toBe('Task "build" completed in 10ms (exit 0).')
    expect(presentDiagnosticsHuman(diagnosticReport)).toContain('1 passed, 1 warning, 0 failed.')
    expect(presentDiagnosticsHuman(diagnosticReport)).toContain('- TTY: Open a terminal.')
  })

  it('aligns wide Unicode cells and removes terminal control sequences', () => {
    const table = formatTable(
      [
        {command: '\u001B[31mbuild\u001B[0m\nnext', name: '编译'},
        {command: 'test', name: 'ok'},
      ],
      [
        {header: 'TASK', value: ({name}) => name},
        {header: 'COMMAND', value: ({command}) => command},
      ],
    )
    const [header, separator, first, second] = table.split('\n')
    const visualColumn = (line: string | undefined, marker: string): number => {
      const index = line?.indexOf(marker) ?? -1
      return index < 0 ? index : stringWidth(line?.slice(0, index) ?? '')
    }
    const commandColumn = visualColumn(header, 'COMMAND')

    expect(commandColumn).toBeGreaterThan(0)
    expect(visualColumn(separator, '-'.repeat(10))).toBe(commandColumn)
    expect(visualColumn(first, 'build next')).toBe(commandColumn)
    expect(visualColumn(second, 'test')).toBe(commandColumn)
    expect(table).not.toContain('\u001B')
    expect(table).not.toContain('\nnext\n')
  })
})

describe('JSON presenters', () => {
  it('emits plain, parseable JSON for every result type', () => {
    const documents = [
      presentTaskListJson(workspace, [{command: 'tsc', name: 'build'}]),
      presentTaskResultJson(taskResult),
      presentDiagnosticsJson(diagnosticReport),
    ]

    for (const document of documents) {
      expect(() => JSON.parse(document) as unknown).not.toThrow()
      expect(document.includes('\u001B[')).toBe(false)
      expect(document.includes('\\u001b')).toBe(false)
    }
  })
})
