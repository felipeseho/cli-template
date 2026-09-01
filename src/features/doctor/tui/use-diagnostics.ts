import {useCallback, useEffect, useRef, useState} from 'react'

import type {DiagnosticContext, DiagnosticReport} from '@/features/doctor/index.js'
import type {ApplicationServices} from '@/runtime/services.js'

export interface UseDiagnosticsOptions {
  readonly context: DiagnosticContext
  readonly onCompleted?: (report: DiagnosticReport) => void
  readonly onError?: (error: unknown) => void
  readonly runDiagnostics: ApplicationServices['runDiagnostics']
}

export interface UseDiagnosticsResult {
  readonly error?: string
  readonly execute: () => Promise<void>
  readonly loading: boolean
  readonly report?: DiagnosticReport
}

export function useDiagnostics({
  context,
  onCompleted,
  onError,
  runDiagnostics,
}: UseDiagnosticsOptions): UseDiagnosticsResult {
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
      onError?.(caught)
    } finally {
      running.current = false
      if (mounted.current) setLoading(false)
    }
  }, [context, onCompleted, onError, runDiagnostics])

  useEffect(() => {
    void execute()
  }, [execute])

  return {error, execute, loading, report}
}
