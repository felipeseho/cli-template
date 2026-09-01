export interface TerminalStreams {
  readonly stdin?: Pick<NodeJS.ReadStream, 'isTTY'>
  readonly stdout?: Pick<NodeJS.WriteStream, 'isTTY'>
}

/** True only when both input and output support interactive terminal control. */
export function isInteractiveTerminal({
  stdin = process.stdin,
  stdout = process.stdout,
}: TerminalStreams = {}): boolean {
  return stdin.isTTY === true && stdout.isTTY === true
}

export class InteractiveTerminalRequiredError extends Error {
  readonly exitCode = 2

  constructor() {
    super('The interactive interface requires stdin and stdout to be attached to a TTY.')
    this.name = 'InteractiveTerminalRequiredError'
  }
}
