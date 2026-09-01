import {stripVTControlCharacters} from 'node:util'

import stringWidth from 'string-width'

export interface TableColumn<Row> {
  readonly header: string
  readonly value: (row: Row) => string
}

export function sanitizeTerminalText(value: string): string {
  return stripVTControlCharacters(value).replaceAll(/\p{Cc}+/gu, ' ')
}

function padToWidth(value: string, width: number): string {
  return value + ' '.repeat(Math.max(0, width - stringWidth(value)))
}

export function formatTable<Row>(
  rows: readonly Row[],
  columns: readonly TableColumn<Row>[],
): string {
  const headers = columns.map(({header}) => sanitizeTerminalText(header))
  const values = rows.map((row) => columns.map((column) => sanitizeTerminalText(column.value(row))))
  const widths = headers.map((header, index) =>
    Math.max(stringWidth(header), ...values.map((row) => stringWidth(row[index] ?? ''))),
  )
  const renderRow = (cells: readonly string[]): string =>
    cells
      .map((cell, index) => padToWidth(cell, widths[index] ?? stringWidth(cell)))
      .join('  ')
      .trimEnd()

  return [
    renderRow(headers),
    renderRow(widths.map((width) => '-'.repeat(width))),
    ...values.map(renderRow),
  ].join('\n')
}
