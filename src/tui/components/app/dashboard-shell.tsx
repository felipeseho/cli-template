import {Box, Text} from 'ink'
import type {ReactNode} from 'react'

import {resolveBorderStyle} from '@/lib/terminal-style.js'
import {AppShell} from '@/tui/components/ui/app-shell.js'
import {useTheme} from '@/tui/hooks/use-theme.js'
import {useUnicode} from '@/tui/hooks/use-unicode.js'

export interface DashboardShellProps {
  readonly alert?: ReactNode
  readonly breadcrumb: ReactNode
  readonly children: ReactNode
  readonly footer: string
  readonly header: ReactNode
  readonly overlay?: ReactNode
}

export function DashboardShell({
  alert,
  breadcrumb,
  children,
  footer,
  header,
  overlay,
}: DashboardShellProps) {
  const theme = useTheme()
  const unicode = useUnicode()
  const borderStyle = resolveBorderStyle('round', unicode)

  return (
    <AppShell fullscreen>
      <Box
        borderColor={theme.colors.border}
        borderStyle={borderStyle}
        flexDirection="column"
        flexGrow={1}
        height="100%"
        overflow="hidden"
        width="100%"
      >
        <Box
          borderBottom
          borderColor={theme.colors.border}
          borderLeft={false}
          borderRight={false}
          borderStyle={borderStyle}
          borderTop={false}
          flexDirection="column"
          flexShrink={0}
        >
          {header}
        </Box>

        <Box
          borderBottom
          borderColor={theme.colors.border}
          borderLeft={false}
          borderRight={false}
          borderStyle={borderStyle}
          borderTop={false}
          flexShrink={0}
          height={2}
          overflow="hidden"
          paddingX={1}
        >
          {breadcrumb}
        </Box>

        <Box flexDirection="column" flexGrow={1} flexShrink={1} overflow="hidden" paddingX={1}>
          {alert ? <Box flexShrink={0}>{alert}</Box> : null}
          <Box
            display={overlay ? 'none' : 'flex'}
            flexDirection="column"
            flexGrow={1}
            flexShrink={1}
            overflow="hidden"
          >
            {children}
          </Box>
          {overlay ? (
            <Box flexDirection="column" flexGrow={1} flexShrink={1} overflow="hidden">
              {overlay}
            </Box>
          ) : null}
        </Box>

        <Box
          borderColor={theme.colors.border}
          borderLeft={false}
          borderRight={false}
          borderStyle={borderStyle}
          borderBottom={false}
          borderTop
          flexShrink={0}
          height={2}
          overflow="hidden"
          paddingX={1}
        >
          <Text color={theme.colors.mutedForeground} wrap="truncate-end">
            {footer}
          </Text>
        </Box>
      </Box>
    </AppShell>
  )
}
