import {CommandHelp, Help, loadHelpClass, ux, type Command, type Interfaces} from '@oclif/core'

import {brandColors, resolveBrandSymbol} from '@/terminal/brand.js'

const MAX_HELP_WIDTH = 80
const MIN_HELP_WIDTH = 24

type HelpOptions = Partial<Interfaces.HelpOptions>
type SectionBody = Parameters<Help['section']>[1]

function isEnabledEnvironmentFlag(name: string): boolean {
  const value = process.env[name]
  return value !== undefined && value !== '0' && value.toLowerCase() !== 'false'
}

function isDumbTerminal(): boolean {
  return process.env.TERM?.toLowerCase() === 'dumb'
}

function shouldUsePlainHelp(): boolean {
  return (
    isEnabledEnvironmentFlag('NO_COLOR') ||
    isEnabledEnvironmentFlag('NO_UNICODE') ||
    isDumbTerminal()
  )
}

function shouldStripAnsi(): boolean {
  return shouldUsePlainHelp()
}

function shouldUseUnicode(): boolean {
  return !shouldUsePlainHelp()
}

function resolveHelpWidth(requestedWidth?: number): number {
  const widths = [MAX_HELP_WIDTH, requestedWidth, process.stdout.columns].filter(
    (width): width is number => typeof width === 'number' && Number.isFinite(width) && width > 0,
  )
  return Math.max(MIN_HELP_WIDTH, Math.min(...widths))
}

function resolveHelpOptions(options: HelpOptions = {}): Interfaces.HelpOptions {
  return {
    ...options,
    maxWidth: resolveHelpWidth(options.maxWidth),
    stripAnsi: options.stripAnsi === true || shouldStripAnsi(),
  }
}

function helpOptionsFrom(value: unknown): HelpOptions | undefined {
  return typeof value === 'object' && value !== null ? value : undefined
}

function firstString(...values: unknown[]): string {
  return values.find((value): value is string => typeof value === 'string') ?? ''
}

function paint(color: string, value: string, stripAnsi: boolean): string {
  return stripAnsi || shouldStripAnsi() ? value : ux.colorize(color, value)
}

function primary(value: string, stripAnsi: boolean): string {
  return paint(brandColors.primary, value, stripAnsi)
}

function accent(value: string, stripAnsi: boolean): string {
  return paint(brandColors.accent, value, stripAnsi)
}

function muted(value: string, stripAnsi: boolean): string {
  return paint(brandColors.mutedForeground, value, stripAnsi)
}

function bold(value: string, stripAnsi: boolean): string {
  return paint('bold', value, stripAnsi)
}

function configuredId(config: Interfaces.Config, id: string): string {
  return config.topicSeparator === ':' ? id : id.replaceAll(':', config.topicSeparator)
}

function identifierSegments(id: string): string[] {
  return id.split(/[: ]+/u).filter(Boolean)
}

function breadcrumb(config: Interfaces.Config, id: string, stripAnsi: boolean): string {
  const unicode = shouldUseUnicode()
  const mark = resolveBrandSymbol('mark', unicode)
  const separator = resolveBrandSymbol('breadcrumb', unicode)
  const segments = identifierSegments(id)
  const lead = primary(`${mark} ${config.bin.toLocaleUpperCase()}`, stripAnsi)
  const trail = segments.map((segment, index) =>
    index === segments.length - 1
      ? accent(segment.toLocaleUpperCase(), stripAnsi)
      : muted(segment.toLocaleUpperCase(), stripAnsi),
  )

  return [lead, ...trail].join(muted(` ${separator} `, stripAnsi))
}

function commandSummary(command: Command.Loadable): string | undefined {
  return command.summary ?? command.description?.split(/\r?\n/u)[0]
}

/**
 * Command-level renderer that keeps oclif's metadata handling while applying
 * the project's compact visual language.
 */
export class BrandedCommandHelp extends CommandHelp {
  constructor(
    command: Command.Loadable,
    config: Interfaces.Config,
    options: Interfaces.HelpOptions,
  ) {
    super(command, config, resolveHelpOptions(options))
  }

  override generate(): string {
    const stripAnsi = this.opts.stripAnsi === true
    const summary = commandSummary(this.command)
    const body = super.generate()

    return [
      this.wrap(breadcrumb(this.config, this.command.id, stripAnsi), 0),
      summary && this.wrap(muted(this.render(summary), stripAnsi), 0),
      body,
    ]
      .filter((section): section is string => Boolean(section))
      .join('\n\n')
  }

  override section(header: string, body: SectionBody): string {
    const stripAnsi = this.opts.stripAnsi === true
    return super.section(primary(header, stripAnsi), body)
  }

  protected override args(args: Command.Arg.Any[]): [string, string | undefined][] | undefined {
    const rows = super.args(args)
    const stripAnsi = this.opts.stripAnsi === true
    return rows?.map(([name, description]) => [accent(name, stripAnsi), description])
  }

  protected override flagHelpLabel(flag: Command.Flag.Any, showOptions = false): string {
    return accent(super.flagHelpLabel(flag, showOptions), this.opts.stripAnsi === true)
  }

  protected override usage(): string {
    const commandId = configuredId(this.config, this.command.id)
    const usage = super
      .usage()
      .replaceAll('<%= command.id %>', commandId)
      .replaceAll(this.command.id, commandId)
    return accent(usage, this.opts.stripAnsi === true)
  }
}

