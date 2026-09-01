import {Command, Help} from '@oclif/core'

import {createApplicationServices} from '@/runtime/container.js'
import {renderTui} from '@/runtime/render-tui.js'
import {isInteractiveTerminal} from '@/runtime/tty.js'

export default class Ui extends Command {
  static override description = 'Open the interactive terminal application.'
  static override examples = ['<%= config.bin %>', '<%= config.bin %> ui']
  static override summary = 'Open the interactive terminal application'

  async run(): Promise<void> {
    if (!isInteractiveTerminal()) {
      await new Help(this.config).showHelp([])
      return
    }

    const exitCode = await renderTui({
      cwd: process.cwd(),
      initialRoute: 'home',
      name: this.config.bin,
      services: createApplicationServices(),
      version: this.config.version,
    })
    if (exitCode !== 0) process.exitCode = exitCode
  }
}
