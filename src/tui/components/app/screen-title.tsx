import {Box, Text} from 'ink'

import {useTheme} from '@/tui/hooks/use-theme.js'

export interface ScreenTitleProps {
  readonly description?: string
  readonly title: string
}

export function ScreenTitle({description, title}: ScreenTitleProps) {
  const theme = useTheme()

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color={theme.colors.primary}>
        {title}
      </Text>
      {description ? <Text color={theme.colors.mutedForeground}>{description}</Text> : null}
    </Box>
  )
}
