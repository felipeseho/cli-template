import {Box, Text} from 'ink'

import {Panel} from '@/tui/components/app/panel.js'
import {ScreenTitle} from '@/tui/components/app/screen-title.js'
import {KeyboardShortcuts, type Shortcut} from '@/tui/components/ui/keyboard-shortcuts.js'
import {useTheme} from '@/tui/hooks/use-theme.js'
import {useUnicode} from '@/tui/hooks/use-unicode.js'

import {NAVIGATION_SHORTCUTS} from '../keymap.js'

export interface HelpScreenProps {
  readonly viewportRows: number
  readonly wide: boolean
}

export function HelpScreen({viewportRows, wide}: HelpScreenProps) {
  const theme = useTheme()
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

  return (
    <Box flexDirection="column">
      <ScreenTitle
        description={compact ? undefined : 'Atalhos disponíveis em toda a interface.'}
        title="Ajuda"
      />
      <Panel title="Teclado">
        <KeyboardShortcuts
          columns={wide ? 2 : 1}
          shortcuts={compact ? compactShortcuts : [...NAVIGATION_SHORTCUTS]}
        />
      </Panel>
      {!compact ? (
        <Box marginTop={1}>
          <Text color={theme.colors.mutedForeground}>
            Em uma tarefa ativa, Ctrl+C cancela apenas o processo. Pressione novamente para sair.
          </Text>
        </Box>
      ) : null}
    </Box>
  )
}
