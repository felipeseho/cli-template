import {stat} from 'node:fs/promises'

import {execa} from 'execa'

import type {
  DiagnosticCheck,
  DiagnosticContext,
  DiagnosticProbe,
} from '../../features/doctor/types.js'
import type {WorkspaceReader} from '../../features/workspace/types.js'
import {PackageJsonWorkspaceReader} from '../workspace/package-json-task-catalog.js'

export type CommandVersionReader = (command: string) => Promise<string | undefined>
export type DirectoryReader = (directory: string) => Promise<boolean>

export interface DoctorChecksOptions {
  readonly commandVersion?: CommandVersionReader
  readonly directoryExists?: DirectoryReader
  readonly nodeVersion?: string
  readonly workspaceReader?: WorkspaceReader
}

async function defaultCommandVersion(command: string): Promise<string | undefined> {
  const result = await execa(command, ['--version'], {
    reject: false,
    shell: false,
    timeout: 3000,
  })

  return result.failed ? undefined : result.stdout.trim()
}

async function defaultDirectoryExists(directory: string): Promise<boolean> {
  try {
    return (await stat(directory)).isDirectory()
  } catch {
    return false
  }
}

function nodeProbe(nodeVersion: string): DiagnosticProbe {
  return {
    run(): Promise<DiagnosticCheck> {
      const major = Number.parseInt(nodeVersion.split('.')[0] ?? '', 10)
      const supported = Number.isFinite(major) && major >= 22

      return Promise.resolve(
        supported
          ? {
              id: 'node',
              label: 'Node.js',
              message: `Node.js ${nodeVersion} is supported.`,
              status: 'pass',
            }
          : {
              id: 'node',
              label: 'Node.js',
              message: `Node.js ${nodeVersion || 'unknown'} is not supported.`,
              remediation: 'Install Node.js 22 or newer.',
              status: 'fail',
            },
      )
    },
  }
}

function commandProbe(
  id: 'git' | 'npm',
  label: string,
  statusWhenMissing: 'fail' | 'warn',
  commandVersion: CommandVersionReader,
): DiagnosticProbe {
  return {
    async run(): Promise<DiagnosticCheck> {
      const version = await commandVersion(id)
      if (version) {
        const displayVersion = id === 'git' ? version.replace(/^git version\s+/i, '') : version
        return {id, label, message: `${label} ${displayVersion} is available.`, status: 'pass'}
      }

      return {
        id,
        label,
        message: `${label} was not found on PATH.`,
        remediation: `Install ${label} and ensure it is available on PATH.`,
        status: statusWhenMissing,
      }
    },
  }
}

function ttyProbe(): DiagnosticProbe {
  return {
    run(context: DiagnosticContext): Promise<DiagnosticCheck> {
      const interactive = context.stdinIsTTY && context.stdoutIsTTY
      return Promise.resolve(
        interactive
          ? {
              id: 'tty',
              label: 'Interactive terminal',
              message: 'stdin and stdout are attached to a TTY.',
              status: 'pass',
            }
          : {
              id: 'tty',
              label: 'Interactive terminal',
              message: 'stdin or stdout is not attached to a TTY.',
              remediation:
                'Use textual or JSON output, or rerun the command in an interactive terminal.',
              status: 'warn',
            },
      )
    },
  }
}

function workspaceProbe(directoryExists: DirectoryReader): DiagnosticProbe {
  return {
    async run({cwd}: DiagnosticContext): Promise<DiagnosticCheck> {
      const exists = await directoryExists(cwd)
      return exists
        ? {
            id: 'workspace',
            label: 'Workspace',
            message: `Workspace directory is accessible at ${cwd}.`,
            status: 'pass',
          }
        : {
            id: 'workspace',
            label: 'Workspace',
            message: `Workspace directory is not accessible at ${cwd}.`,
            remediation: 'Run the CLI from an existing, readable directory.',
            status: 'fail',
          }
    },
  }
}

function packageJsonProbe(workspaceReader: WorkspaceReader): DiagnosticProbe {
  return {
    async run({cwd}: DiagnosticContext): Promise<DiagnosticCheck> {
      try {
        const workspace = await workspaceReader.read(cwd)
        const scriptCount = Object.keys(workspace.scripts).length
        return {
          id: 'package-json',
          label: 'package.json',
          message: `${workspace.name} has ${scriptCount} npm script${scriptCount === 1 ? '' : 's'}.`,
          status: 'pass',
        }
      } catch (error: unknown) {
        return {
          id: 'package-json',
          label: 'package.json',
          message: error instanceof Error ? error.message : 'package.json could not be read.',
          remediation: 'Create or repair package.json in the current workspace.',
          status: 'fail',
        }
      }
    },
  }
}

export function createDoctorChecks({
  commandVersion = defaultCommandVersion,
  directoryExists = defaultDirectoryExists,
  nodeVersion = process.versions.node,
  workspaceReader = new PackageJsonWorkspaceReader(),
}: DoctorChecksOptions = {}): readonly DiagnosticProbe[] {
  return [
    nodeProbe(nodeVersion),
    commandProbe('npm', 'npm', 'fail', commandVersion),
    commandProbe('git', 'Git', 'warn', commandVersion),
    ttyProbe(),
    workspaceProbe(directoryExists),
    packageJsonProbe(workspaceReader),
  ]
}
