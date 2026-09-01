import type {CliErrorMapper} from '@/cli/errors.js'

import {InvalidPackageJsonError, WorkspaceNotFoundError} from '../core/types.js'

export const mapWorkspaceCliError: CliErrorMapper = (error) => {
  if (error instanceof WorkspaceNotFoundError) {
    return {
      code: error.code,
      exitCode: 1,
      message: error.message,
      suggestions: ['Run the command from a directory that contains package.json.'],
    }
  }

  if (error instanceof InvalidPackageJsonError) {
    return {
      code: error.code,
      exitCode: 1,
      message: error.message,
      suggestions: ['Repair package.json and run the command again.'],
    }
  }

  return undefined
}
