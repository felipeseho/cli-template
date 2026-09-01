import type {DiagnosticReport} from '../../features/doctor/types.js'
import {presentJson} from './serialize.js'

export function presentDiagnosticsJson(report: DiagnosticReport): string {
  return presentJson(report)
}
