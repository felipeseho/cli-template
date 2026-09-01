import {Box, Text, useInput} from 'ink'
import {useCallback, useEffect, useRef, useState} from 'react'

import type {Task, TaskEvent, TaskResult} from '@/features/tasks/types.js'
import type {Workspace} from '@/features/workspace/types.js'
import {EmptyState} from '@/tui/components/app/empty-state.js'
import {LogPanel, type LogEntry} from '@/tui/components/app/log-panel.js'
import {Panel} from '@/tui/components/app/panel.js'
import {ScreenTitle} from '@/tui/components/app/screen-title.js'
import {Confirm} from '@/tui/components/ui/confirm.js'
import {Select} from '@/tui/components/ui/select.js'
import {Spinner} from '@/tui/components/ui/spinner.js'
import {StatusMessage} from '@/tui/components/ui/status-message.js'
import {useTheme} from '@/tui/hooks/use-theme.js'
import {useUnicode} from '@/tui/hooks/use-unicode.js'

import type {TuiServices} from '../app.js'
import type {ScreenRoute} from '../router.js'

export type TaskActivity =
  {readonly running: false} | {readonly cancel: () => void; readonly running: true}

export interface TaskRunScreenProps {
  readonly error?: string
  readonly initialTask?: string
  readonly inputEnabled: boolean
  readonly loading: boolean
  readonly navigate: (route: ScreenRoute) => void
  readonly onActivityChange: (activity: TaskActivity) => void
  readonly onCompleted: (result: TaskResult) => void
  readonly services: TuiServices
  readonly tasks: readonly Task[]
  readonly viewportRows: number
  readonly workspace?: Workspace
}

type Phase = 'confirm' | 'failed' | 'finished' | 'running' | 'select'

const outputEntries = (event: TaskEvent): LogEntry[] => {
  if (event.type !== 'output') {
    return []
  }

  const normalized = event.chunk.replaceAll('\r', '')
  const lines = normalized.split('\n').filter((line) => line.length > 0)
  return (lines.length > 0 ? lines : [normalized]).map((message) => ({
    level: event.stream === 'stderr' ? 'error' : 'info',
    message,
  }))
}

const formatElapsed = (milliseconds: number): string => `${(milliseconds / 1000).toFixed(1)}s`

