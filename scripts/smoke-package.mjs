import {spawnSync} from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import {tmpdir} from 'node:os'
import {dirname, join, normalize, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'))
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const temporaryRoot = mkdtempSync(join(tmpdir(), 'cli-package-smoke-'))
const manifestPath = join(repoRoot, 'oclif.manifest.json')
const previousManifest = existsSync(manifestPath) ? readFileSync(manifestPath) : undefined

const smokeEnvironment = {
  ...process.env,
  CI: 'true',
  FORCE_COLOR: '0',
  NO_COLOR: '1',
  NO_MOTION: '1',
  NO_UNICODE: '1',
  TERM: 'dumb',
}

function fail(message) {
  throw new Error(message)
}

function run(command, arguments_, options = {}) {
  const result = spawnSync(command, arguments_, {
    cwd: options.cwd ?? repoRoot,
    encoding: 'utf8',
    env: smokeEnvironment,
    input: options.input,
    maxBuffer: 10 * 1024 * 1024,
    shell: options.shell ?? false,
    timeout: options.timeout ?? 60_000,
    windowsHide: true,
  })

  if (result.error) {
    fail(`Could not run ${command}: ${result.error.message}`)
  }

  if (result.signal) {
    fail(`${command} was terminated by ${result.signal}`)
  }

  if (result.status !== (options.expectedStatus ?? 0)) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    fail(
      `${command} ${arguments_.join(' ')} exited with ${result.status}.` +
        (output ? `\n${output}` : ''),
    )
  }

  return result
}

function packageBin(packageMetadata) {
  if (typeof packageMetadata.bin === 'string') {
    const fallbackName = packageMetadata.name.replace(/^@[^/]+\//, '')
    return [fallbackName, packageMetadata.bin]
  }

  const entries = Object.entries(packageMetadata.bin ?? {})
  if (entries.length === 0) {
    fail('package.json must expose at least one executable through "bin".')
  }

  return entries[0]
}

function normalizeArchivePath(path) {
  return normalize(path).replaceAll('\\', '/').replace(/^\.\//, '')
}

function validateArchive(packResult, binPath) {
  const files = (packResult.files ?? []).map(({path}) => normalizeArchivePath(path))
  const requiredFile = normalizeArchivePath(binPath)

  for (const path of [requiredFile, 'oclif.manifest.json', 'README.md', 'LICENSE']) {
    if (!files.some((file) => file.toLowerCase() === path.toLowerCase())) {
      fail(`Packed artifact is missing ${path}.`)
    }
  }

  if (!files.some((path) => path.startsWith('dist/') && path.endsWith('.js'))) {
    fail('Packed artifact does not contain compiled JavaScript under dist/.')
  }

  const sourceMaps = files.filter((path) => path.toLowerCase().endsWith('.map'))
  if (sourceMaps.length > 0) {
    fail(`Packed artifact contains source maps:\n${sourceMaps.join('\n')}`)
  }

  const packedBin = (packResult.files ?? []).find(
    ({path}) => normalizeArchivePath(path).toLowerCase() === requiredFile.toLowerCase(),
  )
  if (!Number.isInteger(packedBin?.mode) || (packedBin.mode & 0o111) === 0) {
    fail(`${requiredFile} is not executable in the tarball.`)
  }

  const allowedTopLevel = new Set([
    'bin',
    'dist',
    'license',
    'license.md',
    'oclif.manifest.json',
    'package.json',
    'readme',
    'readme.md',
  ])

  const unexpected = files.filter((path) => {
    const topLevel = path.split('/')[0].toLowerCase()
    return !allowedTopLevel.has(topLevel)
  })

  if (unexpected.length > 0) {
    fail(`Packed artifact contains unexpected files:\n${unexpected.join('\n')}`)
  }

  const sensitive = files.filter((path) => {
    const lower = path.toLowerCase()
    return (
      lower === '.env' ||
      lower.includes('/.env') ||
      lower.endsWith('.key') ||
      lower.endsWith('.pem')
    )
  })

  if (sensitive.length > 0) {
    fail(`Packed artifact may contain secrets:\n${sensitive.join('\n')}`)
  }
}

function findPublishedModuleFiles(directory) {
  const files = []

  for (const entry of readdirSync(directory, {withFileTypes: true})) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...findPublishedModuleFiles(path))
    else if (
      entry.isFile() &&
      ['.js', '.mjs', '.cjs', '.d.ts'].some((extension) => entry.name.endsWith(extension))
    ) {
      files.push(path)
    }
  }

  return files
}

