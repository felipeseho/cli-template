import {presentDiagnosticsHuman} from '@/presenters/human/index.js'
import {BaseCommand, interactiveFlag} from '@/runtime/base-command.js'
import {createApplicationServices} from '@/runtime/container.js'
import {renderTui} from '@/runtime/render-tui.js'

export default class Doctor extends BaseCommand {
  static override description = 'Check the local runtime, tools, terminal, and workspace.'
  static override examples = [
    '<%= config.bin %> doctor',
    '<%= config.bin %> doctor --interactive',
    '<%= config.bin %> doctor --json',
  ]
  static override flags = {
    interactive: interactiveFlag,
  }
  static override summary = 'Diagnose the current CLI environment'

  async run() {
    const {flags} = await this.parse(Doctor)
    this.assertOutputMode(flags.interactive)
    const services = createApplicationServices()

    if (flags.interactive) {
      let diagnosticExitCode = 0
      const exitCode = await renderTui({
        cwd: process.cwd(),
        initialRoute: 'doctor',
        name: this.config.bin,
        onDiagnosticsCompleted: (report) => {
          diagnosticExitCode = report.ok ? 0 : 1
        },
        services,
        version: this.config.version,
      })
      const finalExitCode = exitCode === 0 ? diagnosticExitCode : exitCode
      if (finalExitCode !== 0) process.exitCode = finalExitCode
      return
    }

    const report = await services.runDiagnostics({
      cwd: process.cwd(),
      stdinIsTTY: process.stdin.isTTY === true,
      stdoutIsTTY: process.stdout.isTTY === true,
    })

    if (!this.jsonEnabled()) this.log(presentDiagnosticsHuman(report))
    if (!report.ok) process.exitCode = 1
    return report
  }
}
