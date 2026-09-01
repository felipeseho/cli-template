import {Command, Flags, type Interfaces} from '@oclif/core'

import {describeCliError, type CliErrorMapper} from './errors.js'
import {serializeJson} from './json.js'
import {sanitizeTerminalText} from './text.js'
import {isInteractiveTerminal} from '../runtime/tty.js'

export const interactiveFlag = Flags.boolean({
  char: 'i',
  description: 'Open the command-specific interactive screen.',
})

function messageFor(error: unknown): string {
  return sanitizeTerminalText(
    error instanceof Error ? error.message : 'An unexpected error occurred.',
  )
}

function propertyFrom(error: unknown, key: string): unknown {
  if ((typeof error !== 'object' || error === null) && typeof error !== 'function') {
    return undefined
  }

  return Reflect.get(error, key)
}

function configuredExitCode(error: unknown): number | undefined {
  const directExitCode = propertyFrom(error, 'exitCode')
  if (typeof directExitCode === 'number') return directExitCode

  const metadata = propertyFrom(error, 'oclif')
  if (typeof metadata !== 'object' || metadata === null) return undefined

  const exitCode = Reflect.get(metadata, 'exit') as unknown
  return typeof exitCode === 'number' ? exitCode : undefined
}

function codeFor(error: unknown): string | undefined {
  const code = propertyFrom(error, 'code')
  return typeof code === 'string' && code.length > 0 ? code : undefined
}

function suggestionsFor(error: unknown): readonly string[] | undefined {
  const suggestions = propertyFrom(error, 'suggestions')
  if (!Array.isArray(suggestions)) return undefined

  const strings = suggestions.filter(
    (suggestion): suggestion is string => typeof suggestion === 'string',
  )
  return strings.length > 0 ? strings : undefined
}

export abstract class BaseCommand extends Command {
  static override enableJsonFlag = true

  protected override catch(error: Interfaces.CommandError): Promise<unknown> {
    const exitCode = configuredExitCode(error)
    if (exitCode !== undefined) process.exitCode = exitCode
    return super.catch(error) as Promise<unknown>
  }

  protected override toSuccessJson(result: unknown): unknown {
    return JSON.parse(serializeJson(result)) as unknown
  }

  protected override toErrorJson(error: unknown): unknown {
    const code = codeFor(error)
    const suggestions = suggestionsFor(error)
    const envelope = {
      error: {
        ...(code === undefined ? {} : {code}),
        exitCode: configuredExitCode(error) ?? 1,
        message: messageFor(error),
        ...(suggestions === undefined ? {} : {suggestions}),
      },
    }

    return JSON.parse(serializeJson(envelope)) as unknown
  }

  protected assertOutputMode(interactive: boolean | undefined): void {
    if (interactive && this.jsonEnabled()) {
      this.error('--interactive and --json cannot be used together.', {exit: 2})
    }

    if (interactive && !isInteractiveTerminal()) {
      this.error('--interactive requires stdin and stdout to be attached to a TTY.', {
        exit: 2,
        suggestions: [
          'Remove --interactive to use textual output.',
          'Use --json in scripts and CI.',
        ],
      })
    }
  }

  protected fail(error: unknown, mappers: readonly CliErrorMapper[] = []): never {
    const descriptor = describeCliError(error, mappers)
    if (descriptor) {
      this.error(sanitizeTerminalText(descriptor.message), {
        ...(descriptor.code === undefined ? {} : {code: descriptor.code}),
        exit: descriptor.exitCode,
        ...(descriptor.suggestions === undefined ? {} : {suggestions: [...descriptor.suggestions]}),
      })
    }

    this.error(messageFor(error), {exit: 1})
  }
}