function validateInstalledPackage(packageDirectory, binPath) {
  const installedBin = join(packageDirectory, normalizeArchivePath(binPath))
  if (!existsSync(installedBin)) fail(`Installed package is missing ${binPath}.`)

  const binSource = readFileSync(installedBin, 'utf8')
  if (!binSource.startsWith('#!/usr/bin/env node')) {
    fail(`${binPath} must preserve its Node.js shebang.`)
  }

  if (process.platform !== 'win32' && (statSync(installedBin).mode & 0o111) === 0) {
    fail(`${binPath} is not executable after installation.`)
  }

  const unresolvedAlias = /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)['"]@\//
  const offender = findPublishedModuleFiles(packageDirectory).find((path) =>
    unresolvedAlias.test(readFileSync(path, 'utf8')),
  )

  if (offender) {
    fail(`Published JavaScript contains an unresolved @/ alias: ${offender}`)
  }
}

function parseJsonOutput(result, label) {
  const output = result.stdout.trim()
  if (!output) fail(`${label} did not write JSON to stdout.`)
  if (output.includes(String.fromCodePoint(27))) {
    fail(`${label} wrote ANSI control sequences in JSON mode.`)
  }
  if (result.stderr.trim()) {
    fail(`${label} wrote unexpected stderr output:\n${result.stderr.trim()}`)
  }

  try {
    return JSON.parse(output)
  } catch (error) {
    fail(`${label} wrote invalid JSON:\n${output}\n${error.message}`)
  }
}

function runInstalledBin(binName, installRoot, arguments_, workspace) {
  const extension = process.platform === 'win32' ? '.cmd' : ''
  const shim = join(installRoot, 'node_modules', '.bin', `${binName}${extension}`)

  if (!existsSync(shim)) fail(`npm did not create the executable shim for ${binName}.`)

  return run(shim, arguments_, {
    cwd: workspace,
    input: '',
    shell: process.platform === 'win32',
    timeout: 15_000,
  })
}

try {
  const [binName, binPath] = packageBin(packageJson)
  if (!/^[a-zA-Z0-9._-]+$/.test(binName)) {
    fail(`Unsafe or unsupported executable name: ${binName}`)
  }

  console.log('Packing the production artifact...')
  run(npmCommand, ['run', 'prepack'], {timeout: 120_000})
  const pack = run(
    npmCommand,
    ['pack', '--json', '--ignore-scripts', '--pack-destination', temporaryRoot],
    {timeout: 120_000},
  )

  let packReport
  try {
    const reports = JSON.parse(pack.stdout)
    packReport = reports[0]
  } catch (error) {
    fail(`npm pack did not return valid JSON:\n${pack.stdout}\n${error.message}`)
  }

  if (!packReport?.filename) fail('npm pack did not report the tarball filename.')
  validateArchive(packReport, binPath)

  const tarball = join(temporaryRoot, packReport.filename)
  const installRoot = join(temporaryRoot, 'installed')
  const workspace = join(temporaryRoot, 'workspace')
  mkdirSync(installRoot, {recursive: true})
  mkdirSync(workspace, {recursive: true})
  writeFileSync(
    join(workspace, 'package.json'),
    `${JSON.stringify(
      {
        name: 'package-smoke-workspace',
        private: true,
        scripts: {smoke: 'node --version'},
        version: '1.0.0',
      },
      null,
      2,
    )}\n`,
  )

  console.log('Installing the tarball in an isolated workspace...')
  run(
    npmCommand,
    ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--prefix', installRoot, tarball],
    {timeout: 120_000},
  )

  const packageDirectory = join(installRoot, 'node_modules', ...packageJson.name.split('/'))
  validateInstalledPackage(packageDirectory, binPath)

  console.log(`Running ${binName} from the installed package...`)
  const help = runInstalledBin(binName, installRoot, ['--help'], workspace)
  if (!/usage|commands/i.test(`${help.stdout}\n${help.stderr}`)) {
    fail('--help did not contain usage or command information.')
  }

  const version = runInstalledBin(binName, installRoot, ['--version'], workspace)
  if (!version.stdout.includes(packageJson.version)) {
    fail(`--version did not contain ${packageJson.version}.`)
  }

  parseJsonOutput(
    runInstalledBin(binName, installRoot, ['doctor', '--json'], workspace),
    'doctor --json',
  )
  parseJsonOutput(
    runInstalledBin(binName, installRoot, ['task', 'list', '--json'], workspace),
    'task list --json',
  )

  const root = runInstalledBin(binName, installRoot, [], workspace)
  if (!/usage|commands/i.test(`${root.stdout}\n${root.stderr}`)) {
    fail('The root command did not print help when invoked without a TTY.')
  }

  console.log(`Package smoke test passed for ${packReport.filename}.`)
} finally {
  rmSync(temporaryRoot, {force: true, maxRetries: 3, recursive: true, retryDelay: 100})
  if (previousManifest) writeFileSync(manifestPath, previousManifest)
  else rmSync(manifestPath, {force: true})
}
