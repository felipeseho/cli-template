import {cleanup, render} from 'ink-testing-library'
import stringWidth from 'string-width'
import {afterEach, describe, expect, it, vi} from 'vitest'

import type {Task, TaskResult} from '@/features/tasks/index.js'
import type {Workspace} from '@/features/workspace/index.js'
import type {ApplicationServices} from '@/runtime/services.js'
import {App} from '@/tui/app.js'
import {createServices, flushTui, resizeTui, succeededResult, tasks, workspace} from './support.js'

afterEach(cleanup)

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
    resizeTui(instance, {columns: 80, rows: 24})
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
          listTasks: () => [longTask],
          readWorkspace: () => Promise.resolve(longWorkspace),
        })}
        stdinIsTTY
        stdoutIsTTY
      />,
    )

    await vi.waitFor(() => expect(instance.lastFrame()).toContain('workspace-'))
    resizeTui(instance, {columns: 80, rows: 24})
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
      await flushTui()
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
    const runTask: ApplicationServices['runTask'] = (input) => {
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
    resizeTui(instance, {columns: 80, rows: 34})

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
    instance.unmount()
  })
})
