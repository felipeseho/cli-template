import {Box, Text} from 'ink'

import {resolveTerminalSymbol} from '@/lib/terminal-symbols.js'
import {useTheme} from '@/tui/hooks/use-theme.js'
import {useUnicode} from '@/tui/hooks/use-unicode.js'

const DEFAULT_WIDTH = 30
const MAX_WIDTH = 1_000

export interface ProgressBarProps {
  readonly value: number
  /** Maximum value. `total` is retained as a registry-compatible alias. */
  readonly max?: number
  readonly total?: number
  readonly width?: number
  readonly showPercent?: boolean
  readonly showValue?: boolean
  readonly valueLabel?: string
  readonly fillChar?: string
  readonly emptyChar?: string
  readonly color?: string
  readonly trackColor?: string
  readonly label?: string
  readonly 'aria-label'?: string
}

const finiteOr = (value: number, fallback: number): number =>
  Number.isFinite(value) ? value : fallback

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.max(minimum, Math.min(maximum, value))

export const ProgressBar = ({
  value,
  max,
  total,
  width = DEFAULT_WIDTH,
  showPercent = true,
  showValue,
  valueLabel,
  fillChar,
  emptyChar,
  color,
  trackColor,
  label,
  'aria-label': ariaLabel,
}: ProgressBarProps) => {
  const theme = useTheme()
  const unicode = useUnicode()
  const resolvedWidth = clamp(Math.floor(finiteOr(width, DEFAULT_WIDTH)), 1, MAX_WIDTH)
  const requestedMaximum = max ?? total
  const resolvedMaximum =
    requestedMaximum === undefined ? undefined : Math.max(0, finiteOr(requestedMaximum, 0))
  const finiteValue = finiteOr(value, 0)
  const clampedValue =
    resolvedMaximum === undefined
      ? clamp(finiteValue, 0, 100)
      : resolvedMaximum === 0
        ? 0
        : clamp(finiteValue, 0, resolvedMaximum)
  const percent =
    resolvedMaximum === undefined
      ? Math.round(clampedValue)
      : resolvedMaximum === 0
        ? 0
        : Math.round((clampedValue / resolvedMaximum) * 100)
  const filled = clamp(Math.round((percent / 100) * resolvedWidth), 0, resolvedWidth)
  const empty = resolvedWidth - filled
  const resolvedFillChar = fillChar ?? resolveTerminalSymbol(unicode, '█', '#')
  const resolvedEmptyChar = emptyChar ?? resolveTerminalSymbol(unicode, '░', '.')
  const resolvedColor = color ?? theme.colors.primary
  const resolvedTrackColor = trackColor ?? theme.colors.mutedForeground
  const shouldShowValue = showValue ?? (resolvedMaximum !== undefined || valueLabel !== undefined)
  const resolvedValueLabel =
    valueLabel ??
    (resolvedMaximum === undefined ? String(clampedValue) : `${clampedValue}/${resolvedMaximum}`)

  return (
    <Box
      aria-label={
        ariaLabel ??
        `${label ?? 'Progress'}: ${percent}%${
          resolvedMaximum === undefined ? '' : `, ${clampedValue} of ${resolvedMaximum}`
        }`
      }
      aria-role="progressbar"
      aria-state={{busy: percent < 100}}
      flexDirection="column"
    >
      {label && <Text>{label}</Text>}
      <Box>
        <Text aria-hidden color={resolvedColor}>
          {resolvedFillChar.repeat(filled)}
        </Text>
        <Text aria-hidden color={resolvedTrackColor}>
          {resolvedEmptyChar.repeat(empty)}
        </Text>
        {showPercent && (
          <Text color={theme.colors.mutedForeground}>{` ${percent}%`}</Text>
        )}
        {shouldShowValue && (
          <Text color={theme.colors.mutedForeground} dimColor>
            {` ${resolvedValueLabel}`}
          </Text>
        )}
      </Box>
    </Box>
  )
}
