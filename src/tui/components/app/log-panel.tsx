import {Box, Text} from 'ink'
import {useMemo, useState} from 'react'

import {resolveBorderStyle} from '@/lib/terminal-style.js'
import {
  Log,
  type LogEntry,
  type LogLevel,
  type LogProps,
  type LogState,
} from '@/tui/components/ui/log.js'
import {useTheme} from '@/tui/hooks/use-theme.js'
import {useUnicode} from '@/tui/hooks/use-unicode.js'
import {sanitizeLogMessage} from '@/tui/logging.js'

export type {LogEntry} from '@/tui/components/ui/log.js'

export interface LogPanelProps extends Omit<LogProps, 'entries' | 'onStateChange' | 'showFooter'> {
  readonly entries: readonly LogEntry[]
  readonly title?: string
}

const levelPriority: Record<LogLevel, number> = {
  debug: 0,
  error: 3,
  info: 1,
  warn: 2,
}

const levelLabel: Record<LogLevel, string> = {
  debug: 'DBG',
  error: 'ERR',
  info: 'INF',
  warn: 'WRN',
}

function getHighestLevel(entries: readonly LogEntry[]): LogLevel | undefined {
  return entries.reduce<LogLevel | undefined>((highest, entry) => {
    if (!highest || levelPriority[entry.level] > levelPriority[highest]) {
      return entry.level
    }

    return highest
  }, undefined)
}

export function LogPanel({entries, height = 6, title = 'LOG AO VIVO', ...props}: LogPanelProps) {
  const theme = useTheme()
  const unicode = useUnicode()
  const safeEntries = useMemo(
    () => entries.map((entry) => ({...entry, message: sanitizeLogMessage(entry.message)})),
    [entries],
  )
  const [state, setState] = useState<LogState>({
    end: Math.min(height, entries.length),
    follow: props.follow ?? false,
    start: entries.length === 0 ? 0 : 1,
    total: entries.length,
  })
  const highestLevel = getHighestLevel(safeEntries)
  const separator = unicode ? '·' : '|'

  const levelColor = (() => {
    switch (highestLevel) {
      case 'error': {
        return theme.colors.error
      }
      case 'warn': {
        return theme.colors.warning
      }
      case 'info': {
        return theme.colors.info
      }
      default: {
        return theme.colors.mutedForeground
      }
    }
  })()

  return (
    <Box
      borderColor={theme.colors.border}
      borderStyle={resolveBorderStyle('round', unicode)}
      flexDirection="column"
      flexShrink={0}
      paddingX={1}
      width="100%"
    >
      <Box justifyContent="space-between" overflow="hidden">
        <Text bold color={theme.colors.accent} wrap="truncate-end">
          {title}
        </Text>
        <Text color={theme.colors.mutedForeground} wrap="truncate-end">
          <Text bold color={levelColor}>
            {highestLevel ? levelLabel[highestLevel] : '---'}
          </Text>{' '}
          {separator} {state.start}-{state.end}/{state.total} {separator}{' '}
          <Text bold color={state.follow ? theme.colors.success : theme.colors.warning}>
            {state.follow ? 'FOLLOW' : 'PAUSED'}
          </Text>
        </Text>
      </Box>
      <Log
        {...props}
        entries={safeEntries}
        height={height}
        onStateChange={setState}
        showFooter={false}
      />
      {height >= 3 ? (
        <Text color={theme.colors.mutedForeground} dimColor wrap="truncate-end">
          j/k rolar {separator} f alternar follow
        </Text>
      ) : null}
    </Box>
  )
}
