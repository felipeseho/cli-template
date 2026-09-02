import {Box, Text, useInput} from 'ink'
import {cleanup, render} from 'ink-testing-library'
import {useState} from 'react'
import type {ReactElement} from 'react'
import {afterEach, describe, expect, it, vi} from 'vitest'

import {Alert} from '@/tui/components/ui/alert.js'
import {Breadcrumb} from '@/tui/components/ui/breadcrumb.js'
import {Dialog} from '@/tui/components/ui/dialog.js'
import {ProgressBar} from '@/tui/components/ui/progress-bar.js'
import {useInteraction} from '@/tui/hooks/use-interaction.js'
import {UnicodeContext} from '@/tui/hooks/use-unicode.js'

afterEach(cleanup)

const renderWithUnicode = (element: ReactElement, unicode: boolean) =>
  render(<UnicodeContext.Provider value={{unicode}}>{element}</UnicodeContext.Provider>)

const flushEffects = async () => {
  await new Promise<void>((resolve) => setImmediate(resolve))
  await new Promise<void>((resolve) => setImmediate(resolve))
}

describe('dashboard primitives', () => {
  it('renders Alert text and Ink content without nesting layout nodes inside Text', () => {
    const instance = renderWithUnicode(
      <Alert title="Workspace unavailable" variant="warning">
        Simple message
        <Box>
          <Text>Remediation in Ink</Text>
        </Box>
      </Alert>,
      false,
    )

    const frame = instance.lastFrame() ?? ''
    expect(frame).toContain('! Workspace unavailable')
    expect(frame).toContain('Simple message')
    expect(frame).toContain('Remediation in Ink')
    expect(frame).toContain('+')
    expect(frame).not.toMatch(/[⚠╭╮╰╯]/u)
  })

  it('clamps ProgressBar value and width and uses deterministic character fallbacks', () => {
    const complete = renderWithUnicode(<ProgressBar max={10} value={999} width={-4} />, false)
    expect(complete.lastFrame()).toContain('# 100% 10/10')
    expect(complete.lastFrame()).not.toMatch(/[█░]/u)
    complete.unmount()

    const empty = renderWithUnicode(<ProgressBar total={0} value={Number.NaN} width={3} />, false)
    expect(empty.lastFrame()).toContain('... 0% 0/0')
    empty.unmount()

    const phases = renderWithUnicode(
      <ProgressBar max={3} showPercent={false} value={1} valueLabel="1/3 steps" width={3} />,
      true,
    )
    expect(phases.lastFrame()).toContain('█░░ 1/3 steps')
  })

  it('moves the Breadcrumb cursor without navigating until Enter and leaves Escape to its parent', async () => {
    const navigateHome = vi.fn()
    const navigateTasks = vi.fn()
    const navigateRun = vi.fn()
    const onBack = vi.fn()
    const onSelect = vi.fn()

    const Harness = () => {
      useInput((_input, key) => {
        if (key.escape) {
          onBack()
        }
      })

      return (
        <Breadcrumb
          autoFocus
          currentIndex={2}
          items={[
            {id: 'home', label: 'Home', onSelect: navigateHome},
            {id: 'tasks', label: 'Tasks', onSelect: navigateTasks},
            {id: 'run', label: 'build', onSelect: navigateRun},
          ]}
          onSelect={onSelect}
        />
      )
    }

    const instance = render(<Harness />)
    await flushEffects()

    instance.stdin.write('\u001B[D')
    await flushEffects()
    expect(navigateTasks).not.toHaveBeenCalled()
    expect(onSelect).not.toHaveBeenCalled()

    instance.stdin.write('\r')
    await vi.waitFor(() => expect(navigateTasks).toHaveBeenCalledOnce())
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({id: 'tasks'}), 1)

    instance.stdin.write('\u001B[H')
    await flushEffects()
    instance.stdin.write('\r')
    await vi.waitFor(() => expect(navigateHome).toHaveBeenCalledOnce())

    instance.stdin.write('\u001B[F')
    await flushEffects()
    instance.stdin.write('\r')
    await vi.waitFor(() => expect(navigateRun).toHaveBeenCalledOnce())

    instance.stdin.write('\u001B')
    await vi.waitFor(() => expect(onBack).toHaveBeenCalledOnce())
  })

  it('uses Dialog defaults, directional keys, shortcuts and restores focus', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()

    const FocusHarness = () => {
      const [open, setOpen] = useState(true)
      const {isFocused} = useInteraction({autoFocus: true, id: 'dialog-launcher'})

      return (
        <Box flexDirection="column">
          <Text>{isFocused ? 'launcher focused' : 'launcher idle'}</Text>
          <Dialog
            cancelLabel="Cancel"
            confirmLabel="Run"
            onConfirm={() => {
              onConfirm()
              setOpen(false)
            }}
            onOpenChange={setOpen}
            open={open}
            returnFocusId="dialog-launcher"
            title="Confirm run"
          >
            npm run -- build
          </Dialog>
        </Box>
      )
    }

    const instance = render(<FocusHarness />)
    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('Confirm run')
      expect(instance.lastFrame()).toContain('[ Run ]')
    })
    await flushEffects()
    instance.stdin.write('\r')
    await vi.waitFor(() => {
      expect(onConfirm).toHaveBeenCalledOnce()
      expect(instance.lastFrame()).not.toContain('Confirm run')
      expect(instance.lastFrame()).toContain('launcher focused')
    })
    instance.unmount()

    const danger = render(
      <Dialog defaultOpen onCancel={onCancel} title="Remove" variant="danger">
        This action is destructive.
      </Dialog>,
    )
    await flushEffects()
    expect(danger.lastFrame()).toContain('[ Cancel ]')
    danger.stdin.write('\r')
    await vi.waitFor(() => expect(onCancel).toHaveBeenCalledOnce())
    danger.unmount()

    const keyboardConfirm = render(
      <Dialog defaultAction="cancel" defaultOpen onConfirm={onConfirm} title="Run?" />,
    )
    await flushEffects()
    keyboardConfirm.stdin.write('\u001B[C')
    await flushEffects()
    keyboardConfirm.stdin.write('\r')
    await vi.waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(2))
    keyboardConfirm.unmount()

    const shortcuts = render(
      <Dialog open onCancel={onCancel} onConfirm={onConfirm} title="Atalhos" />,
    )
    await flushEffects()
    shortcuts.stdin.write('y')
    await vi.waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(3))
    shortcuts.stdin.write('n')
    await vi.waitFor(() => expect(onCancel).toHaveBeenCalledTimes(2))
    shortcuts.stdin.write('\u001B')
    await vi.waitFor(() => expect(onCancel).toHaveBeenCalledTimes(3))
  })
})
