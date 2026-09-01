export type DiagnosticStatus = 'fail' | 'pass' | 'warn'

export interface DiagnosticCheck {
  readonly id: string
  readonly label: string
  readonly message: string
  readonly remediation?: string
  readonly status: DiagnosticStatus
}

export interface DiagnosticContext {
  readonly cwd: string
  readonly stdinIsTTY: boolean
  readonly stdoutIsTTY: boolean
}

export interface DiagnosticProbe {
  run(context: DiagnosticContext): Promise<DiagnosticCheck>
}

export interface DiagnosticSummary {
  readonly fail: number
  readonly pass: number
  readonly warn: number
}

export interface DiagnosticReport {
  readonly checks: readonly DiagnosticCheck[]
  readonly ok: boolean
  readonly summary: DiagnosticSummary
}
