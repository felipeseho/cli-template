import {Box, Text} from 'ink'

import {Panel} from '@/tui/components/app/panel.js'
import {useTheme} from '@/tui/hooks/use-theme.js'

export type MetricTone = 'default' | 'error' | 'success' | 'warning'

export interface MetricCardProps {
  readonly compact?: boolean
  readonly detail?: string
  readonly label: string
  readonly tone?: MetricTone
  readonly value: string
}

export function MetricCard({
  compact = false,
  detail,
  label,
  tone = 'default',
  value,
}: MetricCardProps) {
  const theme = useTheme()
  const valueColor = {
    default: theme.colors.foreground,
    error: theme.colors.error,
    success: theme.colors.success,
    warning: theme.colors.warning,
  }[tone]

  if (compact) {
    return (
      <Box minWidth={0} overflow="hidden" width="50%">
        <Text color={theme.colors.mutedForeground} wrap="truncate-end">
          {label}:{' '}
          <Text bold color={valueColor}>
            {value}
          </Text>
        </Text>
      </Box>
    )
  }

  return (
    <Panel title={label} width="100%">
      <Text bold color={valueColor} wrap="truncate-end">
        {value}
      </Text>
      {detail ? (
        <Text color={theme.colors.mutedForeground} wrap="truncate-end">
          {detail}
        </Text>
      ) : null}
    </Panel>
  )
}
