import {cleanup, render} from 'ink-testing-library'
import stringWidth from 'string-width'
import {afterEach, describe, expect, it, vi} from 'vitest'

import type {Task, TaskResult} from '@/features/tasks/index.js'
import type {ApplicationServices} from '@/runtime/services.js'
import {App} from '@/tui/app.js'
import {
  createServices,
  flushTui,
  resizeTui,
  succeededResult,
  tasks,
  workspace,
} from '../../tui/support.js'

afterEach(cleanup)

describe('tasks TUI', () => {
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
        services={createServices({listTasks: () => manyTasks})}
        stdinIsTTY
        stdoutIsTTY
      />,
    )

    await vi.waitFor(() => expect(instance.lastFrame()).toContain('14/14 scripts'))
    for (let index = 1; index < manyTasks.length; index += 1) {
      instance.stdin.write('\u001B[B')
      await flushTui()
    }

    instance.stdin.write('\r')
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Executar “task-14”?'))

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
        services={createServices({listTasks: () => manyTasks})}
        stdinIsTTY
        stdoutIsTTY
      />,
    )

    await vi.waitFor(() => expect(instance.lastFrame()).toContain('1-8/20'))
    resizeTui(instance, {columns: 80, rows: 24})
    await vi.waitFor(() => {
      const resizedLines = (instance.lastFrame() ?? '').split('\n')
      expect(resizedLines).toHaveLength(24)
      expect(Math.max(...resizedLines.map((line) => stringWidth(line)))).toBeLessThanOrEqual(80)
    })

    expect(instance.lastFrame()).toContain('task-01')
    expect(instance.lastFrame()).not.toContain(manyTasks[0].command)
    for (let index = 1; index < manyTasks.length; index += 1) {
      instance.stdin.write('\u001B[B')
      await flushTui()
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
    const runTask: ApplicationServices['runTask'] = (input) =>
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

  it('keeps compact running frames within a short viewport and truncates long logs', async () => {
    let resolveTask: ((result: TaskResult) => void) | undefined
    const longLine = `LONG-LINE-${'x'.repeat(240)}`
    const runTask: ApplicationServices['runTask'] = (input) => {
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
    resizeTui(instance, {rows: 18})
    await flushTui()
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
    await flushTui()
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
    await flushTui()
    expect(instance.lastFrame()).toContain('Tarefas do package.json')
    expect(instance.lastFrame()).not.toContain('Ações rápidas')
    expect(instance.lastFrame()).not.toContain('Executar “build”?')
    expect(runTask).not.toHaveBeenCalled()

    instance.unmount()
  })
})
