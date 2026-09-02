import {Box, Text} from 'ink'

import {Panel} from '@/tui/components/app/panel.js'
import {ScreenTitle} from '@/tui/components/app/screen-title.js'
import {Alert} from '@/tui/components/ui/alert.js'
import type {Shortcut} from '@/tui/components/ui/keyboard-shortcuts.js'
import {useTheme} from '@/tui/hooks/use-theme.js'
import {useUnicode} from '@/tui/hooks/use-unicode.js'

import {NAVIGATION_SHORTCUTS} from '../keymap.js'

export interface HelpScreenProps {
  readonly viewportRows: number
  readonly wide: boolean
}

function ShortcutList({shortcuts}: {readonly shortcuts: readonly Shortcut[]}) {
  const theme = useTheme()
  const groups = new Map<string | undefined, Shortcut[]>()

  for (const shortcut of shortcuts) {
    const items = groups.get(shortcut.category) ?? []
    items.push(shortcut)
    groups.set(shortcut.category, items)
  }

  return (
    <Box aria-role="toolbar" flexDirection="column">
      {[...groups.entries()].map(([category, items]) => (
        <Box key={category ?? 'essential'} flexDirection="column">
          {category ? (
            <Text bold color={theme.colors.mutedForeground}>
              {category}
            </Text>
          ) : null}
          {items.map((shortcut) => (
            <Box key={shortcut.key} gap={1}>
              <Box width={18}>
                <Text bold color={theme.colors.primary} wrap="truncate-end">
                  {shortcut.key}
                </Text>
              </Box>
              <Text color={theme.colors.foreground} wrap="truncate-end">
                {shortcut.description}
              </Text>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  )
}

export function HelpScreen({viewportRows, wide}: HelpScreenProps) {
  const unicode = useUnicode()
  const compact = !wide || viewportRows < 28
  const compactShortcuts: Shortcut[] = [
    {
      description: 'Navigate and toggle focus',
      key: `${unicode ? '↑↓' : 'Up/Down'} / Tab`,
    },
    {description: 'Activate selection', key: 'Enter'},
    {description: 'Open commands or help', key: '/ / ?'},
    {description: 'Go back, cancel, or exit', key: 'Esc / Ctrl+C'},
  ]
  const taskShortcuts: Shortcut[] = [
    {category: 'Run', description: 'Confirm the action', key: 'Enter / Y'},
    {category: 'Run', description: 'Cancel the dialog', key: 'Esc / N'},
    {category: 'Run', description: 'Retry after completion', key: 'R'},
    {category: 'Run', description: 'Back to tasks', key: 'B'},
    {category: 'Log', description: 'Scroll output', key: 'J / K'},
    {category: 'Log', description: 'Alternar FOLLOW/PAUSED', key: 'F'},
  ]

  return (
    <Box flexDirection="column">
      <ScreenTitle
        description={compact ? undefined : 'Shortcuts available throughout the interface.'}
        title="Help"
      />
      {compact ? (
        <Panel title="ATALHOS ESSENCIAIS">
          <ShortcutList shortcuts={compactShortcuts} />
        </Panel>
      ) : (
        <Box gap={1}>
          <Box flexBasis={0} flexGrow={1} minWidth={0}>
            <Panel title="GLOBAL NAVIGATION" width="100%">
              <ShortcutList shortcuts={[...NAVIGATION_SHORTCUTS]} />
            </Panel>
          </Box>
          <Box flexBasis={0} flexGrow={1} minWidth={0}>
            <Panel title="TASKS AND LOGS" width="100%">
              <ShortcutList shortcuts={taskShortcuts} />
            </Panel>
          </Box>
        </Box>
      )}
      <Box marginTop={compact ? 0 : 1}>
        <Alert bordered={false} title="Safe cancellation" variant="info">
          In an active task, Ctrl+C only cancels the process; otherwise, it exits the interface.
        </Alert>
      </Box>
    </Box>
  )
}
