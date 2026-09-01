import type {
  DiagnosticContext,
  DiagnosticProbe,
  DiagnosticReport,
  DiagnosticSummary,
} from './types.js'

export interface RunDiagnosticsDependencies {
  readonly probes: readonly DiagnosticProbe[]
}

export async function runDiagnostics(
  {probes}: RunDiagnosticsDependencies,
  context: DiagnosticContext,
): Promise<DiagnosticReport> {
  const checks = await Promise.all(probes.map(async (probe) => probe.run(context)))
  const summary = checks.reduce<DiagnosticSummary>(
    (counts, check) => ({
      ...counts,
      [check.status]: counts[check.status] + 1,
    }),
    {fail: 0, pass: 0, warn: 0},
  )

  return {
    checks,
    ok: summary.fail === 0,
    summary,
  }
}
