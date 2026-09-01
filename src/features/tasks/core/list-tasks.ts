import type {Workspace} from '@/features/workspace/index.js'

import type {Task} from './types.js'

export function listTasks(workspace: Workspace): readonly Task[] {
  return Object.entries(workspace.scripts)
    .map(([name, command]) => ({command, name}))
    .sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))
}
