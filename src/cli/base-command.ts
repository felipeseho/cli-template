import {Command, Flags, type Interfaces} from '@oclif/core'

import {describeCliError, type CliErrorMapper} from './errors.js'
import {showHelp} from './help.js'
import {serializeJson} from './json.js'
import {sanitizeTerminalText} from './text.js'
import {isInteractiveTerminal} from '../runtime/tty.js'

export type OutputMode = 'json' | 'text' | 'tui'

export interface OutputModeOptions {
  readonly interactiveTerminal: boolean
  readonly json: boolean
  readonly noInteractive: boolean
}

export const noInteractiveFlag = Flags.boolean({
  description: 'Use plain text output instead of the interactive dashboard.',
  helpGroup: 'GLOBAL',
})

export function resolveOutputMode({
  interactiveTerminal,
  json,
  noInteractive,
}: OutputModeOptions): OutputMode {
  if (json) return 'json'
  if (noInteractive || !interactiveTerminal) return 'text'
  return 'tui'
}

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

function setProperty(error: unknown, key: string, value: unknown): void {
  if ((typeof error !== 'object' || error === null) && typeof error !== 'function') return
  Reflect.set(error, key, value)
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

  protected override async catch(error: Interfaces.CommandError): Promise<unknown> {
    const exitCode = configuredExitCode(error)
    if (exitCode !== undefined) process.exitCode = exitCode

    if (!this.jsonEnabled() && propertyFrom(error, 'showHelp') === true) {
      setProperty(error, 'showHelp', false)
      setProperty(error, 'skipOclifErrorHandling', true)
      this.logToStderr(sanitizeTerminalText(error.message))
      this.logToStderr()
      await showHelp(this.config, this.id?.split(':') ?? [], {
        sections: ['usage', 'arguments', 'flags'],
        sendToStderr: true,
      })
      throw error
    }

    return super.catch(error)
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

export abstract class DashboardCommand extends BaseCommand {
  static override baseFlags = {
    'no-interactive': noInteractiveFlag,
  }

  protected outputMode(noInteractive: boolean | undefined): OutputMode {
    return resolveOutputMode({
      interactiveTerminal: isInteractiveTerminal(),
      json: this.jsonEnabled(),
      noInteractive: noInteractive === true,
    })
  }
}
