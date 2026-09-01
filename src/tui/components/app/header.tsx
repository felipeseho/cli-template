import {Box, Text} from 'ink'

import type {Workspace} from '@/features/workspace/types.js'
import {useTheme} from '@/tui/hooks/use-theme.js'
import {useUnicode} from '@/tui/hooks/use-unicode.js'

export interface HeaderProps {
  readonly cwd: string
  readonly isTaskRunning: boolean
  readonly name: string
  readonly version: string
  readonly workspace?: Workspace
}

export function Header({cwd, isTaskRunning, name, version, workspace}: HeaderProps) {
  const theme = useTheme()
  const unicode = useUnicode()
  const statusSymbol = unicode ? '●' : '*'
  const status = `${statusSymbol} ${isTaskRunning ? 'tarefa em execução' : 'pronto'}`

  return (
    <Box flexDirection="column" marginBottom={1} overflow="hidden" paddingX={1} width="100%">
      <Box height={1} justifyContent="space-between" overflow="hidden">
        <Box flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
          <Text bold color={theme.colors.primary} wrap="truncate-end">
            {name} <Text color={theme.colors.mutedForeground}>v{version}</Text>
          </Text>
        </Box>
        <Box flexShrink={0} marginLeft={1}>
          <Text
            color={isTaskRunning ? theme.colors.warning : theme.colors.success}
            wrap="truncate-end"
          >
            {status}
          </Text>
        </Box>
      </Box>
      <Box height={1} justifyContent="space-between" overflow="hidden">
        <Box flexShrink={1} minWidth={0} overflow="hidden" width="60%">
          <Text color={theme.colors.mutedForeground} wrap="truncate-middle">
            {cwd}
          </Text>
        </Box>
        <Box flexShrink={1} justifyContent="flex-end" minWidth={0} overflow="hidden" width="40%">
          <Text color={theme.colors.accent} wrap="truncate-end">
            {workspace?.name ?? 'workspace não detectado'}
          </Text>
        </Box>
      </Box>
    </Box>
  )
}
