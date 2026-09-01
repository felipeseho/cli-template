import {Box, Text, useInput, useStdout} from 'ink'
import {useEffect, useRef} from 'react'

import type {Task, TaskResult, TaskStatus} from '@/features/tasks/index.js'
import type {Workspace} from '@/features/workspace/index.js'
import type {ApplicationServices} from '@/runtime/services.js'
import {LogPanel} from '@/tui/components/app/log-panel.js'
import {Panel} from '@/tui/components/app/panel.js'
import {ScreenTitle} from '@/tui/components/app/screen-title.js'
import {Alert} from '@/tui/components/ui/alert.js'
import {Dialog} from '@/tui/components/ui/dialog.js'
import {ProgressBar} from '@/tui/components/ui/progress-bar.js'
import {Select} from '@/tui/components/ui/select.js'
import {Spinner} from '@/tui/components/ui/spinner.js'
import {useTheme} from '@/tui/hooks/use-theme.js'
import {useUnicode} from '@/tui/hooks/use-unicode.js'
import type {ScreenRoute} from '@/tui/routes.js'

import {type TaskActivity, type TaskRunPhase, useTaskRun} from './use-task-run.js'

export interface TaskRunScreenProps {
  readonly error?: string
  readonly initialTask?: string
  readonly inputEnabled: boolean
  readonly loading: boolean
  readonly navigate: (route: ScreenRoute) => void
  readonly onActivityChange: (activity: TaskActivity) => void
  readonly onCompleted: (result: TaskResult) => void
  readonly onDialogOpenChange?: (isOpen: boolean) => void
  readonly runTask: ApplicationServices['runTask']
  readonly tasks: readonly Task[]
  readonly viewportRows: number
  readonly workspace?: Workspace
}

interface PhaseTrailProps {
  readonly phase: Extract<TaskRunPhase, 'confirm' | 'failed' | 'finished' | 'running'>
  readonly resultStatus?: TaskStatus
}

const formatElapsed = (milliseconds: number): string => `${(milliseconds / 1000).toFixed(1)}s`

const resultStatusLabel: Record<TaskStatus, string> = {
  cancelled: 'cancelada',
  failed: 'falhou',
  succeeded: 'sucesso',
}

function PhaseTrail({phase, resultStatus}: PhaseTrailProps) {
  const theme = useTheme()
  const unicode = useUnicode()
  const complete = unicode ? '✓' : '[x]'
  const active = unicode ? '◉' : '[>]'
  const pending = unicode ? '○' : '[ ]'
  const failed = unicode ? '✕' : '[!]'
  const cancelled = unicode ? '⚠' : '[!]'
  const link = unicode ? ' ━ ' : ' - '
  const outcome = phase === 'failed' ? 'failed' : phase === 'finished' ? resultStatus : undefined
  const outcomeSymbol =
    outcome === 'failed' ? failed : outcome === 'cancelled' ? cancelled : complete
  const outcomeColor =
    outcome === 'failed'
      ? theme.colors.error
      : outcome === 'cancelled'
        ? theme.colors.warning
        : theme.colors.success
  const executionSymbol =
    phase === 'confirm'
      ? pending
      : phase === 'running'
        ? active
        : phase === 'failed' || phase === 'finished'
          ? outcomeSymbol
          : complete

  return (
    <Text wrap="truncate-end">
      <Text color={theme.colors.success}>{complete} Selecionar</Text>
      <Text color={theme.colors.mutedForeground}>{link}</Text>
      <Text color={phase === 'confirm' ? theme.colors.primary : theme.colors.success}>
        {phase === 'confirm' ? active : complete} Confirmar
      </Text>
      <Text color={theme.colors.mutedForeground}>{link}</Text>
      <Text
        color={
          phase === 'running'
            ? theme.colors.primary
            : phase === 'failed' || phase === 'finished'
              ? outcomeColor
              : theme.colors.mutedForeground
        }
      >
        {executionSymbol} Executar
      </Text>
      <Text color={theme.colors.mutedForeground}>{link}</Text>
      <Text
        color={
          phase === 'finished' || phase === 'failed' ? outcomeColor : theme.colors.mutedForeground
        }
      >
        {phase === 'finished' || phase === 'failed' ? outcomeSymbol : pending} Concluir
      </Text>
    </Text>
  )
}

