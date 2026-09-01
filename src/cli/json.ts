import {stripVTControlCharacters} from 'node:util'

export function serializeJson(value: unknown): string {
  return (
    JSON.stringify(
      value,
      (_key, nestedValue: unknown) =>
        typeof nestedValue === 'string' ? stripVTControlCharacters(nestedValue) : nestedValue,
      2,
    ) ?? 'null'
  )
}
