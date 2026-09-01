import {createDoctorChecks} from '@/features/doctor/adapters/doctor-checks.js'
import {runDiagnostics} from '@/features/doctor/index.js'
import {ExecaTaskRunner} from '@/features/tasks/adapters/execa-task-runner.js'
import {listTasks, runTask} from '@/features/tasks/index.js'
import {PackageJsonWorkspaceReader} from '@/features/workspace/adapters/package-json-workspace-reader.js'
import {readWorkspace} from '@/features/workspace/index.js'

import type {ApplicationServices} from './services.js'

export type {ApplicationServices} from './services.js'

export function createApplicationServices(): ApplicationServices {
  const workspaceReader = new PackageJsonWorkspaceReader()
  const runner = new ExecaTaskRunner()
  const probes = createDoctorChecks({workspaceReader})

  return {
    listTasks,
    readWorkspace: (directory) => readWorkspace(workspaceReader, directory),
    runDiagnostics: (context) => runDiagnostics({probes}, context),
    runTask: (input) => runTask({runner}, input),
  }
}
