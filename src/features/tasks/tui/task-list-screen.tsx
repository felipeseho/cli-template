import {Box, Text, useInput} from 'ink'
import {useMemo, useState} from 'react'

import type {Task} from '@/features/tasks/index.js'
import type {Workspace} from '@/features/workspace/index.js'
import {Panel} from '@/tui/components/app/panel.js'
import {ScreenTitle} from '@/tui/components/app/screen-title.js'
import {Alert} from '@/tui/components/ui/alert.js'
import {StatusMessage} from '@/tui/components/ui/status-message.js'
import {Table, type Column} from '@/tui/components/ui/table.js'
import {useTheme} from '@/tui/hooks/use-theme.js'
import {useUnicode} from '@/tui/hooks/use-unicode.js'

import {isTextInput} from '@/tui/keymap.js'
import type {ScreenRoute} from '@/tui/routes.js'

export interface TaskListScreenProps {
  readonly error?: string
  readonly inputEnabled: boolean
  readonly loading: boolean
  readonly navigate: (route: ScreenRoute) => void
  readonly tasks: readonly Task[]
  readonly viewportRows: number
  readonly wide: boolean
  readonly workspace?: Workspace
}

type TaskRow = Record<'command' | 'name', string>

export function TaskListScreen({
  error,
  inputEnabled,
  loading,
  navigate,
  tasks,
  viewportRows,
  wide,
  workspace,
}: TaskListScreenProps) {
  const theme = useTheme()
  const unicode = useUnicode()
  const maxRows = Math.max(3, Math.min(12, viewportRows - 17))
  const [filter, setFilter] = useState('')
  const filteredTasks = useMemo(() => {
    const query = filter.trim().toLocaleLowerCase()
    if (!query) {
      return tasks
    }

    return tasks.filter(
      (task) =>
        task.name.toLocaleLowerCase().includes(query) ||
        task.command.toLocaleLowerCase().includes(query),
    )
  }, [filter, tasks])

  useInput(
    (input, key) => {
      if (key.backspace || key.delete) {
        setFilter((current) => current.slice(0, -1))
        return
      }

      if (key.ctrl && input.toLocaleLowerCase() === 'u') {
        setFilter('')
        return
      }

      // These keys belong to the application shell and must never leak into the
      // task filter.
      if (input === '/' || input === '?') {
        return
      }

      if (isTextInput(input, key) && !key.return && !key.tab) {
        setFilter((current) => current + input)
      }
    },
    {isActive: inputEnabled},
  )

  const rows: TaskRow[] = filteredTasks.map((task) => ({...task}))
  const columns: Column<TaskRow>[] = [
    {header: 'Script', key: 'name', width: wide ? 26 : 18},
    {header: 'Command', key: 'command', width: wide ? 66 : 42},
  ]

  return (
    <Box flexDirection="column">
      <ScreenTitle
        description="Type to filter; use the arrow keys and Enter to run."
        title="package.json tasks"
      />
      {loading ? (
        <StatusMessage variant="loading">
          {unicode ? 'Loading scripts…' : 'Loading scripts...'}
        </StatusMessage>
      ) : null}
      {!loading && !workspace ? (
        <Alert title="No workspace to list" variant="error">
          {error ?? 'Run the CLI from the root of a Node.js project.'}
        </Alert>
      ) : null}
      {!loading && workspace ? (
        <Panel title={`SCRIPTS · Search: ${filter || 'all scripts'}`}>
          <Box justifyContent="space-between" marginBottom={tasks.length > 0 ? 1 : 0}>
            <Text color={theme.colors.mutedForeground} wrap="truncate-end">
              {filter ? `Filtering by “${filter}”` : 'Type to search by name or command'}
            </Text>
            <Text bold color={theme.colors.info}>
              {filteredTasks.length}/{tasks.length} scripts
            </Text>
          </Box>
          {tasks.length === 0 ? (
            <Alert bordered={false} title="This workspace has no scripts" variant="warning">
              Add at least one entry to package.json#scripts.
            </Alert>
          ) : rows.length === 0 ? (
            <Alert bordered={false} title={`No script matches “${filter}”`} variant="warning">
              Backspace removes characters; Ctrl+U clears the search.
            </Alert>
          ) : (
            <Table
              aria-label="Available scripts"
              autoFocus
              columns={columns}
              data={rows}
              getRowKey={(row) => row.name}
              isActive={inputEnabled}
              maxRows={maxRows}
              onSelect={(row) => navigate({screen: 'task-run', taskName: row.name})}
              selectable
            />
          )}
          {tasks.length > 0 ? (
            <Text color={theme.colors.mutedForeground} dimColor>
              {unicode ? '↑↓' : 'Up/Down'} navigate {unicode ? '·' : '|'} Enter run{' '}
              {unicode ? '·' : '|'} Ctrl+U clear search
            </Text>
          ) : null}
        </Panel>
      ) : null}
    </Box>
  )
}
