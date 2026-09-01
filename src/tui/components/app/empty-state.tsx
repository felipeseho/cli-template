import {Box, Text} from 'ink'

import {StatusMessage} from '@/tui/components/ui/status-message.js'
import {useTheme} from '@/tui/hooks/use-theme.js'

export interface EmptyStateProps {
  readonly detail?: string
  readonly title: string
}

export function EmptyState({detail, title}: EmptyStateProps) {
  const theme = useTheme()

  return (
    <Box flexDirection="column" paddingY={1}>
      <StatusMessage variant="warning">{title}</StatusMessage>
      {detail ? (
        <Box paddingLeft={2}>
          <Text color={theme.colors.mutedForeground}>{detail}</Text>
        </Box>
      ) : null}
    </Box>
  )
}
