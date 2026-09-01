import {stripVTControlCharacters} from 'node:util'

export function sanitizeTerminalText(value: string): string {
  return stripVTControlCharacters(value).replaceAll(/\p{Cc}+/gu, ' ')
}
