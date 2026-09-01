import {stripVTControlCharacters} from 'node:util'

/**
 * Returns a terminal-safe copy for rendering while leaving the captured task
 * output untouched for CLI/JSON consumers.
 */
export function sanitizeLogMessage(message: string): string {
  return stripVTControlCharacters(message).replaceAll(/\p{Cc}+/gu, ' ')
}
