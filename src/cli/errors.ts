export interface CliErrorDescriptor {
  readonly code?: string
  readonly exitCode: number
  readonly message: string
  readonly suggestions?: readonly string[]
}

export type CliErrorMapper = (error: unknown) => CliErrorDescriptor | undefined

export function describeCliError(
  error: unknown,
  mappers: readonly CliErrorMapper[],
): CliErrorDescriptor | undefined {
  for (const mapper of mappers) {
    const descriptor = mapper(error)
    if (descriptor) return descriptor
  }

  return undefined
}
