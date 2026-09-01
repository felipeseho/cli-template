import stringWidth from 'string-width'
import {describe, expect, it} from 'vitest'

import {serializeJson} from '@/cli/json.js'
import {formatTable} from '@/cli/table.js'

describe('shared CLI presentation', () => {
  it('aligns wide Unicode cells and removes terminal control sequences', () => {
    const table = formatTable(
      [
        {command: '\u001B[31mbuild\u001B[0m\nnext', name: '编译'},
        {command: 'test', name: 'ok'},
      ],
      [
        {header: 'TASK', value: ({name}) => name},
        {header: 'COMMAND', value: ({command}) => command},
      ],
    )
    const [header, separator, first, second] = table.split('\n')
    const visualColumn = (line: string | undefined, marker: string): number => {
      const index = line?.indexOf(marker) ?? -1
      return index < 0 ? index : stringWidth(line?.slice(0, index) ?? '')
    }
    const commandColumn = visualColumn(header, 'COMMAND')

    expect(commandColumn).toBeGreaterThan(0)
    expect(visualColumn(separator, '-'.repeat(10))).toBe(commandColumn)
    expect(visualColumn(first, 'build next')).toBe(commandColumn)
    expect(visualColumn(second, 'test')).toBe(commandColumn)
    expect(table).not.toContain('\u001B')
    expect(table).not.toContain('\nnext\n')
  })

  it('serializes one parseable ANSI-free JSON document', () => {
    const document = serializeJson({message: '\u001B[31mdone\u001B[39m'})

    expect(JSON.parse(document)).toEqual({message: 'done'})
    expect(document).not.toContain('\u001B[')
    expect(document).not.toContain('\\u001b')
  })
})
