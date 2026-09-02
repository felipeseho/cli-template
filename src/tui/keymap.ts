import type {Key} from 'ink'

import type {Shortcut} from '@/tui/components/ui/keyboard-shortcuts.js'

export const GLOBAL_SHORTCUTS = [
  {description: 'Open the command palette', key: '/'},
  {description: 'Open or close help', key: '?'},
  {description: 'Go back or exit', key: 'Esc'},
  {description: 'Cancel task or exit', key: 'Ctrl+C'},
] as const satisfies readonly Shortcut[]

export const NAVIGATION_SHORTCUTS = [
  {category: 'Navigation', description: 'Move the selection', key: 'Up / Down'},
  {category: 'Navigation', description: 'Activate the selection', key: 'Enter'},
  {category: 'Navigation', description: 'Toggle controls', key: 'Tab'},
  ...GLOBAL_SHORTCUTS.map((shortcut) => ({
    ...shortcut,
    category: 'Global',
  })),
] as const satisfies readonly Shortcut[]

export const isControlC = (input: string, key: Key): boolean =>
  key.ctrl && input.toLocaleLowerCase() === 'c'

export const isPaletteKey = (input: string, key: Key): boolean =>
  input === '/' && !key.ctrl && !key.meta

export const isHelpKey = (input: string, key: Key): boolean =>
  input === '?' && !key.ctrl && !key.meta

export const isTextInput = (input: string, key: Key): boolean =>
  input.length > 0 && !key.ctrl && !key.meta && !key.escape