/** Static, Ink-free help renderer used by root, topic, command, and error help. */
export class BrandedHelp extends Help {
  protected override CommandHelpClass = BrandedCommandHelp

  constructor(config: Interfaces.Config, options: HelpOptions = {}) {
    super(config, resolveHelpOptions(options))
  }

  override formatRoot(): string {
    const stripAnsi = this.opts.stripAnsi === true
    const unicode = shouldUseUnicode()
    const mark = resolveBrandSymbol('mark', unicode)
    const oclifDescription: unknown = this.config.pjson.oclif.description
    const packageDescription: unknown = this.config.pjson.description
    const description = this.render(firstString(oclifDescription, packageDescription)).split(
      /\r?\n/u,
    )[0]
    const title = [
      primary(bold(`${mark} ${this.config.bin.toLocaleUpperCase()}`, stripAnsi), stripAnsi),
      muted(`v${this.config.version}`, stripAnsi),
    ].join(' ')
    const modes: [string, string][] = [
      [accent('TTY', stripAnsi), 'Open the interactive dashboard by default.'],
      [accent('--no-interactive', stripAnsi), 'Print plain, human-readable text.'],
      [accent('--json', stripAnsi), 'Print one machine-readable JSON document.'],
    ]

    return [
      this.wrap(title, 0),
      description && this.wrap(muted(description, stripAnsi), 0),
      this.section('USAGE', accent(`$ ${this.config.bin} [COMMAND]`, stripAnsi)),
      this.section('MODES', modes),
    ]
      .filter((section): section is string => Boolean(section))
      .join('\n\n')
  }

  override section(header: string, body: SectionBody): string {
    const stripAnsi = this.opts.stripAnsi === true
    return super.section(primary(header, stripAnsi), body)
  }

  override showCommandHelp(command: Command.Loadable): Promise<void> {
    const name = command.id
    const depth = name.split(':').length
    const subtopics = this.sortedTopics.filter(
      (topic) => topic.name.startsWith(`${name}:`) && topic.name.split(':').length === depth + 1,
    )
    const subcommands = this.sortedCommands.filter(
      (candidate) =>
        candidate.id.startsWith(`${name}:`) && candidate.id.split(':').length === depth + 1,
    )

    this.log(this.formatCommand(command))
    this.log('')

    if (subtopics.length > 0) {
      this.log(this.formatTopics(subtopics))
      this.log('')
    }

    if (subcommands.length > 0) {
      this.log(this.formatCommands(subcommands))
      this.log('')
    }

    return Promise.resolve()
  }

  protected override formatCommand(command: Command.Loadable): string {
    return this.getCommandHelpClass(command).generate()
  }

  protected override formatCommands(commands: Command.Loadable[]): string {
    if (commands.length === 0) return ''
    const stripAnsi = this.opts.stripAnsi === true
    const rows = commands.map((command) => [
      accent(configuredId(this.config, command.id), stripAnsi),
      commandSummary(command) && muted(this.render(commandSummary(command) ?? ''), stripAnsi),
    ])
    const body = this.renderList(rows, {
      indentation: 2,
      spacer: '\n',
      stripAnsi,
    })
    return this.section('COMMANDS', body)
  }

  protected override formatTopic(topic: Interfaces.Topic): string {
    const stripAnsi = this.opts.stripAnsi === true
    const description = this.render(
      topic.description ?? `Commands for ${configuredId(this.config, topic.name)}.`,
    )
    const [summary, ...detail] = description.split(/\r?\n/u)
    const topicId = configuredId(this.config, topic.name)

    const output = [
      this.wrap(breadcrumb(this.config, topic.name, stripAnsi), 0),
      summary && this.wrap(muted(summary, stripAnsi), 0),
      this.section(
        this.opts.usageHeader ?? 'USAGE',
        accent(`$ ${this.config.bin} ${topicId} COMMAND`, stripAnsi),
      ),
      detail.length > 0 && this.section('DESCRIPTION', this.wrap(detail.join('\n'))),
    ]
      .filter((section): section is string => Boolean(section))
      .join('\n\n')
    return `${output}\n`
  }

  protected override formatTopics(topics: Interfaces.Topic[]): string {
    if (topics.length === 0) return ''
    const stripAnsi = this.opts.stripAnsi === true
    const rows = topics.map((topic) => [
      accent(configuredId(this.config, topic.name), stripAnsi),
      topic.description && muted(this.render(topic.description.split(/\r?\n/u)[0]), stripAnsi),
    ])
    const body = this.renderList(rows, {
      indentation: 2,
      spacer: '\n',
      stripAnsi,
    })
    return this.section('TOPICS', body)
  }

  protected override getCommandHelpClass(command: Command.Loadable): BrandedCommandHelp {
    return new BrandedCommandHelp(command, this.config, this.opts)
  }
}

/** Load the configured help class and render it with the CLI's configured defaults. */
export async function showHelp(
  config: Interfaces.Config,
  argv: string[],
  options: HelpOptions = {},
): Promise<void> {
  const HelpClass = await loadHelpClass(config)
  const oclifHelpOptions: unknown = config.pjson.oclif.helpOptions
  const packageHelpOptions: unknown = config.pjson.helpOptions
  const configuredOptions =
    helpOptionsFrom(oclifHelpOptions) ?? helpOptionsFrom(packageHelpOptions) ?? {}
  const help = new HelpClass(config, {...configuredOptions, ...options})
  await help.showHelp(argv)
}

export default BrandedHelp
