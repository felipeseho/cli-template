import {Box, Text} from 'ink'

import {Panel} from '@/tui/components/app/panel.js'
import {ScreenTitle} from '@/tui/components/app/screen-title.js'
import {Alert} from '@/tui/components/ui/alert.js'
import type {Shortcut} from '@/tui/components/ui/keyboard-shortcuts.js'
import {useTheme} from '@/tui/hooks/use-theme.js'
import {useUnicode} from '@/tui/hooks/use-unicode.js'

import {NAVIGATION_SHORTCUTS} from '../keymap.js'

export interface HelpScreenProps {
  readonly viewportRows: number
  readonly wide: boolean
}

function ShortcutList({shortcuts}: {readonly shortcuts: readonly Shortcut[]}) {
  const theme = useTheme()
  const groups = new Map<string | undefined, Shortcut[]>()

  for (const shortcut of shortcuts) {
    const items = groups.get(shortcut.category) ?? []
    items.push(shortcut)
    groups.set(shortcut.category, items)
  }

  return (
    <Box aria-role="toolbar" flexDirection="column">
      {[...groups.entries()].map(([category, items]) => (
        <Box key={category ?? 'essential'} flexDirection="column">
          {category ? (
            <Text bold color={theme.colors.mutedForeground}>
              {category}
            </Text>
          ) : null}
          {items.map((shortcut) => (
            <Box key={shortcut.key} gap={1}>
              <Box width={18}>
                <Text bold color={theme.colors.primary} wrap="truncate-end">
                  {shortcut.key}
                </Text>
              </Box>
              <Text color={theme.colors.foreground} wrap="truncate-end">
                {shortcut.description}
              </Text>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  )
}

export function HelpScreen({viewportRows, wide}: HelpScreenProps) {
  const unicode = useUnicode()
  const compact = !wide || viewportRows < 28
  const compactShortcuts: Shortcut[] = [
    {
      description: 'Navegar e alternar foco',
      key: `${unicode ? '↑↓' : 'Up/Down'} / Tab`,
    },
    {description: 'Ativar seleção', key: 'Enter'},
    {description: 'Abrir comandos ou ajuda', key: '/ / ?'},
    {description: 'Voltar, cancelar ou sair', key: 'Esc / Ctrl+C'},
  ]
  const taskShortcuts: Shortcut[] = [
    {category: 'Execução', description: 'Confirmar a ação', key: 'Enter / Y'},
    {category: 'Execução', description: 'Cancelar o diálogo', key: 'Esc / N'},
    {category: 'Execução', description: 'Repetir após concluir', key: 'R'},
    {category: 'Execução', description: 'Voltar para tarefas', key: 'B'},
    {category: 'Log', description: 'Rolar a saída', key: 'J / K'},
    {category: 'Log', description: 'Alternar FOLLOW/PAUSED', key: 'F'},
  ]

  return (
    <Box flexDirection="column">
      <ScreenTitle
        description={compact ? undefined : 'Atalhos disponíveis em toda a interface.'}
        title="Ajuda"
      />
      {compact ? (
        <Panel title="ATALHOS ESSENCIAIS">
          <ShortcutList shortcuts={compactShortcuts} />
        </Panel>
      ) : (
        <Box gap={1}>
          <Box flexBasis={0} flexGrow={1} minWidth={0}>
            <Panel title="NAVEGAÇÃO GLOBAL" width="100%">
              <ShortcutList shortcuts={[...NAVIGATION_SHORTCUTS]} />
            </Panel>
          </Box>
          <Box flexBasis={0} flexGrow={1} minWidth={0}>
            <Panel title="TAREFAS E LOGS" width="100%">
              <ShortcutList shortcuts={taskShortcuts} />
            </Panel>
          </Box>
        </Box>
      )}
      <Box marginTop={compact ? 0 : 1}>
        <Alert bordered={false} title="Cancelamento seguro" variant="info">
          Em uma tarefa ativa, Ctrl+C cancela apenas o processo; fora dela, encerra a interface.
        </Alert>
      </Box>
    </Box>
  )
}
