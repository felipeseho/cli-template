import {cleanup, render} from 'ink-testing-library'
import stringWidth from 'string-width'
import {afterEach, describe, expect, it, vi} from 'vitest'

import type {RunTaskInput, Task, TaskResult} from '@/features/tasks/index.js'
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
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('> build'))
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

    resizeTui(instance, {columns: 120, rows: 40})
    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('14/14 scripts')
      expect(instance.lastFrame()).toContain('> task-01')
    })
    for (let index = 1; index < manyTasks.length; index += 1) {
      instance.stdin.write('\u001B[B')
      await vi.waitFor(() => expect(instance.lastFrame()).toContain(`> ${manyTasks[index]?.name}`))
    }

    instance.stdin.write('\r')
    await vi.waitFor(() =>
      expect(instance.lastFrame()).toContain('Executar “task-14” neste workspace?'),
    )

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

    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('1-8/20')
      expect(instance.lastFrame()).toContain('> task-01')
    })
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
      await vi.waitFor(() => expect(instance.lastFrame()).toContain(`> ${manyTasks[index]?.name}`))
    }

    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('13-20/20')
      expect(instance.lastFrame()).toContain('task-20')
      expect(instance.lastFrame()).not.toContain('task-01')
    })
    instance.stdin.write('\r')
    await vi.waitFor(() =>
      expect(instance.lastFrame()).toContain('Executar “task-20” neste workspace?'),
    )

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

    await vi.waitFor(() =>
      expect(instance.lastFrame()).toContain('Executar “build” neste workspace?'),
    )
    await flushTui()
    instance.stdin.write('\r')
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('starting'))

    instance.stdin.write('\u0003')
    await vi.waitFor(() => {
      expect(instance.lastFrame()).toMatch(/cancelada [|·] código 130/u)
      expect(instance.lastFrame()).toContain('[!] Executar')
      expect(instance.lastFrame()).toContain('[!] Concluir')
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

    await vi.waitFor(() =>
      expect(instance.lastFrame()).toContain('Executar “build” neste workspace?'),
    )
    resizeTui(instance, {columns: 80, rows: 18})
    await flushTui()
    instance.stdin.write('\r')

    await vi.waitFor(() => expect(instance.lastFrame()).toContain('LONG-LINE-'))
    const frame = instance.lastFrame() ?? ''
    expect(frame.split('\n')).toHaveLength(18)
    expect(frame).not.toContain(longLine)
    expect(frame).toContain('Tab')
    expect(frame).toContain('Ctrl+C cancelar')

    resolveTask?.(succeededResult)
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('sucesso'))
    const resultFrame = instance.lastFrame() ?? ''
    const resultLines = resultFrame.split('\n')
    expect(resultLines).toHaveLength(18)
    expect(Math.max(...resultLines.map((line) => stringWidth(line)))).toBeLessThanOrEqual(80)
    expect(resultFrame).toContain('Tarefa concluída')
    expect(resultFrame).toContain('LOG DA EXECUÇÃO')
    expect(resultFrame).toContain('R repetir')
    expect(resultLines.some((line) => line.includes('sucesso') && line.includes('---'))).toBe(false)
    instance.unmount()
  })

  it('sanitizes the displayed log without changing the completed result', async () => {
    const rawOutput = '\u001B[31mRED\u001B[0m\u0000DONE\n'
    const rawResult: TaskResult = {
      ...succeededResult,
      outputTruncated: true,
      stdout: rawOutput,
    }
    const onTaskCompleted = vi.fn()
    const runTask: ApplicationServices['runTask'] = (input) => {
      input.onEvent?.({
        chunk: rawOutput,
        stream: 'stdout',
        task: tasks[0],
        type: 'output',
      })
      return Promise.resolve(rawResult)
    }
    const instance = render(
      <App
        cwd={workspace.path}
        initialRoute="task-run"
        initialTask="build"
        onTaskCompleted={onTaskCompleted}
        services={createServices({runTask})}
        stdinIsTTY
        stdoutIsTTY
      />,
    )

    resizeTui(instance, {columns: 120, rows: 40})
    await vi.waitFor(() =>
      expect(instance.lastFrame()).toContain('Executar “build” neste workspace?'),
    )
    await flushTui()
    instance.stdin.write('\r')

    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('Tarefa concluída')
      expect(instance.lastFrame()).toContain('RED DONE')
      expect(instance.lastFrame()).toContain('Saída truncada')
      expect(instance.lastFrame()).not.toContain('\u001B')
      expect(onTaskCompleted).toHaveBeenCalledWith(rawResult)
      expect(rawResult.stdout).toBe(rawOutput)
    })

    instance.unmount()
  })

  it('shows failures as alerts and returns to confirmation on retry', async () => {
    const failure = new Error('Process spawn failed.')
    const onTaskError = vi.fn()
    const runTask = vi.fn(() => Promise.reject(failure))
    const instance = render(
      <App
        cwd={workspace.path}
        initialRoute="task-run"
        initialTask="build"
        onTaskError={onTaskError}
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
      expect(instance.lastFrame()).toContain('Não foi possível concluir a tarefa')
      expect(instance.lastFrame()).toContain('Process spawn failed.')
      expect(instance.lastFrame()).toContain('[!] Executar')
      expect(instance.lastFrame()).toContain('[!] Concluir')
      expect(onTaskError).toHaveBeenCalledOnce()
      expect(onTaskError).toHaveBeenCalledWith(failure)
    })

    await flushTui()
    instance.stdin.write('r')
    await vi.waitFor(() =>
      expect(instance.lastFrame()).toContain('Executar “build” neste workspace?'),
    )
    expect(runTask).toHaveBeenCalledOnce()

    instance.unmount()
  })

  it.each([
    {expected: undefined, label: 'the adapter default', taskOutputLimit: undefined},
    {expected: 0, label: 'zero', taskOutputLimit: 0},
    {expected: 4_096, label: 'a custom value', taskOutputLimit: 4_096},
  ])('forwards $label as the task output limit', async ({expected, taskOutputLimit}) => {
    const runTask = vi.fn((input: RunTaskInput) =>
      Promise.resolve({...succeededResult, workspacePath: input.workspace.path}),
    )
    const instance = render(
      <App
        cwd={workspace.path}
        initialRoute="task-run"
        initialTask="build"
        services={createServices({runTask})}
        stdinIsTTY
        stdoutIsTTY
        {...(taskOutputLimit === undefined ? {} : {taskOutputLimit})}
      />,
    )

    await vi.waitFor(() =>
      expect(instance.lastFrame()).toContain('Executar “build” neste workspace?'),
    )
    await flushTui()
    instance.stdin.write('\r')

    await vi.waitFor(() => expect(runTask).toHaveBeenCalledOnce())
    const input = runTask.mock.calls[0]?.[0]
    expect(input).toBeDefined()
    if (expected === undefined) {
      expect(input).not.toHaveProperty('outputLimit')
    } else {
      expect(input).toHaveProperty('outputLimit', expected)
    }

    instance.unmount()
  })

  it('marks a non-zero task result as failed in both the alert and phase trail', async () => {
    const failedResult: TaskResult = {
      ...succeededResult,
      exitCode: 7,
      status: 'failed',
      stderr: 'build failed\n',
    }
    const instance = render(
      <App
        cwd={workspace.path}
        initialRoute="task-run"
        initialTask="build"
        services={createServices({runTask: () => Promise.resolve(failedResult)})}
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
      expect(instance.lastFrame()).toContain('Tarefa concluída com falha')
      expect(instance.lastFrame()).toMatch(/falhou [|·] código 7/u)
      expect(instance.lastFrame()).toContain('[!] Executar')
      expect(instance.lastFrame()).toContain('[!] Concluir')
    })

    instance.unmount()
  })

  it('exposes FOLLOW and PAUSED states while a task streams logs', async () => {
    let resolveTask: ((result: TaskResult) => void) | undefined
    const runTask: ApplicationServices['runTask'] = (input) => {
      for (let index = 1; index <= 12; index += 1) {
        input.onEvent?.({
          chunk: `line ${index}\n`,
          stream: 'stdout',
          task: tasks[0],
          type: 'output',
        })
      }

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

    resizeTui(instance, {columns: 120, rows: 40})
    await vi.waitFor(() =>
      expect(instance.lastFrame()).toContain('Executar “build” neste workspace?'),
    )
    await flushTui()
    instance.stdin.write('\r')
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('FOLLOW'))

    instance.stdin.write('k')
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('PAUSED'))

    instance.stdin.write('f')
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('FOLLOW'))

    resolveTask?.(succeededResult)
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Tarefa concluída'))
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

    await vi.waitFor(() =>
      expect(instance.lastFrame()).toContain('Executar “build” neste workspace?'),
    )
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
      expect(instance.lastFrame()).toContain('Executar “build” neste workspace?')
    })
    await flushTui()
    instance.stdin.write('\u001B')

    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Tarefas do package.json'))
    await flushTui()
    expect(instance.lastFrame()).toContain('Tarefas do package.json')
    expect(instance.lastFrame()).not.toContain('Ações rápidas')
    expect(instance.lastFrame()).not.toContain('Executar “build” neste workspace?')
    expect(runTask).not.toHaveBeenCalled()

    instance.unmount()
  })
})
