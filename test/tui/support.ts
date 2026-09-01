import type {render} from 'ink-testing-library'

import type {DiagnosticReport} from '@/features/doctor/index.js'
import type {Task, TaskResult} from '@/features/tasks/index.js'
import type {Workspace} from '@/features/workspace/index.js'
import type {ApplicationServices} from '@/runtime/services.js'

export const workspace: Workspace = {
  name: 'fixture-project',
  packageJsonPath: '/fixture/package.json',
  path: '/fixture',
  scripts: {
    build: 'tsc -p tsconfig.json',
    lint: 'eslint .',
  },
}

export const tasks: readonly Task[] = [
  {command: 'tsc -p tsconfig.json', name: 'build'},
  {command: 'eslint .', name: 'lint'},
]

export const diagnostics: DiagnosticReport = {
  checks: [
    {
      id: 'node',
      label: 'Node.js',
      message: 'Node.js 22 is supported.',
      status: 'pass',
    },
  ],
  ok: true,
  summary: {fail: 0, pass: 1, warn: 0},
}

export const succeededResult: TaskResult = {
  durationMs: 25,
  exitCode: 0,
  outputTruncated: false,
  status: 'succeeded',
  stderr: '',
  stdout: 'done\n',
  task: tasks[0],
  workspacePath: workspace.path,
}

export function createServices(overrides: Partial<ApplicationServices> = {}): ApplicationServices {
  return {
    listTasks: () => tasks,
    readWorkspace: () => Promise.resolve(workspace),
    runDiagnostics: () => Promise.resolve(diagnostics),
    runTask: () => Promise.resolve(succeededResult),
    ...overrides,
  }
}

export function flushTui(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

export function resizeTui(
  instance: ReturnType<typeof render>,
  {columns, rows}: {readonly columns?: number; readonly rows?: number},
): void {
  Object.defineProperties(instance.stdout, {
    ...(columns === undefined ? {} : {columns: {configurable: true, value: columns}}),
    ...(rows === undefined ? {} : {rows: {configurable: true, value: rows}}),
  })
  instance.stdout.emit('resize')
}
