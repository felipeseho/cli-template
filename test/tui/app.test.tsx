import {render} from 'ink-testing-library'
import stringWidth from 'string-width'
import {describe, expect, it, vi} from 'vitest'

import type {DiagnosticReport} from '@/features/doctor/types.js'
import type {Task, TaskResult} from '@/features/tasks/types.js'
import type {Workspace} from '@/features/workspace/types.js'
import {App, type TuiServices} from '@/tui/app.js'

const workspace: Workspace = {
  name: 'fixture-project',
  packageJsonPath: '/fixture/package.json',
  path: '/fixture',
  scripts: {
    build: 'tsc -p tsconfig.json',
    lint: 'eslint .',
  },
}

const tasks: readonly Task[] = [
  {command: 'tsc -p tsconfig.json', name: 'build'},
  {command: 'eslint .', name: 'lint'},
]

const diagnostics: DiagnosticReport = {
  checks: [
    {
      id: 'node',
      label: 'Node.js',
      message: 'Node.js 22 is supported.',
      status: 'pass',
    },
  ],
  ok: true,
  summary: {fail: 0, pass: 1, warn: 0},
}

const succeededResult: TaskResult = {
  durationMs: 25,
  exitCode: 0,
  outputTruncated: false,
  status: 'succeeded',
  stderr: '',
  stdout: 'done\n',
  task: tasks[0],
  workspacePath: workspace.path,
}

function createServices(overrides: Partial<TuiServices> = {}): TuiServices {
  return {
    listTasks: () => Promise.resolve(tasks),
    readWorkspace: () => Promise.resolve(workspace),
    runDiagnostics: () => Promise.resolve(diagnostics),
    runTask: () => Promise.resolve(succeededResult),
    ...overrides,
  }
}

