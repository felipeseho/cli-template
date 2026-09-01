import {Box, Text} from 'ink'

import type {Workspace} from '@/features/workspace/index.js'
import {resolveBrandSymbol} from '@/terminal/brand.js'
import {useTheme} from '@/tui/hooks/use-theme.js'
import {useUnicode} from '@/tui/hooks/use-unicode.js'
import type {DashboardLayout} from '@/tui/layout.js'

export type HeaderStatus = 'loading' | 'ready' | 'running' | 'warning'

export interface HeaderProps {
  readonly cwd: string
  readonly description: string
  readonly layout: DashboardLayout
  readonly name: string
  readonly status: HeaderStatus
  readonly version: string
  readonly workspace?: Workspace
}

const statusLabel: Record<HeaderStatus, string> = {
  loading: 'CARREGANDO',
  ready: 'PRONTO',
  running: 'EXECUTANDO',
  warning: 'ATENÇÃO',
}

export function Header({cwd, description, layout, name, status, version, workspace}: HeaderProps) {
  const theme = useTheme()
  const unicode = useUnicode()
  const compact = layout === 'compact'
  const statusColor = {
    loading: theme.colors.info,
    ready: theme.colors.success,
    running: theme.colors.warning,
    warning: theme.colors.warning,
  }[status]
  const separator = unicode ? ' · ' : ' | '

  return (
    <Box flexDirection="column" height={2} overflow="hidden" paddingX={1} width="100%">
      <Box height={1} justifyContent="space-between" overflow="hidden">
        <Box flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
          <Text bold color={theme.colors.primary} wrap="truncate-end">
            {resolveBrandSymbol('mark', unicode)} {name.toLocaleUpperCase()}{' '}
            <Text color={theme.colors.mutedForeground}>v{version}</Text>
            {!compact ? (
              <Text color={theme.colors.mutedForeground}>
                {separator}
                {description}
              </Text>
            ) : null}
          </Text>
        </Box>
        <Box flexShrink={0} marginLeft={1}>
          <Text bold color={statusColor} wrap="truncate-end">
            {unicode ? '●' : '*'} {statusLabel[status]}
          </Text>
        </Box>
      </Box>

      <Box height={1} justifyContent="space-between" overflow="hidden">
        <Box flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
          <Text color={theme.colors.accent} wrap="truncate-end">
            {workspace?.name ?? 'workspace não detectado'}
            <Text color={theme.colors.mutedForeground}>
              {separator}
              {cwd}
            </Text>
          </Text>
        </Box>
        {!compact ? (
          <Box flexShrink={0} marginLeft={1}>
            <Text color={theme.colors.mutedForeground}>/ ações{separator}? ajuda</Text>
          </Box>
        ) : null}
      </Box>
    </Box>
  )
}
