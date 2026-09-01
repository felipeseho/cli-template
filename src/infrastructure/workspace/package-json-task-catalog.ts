import {readFile} from 'node:fs/promises'
import {basename, join, resolve} from 'node:path'

import type {TaskCatalog} from '../../features/tasks/ports.js'
import type {Task} from '../../features/tasks/types.js'
import {
  InvalidPackageJsonError,
  type PackageScripts,
  type Workspace,
  WorkspaceNotFoundError,
  type WorkspaceReader,
} from '../../features/workspace/types.js'

interface PackageJsonShape {
  readonly name?: unknown
  readonly scripts?: unknown
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseScripts(value: unknown, packageJsonPath: string): PackageScripts {
  if (value === undefined) return {}

  if (!isRecord(value)) {
    throw new InvalidPackageJsonError(
      packageJsonPath,
      'The package.json "scripts" field must be an object.',
    )
  }

  const entries = Object.entries(value)
  const invalidEntry = entries.find(([, command]) => typeof command !== 'string')

  if (invalidEntry) {
    throw new InvalidPackageJsonError(
      packageJsonPath,
      `The package.json script "${invalidEntry[0]}" must be a string.`,
    )
  }

  return Object.fromEntries(entries) as Record<string, string>
}

export class PackageJsonWorkspaceReader implements WorkspaceReader {
  async read(directory: string): Promise<Workspace> {
    const workspacePath = resolve(directory)
    const packageJsonPath = join(workspacePath, 'package.json')
    let source: string

    try {
      source = await readFile(packageJsonPath, 'utf8')
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        throw new WorkspaceNotFoundError(workspacePath)
      }

      throw new InvalidPackageJsonError(
        packageJsonPath,
        'The package.json file could not be read.',
        {cause: error},
      )
    }

    let parsed: unknown

    try {
      parsed = JSON.parse(source) as unknown
    } catch (error: unknown) {
      throw new InvalidPackageJsonError(
        packageJsonPath,
        'The package.json file contains invalid JSON.',
        {
          cause: error,
        },
      )
    }

    if (!isRecord(parsed)) {
      throw new InvalidPackageJsonError(packageJsonPath, 'The package.json root must be an object.')
    }

    const packageJson: PackageJsonShape = parsed
    const packageName =
      typeof packageJson.name === 'string' && packageJson.name.trim().length > 0
        ? packageJson.name
        : basename(workspacePath)

    return {
      name: packageName,
      packageJsonPath,
      path: workspacePath,
      scripts: parseScripts(packageJson.scripts, packageJsonPath),
    }
  }
}

export class PackageJsonTaskCatalog implements TaskCatalog {
  list(workspace: Workspace): Promise<readonly Task[]> {
    return Promise.resolve(
      Object.entries(workspace.scripts)
        .map(([name, command]) => ({command, name}))
        .sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0)),
    )
  }
}
