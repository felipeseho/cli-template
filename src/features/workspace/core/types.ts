export type PackageScripts = Readonly<Record<string, string>>

export interface Workspace {
  readonly name: string
  readonly packageJsonPath: string
  readonly path: string
  readonly scripts: PackageScripts
}

export interface WorkspaceReader {
  read(directory: string): Promise<Workspace>
}

export class WorkspaceNotFoundError extends Error {
  readonly code = 'WORKSPACE_NOT_FOUND'

  constructor(readonly directory: string) {
    super(`No package.json was found in ${directory}.`)
    this.name = 'WorkspaceNotFoundError'
  }
}

export class InvalidPackageJsonError extends Error {
  readonly code = 'INVALID_PACKAGE_JSON'

  constructor(
    readonly packageJsonPath: string,
    message = 'The package.json file is not valid.',
    options?: ErrorOptions,
  ) {
    super(`${message} (${packageJsonPath})`, options)
    this.name = 'InvalidPackageJsonError'
  }
}
