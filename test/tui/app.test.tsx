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
          description="Platform team operations."
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
      expect(instance.lastFrame()).toContain('Platform team operations.')
      expect(instance.lastFrame()).toContain('Runs this session')
      const resizedLines = (instance.lastFrame() ?? '').split('\n')
      expect(resizedLines).toHaveLength(40)
      expect(Math.max(...resizedLines.map((line) => stringWidth(line)))).toBeLessThanOrEqual(120)
    })

    const frame = instance.lastFrame() ?? ''
    const lines = frame.split('\n')
    expect(lines).toHaveLength(40)
    expect(Math.max(...lines.map((line) => stringWidth(line)))).toBeLessThanOrEqual(120)
    for (const metric of ['Workspace', 'Scripts', 'Environment', 'Session']) {
      expect(frame).toContain(metric)
    }
    expect(frame).toContain('not checked')
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
      expect(instance.lastFrame()).toContain('Workspace: loading')
      expect(instance.lastFrame()).toContain('Scripts: -')
      expect(instance.lastFrame()).toContain('Environment: not checked')
    })

    resolveWorkspace({...workspace, scripts: {}})
    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('Workspace: fixture-project')
      expect(instance.lastFrame()).toContain('Scripts: 0')
      expect(instance.lastFrame()).toContain('Run a task')
      expect(instance.lastFrame()).toContain('no runs')
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
      expect(instance.lastFrame()).toContain('Workspace unavailable')
      expect(instance.lastFrame()).toContain('Workspace: not detected')
      expect(instance.lastFrame()).toContain('Check environment')
      expect(instance.lastFrame()).not.toContain('Explore tasks')
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
      expect(instance.lastFrame()).toContain('healthy')
      expect(instance.lastFrame()).not.toContain('not checked')
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
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Navigate and toggle focus'))

    instance.stdin.write('\u001B')
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Quick actions'))

    instance.stdin.write('/')
    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('Search actions')
      expect(instance.lastFrame()).toContain('Go home')
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

    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Help'))
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
      'Navigate and toggle focus',
      'Activate selection',
      'Open commands or help',
      'Go back, cancel, or exit',
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
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Search actions'))
    await flushTui()

    instance.stdin.write('lint')
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('>lint'))
    instance.stdin.write('\u001B')
    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('Search: all scripts')
      expect(instance.lastFrame()).toContain('2/2 scripts')
      expect(instance.lastFrame()).not.toContain('Quick actions')
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
      expect(instance.lastFrame()).toContain('Quick actions')
      expect(instance.lastFrame()).not.toContain('CONFIRM RUN')
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

    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Run “build” in this workspace?'))
    await flushTui()

    instance.stdin.write('?')
    instance.stdin.write('/')
    await flushTui()
    expect(instance.lastFrame()).toContain('CONFIRM RUN')
    expect(instance.lastFrame()).not.toContain('Search actions')
    expect(instance.lastFrame()).not.toContain('Navigate and toggle focus')
    const dialogFooter = (instance.lastFrame() ?? '').split('\n').at(-2) ?? ''
    expect(dialogFooter).toContain('Left/Right choose')
    expect(dialogFooter).not.toContain('/ commands')
    expect(dialogFooter).not.toContain('? help')

    instance.stdin.write('\u001B')
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('package.json tasks'))
    instance.stdin.write('/')
    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('Search actions')
      expect((instance.lastFrame() ?? '').split('\n').at(-2)).toContain('Type to search')
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
    expect(paletteFrame).toContain('Search actions...')
    expect(paletteFrame).toContain('Navigation')
    expect(paletteFrame).toContain('Tasks')
    expect(paletteFrame).toContain('Run deploy-with-a-descriptive-script-name')
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
    expect(taskFrame).toContain('CONFIRM RUN')
    expect(taskFrame).not.toContain(longTask.command)
    expect(taskFrame).toContain('Run “deploy-with-a-descriptive-script-name” in this')
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

    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Run “build” in this workspace?'))
    await flushTui()
    instance.stdin.write('\r')
    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('still running')
      expect((instance.lastFrame() ?? '').split('\n').at(-2)).toContain('? help')
      expect((instance.lastFrame() ?? '').split('\n').at(-2)).not.toContain('Enter/Y confirm')
    })

    instance.stdin.write('?')
    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('Navigate and toggle focus')
      expect((instance.lastFrame() ?? '').split('\n').at(-2)).toContain('? or Esc close')
      expect((instance.lastFrame() ?? '').split('\n').at(-2)).toContain('Ctrl+C cancel')
    })
    expect(taskSignal?.aborted).toBe(false)
    expect(onTaskCompleted).not.toHaveBeenCalled()

    instance.stdin.write('\u0003')
    await vi.waitFor(() => {
      expect(taskSignal?.aborted).toBe(true)
      expect(onTaskCompleted).toHaveBeenCalledWith(cancelledResult)
      expect(instance.lastFrame()).toContain('Navigate and toggle focus')
      expect(onExit).not.toHaveBeenCalled()
    })

    instance.stdin.write('\u001B')
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Task cancelled'))
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

    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Run “build” in this workspace?'))
    resizeTui(instance, {columns: 80, rows: 34})

    for (let run = 1; run <= 5; run += 1) {
      if (run > 1) {
        await flushTui()
        instance.stdin.write('r')
        await vi.waitFor(() =>
          expect(instance.lastFrame()).toContain('Run “build” in this workspace?'),
        )
      }

      await flushTui()
      instance.stdin.write('\r')
      await vi.waitFor(() => {
        expect(runTask).toHaveBeenCalledTimes(run)
        expect(instance.lastFrame()).toContain('success')
      })
    }

    instance.stdin.write('\u001B')
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('package.json tasks'))
    instance.stdin.write('\u001B')
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Quick actions'))

    const frame = instance.lastFrame() ?? ''
    const lines = frame.split('\n')
    expect(lines).toHaveLength(34)
    expect(Math.max(...lines.map((line) => stringWidth(line)))).toBeLessThanOrEqual(80)
    expect(frame).toContain('Home')
    expect(frame).toContain('Workspace: fixture-project')
    expect(frame).toContain('Scripts: 2')
    expect(frame).toContain('Session: build (success)')
    expect(frame).not.toContain('Runs this session')
    expect(frame).toContain('Tab')
    expect(frame).toContain('Ctrl+C exit')

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
