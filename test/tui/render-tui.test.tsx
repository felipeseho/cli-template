import {PassThrough} from 'node:stream'

import {describe, expect, it, vi} from 'vitest'

import type {ApplicationServices} from '@/runtime/services.js'
import {renderTui} from '@/runtime/render-tui.js'

function interactiveStreams() {
  const stdin = new PassThrough()
  const stdout = new PassThrough()
  const stderr = new PassThrough()
  const setRawMode = vi.fn()

  Object.defineProperties(stdin, {
    isTTY: {value: true},
    ref: {value: vi.fn()},
    setRawMode: {value: setRawMode},
    unref: {value: vi.fn()},
  })
  Object.defineProperties(stdout, {
    columns: {value: 80, writable: true},
    isTTY: {value: true},
    rows: {value: 24, writable: true},
  })

  return {
    setRawMode,
    stderr: stderr as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    stdout: stdout as unknown as NodeJS.WriteStream,
  }
}

describe('renderTui', () => {
  it('uses the alternate screen and restores terminal state on exit', async () => {
    const streams = interactiveStreams()
    let output = ''
    streams.stdout.on('data', (chunk) => {
      output += String(chunk)
    })
    const services: ApplicationServices = {
      listTasks: () => [],
      readWorkspace: () => Promise.reject(new Error('No package.json')),
      runDiagnostics: () =>
        Promise.resolve({
          checks: [],
          ok: true,
          summary: {fail: 0, pass: 0, warn: 0},
        }),
      runTask: () => Promise.reject(new Error('Unexpected task execution')),
    }

    const result = renderTui({
      ...streams,
      cwd: '/fixture',
      name: 'mycli',
      services,
      version: '1.0.0',
    })

    await new Promise((resolve) => setImmediate(resolve))
    streams.stdin.write('\u001B')

    await expect(result).resolves.toBe(0)
    expect(output).toContain('\u001B[?1049h')
    expect(output).toContain('\u001B[?1049l')
    expect(streams.setRawMode).toHaveBeenCalledWith(true)
    expect(streams.setRawMode).toHaveBeenLastCalledWith(false)
  })
})
