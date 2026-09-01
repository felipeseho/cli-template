import {Box, Text} from 'ink'
import type {ReactNode} from 'react'

import {resolveBorderStyle} from '@/lib/terminal-style.js'
import {useTheme} from '@/tui/hooks/use-theme.js'
import {useUnicode} from '@/tui/hooks/use-unicode.js'

export interface PanelProps {
  readonly children: ReactNode
  readonly title?: string
  readonly width?: number | string
}

export function Panel({children, title, width}: PanelProps) {
  const theme = useTheme()
  const unicode = useUnicode()

  return (
    <Box
      borderColor={theme.colors.border}
      borderStyle={resolveBorderStyle('round', unicode)}
      flexDirection="column"
      paddingX={1}
      width={width}
    >
      {title ? (
        <Text bold color={theme.colors.accent} wrap="truncate-end">
          {title}
        </Text>
      ) : null}
      {children}
    </Box>
  )
}