describe('interactive application', () => {
  it('loads the workspace and navigates through help and the command palette', async () => {
    const instance = render(
      <App
        cwd={workspace.path}
        name="mycli"
        services={createServices()}
        stdinIsTTY
        stdoutIsTTY
        version="1.2.3"
      />,
    )

    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('fixture-project')
      expect(instance.lastFrame()).toContain('Scripts: 2')
    })
    expect(instance.lastFrame()).toContain('Up/Down')
    expect(instance.lastFrame()).toContain('Tab')
    expect(instance.lastFrame()).not.toMatch(/[●↑↓·•…]/u)

    instance.stdin.write('?')
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Navegar e alternar foco'))

    instance.stdin.write('\u001B')
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Ações rápidas'))

    instance.stdin.write('/')
    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('Buscar uma ação')
      expect(instance.lastFrame()).toContain('Ir para o início')
    })

    instance.unmount()
  })

  it('renders narrow help without collisions inside an 80x24 viewport', async () => {
    const instance = render(
      <App
        cwd={workspace.path}
        initialRoute="help"
        services={createServices()}
        stdinIsTTY
        stdoutIsTTY
      />,
    )

    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Ajuda'))
    Object.defineProperties(instance.stdout, {
      columns: {configurable: true, value: 80},
      rows: {configurable: true, value: 24},
    })
    instance.stdout.emit('resize')
    await vi.waitFor(() => {
      const resizedLines = (instance.lastFrame() ?? '').split('\n')
      expect(Math.max(...resizedLines.map((line) => stringWidth(line)))).toBeLessThanOrEqual(80)
    })

    const frame = instance.lastFrame() ?? ''
    const lines = frame.split('\n')
    expect(lines).toHaveLength(24)
    expect(Math.max(...lines.map((line) => stringWidth(line)))).toBeLessThanOrEqual(80)
    for (const description of [
      'Navegar e alternar foco',
      'Ativar seleção',
      'Abrir comandos ou ajuda',
      'Voltar, cancelar ou sair',
    ]) {
      expect(lines.filter((line) => line.includes(description))).toHaveLength(1)
    }
    expect(frame).toContain('Tab')
    expect(frame).toContain('Ctrl+C')

    instance.unmount()
  })

  it('reports every completed interactive diagnostic run', async () => {
    const failedDiagnostics: DiagnosticReport = {
      checks: [
        {
          id: 'node',
          label: 'Node.js',
          message: 'Unsupported runtime.',
          remediation: 'Install Node.js 22 or newer.',
          status: 'fail',
        },
      ],
      ok: false,
      summary: {fail: 1, pass: 0, warn: 0},
    }
    const onDiagnosticsCompleted = vi.fn()
    const runDiagnostics = vi.fn(() => Promise.resolve(failedDiagnostics))
    const instance = render(
      <App
        cwd={workspace.path}
        initialRoute="doctor"
        onDiagnosticsCompleted={onDiagnosticsCompleted}
        services={createServices({runDiagnostics})}
        stdinIsTTY
        stdoutIsTTY
      />,
    )

    await vi.waitFor(() => {
      expect(onDiagnosticsCompleted).toHaveBeenCalledTimes(1)
      expect(onDiagnosticsCompleted).toHaveBeenLastCalledWith(failedDiagnostics)
    })

    instance.stdin.write('r')
    await vi.waitFor(() => {
      expect(runDiagnostics).toHaveBeenCalledTimes(2)
      expect(onDiagnosticsCompleted).toHaveBeenCalledTimes(2)
      expect(onDiagnosticsCompleted).toHaveBeenLastCalledWith(failedDiagnostics)
    })

    instance.unmount()
  })

  it('filters scripts on the task list screen', async () => {
    const instance = render(
      <App
        cwd={workspace.path}
        initialRoute="task-list"
        services={createServices()}
        stdinIsTTY
        stdoutIsTTY
      />,
    )

    await vi.waitFor(() => expect(instance.lastFrame()).toContain('2/2 scripts'))
    instance.stdin.write('lint')

    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('Busca: lint')
      expect(instance.lastFrame()).toContain('1/2 scripts')
      expect(instance.lastFrame()).not.toContain('tsc -p tsconfig.json')
    })

    instance.unmount()
  })

  it('scrolls beyond the first table window and selects later tasks', async () => {
    const manyTasks: readonly Task[] = Array.from({length: 14}, (_, index) => ({
      command: `node -e "console.log(${index + 1})"`,
      name: `task-${String(index + 1).padStart(2, '0')}`,
    }))
    const instance = render(
      <App
        cwd={workspace.path}
        initialRoute="task-list"
        services={createServices({listTasks: () => Promise.resolve(manyTasks)})}
        stdinIsTTY
        stdoutIsTTY
      />,
    )

    await vi.waitFor(() => expect(instance.lastFrame()).toContain('14/14 scripts'))
    for (let index = 1; index < manyTasks.length; index += 1) {
      instance.stdin.write('\u001B[B')
      await new Promise((resolve) => setImmediate(resolve))
    }

    instance.stdin.write('\r')
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Executar “task-14”?'))

    instance.unmount()
  })

  it('keeps screen shortcuts inactive while the command palette is open', async () => {
    const instance = render(
      <App
        cwd={workspace.path}
        initialRoute="task-list"
        services={createServices()}
        stdinIsTTY
        stdoutIsTTY
      />,
    )

    await vi.waitFor(() => expect(instance.lastFrame()).toContain('2/2 scripts'))
    instance.stdin.write('/')
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Buscar uma ação'))

    instance.stdin.write('lint')
    instance.stdin.write('\u001B')
    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('Busca: todos os scripts')
      expect(instance.lastFrame()).toContain('2/2 scripts')
      expect(instance.lastFrame()).not.toContain('Ações rápidas')
    })

    instance.unmount()
  })

  it('windows a 20-script task selector inside an 80x24 viewport', async () => {
    const manyTasks: readonly Task[] = Array.from({length: 20}, (_, index) => ({
      command: `LONG-HINT-${index + 1}-${'x'.repeat(180)}`,
      name: `task-${String(index + 1).padStart(2, '0')}`,
    }))
    const instance = render(
      <App
        cwd={workspace.path}
        initialRoute="task-run"
        services={createServices({listTasks: () => Promise.resolve(manyTasks)})}
        stdinIsTTY
        stdoutIsTTY
      />,
    )

    await vi.waitFor(() => expect(instance.lastFrame()).toContain('1-8/20'))
    Object.defineProperties(instance.stdout, {
      columns: {configurable: true, value: 80},
      rows: {configurable: true, value: 24},
    })
    instance.stdout.emit('resize')
    await vi.waitFor(() => {
      const resizedLines = (instance.lastFrame() ?? '').split('\n')
      expect(resizedLines).toHaveLength(24)
      expect(Math.max(...resizedLines.map((line) => stringWidth(line)))).toBeLessThanOrEqual(80)
    })

    expect(instance.lastFrame()).toContain('task-01')
    expect(instance.lastFrame()).not.toContain(manyTasks[0].command)
    for (let index = 1; index < manyTasks.length; index += 1) {
      instance.stdin.write('\u001B[B')
      await new Promise((resolve) => setImmediate(resolve))
    }

    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('13-20/20')
      expect(instance.lastFrame()).toContain('task-20')
      expect(instance.lastFrame()).not.toContain('task-01')
    })
    instance.stdin.write('\r')
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Executar “task-20”?'))

    instance.unmount()
  })

  it('constrains long headers, palette descriptions and task commands at 80x24', async () => {
    const longTask: Task = {
      command: `LONG-COMMAND-${'x'.repeat(230)}`,
      name: 'deploy-with-a-descriptive-script-name',
    }
    const longWorkspace: Workspace = {
      ...workspace,
      name: `workspace-${'w'.repeat(120)}`,
      scripts: {[longTask.name]: longTask.command},
    }
    const longCwd = `/projects/${'directory/'.repeat(20)}`
    const instance = render(
      <App
        cwd={longCwd}
        name={`mycli-${'n'.repeat(100)}`}
        services={createServices({
          listTasks: () => Promise.resolve([longTask]),
          readWorkspace: () => Promise.resolve(longWorkspace),
        })}
        stdinIsTTY
        stdoutIsTTY
      />,
    )

    await vi.waitFor(() => expect(instance.lastFrame()).toContain('workspace-'))
    Object.defineProperties(instance.stdout, {
      columns: {configurable: true, value: 80},
      rows: {configurable: true, value: 24},
    })
    instance.stdout.emit('resize')
    await vi.waitFor(() => {
      const resizedLines = (instance.lastFrame() ?? '').split('\n')
      expect(Math.max(...resizedLines.map((line) => stringWidth(line)))).toBeLessThanOrEqual(80)
    })

    instance.stdin.write('/')
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('LONG-COMMAND-'))
    const paletteFrame = instance.lastFrame() ?? ''
    const paletteLines = paletteFrame.split('\n')
    expect(paletteLines).toHaveLength(24)
    expect(Math.max(...paletteLines.map((line) => stringWidth(line)))).toBeLessThanOrEqual(80)
    expect(paletteFrame).toContain('Buscar uma ação...')
    expect(paletteFrame).toContain('Navegação')
    expect(paletteFrame).toContain('Tarefas')
    expect(paletteFrame).toContain('Executar deploy-with-a-descriptive-script-name')
    expect(paletteFrame).not.toContain(longTask.command)
    expect(paletteLines.filter((line) => line.includes('+')).length).toBeGreaterThanOrEqual(4)

    for (let index = 0; index < 4; index += 1) {
      instance.stdin.write('\u001B[B')
      await new Promise((resolve) => setImmediate(resolve))
    }
    instance.stdin.write('\r')
    await vi.waitFor(() =>
      expect(instance.lastFrame()).toContain('npm run -- deploy-with-a-descriptive-script-name'),
    )

    const taskFrame = instance.lastFrame() ?? ''
    const taskLines = taskFrame.split('\n')
    expect(taskLines).toHaveLength(24)
    expect(Math.max(...taskLines.map((line) => stringWidth(line)))).toBeLessThanOrEqual(80)
    expect(taskLines.filter((line) => line.includes('LONG-COMMAND-'))).toHaveLength(1)
    expect(taskFrame).not.toContain(longTask.command)
    expect(taskFrame).toContain('Executar “deploy-with-a-descriptive-script-name”?')

    instance.unmount()
  })

  it('cancels a running task on Ctrl+C without exiting the application', async () => {
    const onExit = vi.fn()
    const onTaskCompleted = vi.fn()
    const cancelledResult: TaskResult = {
      ...succeededResult,
      durationMs: 40,
      exitCode: 130,
      status: 'cancelled',
      stdout: 'starting\n',
    }
    const runTask: TuiServices['runTask'] = (input) =>
      new Promise<TaskResult>((resolve) => {
        input.onEvent?.({
          chunk: 'starting\n',
          stream: 'stdout',
          task: tasks[0],
          type: 'output',
        })

        const cancel = () => resolve(cancelledResult)
        if (input.signal?.aborted) {
          cancel()
        } else {
          input.signal?.addEventListener('abort', cancel, {once: true})
        }
      })
    const instance = render(
      <App
        cwd={workspace.path}
        initialRoute="task-run"
        initialTask="build"
        onExit={onExit}
        onTaskCompleted={onTaskCompleted}
        services={createServices({runTask})}
        stdinIsTTY
        stdoutIsTTY
      />,
    )

    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Executar “build”?'))
    instance.stdin.write('\r')
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('starting'))

    instance.stdin.write('\u0003')
    await vi.waitFor(() => {
      expect(instance.lastFrame()).toMatch(/cancelled [|·] código 130/u)
      expect(onExit).not.toHaveBeenCalled()
      expect(onTaskCompleted).toHaveBeenCalledWith(cancelledResult)
    })

    instance.unmount()
  })

  it('keeps a running task mounted when help is pressed', async () => {
    let taskSignal: AbortSignal | undefined
    const onExit = vi.fn()
    const onTaskCompleted = vi.fn()
    const cancelledResult: TaskResult = {
      ...succeededResult,
      durationMs: 40,
      exitCode: 130,
      status: 'cancelled',
      stdout: 'still running\n',
    }
    const runTask: TuiServices['runTask'] = (input) => {
      taskSignal = input.signal
      input.onEvent?.({
        chunk: 'still running\n',
        stream: 'stdout',
        task: tasks[0],
        type: 'output',
      })
      return new Promise<TaskResult>((resolve) =>
        input.signal?.addEventListener('abort', () => resolve(cancelledResult), {once: true}),
      )
    }
    const instance = render(
      <App
        cwd={workspace.path}
        initialRoute="task-run"
        initialTask="build"
        onExit={onExit}
        onTaskCompleted={onTaskCompleted}
        services={createServices({runTask})}
        stdinIsTTY
        stdoutIsTTY
      />,
    )

    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Executar “build”?'))
    instance.stdin.write('\r')
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('still running'))

    instance.stdin.write('?')
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Navegar e alternar foco'))
    expect(taskSignal?.aborted).toBe(false)
    expect(onTaskCompleted).not.toHaveBeenCalled()

    instance.stdin.write('\u0003')
    await vi.waitFor(() => {
      expect(taskSignal?.aborted).toBe(true)
      expect(onTaskCompleted).toHaveBeenCalledWith(cancelledResult)
      expect(instance.lastFrame()).toContain('Navegar e alternar foco')
      expect(onExit).not.toHaveBeenCalled()
    })

    instance.stdin.write('\u001B')
    await vi.waitFor(() => expect(instance.lastFrame()).toMatch(/cancelled [|·] código 130/u))
    instance.unmount()
  })

  it('keeps compact running frames within a short viewport and truncates long logs', async () => {
    let resolveTask: ((result: TaskResult) => void) | undefined
    const longLine = `LONG-LINE-${'x'.repeat(240)}`
    const runTask: TuiServices['runTask'] = (input) => {
      input.onEvent?.({
        chunk: `${longLine}\n`,
        stream: 'stdout',
        task: tasks[0],
        type: 'output',
      })
      return new Promise<TaskResult>((resolve) => {
        resolveTask = resolve
      })
    }
    const instance = render(
      <App
        cwd={workspace.path}
        initialRoute="task-run"
        initialTask="build"
        services={createServices({runTask})}
        stdinIsTTY
        stdoutIsTTY
      />,
    )

    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Executar “build”?'))
    Object.defineProperty(instance.stdout, 'rows', {configurable: true, value: 18})
    instance.stdout.emit('resize')
    await new Promise((resolve) => setImmediate(resolve))
    instance.stdin.write('\r')

    await vi.waitFor(() => expect(instance.lastFrame()).toContain('LONG-LINE-'))
    const frame = instance.lastFrame() ?? ''
    expect(frame.split('\n')).toHaveLength(18)
    expect(frame).not.toContain(longLine)
    expect(frame).toContain('Tab')
    expect(frame).toContain('Ctrl+C cancelar')

    resolveTask?.(succeededResult)
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('succeeded'))
    instance.unmount()
  })

  it('does not confirm task execution with navigation keys', async () => {
    const runTask = vi.fn(() => Promise.resolve(succeededResult))
    const instance = render(
      <App
        cwd={workspace.path}
        initialRoute="task-run"
        initialTask="build"
        services={createServices({runTask})}
        stdinIsTTY
        stdoutIsTTY
      />,
    )

    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Executar “build”?'))
    instance.stdin.write('\t')
    instance.stdin.write('\u001B[A')
    instance.stdin.write('\u001B[B')
    await new Promise((resolve) => setImmediate(resolve))
    expect(runTask).not.toHaveBeenCalled()

    instance.stdin.write('\r')
    await vi.waitFor(() => expect(runTask).toHaveBeenCalledOnce())

    instance.unmount()
  })

  it('handles Escape from task confirmation exactly once and returns to Task List', async () => {
    const runTask = vi.fn(() => Promise.resolve(succeededResult))
    const instance = render(
      <App
        cwd={workspace.path}
        initialRoute="task-run"
        initialTask="build"
        services={createServices({runTask})}
        stdinIsTTY
        stdoutIsTTY
      />,
    )

    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('npm run -- build')
      expect(instance.lastFrame()).toContain('Executar “build”?')
    })
    instance.stdin.write('\u001B')

    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Tarefas do package.json'))
    await new Promise((resolve) => setImmediate(resolve))
    expect(instance.lastFrame()).toContain('Tarefas do package.json')
    expect(instance.lastFrame()).not.toContain('Ações rápidas')
    expect(instance.lastFrame()).not.toContain('Executar “build”?')
    expect(runTask).not.toHaveBeenCalled()

    instance.unmount()
  })

  it('keeps the compact Home intact at 80x34 with five recent runs', async () => {
    const runTask = vi.fn(() => Promise.resolve(succeededResult))
    const instance = render(
      <App
        cwd={workspace.path}
        initialRoute="task-run"
        initialTask="build"
        services={createServices({runTask})}
        stdinIsTTY
        stdoutIsTTY
      />,
    )

    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Executar “build”?'))
    Object.defineProperties(instance.stdout, {
      columns: {configurable: true, value: 80},
      rows: {configurable: true, value: 34},
    })
    instance.stdout.emit('resize')

    for (let run = 1; run <= 5; run += 1) {
      if (run > 1) {
        instance.stdin.write('r')
        await vi.waitFor(() => expect(instance.lastFrame()).toContain('Executar “build”?'))
      }

      instance.stdin.write('\r')
      await vi.waitFor(() => {
        expect(runTask).toHaveBeenCalledTimes(run)
        expect(instance.lastFrame()).toContain('succeeded')
      })
    }

    instance.stdin.write('\u001B')
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Tarefas do package.json'))
    instance.stdin.write('\u001B')
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Ações rápidas'))

    const frame = instance.lastFrame() ?? ''
    const lines = frame.split('\n')
    expect(lines).toHaveLength(34)
    expect(Math.max(...lines.map((line) => stringWidth(line)))).toBeLessThanOrEqual(80)
    expect(frame).toContain('Início')
    expect(frame).toContain('Pacote: fixture-project')
    expect(frame).toContain('Scripts: 2')
    expect(frame).toContain('Sessão: build (succeeded)')
    expect(frame).not.toContain('Execuções nesta sessão')
    expect(frame).toContain('Tab')
    expect(frame).toContain('Ctrl+C sair')

    instance.unmount()
  })

  it('returns exit code 130 when Ctrl+C is pressed while idle', async () => {
    const onExit = vi.fn()
    const instance = render(
      <App
        cwd={workspace.path}
        onExit={onExit}
        services={createServices()}
        stdinIsTTY
        stdoutIsTTY
      />,
    )

    await vi.waitFor(() => expect(instance.lastFrame()).toContain('fixture-project'))
    instance.stdin.write('\u0003')
    await vi.waitFor(() => expect(onExit).toHaveBeenCalledWith(130))
  })
})
