import {createTheme} from '@/providers/theme-provider.js'
import {defaultTheme} from '@/lib/terminal-themes/default.js'
import {brandColors} from '@/terminal/brand.js'

/**
 * The template theme is intentionally local. Projects created from this
 * repository can replace these tokens without changing any screen code.
 */
export const cliTheme = createTheme({
  colors: {
    ...defaultTheme.colors,
    accent: brandColors.accent,
    border: '#334155',
    focusRing: '#A78BFA',
    info: '#38BDF8',
    muted: '#1E293B',
    mutedForeground: brandColors.mutedForeground,
    primary: brandColors.primary,
    selection: '#7C3AED',
    success: '#34D399',
    warning: '#FBBF24',
  },
  name: 'mycli',
})
