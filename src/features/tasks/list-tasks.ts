import type {Workspace} from '../workspace/types.js'
import type {TaskCatalog} from './ports.js'
import type {Task} from './types.js'

export interface ListTasksDependencies {
  readonly catalog: TaskCatalog
}

export async function listTasks(
  {catalog}: ListTasksDependencies,
  workspace: Workspace,
): Promise<readonly Task[]> {
  return catalog.list(workspace)
}
