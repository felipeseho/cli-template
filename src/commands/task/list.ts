import {presentTaskListHuman} from '@/presenters/human/index.js'
import {BaseCommand, interactiveFlag} from '@/runtime/base-command.js'
import {createApplicationServices} from '@/runtime/container.js'
import {renderTui} from '@/runtime/render-tui.js'

export default class TaskList extends BaseCommand {
  static override description = 'List npm scripts declared by the current workspace.'
  static override examples = [
    '<%= config.bin %> task list',
    '<%= config.bin %> task list --interactive',
    '<%= config.bin %> task list --json',
  ]
  static override flags = {interactive: interactiveFlag}
  static override summary = 'List workspace tasks'

  async run() {
    const {flags} = await this.parse(TaskList)
    this.assertOutputMode(flags.interactive)
    const services = createApplicationServices()

    try {
      if (flags.interactive) {
        const exitCode = await renderTui({
          cwd: process.cwd(),
          initialRoute: 'task-list',
          name: this.config.bin,
          services,
          version: this.config.version,
        })
        if (exitCode !== 0) process.exitCode = exitCode
        return
      }

      const workspace = await services.readWorkspace(process.cwd())
      const tasks = await services.listTasks(workspace)
      if (!this.jsonEnabled()) this.log(presentTaskListHuman(workspace, tasks))

      return {
        tasks,
        workspace: {
          name: workspace.name,
          packageJsonPath: workspace.packageJsonPath,
          path: workspace.path,
        },
      }
    } catch (error: unknown) {
      this.fail(error)
    }
  }
}
