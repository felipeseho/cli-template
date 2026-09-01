import {describe, expect, it} from 'vitest'

import {mapWorkspaceCliError} from '@/features/workspace/cli/errors.js'
import {InvalidPackageJsonError, WorkspaceNotFoundError} from '@/features/workspace/index.js'

describe('workspace CLI errors', () => {
  it('maps missing and invalid workspaces to stable CLI contracts', () => {
    expect(mapWorkspaceCliError(new WorkspaceNotFoundError('/workspace'))).toMatchObject({
      code: 'WORKSPACE_NOT_FOUND',
      exitCode: 1,
    })
    expect(
      mapWorkspaceCliError(new InvalidPackageJsonError('/workspace/package.json')),
    ).toMatchObject({
      code: 'INVALID_PACKAGE_JSON',
      exitCode: 1,
    })
    expect(mapWorkspaceCliError(new Error('unexpected'))).toBeUndefined()
  })
})
