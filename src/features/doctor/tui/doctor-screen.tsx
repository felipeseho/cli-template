import {Box, Text, useInput} from 'ink'

import type {DiagnosticContext, DiagnosticReport} from '@/features/doctor/index.js'
import {resolveStatusSymbol} from '@/lib/terminal-symbols.js'
import {resolveBorderStyle} from '@/lib/terminal-style.js'
import type {ApplicationServices} from '@/runtime/services.js'
import {Panel} from '@/tui/components/app/panel.js'
import {ScreenTitle} from '@/tui/components/app/screen-title.js'
import {Alert} from '@/tui/components/ui/alert.js'
import {StatusMessage} from '@/tui/components/ui/status-message.js'
import {Table, type Column} from '@/tui/components/ui/table.js'
import {useTheme} from '@/tui/hooks/use-theme.js'
import {useUnicode} from '@/tui/hooks/use-unicode.js'

import {useDiagnostics} from './use-diagnostics.js'

export interface DoctorScreenProps {
  readonly context: DiagnosticContext
  readonly inputEnabled: boolean
  readonly onCompleted?: (report: DiagnosticReport) => void
  readonly onError?: (error: unknown) => void
  readonly runDiagnostics: ApplicationServices['runDiagnostics']
  readonly viewportRows: number
  readonly wide: boolean
}

type DiagnosticRow = Record<'check' | 'message' | 'status', string>

interface MetricCardProps {
  readonly color: string
  readonly label: string
  readonly symbol: string
  readonly value: number
}

function MetricCard({color, label, symbol, value}: MetricCardProps) {
  const unicode = useUnicode()

  return (
    <Box
      borderColor={color}
      borderStyle={resolveBorderStyle('round', unicode)}
      flexBasis={0}
      flexGrow={1}
      justifyContent="space-between"
      minWidth={0}
      paddingX={1}
    >
      <Text bold color={color} wrap="truncate-end">
        {symbol} {label}
      </Text>
      <Text bold color={color}>
        {value}
      </Text>
    </Box>
  )
}

export function DoctorScreen({
  context,
  inputEnabled,
  onCompleted,
  onError,
  runDiagnostics,
  viewportRows,
  wide,
}: DoctorScreenProps) {
  const theme = useTheme()
  const unicode = useUnicode()
  const separator = unicode ? '·' : '|'
  const compact = !wide && viewportRows < 30
  const {error, execute, loading, report} = useDiagnostics({
    context,
    onCompleted,
    onError,
    runDiagnostics,
  })

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
      status: `${resolveStatusSymbol(
        unicode,
        check.status === 'pass' ? 'success' : check.status === 'warn' ? 'warning' : 'error',
      )} ${check.status.toLocaleUpperCase()}`,
    })) ?? []
  const columns: Column<DiagnosticRow>[] = [
    {header: 'Status', key: 'status', width: 7},
    {header: 'Verificação', key: 'check', width: wide ? 24 : 18},
    {header: 'Detalhes', key: 'message', width: wide ? 62 : 38},
  ]
  const remediations = report?.checks.filter((check) => check.remediation) ?? []

  return (
    <Box flexDirection="column">
      {!compact || loading || error ? (
        <ScreenTitle
          description={compact ? undefined : 'Node, npm, Git, terminal e integridade do workspace.'}
          title="Doctor"
        />
      ) : null}
      {loading ? (
        <StatusMessage variant="loading">
          {unicode ? 'Executando verificações…' : 'Executando verificações...'}
        </StatusMessage>
      ) : null}
      {!loading && error ? (
        <Alert title="Não foi possível executar o diagnóstico" variant="error">
          {error}
        </Alert>
      ) : null}
      {!loading && report ? (
        <Box flexDirection="column" gap={compact ? 0 : 1}>
          <Box flexShrink={0} gap={1}>
            <MetricCard
              color={theme.colors.success}
              label="PASS"
              symbol={resolveStatusSymbol(unicode, 'success')}
              value={report.summary.pass}
            />
            <MetricCard
              color={theme.colors.warning}
              label="WARN"
              symbol={resolveStatusSymbol(unicode, 'warning')}
              value={report.summary.warn}
            />
            <MetricCard
              color={theme.colors.error}
              label="FAIL"
              symbol={resolveStatusSymbol(unicode, 'error')}
              value={report.summary.fail}
            />
          </Box>
          {compact ? (
            <Box flexShrink={0}>
              <Table
                columns={columns}
                data={rows}
                getRowKey={(row) => row.check}
                maxRows={Math.max(1, viewportRows - 11)}
              />
            </Box>
          ) : (
            <Panel title={`VERIFICAÇÕES · ${report.checks.length}`}>
              <Table columns={columns} data={rows} getRowKey={(row) => row.check} />
            </Panel>
          )}
          {remediations.length > 0 && compact ? (
            <Alert bordered={false} title="Ação recomendada" variant="warning">
              {`${remediations[0]?.label}: ${remediations[0]?.remediation ?? ''}${
                remediations.length > 1 ? ` (+${remediations.length - 1})` : ''
              }`}
            </Alert>
          ) : null}
          {remediations.length > 0 && !compact ? (
            <Alert title="AÇÕES RECOMENDADAS" variant="warning">
              <Box flexDirection="column">
                {remediations.map((check) => (
                  <Text key={check.id} color={theme.colors.foreground}>
                    {unicode ? '•' : '-'} {check.label}: {check.remediation}
                  </Text>
                ))}
              </Box>
            </Alert>
          ) : null}
          <Text color={theme.colors.mutedForeground} dimColor>
            {report.ok ? 'Ambiente pronto' : 'Atenção necessária'} {separator} R repetir diagnóstico
          </Text>
        </Box>
      ) : null}
      {loading || error ? (
        <Text color={theme.colors.mutedForeground} dimColor>
          R repetir diagnóstico
        </Text>
      ) : null}
    </Box>
  )
}
