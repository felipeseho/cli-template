import {Args, Flags} from '@oclif/core'

import {DashboardCommand} from '@/cli/base-command.js'
import {mapTaskCliError} from '@/features/tasks/cli/errors.js'
import {presentTaskResultHuman} from '@/features/tasks/cli/presenter.js'
import {resolveTask, type TaskEvent} from '@/features/tasks/index.js'
import {mapWorkspaceCliError} from '@/features/workspace/cli/errors.js'
import {createApplicationServices} from '@/runtime/container.js'
import {renderTui} from '@/runtime/render-tui.js'
import {createSignalController} from '@/runtime/signals.js'

function streamTaskOutput(event: TaskEvent): void {
  if (event.type !== 'output') return
  const target = event.stream === 'stderr' ? process.stderr : process.stdout
  target.write(event.chunk)
}

export default class TaskRun extends DashboardCommand {
  static override args = {
    script: Args.string({
      description: 'Exact script name from package.json.',
      required: true,
    }),
  }
  static override description = 'Run one npm script declared by the current workspace.'
  static override examples = [
    '<%= config.bin %> task run build',
    '<%= config.bin %> task run test --no-interactive',
    '<%= config.bin %> task run lint --json',
  ]
  static override flags = {
    'output-limit': Flags.integer({
      default: 65_536,
      description: 'Maximum captured characters per output stream.',
      min: 0,
    }),
  }
  static override summary = 'Run a workspace task'

  async run() {
    const {args, flags} = await this.parse(TaskRun)
    const outputMode = this.outputMode(flags['no-interactive'])
    const services = createApplicationServices()

    try {
      if (outputMode === 'tui') {
        const workspace = await services.readWorkspace(process.cwd())
        const tasks = services.listTasks(workspace)
        resolveTask(tasks, args.script)

        let taskExitCode = 0
        const exitCode = await renderTui({
          cwd: process.cwd(),
          initialRoute: 'task-run',
          initialTask: args.script,
          name: this.config.bin,
          onTaskCompleted: (result) => {
            taskExitCode = result.exitCode
          },
          onTaskError: () => {
            taskExitCode = 1
          },
          services,
          taskOutputLimit: flags['output-limit'],
          version: this.config.version,
        })
        const finalExitCode = exitCode === 0 ? taskExitCode : exitCode
        if (finalExitCode !== 0) process.exitCode = finalExitCode
        return
      }

      const workspace = await services.readWorkspace(process.cwd())
      const signals = createSignalController()

      try {
        const result = await services.runTask({
          ...(outputMode === 'text' ? {onEvent: streamTaskOutput} : {}),
          outputLimit: flags['output-limit'],
          signal: signals.signal,
          taskName: args.script,
          workspace,
        })

        if (outputMode === 'text') this.log(`\n${presentTaskResultHuman(result)}`)
        if (result.exitCode !== 0) process.exitCode = result.exitCode
        return result
      } finally {
        signals.dispose()
      }
    } catch (error: unknown) {
      this.fail(error, [mapTaskCliError, mapWorkspaceCliError])
    }
  }
}
