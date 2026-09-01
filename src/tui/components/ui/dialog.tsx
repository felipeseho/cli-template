import {Box, Text, useStdout} from 'ink'
import {useEffect, useId, useState} from 'react'
import type {ReactNode} from 'react'

import {resolveBorderStyle} from '@/lib/terminal-style.js'
import {FocusScope, useInteraction} from '@/tui/hooks/use-interaction.js'
import {useTheme} from '@/tui/hooks/use-theme.js'
import {useUnicode} from '@/tui/hooks/use-unicode.js'

export type DialogAction = 'confirm' | 'cancel'

interface DialogActionsProps {
  readonly id: string
  readonly confirmLabel: string
  readonly cancelLabel: string
  readonly confirmColor: string
  readonly defaultAction: DialogAction
  readonly disabled: boolean
  readonly isActive: boolean
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

const DialogActions = ({
  id,
  confirmLabel,
  cancelLabel,
  confirmColor,
  defaultAction,
  disabled,
  isActive,
  onConfirm,
  onCancel,
}: DialogActionsProps) => {
  const theme = useTheme()
  const [focusedButton, setFocusedButton] = useState<DialogAction>(defaultAction)

  useEffect(() => {
    setFocusedButton(defaultAction)
  }, [defaultAction])

  useInteraction(
    (input, key) => {
      if (key.leftArrow || key.home) {
        setFocusedButton('cancel')
      } else if (key.rightArrow || key.end) {
        setFocusedButton('confirm')
      } else if (key.return) {
        if (focusedButton === 'confirm') {
          onConfirm()
        } else {
          onCancel()
        }
      } else if (input === 'y' || input === 'Y') {
        onConfirm()
      } else if (input === 'n' || input === 'N') {
        onCancel()
      }
    },
    {autoFocus: true, disabled, id, isActive},
  )

  return (
    <Box aria-role="toolbar" flexDirection="row" gap={2} justifyContent="flex-end" marginTop={1}>
      <Box
        aria-label={cancelLabel}
        aria-role="button"
        aria-state={{disabled: disabled || undefined, selected: focusedButton === 'cancel'}}
      >
        <Text
          aria-hidden
          bold={focusedButton === 'cancel'}
          color={
            focusedButton === 'cancel'
              ? theme.colors.foreground
              : theme.colors.mutedForeground
          }
          inverse={focusedButton === 'cancel'}
        >
          {focusedButton === 'cancel' ? `[ ${cancelLabel} ]` : `  ${cancelLabel}  `}
        </Text>
      </Box>
      <Box
        aria-label={confirmLabel}
        aria-role="button"
        aria-state={{disabled: disabled || undefined, selected: focusedButton === 'confirm'}}
      >
        <Text
          aria-hidden
          bold={focusedButton === 'confirm'}
          color={focusedButton === 'confirm' ? confirmColor : theme.colors.mutedForeground}
          inverse={focusedButton === 'confirm'}
        >
          {focusedButton === 'confirm' ? `[ ${confirmLabel} ]` : `  ${confirmLabel}  `}
        </Text>
      </Box>
    </Box>
  )
}

export interface DialogProps {
  readonly title?: string
  readonly description?: ReactNode
  readonly children?: ReactNode
  readonly confirmLabel?: string
  readonly cancelLabel?: string
  readonly onConfirm?: () => void
  readonly onCancel?: () => void
  readonly onClose?: () => void
  readonly variant?: 'default' | 'danger'
  readonly defaultAction?: DialogAction
  readonly open?: boolean
  readonly defaultOpen?: boolean
  readonly onOpenChange?: (open: boolean) => void
  readonly isOpen?: boolean
  readonly isActive?: boolean
  readonly disabled?: boolean
  readonly initialFocusId?: string
  readonly returnFocusId?: string
  readonly width?: number
  readonly 'aria-label'?: string
}

const DialogBody = ({children}: {readonly children: ReactNode}) => {
  if (
    typeof children === 'string' ||
    typeof children === 'number' ||
    typeof children === 'bigint'
  ) {
    return <Text>{String(children)}</Text>
  }

  return <>{children}</>
}

export const Dialog = ({
  title,
  description,
  children,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  onClose,
  variant = 'default',
  defaultAction,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  isOpen,
  isActive = true,
  disabled = false,
  initialFocusId,
  returnFocusId,
  width = 56,
  'aria-label': ariaLabel,
}: DialogProps) => {
  const unicode = useUnicode()
  const theme = useTheme()
  const {stdout} = useStdout()
  const generatedId = useId()
  const actionsId = `dialog-actions-${generatedId}`
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const open = controlledOpen ?? isOpen ?? internalOpen
  const scopeActive = open && isActive && !disabled
  const requestedWidth = Number.isFinite(width) ? Math.floor(width) : 56
  const resolvedWidth = Math.max(1, Math.min(Math.max(1, requestedWidth), stdout.columns ?? 80))
  const resolvedDefaultAction = defaultAction ?? (variant === 'danger' ? 'cancel' : 'confirm')

  const setOpen = (nextOpen: boolean) => {
    if (controlledOpen === undefined && isOpen === undefined) {
      setInternalOpen(nextOpen)
    }
    onOpenChange?.(nextOpen)
    if (!nextOpen) {
      onClose?.()
    }
  }

  const cancel = () => {
    if (disabled) {
      return
    }
    onCancel?.()
    setOpen(false)
  }

  const confirm = () => {
    if (disabled) {
      return
    }
    onConfirm?.()
    setOpen(false)
  }

  if (!open) {
    return null
  }

  const accentColor = variant === 'danger' ? theme.colors.error : theme.colors.primary

  return (
    <FocusScope
      active={scopeActive}
      initialFocusId={initialFocusId ?? actionsId}
      returnFocusId={returnFocusId}
      onEscapeKey={cancel}
    >
      <Box justifyContent="center" width="100%">
        <Box
          aria-label={ariaLabel ?? `Dialog${title ? `: ${title}` : ''}`}
          aria-state={{disabled: disabled || undefined}}
          borderColor={accentColor}
          borderStyle={resolveBorderStyle('round', unicode)}
          flexDirection="column"
          paddingX={1}
          paddingY={0}
          width={resolvedWidth}
        >
          {title && (
            <Box marginBottom={description === undefined && children === undefined ? 0 : 1}>
              <Text bold color={accentColor} wrap="truncate-end">
                {title}
              </Text>
            </Box>
          )}
          {description !== undefined && description !== null && (
            <Box flexDirection="column" marginBottom={children === undefined ? 0 : 1}>
              <DialogBody>{description}</DialogBody>
            </Box>
          )}
          {children !== undefined && children !== null && (
            <Box flexDirection="column">
              <DialogBody>{children}</DialogBody>
            </Box>
          )}
          <DialogActions
            cancelLabel={cancelLabel}
            confirmColor={accentColor}
            confirmLabel={confirmLabel}
            defaultAction={resolvedDefaultAction}
            disabled={disabled}
            id={actionsId}
            isActive={scopeActive}
            onCancel={cancel}
            onConfirm={confirm}
          />
        </Box>
      </Box>
    </FocusScope>
  )
}
