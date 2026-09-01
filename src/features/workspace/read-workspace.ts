import {resolve} from 'node:path'

import type {Workspace, WorkspaceReader} from './types.js'

export async function readWorkspace(
  reader: WorkspaceReader,
  directory = process.cwd(),
): Promise<Workspace> {
  return reader.read(resolve(directory))
}
