import {mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {basename, join} from 'node:path'

import {afterEach, describe, expect, it} from 'vitest'

import {readWorkspace} from '@/features/workspace/read-workspace.js'
import {InvalidPackageJsonError, WorkspaceNotFoundError} from '@/features/workspace/types.js'
import {
  PackageJsonTaskCatalog,
  PackageJsonWorkspaceReader,
} from '@/infrastructure/workspace/package-json-task-catalog.js'

const temporaryDirectories: string[] = []

async function makeTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'my-cli-workspace-'))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map(async (directory) => rm(directory, {force: true, recursive: true})),
  )
})

describe('PackageJsonWorkspaceReader', () => {
  it('reads the workspace and its scripts', async () => {
    const directory = await makeTemporaryDirectory()
    await writeFile(
      join(directory, 'package.json'),
      JSON.stringify({name: 'fixture', scripts: {test: 'vitest', build: 'tsc'}}),
    )

    const workspace = await readWorkspace(new PackageJsonWorkspaceReader(), directory)

    expect(workspace).toEqual({
      name: 'fixture',
      packageJsonPath: join(directory, 'package.json'),
      path: directory,
      scripts: {build: 'tsc', test: 'vitest'},
    })
  })

  it('uses the directory name when the package is unnamed', async () => {
    const directory = await makeTemporaryDirectory()
    await writeFile(join(directory, 'package.json'), '{}')

    const workspace = await new PackageJsonWorkspaceReader().read(directory)

    expect(workspace.name).toBe(basename(directory))
    expect(workspace.scripts).toEqual({})
  })

  it('reports a missing package.json with a domain error', async () => {
    const directory = await makeTemporaryDirectory()

    await expect(new PackageJsonWorkspaceReader().read(directory)).rejects.toBeInstanceOf(
      WorkspaceNotFoundError,
    )
  })

  it.each([
    ['invalid JSON', '{'],
    ['a non-object root', '[]'],
    ['a non-object scripts field', JSON.stringify({scripts: []})],
    ['a non-string script', JSON.stringify({scripts: {test: 42}})],
  ])('rejects %s', async (_case, source) => {
    const directory = await makeTemporaryDirectory()
    await writeFile(join(directory, 'package.json'), source)

    await expect(new PackageJsonWorkspaceReader().read(directory)).rejects.toBeInstanceOf(
      InvalidPackageJsonError,
    )
  })
})

describe('PackageJsonTaskCatalog', () => {
  it('maps and sorts package scripts', async () => {
    const tasks = await new PackageJsonTaskCatalog().list({
      name: 'fixture',
      packageJsonPath: '/workspace/package.json',
      path: '/workspace',
      scripts: {test: 'vitest', build: 'tsc'},
    })

    expect(tasks).toEqual([
      {command: 'tsc', name: 'build'},
      {command: 'vitest', name: 'test'},
    ])
  })
})
