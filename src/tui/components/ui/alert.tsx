import {Box, Text, useIsScreenReaderEnabled} from 'ink'
import {Children, Fragment, isValidElement} from 'react'
import type {ReactNode} from 'react'

import type {BorderStyle} from '@/components/ui/types.js'
import {resolveStatusSymbol} from '@/lib/terminal-symbols.js'
import {resolveBorderStyle} from '@/lib/terminal-style.js'
import {useTheme} from '@/tui/hooks/use-theme.js'
import {useUnicode} from '@/tui/hooks/use-unicode.js'

export type AlertVariant = 'success' | 'error' | 'warning' | 'info'

export interface AlertProps {
  readonly variant?: AlertVariant
  readonly title?: ReactNode
  readonly children?: ReactNode
  readonly icon?: string
  readonly bordered?: boolean
  readonly borderStyle?: BorderStyle
  readonly color?: string
  readonly paddingX?: number
  readonly paddingY?: number
  readonly 'aria-label'?: string
}

interface InkContentProps {
  readonly children: ReactNode
  readonly bold?: boolean
  readonly color?: string
}

/** Render primitive text safely while leaving Ink layout elements outside Text. */
const InkContent = ({children, bold, color}: InkContentProps) => (
  <>
    {Children.map(children, (child) => {
      if (child === null || child === undefined || typeof child === 'boolean') {
        return null
      }

      if (
        typeof child === 'string' ||
        typeof child === 'number' ||
        typeof child === 'bigint'
      ) {
        return (
          <Text bold={bold} color={color}>
            {String(child)}
          </Text>
        )
      }

      if (isValidElement<{children?: ReactNode}>(child) && child.type === Fragment) {
        return (
          <InkContent bold={bold} color={color}>
            {child.props.children}
          </InkContent>
        )
      }

      return child
    })}
  </>
)

export const Alert = ({
  variant = 'info',
  title,
  children,
  icon,
  bordered = true,
  borderStyle,
  color,
  paddingX = 1,
  paddingY = 0,
  'aria-label': ariaLabel,
}: AlertProps) => {
  const unicode = useUnicode()
  const theme = useTheme()
  const isScreenReaderEnabled = useIsScreenReaderEnabled()

  const variantColor =
    color ??
    (() => {
      switch (variant) {
        case 'success': {
          return theme.colors.success
        }
        case 'error': {
          return theme.colors.error
        }
        case 'warning': {
          return theme.colors.warning
        }
        default: {
          return theme.colors.info
        }
      }
    })()

  const resolvedIcon = icon ?? resolveStatusSymbol(unicode, variant)
  const accessibleTitle =
    typeof title === 'string' || typeof title === 'number' || typeof title === 'bigint'
      ? String(title)
      : undefined
  const content = (
    <>
      <Box
        aria-label={ariaLabel ?? `${variant} alert${accessibleTitle ? `: ${accessibleTitle}` : ''}`}
        gap={1}
      >
        <Text aria-hidden bold color={variantColor}>
          {resolvedIcon}
        </Text>
        {title !== undefined && title !== null && (
          <Box flexShrink={1} minWidth={0}>
            <InkContent bold color={variantColor}>
              {title}
            </InkContent>
          </Box>
        )}
      </Box>
      {children !== undefined && children !== null && (
        <Box flexDirection="column">
          <InkContent>{children}</InkContent>
        </Box>
      )}
    </>
  )

  if (!bordered) {
    return (
      <Box flexDirection="column" paddingX={paddingX} paddingY={paddingY}>
        {content}
      </Box>
    )
  }

  return (
    <Box
      borderColor={variantColor}
      borderStyle={resolveBorderStyle(
        isScreenReaderEnabled ? undefined : (borderStyle ?? theme.border.style),
        unicode,
      )}
      flexDirection="column"
      paddingX={paddingX}
      paddingY={paddingY}
    >
      {content}
    </Box>
  )
}
