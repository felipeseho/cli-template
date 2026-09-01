import {createTheme} from '@/providers/theme-provider.js'
import {defaultTheme} from '@/lib/terminal-themes/default.js'

/**
 * The template theme is intentionally local. Projects created from this
 * repository can replace these tokens without changing any screen code.
 */
export const cliTheme = createTheme({
  colors: {
    ...defaultTheme.colors,
    accent: '#22D3EE',
    border: '#334155',
    focusRing: '#A78BFA',
    info: '#38BDF8',
    muted: '#1E293B',
    mutedForeground: '#94A3B8',
    primary: '#8B5CF6',
    selection: '#7C3AED',
    success: '#34D399',
    warning: '#FBBF24',
  },
  name: 'mycli',
})
