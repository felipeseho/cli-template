import {Box, Text} from 'ink'
import {useEffect, useState} from 'react'

import {resolveTerminalSymbol} from '@/lib/terminal-symbols.js'
import type {InteractionProps} from '@/tui/hooks/use-interaction.js'
import {useInteraction} from '@/tui/hooks/use-interaction.js'
import {useTheme} from '@/tui/hooks/use-theme.js'
import {useUnicode} from '@/tui/hooks/use-unicode.js'

export interface BreadcrumbItem {
  readonly id: string
  readonly label: string
  readonly onSelect?: () => void
  readonly disabled?: boolean
}

export interface BreadcrumbProps extends InteractionProps {
  readonly items: readonly BreadcrumbItem[]
  readonly separator?: string
  readonly currentIndex?: number
  readonly defaultCurrentIndex?: number
  readonly onCurrentIndexChange?: (index: number, item: BreadcrumbItem) => void
  readonly onSelect?: (item: BreadcrumbItem, index: number) => void
  readonly 'aria-label'?: string
}

const clampIndex = (index: number, length: number): number => {
  if (length === 0) {
    return -1
  }

  const finiteIndex = Number.isFinite(index) ? Math.floor(index) : length - 1
  return Math.max(0, Math.min(length - 1, finiteIndex))
}

export const Breadcrumb = ({
  items,
  separator,
  currentIndex: controlledCurrentIndex,
  defaultCurrentIndex,
  onCurrentIndexChange,
  onSelect,
  id,
  autoFocus = false,
  isActive = true,
  disabled = false,
  'aria-label': ariaLabel,
}: BreadcrumbProps) => {
  const theme = useTheme()
  const unicode = useUnicode()
  const resolvedSeparator = separator ?? resolveTerminalSymbol(unicode, '›', '>')
  const initialIndex = clampIndex(defaultCurrentIndex ?? items.length - 1, items.length)
  const [internalCurrentIndex, setInternalCurrentIndex] = useState(initialIndex)
  const resolvedCurrentIndex = clampIndex(
    controlledCurrentIndex ?? internalCurrentIndex,
    items.length,
  )
  const [cursorIndex, setCursorIndex] = useState(resolvedCurrentIndex)

  useEffect(() => {
    setInternalCurrentIndex((index) => clampIndex(index, items.length))
    setCursorIndex(resolvedCurrentIndex)
  }, [items.length, resolvedCurrentIndex])

  const enabledIndices = items
    .map((item, index) => ({index, item}))
    .filter(({item}) => !item.disabled)
    .map(({index}) => index)

  const moveCursor = (direction: -1 | 1) => {
    if (enabledIndices.length === 0) {
      return
    }

    const currentPosition = enabledIndices.indexOf(cursorIndex)
    const fallbackPosition = direction === 1 ? -1 : enabledIndices.length
    const nextPosition = Math.max(
      0,
      Math.min(enabledIndices.length - 1, (currentPosition === -1 ? fallbackPosition : currentPosition) + direction),
    )
    setCursorIndex(enabledIndices[nextPosition] ?? cursorIndex)
  }

  const activateCursor = () => {
    const item = items[cursorIndex]
    if (!item || item.disabled) {
      return
    }

    if (controlledCurrentIndex === undefined) {
      setInternalCurrentIndex(cursorIndex)
    }
    onCurrentIndexChange?.(cursorIndex, item)
    item.onSelect?.()
    onSelect?.(item, cursorIndex)
  }

  const {isFocused} = useInteraction(
    (_input, key) => {
      if (key.leftArrow) {
        moveCursor(-1)
      } else if (key.rightArrow) {
        moveCursor(1)
      } else if (key.home) {
        setCursorIndex(enabledIndices[0] ?? -1)
      } else if (key.end) {
        setCursorIndex(enabledIndices.at(-1) ?? -1)
      } else if (key.return) {
        activateCursor()
      }
    },
    {autoFocus, disabled, id, isActive},
  )

  return (
    <Box
      alignItems="center"
      aria-label={ariaLabel ?? 'Breadcrumb'}
      aria-role="list"
      aria-state={{disabled: disabled || undefined}}
      flexDirection="row"
    >
      {items.map((item, index) => {
        const isCurrent = index === resolvedCurrentIndex
        const hasCursor = isFocused && index === cursorIndex
        return (
          <Box
            key={item.id}
            alignItems="center"
            aria-label={item.label}
            aria-role="listitem"
            aria-state={{
              disabled: disabled || item.disabled || undefined,
              selected: isCurrent,
            }}
            flexDirection="row"
          >
            <Text
              aria-hidden
              bold={isCurrent || hasCursor}
              color={
                item.disabled
                  ? theme.colors.mutedForeground
                  : isCurrent || hasCursor
                    ? theme.colors.primary
                    : theme.colors.mutedForeground
              }
              inverse={hasCursor}
              dimColor={item.disabled}
            >
              {item.label}
            </Text>
            {index < items.length - 1 && (
              <Text aria-hidden color={theme.colors.mutedForeground}>
                {` ${resolvedSeparator} `}
              </Text>
            )}
          </Box>
        )
      })}
    </Box>
  )
}
