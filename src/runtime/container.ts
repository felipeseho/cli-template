import {
  runDiagnostics,
  type DiagnosticContext,
  type DiagnosticReport,
} from '@/features/doctor/index.js'
import {
  listTasks,
  runTask,
  type RunTaskInput,
  type Task,
  type TaskResult,
} from '@/features/tasks/index.js'
import {readWorkspace, type Workspace} from '@/features/workspace/index.js'
import {ExecaTaskRunner} from '@/infrastructure/process/execa-task-runner.js'
import {createDoctorChecks} from '@/infrastructure/system/doctor-checks.js'
import {
  PackageJsonTaskCatalog,
  PackageJsonWorkspaceReader,
} from '@/infrastructure/workspace/package-json-task-catalog.js'

export interface ApplicationServices {
  listTasks(workspace: Workspace): Promise<readonly Task[]>
  readWorkspace(directory: string): Promise<Workspace>
  runDiagnostics(context: DiagnosticContext): Promise<DiagnosticReport>
  runTask(input: RunTaskInput): Promise<TaskResult>
}

export function createApplicationServices(): ApplicationServices {
  const workspaceReader = new PackageJsonWorkspaceReader()
  const catalog = new PackageJsonTaskCatalog()
  const runner = new ExecaTaskRunner()
  const probes = createDoctorChecks({workspaceReader})

  return {
    listTasks: (workspace) => listTasks({catalog}, workspace),
    readWorkspace: (directory) => readWorkspace(workspaceReader, directory),
    runDiagnostics: (context) => runDiagnostics({probes}, context),
    runTask: (input) => runTask({catalog, runner}, input),
  }
}
