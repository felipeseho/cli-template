import type {Workspace, WorkspaceReader} from './types.js'

export async function readWorkspace(
  reader: WorkspaceReader,
  directory: string,
): Promise<Workspace> {
  return reader.read(directory)
}
