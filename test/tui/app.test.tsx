import {cleanup, render} from 'ink-testing-library'
import stringWidth from 'string-width'
import {afterEach, describe, expect, it, vi} from 'vitest'

import type {Task, TaskResult} from '@/features/tasks/index.js'
import type {Workspace} from '@/features/workspace/index.js'
import type {ApplicationServices} from '@/runtime/services.js'
import {App} from '@/tui/app.js'
import {UnicodeContext} from '@/tui/hooks/use-unicode.js'
import {
  createServices,
  diagnostics,
  flushTui,
  resizeTui,
  succeededResult,
  tasks,
  workspace,
} from './support.js'

afterEach(cleanup)

describe('interactive application', () => {
  it('renders the complete dashboard at 120x40 with a custom description', async () => {
    const instance = render(
      <UnicodeContext.Provider value={{unicode: true}}>
        <App
          cwd={workspace.path}
          description="Operações do time de plataforma."
          name="mycli"
          services={createServices()}
          stdinIsTTY
          stdoutIsTTY
          version="1.2.3"
        />
      </UnicodeContext.Provider>,
    )

    resizeTui(instance, {columns: 120, rows: 40})
    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('Operações do time de plataforma.')
      expect(instance.lastFrame()).toContain('Execuções nesta sessão')
      const resizedLines = (instance.lastFrame() ?? '').split('\n')
      expect(resizedLines).toHaveLength(40)
      expect(Math.max(...resizedLines.map((line) => stringWidth(line)))).toBeLessThanOrEqual(120)
    })

    const frame = instance.lastFrame() ?? ''
    const lines = frame.split('\n')
    expect(lines).toHaveLength(40)
    expect(Math.max(...lines.map((line) => stringWidth(line)))).toBeLessThanOrEqual(120)
    for (const metric of ['Workspace', 'Scripts', 'Ambiente', 'Sessão']) {
      expect(frame).toContain(metric)
    }
    expect(frame).toContain('não verificado')
    expect(frame).toContain('◆ MYCLI v1.2.3')
    expect(frame).toContain('╭')
    expect(frame).toContain('Dashboard')

    instance.unmount()
  })

  it('shows honest Home states while loading and for a workspace without scripts', async () => {
    let resolveWorkspace!: (value: Workspace) => void
    const workspacePromise = new Promise<Workspace>((resolve) => {
      resolveWorkspace = resolve
    })
    const instance = render(
      <App
        cwd={workspace.path}
        services={createServices({
          listTasks: () => [],
          readWorkspace: () => workspacePromise,
        })}
        stdinIsTTY
        stdoutIsTTY
      />,
    )

    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('Workspace: carregando')
      expect(instance.lastFrame()).toContain('Scripts: -')
      expect(instance.lastFrame()).toContain('Ambiente: não verificado')
    })

    resolveWorkspace({...workspace, scripts: {}})
    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('Workspace: fixture-project')
      expect(instance.lastFrame()).toContain('Scripts: 0')
      expect(instance.lastFrame()).toContain('Executar uma tarefa')
      expect(instance.lastFrame()).toContain('nenhuma execução')
    })

    instance.unmount()
  })

  it('keeps Doctor available when Home cannot load a workspace', async () => {
    const failure = new Error('package.json ausente')
    const onWorkspaceError = vi.fn()
    const instance = render(
      <App
        cwd="/fixture/missing"
        onWorkspaceError={onWorkspaceError}
        services={createServices({
          readWorkspace: () => Promise.reject(failure),
        })}
        stdinIsTTY
        stdoutIsTTY
      />,
    )

    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('Workspace indisponível')
      expect(instance.lastFrame()).toContain('Workspace: não detectado')
      expect(instance.lastFrame()).toContain('Verificar ambiente')
      expect(instance.lastFrame()).not.toContain('Explorar tarefas')
      expect(onWorkspaceError).toHaveBeenCalledOnce()
      expect(onWorkspaceError).toHaveBeenCalledWith(failure)
    })

    instance.unmount()
  })

  it('keeps the last diagnostic report in the Home session summary', async () => {
    const onDiagnosticsCompleted = vi.fn()
    const instance = render(
      <App
        cwd={workspace.path}
        initialRoute="doctor"
        onDiagnosticsCompleted={onDiagnosticsCompleted}
        services={createServices()}
        stdinIsTTY
        stdoutIsTTY
      />,
    )

    resizeTui(instance, {columns: 120, rows: 40})
    await vi.waitFor(() => expect(onDiagnosticsCompleted).toHaveBeenCalledWith(diagnostics))
    instance.stdin.write('\u001B')
    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('Dashboard')
      expect(instance.lastFrame()).toContain('saudável')
      expect(instance.lastFrame()).not.toContain('não verificado')
    })

    instance.unmount()
  })

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

    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('2/2 scripts')
      expect(instance.lastFrame()).toContain('> build')
    })
    instance.stdin.write('/')
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Buscar uma ação'))
    await flushTui()

    instance.stdin.write('lint')
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('>lint'))
    instance.stdin.write('\u001B')
    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('Busca: todos os scripts')
      expect(instance.lastFrame()).toContain('2/2 scripts')
      expect(instance.lastFrame()).not.toContain('Ações rápidas')
    })

    instance.unmount()
  })

  it('lets the focused Breadcrumb navigate without activating the hidden table', async () => {
    const instance = render(
      <App
        cwd={workspace.path}
        initialRoute="task-list"
        services={createServices()}
        stdinIsTTY
        stdoutIsTTY
      />,
    )

    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('2/2 scripts')
      expect(instance.lastFrame()).toContain('> build')
    })
    instance.stdin.write('\t')
    await flushTui()
    await new Promise((resolve) => setTimeout(resolve, 30))
    instance.stdin.write('\u001B[D')
    await flushTui()
    await new Promise((resolve) => setTimeout(resolve, 30))
    instance.stdin.write('\r')

    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('Ações rápidas')
      expect(instance.lastFrame()).not.toContain('CONFIRMAR EXECUÇÃO')
    })

    instance.unmount()
  })

  it('gates global shortcuts while a dialog is open and releases them after cleanup', async () => {
    const instance = render(
      <App
        cwd={workspace.path}
        initialRoute="task-run"
        initialTask="build"
        services={createServices()}
        stdinIsTTY
        stdoutIsTTY
      />,
    )

    await vi.waitFor(() =>
      expect(instance.lastFrame()).toContain('Executar “build” neste workspace?'),
    )
    await flushTui()

    instance.stdin.write('?')
    instance.stdin.write('/')
    await flushTui()
    expect(instance.lastFrame()).toContain('CONFIRMAR EXECUÇÃO')
    expect(instance.lastFrame()).not.toContain('Buscar uma ação')
    expect(instance.lastFrame()).not.toContain('Navegar e alternar foco')
    const dialogFooter = (instance.lastFrame() ?? '').split('\n').at(-2) ?? ''
    expect(dialogFooter).toContain('Left/Right escolher')
    expect(dialogFooter).not.toContain('/ comandos')
    expect(dialogFooter).not.toContain('? ajuda')

    instance.stdin.write('\u001B')
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Tarefas do package.json'))
    instance.stdin.write('/')
    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('Buscar uma ação')
      expect((instance.lastFrame() ?? '').split('\n').at(-2)).toContain('Digite para buscar')
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
    expect(taskFrame).toContain('CONFIRMAR EXECUÇÃO')
    expect(taskFrame).not.toContain(longTask.command)
    expect(taskFrame).toContain('Executar “deploy-with-a-descriptive-script-name” neste')
    expect(taskFrame).toContain('workspace?')
    expect(taskFrame).toContain('LONG')

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

    await vi.waitFor(() =>
      expect(instance.lastFrame()).toContain('Executar “build” neste workspace?'),
    )
    await flushTui()
    instance.stdin.write('\r')
    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('still running')
      expect((instance.lastFrame() ?? '').split('\n').at(-2)).toContain('? ajuda')
      expect((instance.lastFrame() ?? '').split('\n').at(-2)).not.toContain('Enter/Y confirmar')
    })

    instance.stdin.write('?')
    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('Navegar e alternar foco')
      expect((instance.lastFrame() ?? '').split('\n').at(-2)).toContain('? ou Esc fechar')
      expect((instance.lastFrame() ?? '').split('\n').at(-2)).toContain('Ctrl+C cancelar')
    })
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
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Tarefa cancelada'))
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

    await vi.waitFor(() =>
      expect(instance.lastFrame()).toContain('Executar “build” neste workspace?'),
    )
    resizeTui(instance, {columns: 80, rows: 34})

    for (let run = 1; run <= 5; run += 1) {
      if (run > 1) {
        await flushTui()
        instance.stdin.write('r')
        await vi.waitFor(() =>
          expect(instance.lastFrame()).toContain('Executar “build” neste workspace?'),
        )
      }

      await flushTui()
      instance.stdin.write('\r')
      await vi.waitFor(() => {
        expect(runTask).toHaveBeenCalledTimes(run)
        expect(instance.lastFrame()).toContain('sucesso')
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
    expect(frame).toContain('Workspace: fixture-project')
    expect(frame).toContain('Scripts: 2')
    expect(frame).toContain('Sessão: build (sucesso)')
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
