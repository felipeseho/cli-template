import {Box, Text, useInput} from 'ink'
import {useCallback, useEffect, useRef, useState} from 'react'

import type {DiagnosticContext, DiagnosticReport} from '@/features/doctor/types.js'
import {EmptyState} from '@/tui/components/app/empty-state.js'
import {Panel} from '@/tui/components/app/panel.js'
import {ScreenTitle} from '@/tui/components/app/screen-title.js'
import {StatusMessage} from '@/tui/components/ui/status-message.js'
import {Table, type Column} from '@/tui/components/ui/table.js'
import {useTheme} from '@/tui/hooks/use-theme.js'
import {useUnicode} from '@/tui/hooks/use-unicode.js'

export interface DoctorScreenProps {
  readonly context: DiagnosticContext
  readonly inputEnabled: boolean
  readonly onCompleted?: (report: DiagnosticReport) => void
  readonly runDiagnostics: (context: DiagnosticContext) => Promise<DiagnosticReport>
  readonly viewportRows: number
  readonly wide: boolean
}

type DiagnosticRow = Record<'check' | 'message' | 'status', string>

export function DoctorScreen({
  context,
  inputEnabled,
  onCompleted,
  runDiagnostics,
  viewportRows,
  wide,
}: DoctorScreenProps) {
  const theme = useTheme()
  const unicode = useUnicode()
  const separator = unicode ? '·' : '|'
  const compact = !wide && viewportRows < 30
  const [report, setReport] = useState<DiagnosticReport>()
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(true)
  const mounted = useRef(true)
  const running = useRef(false)

  useEffect(() => {
    mounted.current = true

    return () => {
      mounted.current = false
    }
  }, [])

  const execute = useCallback(async () => {
    if (running.current) return

    running.current = true
    setError(undefined)
    setLoading(true)

    try {
      const nextReport = await runDiagnostics(context)
      if (!mounted.current) return

      setReport(nextReport)
      onCompleted?.(nextReport)
    } catch (caught) {
      if (!mounted.current) return

      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      running.current = false
      if (mounted.current) setLoading(false)
    }
  }, [context, onCompleted, runDiagnostics])

  useEffect(() => {
    void execute()
  }, [execute])

  useInput(
    (input, key) => {
      if (!loading && !key.ctrl && input.toLocaleLowerCase() === 'r') {
        void execute()
      }
    },
    {isActive: inputEnabled},
  )

  const rows: DiagnosticRow[] =
    report?.checks.map((check) => ({
      check: check.label,
      message: check.message,
      status: check.status.toLocaleUpperCase(),
    })) ?? []
  const columns: Column<DiagnosticRow>[] = [
    {header: 'Status', key: 'status', width: 7},
    {header: 'Verificação', key: 'check', width: wide ? 24 : 18},
    {header: 'Detalhes', key: 'message', width: wide ? 62 : 38},
  ]
  const remediations = report?.checks.filter((check) => check.remediation) ?? []

  return (
    <Box flexDirection="column">
      <ScreenTitle
        description={compact ? undefined : 'Node, npm, Git, terminal e integridade do workspace.'}
        title="Doctor"
      />
      {loading ? (
        <StatusMessage variant="loading">
          {unicode ? 'Executando verificações…' : 'Executando verificações...'}
        </StatusMessage>
      ) : null}
      {!loading && error ? (
        <EmptyState detail={error} title="Não foi possível executar o diagnóstico" />
      ) : null}
      {!loading && report ? (
        <Box flexDirection="column" gap={compact ? 0 : 1}>
          <StatusMessage variant={report.ok ? 'success' : 'error'}>
            {report.summary.pass} ok {separator} {report.summary.warn} avisos {separator}{' '}
            {report.summary.fail} falhas
          </StatusMessage>
          <Panel title="Resultado">
            <Table columns={columns} data={rows} getRowKey={(row) => row.check} />
          </Panel>
          {remediations.length > 0 && compact ? (
            <Text color={theme.colors.warning} wrap="truncate-end">
              {unicode ? '•' : '-'} {remediations[0]?.label}: {remediations[0]?.remediation}
              {remediations.length > 1 ? ` (+${remediations.length - 1})` : ''}
            </Text>
          ) : null}
          {remediations.length > 0 && !compact ? (
            <Panel title="Recomendações">
              {remediations.map((check) => (
                <Text key={check.id} color={theme.colors.warning}>
                  {unicode ? '•' : '-'} {check.label}: {check.remediation}
                </Text>
              ))}
            </Panel>
          ) : null}
        </Box>
      ) : null}
      <Text color={theme.colors.mutedForeground} dimColor>
        R repetir diagnóstico
      </Text>
    </Box>
  )
}
