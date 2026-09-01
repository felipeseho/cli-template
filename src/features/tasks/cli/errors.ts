import type {CliErrorMapper} from '@/cli/errors.js'

import {TaskNotFoundError} from '../core/types.js'

export const mapTaskCliError: CliErrorMapper = (error) =>
  error instanceof TaskNotFoundError
    ? {
        code: error.code,
        exitCode: 2,
        message: error.message,
        suggestions: ['Run "mycli task list" to inspect scripts in this workspace.'],
      }
    : undefined
