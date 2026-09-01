import {useCallback, useEffect, useRef, useState} from 'react'

import type {TaskEvent, TaskResult} from '@/features/tasks/index.js'
import type {Workspace} from '@/features/workspace/index.js'
import type {ApplicationServices} from '@/runtime/services.js'
import type {LogEntry} from '@/tui/components/app/log-panel.js'

export type TaskActivity =
  {readonly running: false} | {readonly cancel: () => void; readonly running: true}

export type TaskRunPhase = 'confirm' | 'failed' | 'finished' | 'running' | 'select'

export interface UseTaskRunOptions {
  readonly initialTask?: string
  readonly onActivityChange: (activity: TaskActivity) => void
  readonly onCompleted: (result: TaskResult) => void
  readonly runTask: ApplicationServices['runTask']
  readonly workspace?: Workspace
}

export interface UseTaskRunResult {
  readonly cancelling: boolean
  readonly elapsedMs: number
  readonly logs: LogEntry[]
  readonly phase: TaskRunPhase
  readonly result?: TaskResult
  readonly retry: () => void
  readonly run: () => Promise<void>
  readonly runError?: string
  readonly selectedTask: string
  readonly selectTask: (taskName: string) => void
}

function outputEntries(event: TaskEvent): LogEntry[] {
  if (event.type !== 'output') return []

  const normalized = event.chunk.replaceAll('\r', '')
  const lines = normalized.split('\n').filter((line) => line.length > 0)
  return (lines.length > 0 ? lines : [normalized]).map((message) => ({
    level: event.stream === 'stderr' ? 'error' : 'info',
    message,
  }))
}

export function useTaskRun({
  initialTask,
  onActivityChange,
  onCompleted,
  runTask,
  workspace,
}: UseTaskRunOptions): UseTaskRunResult {
  const mounted = useRef(true)
  const controller = useRef<AbortController | undefined>(undefined)
  const startedAt = useRef(0)
  const [selectedTask, setSelectedTask] = useState(initialTask ?? '')
  const [phase, setPhase] = useState<TaskRunPhase>(initialTask ? 'confirm' : 'select')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [result, setResult] = useState<TaskResult>()
  const [runError, setRunError] = useState<string>()
  const [elapsedMs, setElapsedMs] = useState(0)
  const [cancelling, setCancelling] = useState(false)

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
    if (phase !== 'running') return

    const timer = setInterval(() => {
      setElapsedMs(Date.now() - startedAt.current)
    }, 250)

    return () => clearInterval(timer)
  }, [phase])

  const run = useCallback(async () => {
    if (!workspace || !selectedTask || phase === 'running') return

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
      const nextResult = await runTask({
        onEvent(event) {
          if (!mounted.current || event.type !== 'output') return

          setLogs((current) => [...current, ...outputEntries(event)].slice(-300))
        },
        outputLimit: 65_536,
        signal: nextController.signal,
        taskName: selectedTask,
        workspace,
      })

      if (!mounted.current) return

      setElapsedMs(nextResult.durationMs)
      setResult(nextResult)
      setPhase('finished')
      onCompleted(nextResult)
    } catch (caught) {
      if (!mounted.current) return

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
  }, [onActivityChange, onCompleted, phase, runTask, selectedTask, workspace])

  const retry = useCallback(() => {
    setPhase('confirm')
    setRunError(undefined)
    setResult(undefined)
  }, [])

  const selectTask = useCallback((taskName: string) => {
    setSelectedTask(taskName)
    setPhase('confirm')
  }, [])

  return {
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
  }
}
