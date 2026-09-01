# Adding a command and screen

Use this guide when a capability needs an automation-friendly command, an interactive screen, or
both. The architecture keeps delivery choices separate from business behavior, so start by deciding
which level of change you need.

## Choose the right path

```mermaid
flowchart TD
  request["New CLI capability"] --> scaffold{"Scaffold only?"}
  scaffold -->|Yes| skill["Use $create-command"]
  skill --> placeholder["Create one command file<br/>with console.log placeholder"]
  scaffold -->|No| core["Model the use case"]
  core --> command["Add thin oclif command"]
  command --> interactive{"Interactive value?"}
  interactive -->|No| tests["Test command and feature"]
  interactive -->|Yes| screen["Add route and Ink screen"]
  screen --> tests
  tests --> docs["Update public documentation"]
  docs --> verify["Run quality and package checks"]
```

For a metadata-only command scaffold, use the repository's `$create-command` Codex skill. It asks
for the ID, description, aliases, arguments, flags, and examples, then creates a compilable file in
`src/commands/` whose only behavior is a visible `console.log` placeholder.

For real product behavior, follow the workflow below. If the feature is textual only, skip the TUI
step but keep the use case independent from oclif.

## 1. Model the use case

Create `src/features/<feature>/core/` with:

- input, result, and event types;
- ports for external effects;
- a function or class that coordinates the operation;
- stable error types for expected failures.

The core must not import oclif, React, Ink, Execa, Node.js APIs, or concrete infrastructure.
Commands and screens need to present the same failure differently, so expected errors must remain
typed and transport-neutral.

For long-running work, publish discriminated events instead of writing to the terminal:

```ts
export type ExampleEvent =
  | {type: 'started'}
  | {type: 'output'; stream: 'stdout' | 'stderr'; text: string}
  | {type: 'completed'; durationMs: number}
  | {type: 'failed'; message: string}
  | {type: 'cancelled'}
```

Expose only public core contracts from `src/features/<feature>/index.ts`. Imports inside the feature
remain relative; consumers outside the feature use that root entrypoint.

Implement each concrete port in `src/features/<feature>/adapters/` and register it in the runtime
container. An adapter never instantiates another adapter; only the composition root knows concrete
implementations.

```mermaid
flowchart LR
  input["Typed input"] --> usecase["Feature use case"]
  usecase --> port["Port"]
  adapter["Concrete adapter"] -. implements .-> port
  usecase --> events["Events"]
  usecase --> result["Typed result"]
  events --> cli["CLI presenter"]
  events --> tui["TUI state"]
  result --> cli
  result --> tui
```

## 2. Define CLI presentation

Add human presentation, error mapping, and output DTOs to `src/features/<feature>/cli/`. Use
`src/cli/` only for shared tables, sanitization, serialization, and base error behavior.

Decide the public contract before implementing:

- the success shape;
- the expected error shape;
- exit codes;
- which events stream in human mode;
- whether the command supports JSON;
- whether an interactive route adds real value.

JSON is a public API. It must contain only data and remain free from ANSI, progress messages,
spinners, and textual logs. Emit exactly one document at the end.

Do not create identity wrappers around results. When the public JSON shape differs from the use-case
result, create a typed mapper and return its DTO.

## 3. Add the oclif class

Create `src/commands/<topic>/<name>.ts`. With `"topicSeparator": " "`, the path
`src/commands/project/create.ts` becomes `mycli project create`.

```mermaid
flowchart LR
  file["src/commands/project/create.ts"] --> discovery["oclif pattern discovery"]
  discovery --> id["project create"]
  id --> help["mycli project create --help"]
```

Do not register the command manually. Development rediscovers source files because the generated
manifest is ignored and removed before startup. Packaging recreates the manifest from the production
build.

The class should do only the following:

1. declare aliases, arguments, flags, description, examples, and summary;
2. call `this.parse()`;
3. reject `--json` together with `--interactive` when both are supported;
4. require a TTY before mounting a screen;
5. obtain dependencies from the composition root;
6. call the use case or interactive runtime;
7. present the result and set the exit code.

Use `BaseCommand` when the command participates in the project's JSON and central error contracts.
Keep non-interactive behavior as the default; `--interactive` selects another delivery adapter for
the same use case.

Do not call another oclif class to reuse behavior.

## 4. Add the route and screen

If interaction improves the experience, add a route to `ScreenRoute` and connect it in
`src/tui/router.tsx`. Place feature-specific screens and controllers in
`src/features/<feature>/tui/`.

The screen should:

- receive services and state through props or context, not mutable global modules;
- start effects in hooks and cancel pending work when unmounted;
- represent `idle`, `loading`, `success`, `failure`, and `cancelled` when applicable;
- use primitives from `components/ui` and product compositions from `components/app`;
- work in one column and use two columns when enough width is available;
- provide an `Esc` path and respect global `Ctrl+C` behavior.

Register the action on Home and in the command palette. Change `keymap.ts` only for global shortcuts;
local shortcuts stay near the screen that owns them.

During Ink rendering, never use `console.log`, `this.log()`, or oclif spinners. Convert use-case
events into visual state.

## 5. Test every changed boundary

### Feature tests

Cover:

- success with fake ports;
- validation and expected failures;
- event order;
- cancellation and resource release;
- feature-specific adapters, presenters, DTOs, and error mappers.

### Command tests

Cover:

- help, positional arguments, and flags;
- human output;
- parseable JSON without ANSI;
- `--json --interactive` returning invalid usage;
- `--interactive` without a TTY returning exit code `2`;
- preservation of child process exit codes.

### TUI tests

Cover:

- route and initial frame;
- navigation and shortcuts;
- loading and final frames;
- confirmation and cancellation;
- narrow and wide layouts when behavior changes with terminal width.

Organize feature tests under `test/features/<feature>/`. Global command, shell, routing, and package
tests remain in their integration folders.

Use a fixed width, `NO_MOTION=1`, and `NO_UNICODE=1` for visual tests. Avoid snapshots of elapsed
time or animation frames; assert semantic content from the final frame.

## 6. Update the public story

Add the command to the README command table. If it introduces a public JSON contract, document its
shape and exit behavior. If it changes contracts or dependencies between layers, update
`docs/architecture.md`.

## 7. Validate the result

Run the main quality gate:

```bash
npm run check
```

For command discovery and the installable artifact, also run:

```bash
npm run build
npm run manifest
npm run smoke:package
```

Before handing off, execute the command in development with safe values for every required argument
and flag, then confirm both its output and exit code.
