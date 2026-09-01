import type {DiagnosticContext, DiagnosticReport} from '@/features/doctor/index.js'
import type {RunTaskInput, Task, TaskResult} from '@/features/tasks/index.js'
import type {Workspace} from '@/features/workspace/index.js'

export interface ApplicationServices {
  listTasks(workspace: Workspace): readonly Task[]
  readWorkspace(directory: string): Promise<Workspace>
  runDiagnostics(context: DiagnosticContext): Promise<DiagnosticReport>
  runTask(input: RunTaskInput): Promise<TaskResult>
}
