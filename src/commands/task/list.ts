import {DashboardCommand} from '@/cli/base-command.js'
import {mapWorkspaceCliError} from '@/features/workspace/cli/errors.js'
import {toTaskListOutput} from '@/features/tasks/cli/output.js'
import {presentTaskListHuman} from '@/features/tasks/cli/presenter.js'
import {createApplicationServices} from '@/runtime/container.js'
import {renderTui} from '@/runtime/render-tui.js'

export default class TaskList extends DashboardCommand {
  static override description = 'List npm scripts declared by the current workspace.'
  static override examples = [
    '<%= config.bin %> task list',
    '<%= config.bin %> task list --no-interactive',
    '<%= config.bin %> task list --json',
  ]
  static override summary = 'List workspace tasks'

  async run() {
    const {flags} = await this.parse(TaskList)
    const outputMode = this.outputMode(flags['no-interactive'])
    const services = createApplicationServices()

    try {
      if (outputMode === 'tui') {
        let workspaceExitCode = 0
        const exitCode = await renderTui({
          cwd: process.cwd(),
          initialRoute: 'task-list',
          name: this.config.bin,
          onWorkspaceError: () => {
            workspaceExitCode = 1
          },
          services,
          version: this.config.version,
        })
        const finalExitCode = exitCode === 0 ? workspaceExitCode : exitCode
        if (finalExitCode !== 0) process.exitCode = finalExitCode
        return
      }

      const workspace = await services.readWorkspace(process.cwd())
      const tasks = services.listTasks(workspace)
      if (outputMode === 'text') this.log(presentTaskListHuman(workspace, tasks))

      return toTaskListOutput(workspace, tasks)
    } catch (error: unknown) {
      this.fail(error, [mapWorkspaceCliError])
    }
  }
}
