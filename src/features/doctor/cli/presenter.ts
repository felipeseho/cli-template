import {formatTable} from '@/cli/table.js'
import {sanitizeTerminalText} from '@/cli/text.js'

import type {DiagnosticReport} from '../core/types.js'

export function presentDiagnosticsHuman(report: DiagnosticReport): string {
  const table = formatTable(report.checks, [
    {header: 'STATUS', value: ({status}) => status.toUpperCase()},
    {header: 'CHECK', value: ({label}) => label},
    {header: 'DETAIL', value: ({message}) => message},
  ])
  const remediations = report.checks
    .filter((check) => check.remediation)
    .map(
      (check) =>
        `- ${sanitizeTerminalText(check.label)}: ${sanitizeTerminalText(check.remediation ?? '')}`,
    )
  const warningLabel = report.summary.warn === 1 ? 'warning' : 'warnings'
  const summary = `${report.summary.pass} passed, ${report.summary.warn} ${warningLabel}, ${report.summary.fail} failed.`

  return [
    table,
    '',
    summary,
    ...(remediations.length > 0 ? ['', 'Suggested fixes:', ...remediations] : []),
  ].join('\n')
}