export function TaskRunScreen({
  error: workspaceError,
  initialTask,
  inputEnabled,
  loading,
  navigate,
  onActivityChange,
  onCompleted,
  services,
  tasks,
  viewportRows,
  workspace,
}: TaskRunScreenProps) {
  const theme = useTheme()
  const unicode = useUnicode()
  const separator = unicode ? '·' : '|'
  const mounted = useRef(true)
  const controller = useRef<AbortController | undefined>(undefined)
  const startedAt = useRef(0)
  const [selectedTask, setSelectedTask] = useState(initialTask ?? '')
  const [phase, setPhase] = useState<Phase>(initialTask ? 'confirm' : 'select')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [result, setResult] = useState<TaskResult>()
  const [runError, setRunError] = useState<string>()
  const [elapsedMs, setElapsedMs] = useState(0)
  const [cancelling, setCancelling] = useState(false)
  const compact = viewportRows < 22
  const runningLogHeight = Math.max(2, Math.min(10, viewportRows - (compact ? 14 : 17)))
  const resultLogHeight = Math.max(2, Math.min(8, viewportRows - (compact ? 14 : 17)))

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      controller.current?.abort()
      onActivityChange({running: false})
    }
  }, [onActivityChange])

  useEffect(() => {
    setSelectedTask(initialTask ?? '')
    setPhase(initialTask ? 'confirm' : 'select')
    setLogs([])
    setResult(undefined)
    setRunError(undefined)
    setCancelling(false)
  }, [initialTask])

  useEffect(() => {
    if (phase !== 'running') {
      return
    }

    const timer = setInterval(() => {
      setElapsedMs(Date.now() - startedAt.current)
    }, 250)

    return () => clearInterval(timer)
  }, [phase])

  const run = useCallback(async () => {
    if (!workspace || !selectedTask || phase === 'running') {
      return
    }

    const nextController = new AbortController()
    controller.current = nextController
    startedAt.current = Date.now()
    setElapsedMs(0)
    setLogs([])
    setResult(undefined)
    setRunError(undefined)
    setCancelling(false)
    setPhase('running')

    const cancel = () => {
      setCancelling(true)
      nextController.abort()
    }
    onActivityChange({cancel, running: true})

    try {
      const nextResult = await services.runTask({
        onEvent(event) {
          if (!mounted.current || event.type !== 'output') {
            return
          }

          setLogs((current) => [...current, ...outputEntries(event)].slice(-300))
        },
        outputLimit: 65_536,
        signal: nextController.signal,
        taskName: selectedTask,
        workspace,
      })

      if (!mounted.current) {
        return
      }

      setElapsedMs(nextResult.durationMs)
      setResult(nextResult)
      setPhase('finished')
      onCompleted(nextResult)
    } catch (caught) {
      if (!mounted.current) {
        return
      }

      setRunError(
        nextController.signal.aborted
          ? 'A execução foi cancelada.'
          : caught instanceof Error
            ? caught.message
            : String(caught),
      )
      setPhase('failed')
    } finally {
      if (mounted.current) {
        controller.current = undefined
        setCancelling(false)
        onActivityChange({running: false})
      }
    }
  }, [onActivityChange, onCompleted, phase, selectedTask, services, workspace])

  useInput(
    (input, key) => {
      if (key.ctrl) {
        return
      }

      if ((phase === 'failed' || phase === 'finished') && input.toLocaleLowerCase() === 'r') {
        setPhase('confirm')
        setRunError(undefined)
        setResult(undefined)
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
        <StatusMessage variant="loading">
          {unicode ? 'Lendo o workspace…' : 'Lendo o workspace...'}
        </StatusMessage>
      </Box>
    )
  }

  if (!workspace) {
    return (
      <Box flexDirection="column">
        <ScreenTitle title="Executar tarefa" />
        <EmptyState
          detail={workspaceError ?? 'Abra a CLI dentro de um projeto Node.js.'}
          title="Nenhum workspace disponível"
        />
      </Box>
    )
  }

  if (tasks.length === 0) {
    return (
      <Box flexDirection="column">
        <ScreenTitle title="Executar tarefa" />
        <EmptyState
          detail="Crie uma entrada em package.json#scripts e abra esta tela novamente."
          title="Não há scripts para executar"
        />
      </Box>
    )
  }

  const selected = tasks.find((task) => task.name === selectedTask)
  const selection = (
    <Select
      aria-label="Selecione uma tarefa"
      autoFocus
      isActive={inputEnabled}
      label="Escolha um script"
      maxVisibleOptions={Math.max(3, Math.min(8, viewportRows - 11))}
      onSubmit={(taskName) => {
        setSelectedTask(taskName)
        setPhase('confirm')
      }}
      options={tasks.map((task) => ({
        hint: task.command,
        label: task.name,
        value: task.name,
      }))}
      value={selectedTask || undefined}
    />
  )

  return (
    <Box flexDirection="column">
      <ScreenTitle
        description={compact ? undefined : 'Execução segura via npm, sem interpolação de shell.'}
        title="Executar tarefa"
      />
      {selectedTask && !selected ? (
        <Box flexDirection="column" gap={1}>
          <StatusMessage variant="error">
            O script “{selectedTask}” não existe neste workspace.
          </StatusMessage>
          {selection}
        </Box>
      ) : null}
      {!selectedTask && phase === 'select' ? selection : null}
      {selected ? (
        <Panel title={`npm run -- ${selected.name}`} width="100%">
          <Text color={theme.colors.mutedForeground} wrap="truncate-end">
            {selected.command}
          </Text>

          {phase === 'confirm' ? (
            <Box marginTop={1}>
              <Confirm
                autoFocus
                confirmLabel="Executar"
                defaultValue
                isActive={inputEnabled}
                message={`Executar “${selected.name}”?`}
                onCancel={() => navigate({screen: 'task-list'})}
                onConfirm={() => void run()}
              />
            </Box>
          ) : null}

          {phase === 'running' ? (
            <Box flexDirection="column" gap={1} marginTop={1}>
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
              <LogPanel
                entries={logs}
                follow
                height={runningLogHeight}
                isActive={inputEnabled}
                showTimestamp={false}
              />
              {!compact ? (
                <Text color={theme.colors.mutedForeground}>
                  Ctrl+C solicita o cancelamento e aguarda o subprocesso terminar.
                </Text>
              ) : null}
            </Box>
          ) : null}

          {phase === 'finished' && result ? (
            <Box flexDirection="column" gap={1} marginTop={1}>
              <StatusMessage
                variant={
                  result.status === 'succeeded'
                    ? 'success'
                    : result.status === 'cancelled'
                      ? 'warning'
                      : 'error'
                }
              >
                {result.status} {separator} código {result.exitCode} {separator}{' '}
                {formatElapsed(result.durationMs)}
              </StatusMessage>
              {logs.length > 0 ? (
                <LogPanel
                  entries={logs}
                  height={resultLogHeight}
                  isActive={inputEnabled}
                  showTimestamp={false}
                />
              ) : null}
              {result.outputTruncated ? (
                <StatusMessage variant="warning">A saída capturada foi truncada.</StatusMessage>
              ) : null}
              <Text color={theme.colors.mutedForeground}>
                R repetir {separator} B voltar às tarefas
              </Text>
            </Box>
          ) : null}

          {phase === 'failed' ? (
            <Box flexDirection="column" gap={1} marginTop={1}>
              <StatusMessage variant={cancelling ? 'warning' : 'error'}>
                {runError ?? 'A execução falhou.'}
              </StatusMessage>
              {logs.length > 0 ? (
                <LogPanel
                  entries={logs}
                  height={resultLogHeight}
                  isActive={inputEnabled}
                  showTimestamp={false}
                />
              ) : null}
              <Text color={theme.colors.mutedForeground}>
                R tentar novamente {separator} B voltar
              </Text>
            </Box>
          ) : null}
        </Panel>
      ) : null}
    </Box>
  )
}
