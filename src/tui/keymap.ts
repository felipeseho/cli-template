import type {Key} from 'ink'

import type {Shortcut} from '@/tui/components/ui/keyboard-shortcuts.js'

export const GLOBAL_SHORTCUTS = [
  {description: 'Abrir a paleta de comandos', key: '/'},
  {description: 'Abrir ou fechar a ajuda', key: '?'},
  {description: 'Voltar ou sair', key: 'Esc'},
  {description: 'Cancelar tarefa ou sair', key: 'Ctrl+C'},
] as const satisfies readonly Shortcut[]

export const NAVIGATION_SHORTCUTS = [
  {category: 'Navegação', description: 'Mover a seleção', key: 'Up / Down'},
  {category: 'Navegação', description: 'Ativar a seleção', key: 'Enter'},
  {category: 'Navegação', description: 'Alternar controles', key: 'Tab'},
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