function resultPresentation(result: TaskResult): {
  readonly title: string
  readonly variant: 'error' | 'success' | 'warning'
} {
  switch (result.status) {
    case 'succeeded': {
      return {title: 'Tarefa concluída', variant: 'success'}
    }
    case 'cancelled': {
      return {title: 'Tarefa cancelada', variant: 'warning'}
    }
    case 'failed': {
      return {title: 'Tarefa concluída com falha', variant: 'error'}
    }
  }
}

export function TaskRunScreen({
  error: workspaceError,
  initialTask,
  inputEnabled,
  loading,
  navigate,
  onActivityChange,
  onCompleted,
  onDialogOpenChange,
  runTask,
  tasks,
  viewportRows,
  workspace,
}: TaskRunScreenProps) {
  const theme = useTheme()
  const unicode = useUnicode()
  const {stdout} = useStdout()
  const columns = stdout.columns ?? 80
  const compact = columns < 90 || viewportRows < 19
  const ultraCompact = viewportRows < 12
  const wide = columns >= 110 && viewportRows >= 21
  const separator = unicode ? '·' : '|'
  const {
    cancelling,
    elapsedMs,
    logs,
    phase,
    result,
    retry,
    run,
    runError,
    selectedTask,
    selectTask,
  } = useTaskRun({initialTask, onActivityChange, onCompleted, runTask, workspace})
  const selected = tasks.find((task) => task.name === selectedTask)
  const dialogOpen = phase === 'confirm' && selected !== undefined
  const dialogOpenRef = useRef(dialogOpen)
  const dialogCallbackRef = useRef(onDialogOpenChange)
  dialogOpenRef.current = dialogOpen
  dialogCallbackRef.current = onDialogOpenChange
  const progressWidth = Math.max(
    12,
    Math.min(64, wide ? Math.floor((columns - 10) * 0.6) - 18 : columns - 25),
  )
  const runningLogHeight = compact
    ? Math.max(1, Math.min(2, viewportRows - (ultraCompact ? 8 : 12)))
    : Math.max(3, Math.min(9, viewportRows - 20))
  const resultLogHeight = compact ? 1 : Math.max(3, Math.min(7, viewportRows - 19))

  useEffect(() => {
    onDialogOpenChange?.(dialogOpen)
  }, [dialogOpen, onDialogOpenChange])

  useEffect(
    () => () => {
      if (dialogOpenRef.current) {
        dialogCallbackRef.current?.(false)
      }
    },
    [],
  )

  useInput(
    (input, key) => {
      if (key.ctrl) {
        return
      }

      if ((phase === 'failed' || phase === 'finished') && input.toLocaleLowerCase() === 'r') {
        retry()
        return
      }

      if ((phase === 'failed' || phase === 'finished') && input.toLocaleLowerCase() === 'b') {
        navigate({screen: 'task-list'})
      }
    },
    {isActive: inputEnabled},
  )

  if (loading) {
    return (
      <Box flexDirection="column">
        <ScreenTitle title="Executar tarefa" />
        <Alert bordered={false} title={unicode ? 'Lendo o workspace…' : 'Lendo o workspace...'} />
      </Box>
    )
  }

  if (!workspace) {
    return (
      <Box flexDirection="column">
        <ScreenTitle title="Executar tarefa" />
        <Alert title="Nenhum workspace disponível" variant="error">
          {workspaceError ?? 'Abra a CLI dentro de um projeto Node.js.'}
        </Alert>
      </Box>
    )
  }

  if (tasks.length === 0) {
    return (
      <Box flexDirection="column">
        <ScreenTitle title="Executar tarefa" />
        <Alert title="Não há scripts para executar" variant="warning">
          Crie uma entrada em package.json#scripts e abra esta tela novamente.
        </Alert>
      </Box>
    )
  }

  const selection = (
    <Select
      aria-label="Selecione uma tarefa"
      autoFocus
      isActive={inputEnabled}
      label="Escolha um script"
      maxVisibleOptions={Math.max(3, Math.min(8, viewportRows - 7))}
      onSubmit={selectTask}
      options={tasks.map((task) => ({
        hint: task.command,
        label: task.name,
        value: task.name,
      }))}
      value={selectedTask || undefined}
    />
  )

  if (selected && phase === 'confirm') {
    return (
      <Box alignItems="center" flexGrow={1} justifyContent="center">
        <Dialog
          cancelLabel="Cancelar"
          confirmLabel="Executar"
          defaultAction="confirm"
          description={`Executar “${selected.name}” neste workspace?`}
          isActive={dialogOpen}
          onCancel={() => navigate({screen: 'task-list'})}
          onConfirm={() => void run()}
          onOpenChange={onDialogOpenChange}
          open={dialogOpen}
          title="CONFIRMAR EXECUÇÃO"
          width={Math.min(60, Math.max(36, columns - 6))}
        >
          <Text color={theme.colors.mutedForeground} wrap="truncate-end">
            npm run -- {selected.name} {separator} {selected.command}
          </Text>
          <Box marginTop={1}>
            <ProgressBar
              aria-label="Etapa de confirmação, 1 de 3"
              max={3}
              showPercent={false}
              showValue
              value={1}
              valueLabel="1/3 etapas"
              width={Math.min(42, Math.max(12, columns - 20))}
            />
          </Box>
          <Text color={theme.colors.mutedForeground} dimColor wrap="truncate-end">
            {unicode ? '←/→' : 'Left/Right'} escolher {separator} Enter/Y confirmar {separator}{' '}
            Esc/N voltar
          </Text>
        </Dialog>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      {!compact || phase === 'select' ? (
        <ScreenTitle
          description={compact ? undefined : 'Execução segura via npm, sem interpolação de shell.'}
          title="Executar tarefa"
        />
      ) : null}
      {selectedTask && !selected ? (
        <Box flexDirection="column" gap={1}>
          <Alert title={`O script “${selectedTask}” não existe neste workspace.`} variant="error">
            Selecione um dos scripts disponíveis abaixo.
          </Alert>
          {selection}
        </Box>
      ) : null}
      {!selectedTask && phase === 'select' ? (
        <Panel title="SELECIONAR TAREFA">{selection}</Panel>
      ) : null}
      {selected ? (
        <Box flexDirection="column" gap={compact ? 0 : 1}>
          {ultraCompact || (compact && phase !== 'running') ? (
            <Box flexDirection="column">
              <PhaseTrail
                phase={phase === 'select' ? 'confirm' : phase}
                resultStatus={result?.status}
              />
              <ProgressBar
                aria-label={`Progresso da execução, ${phase === 'running' ? 2 : 3} de 3`}
                max={3}
                showPercent={false}
                showValue
                value={phase === 'running' ? 2 : 3}
                valueLabel={`${phase === 'running' ? 2 : 3}/3 etapas`}
                width={Math.max(12, columns - 25)}
              />
              {phase === 'running' ? (
                <Spinner
                  isActive={!cancelling}
                  label={
                    cancelling
                      ? unicode
                        ? 'Cancelando processo…'
                        : 'Cancelando processo...'
                      : `Executando ${selected.name} há ${formatElapsed(elapsedMs)}`
                  }
                />
              ) : null}
            </Box>
          ) : (
            <Box flexDirection={wide ? 'row' : 'column'} gap={wide ? 1 : 0}>
              {wide ? (
                <Box flexBasis={0} flexGrow={2} minWidth={0}>
                  <Panel title="TAREFA" width="100%">
                    <Text bold color={theme.colors.foreground} wrap="truncate-end">
                      {selected.name}
                    </Text>
                    <Text color={theme.colors.mutedForeground} wrap="truncate-end">
                      {selected.command}
                    </Text>
                    <Text color={theme.colors.mutedForeground} dimColor wrap="truncate-end">
                      cwd {workspace.path}
                    </Text>
                  </Panel>
                </Box>
              ) : null}
              <Box
                flexBasis={wide ? 0 : undefined}
                flexGrow={wide ? 3 : undefined}
                flexShrink={wide ? 1 : 0}
                minWidth={0}
                width={wide ? undefined : '100%'}
              >
                <Panel title="EXECUÇÃO ATUAL" width="100%">
                  {!wide ? (
                    <Text bold color={theme.colors.foreground} wrap="truncate-end">
                      {selected.name} {separator} {selected.command}
                    </Text>
                  ) : null}
                  <PhaseTrail
                    phase={phase === 'select' ? 'confirm' : phase}
                    resultStatus={result?.status}
                  />
                  <ProgressBar
                    aria-label={`Progresso da execução, ${phase === 'running' ? 2 : 3} de 3`}
                    max={3}
                    showPercent={false}
                    showValue
                    value={phase === 'running' ? 2 : 3}
                    valueLabel={`${phase === 'running' ? 2 : 3}/3 etapas`}
                    width={progressWidth}
                  />
                  {phase === 'running' ? (
                    <Spinner
                      isActive={!cancelling}
                      label={
                        cancelling
                          ? unicode
                            ? 'Cancelando processo…'
                            : 'Cancelando processo...'
                          : `Executando há ${formatElapsed(elapsedMs)}`
                      }
                    />
                  ) : null}
                </Panel>
              </Box>
            </Box>
          )}

          {phase === 'running' ? (
            <LogPanel
              autoFocus
              entries={logs}
              follow
              height={runningLogHeight}
              isActive={inputEnabled}
              showTimestamp={false}
            />
          ) : null}

          {phase === 'finished' && result ? (
            <Box flexDirection="column" gap={compact ? 0 : 1}>
              <Alert
                bordered={!compact}
                title={resultPresentation(result).title}
                variant={resultPresentation(result).variant}
              >
                {`${resultStatusLabel[result.status]} ${separator} código ${
                  result.exitCode
                } ${separator} ${formatElapsed(result.durationMs)}`}
              </Alert>
              {logs.length > 0 && !(ultraCompact && result.outputTruncated) ? (
                <LogPanel
                  autoFocus
                  entries={logs}
                  follow
                  height={resultLogHeight}
                  isActive={inputEnabled}
                  showTimestamp={false}
                  title="LOG DA EXECUÇÃO"
                />
              ) : null}
              {result.outputTruncated ? (
                <Alert bordered={!compact} title="Saída truncada" variant="warning">
                  O resultado bruto atingiu o limite de captura; execute o comando diretamente para
                  inspecionar a saída completa.
                </Alert>
              ) : null}
              <Text color={theme.colors.mutedForeground}>
                R repetir {separator} B voltar às tarefas
              </Text>
            </Box>
          ) : null}

          {phase === 'failed' ? (
            <Box flexDirection="column" gap={compact ? 0 : 1}>
              <Alert
                bordered={!compact}
                title="Não foi possível concluir a tarefa"
                variant={cancelling ? 'warning' : 'error'}
              >
                {runError ?? 'A execução falhou.'}
              </Alert>
              {logs.length > 0 ? (
                <LogPanel
                  autoFocus
                  entries={logs}
                  follow
                  height={resultLogHeight}
                  isActive={inputEnabled}
                  showTimestamp={false}
                  title="LOG DA FALHA"
                />
              ) : null}
              <Text color={theme.colors.mutedForeground}>
                R tentar novamente {separator} B voltar
              </Text>
            </Box>
          ) : null}
        </Box>
      ) : null}
    </Box>
  )
}
