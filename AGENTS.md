# Repository guidance

## Overview

This repository is a hybrid TypeScript ESM CLI template:

- scriptable commands built with oclif;
- an interactive interface built with React and Ink;
- use cases shared by the CLI and TUI;
- Node.js `>=24.15` and npm 12.

Read `docs/architecture.md` before changing the project structure. For end-to-end command work,
follow `docs/adding-a-command.md`.

## Architecture

- Keep classes in `src/commands/` thin: declare metadata, parse input, validate the execution mode,
  and delegate.
- Put business rules in `src/features/<feature>/core/` and organize each feature into `core`,
  `adapters`, `cli`, and `tui` as needed.
- Core code does not import Node.js, oclif, React, Ink, Execa, or the feature's outer layers.
- Use relative imports within a feature. External consumers import its public contract through the
  feature's `index.ts`.
- Only the composition root in `src/runtime/` knows concrete implementations across layers.
- Commands do not import individual screens, and the TUI does not execute oclif classes. Both call
  the same use cases.
- Services and use cases return data or publish events; they do not write directly to the terminal.
- Preserve the dependency restrictions in `eslint.config.js`.

## oclif commands

- Use the `$create-command` skill when the request is to scaffold a new command. Follow its question
  and validation flow before writing the file.
- The path defines the public ID: `src/commands/project/create.ts` becomes `project create` because
  the topic separator is a space.
- Do not register commands manually.
- Export the class as `default`, use `static override` for metadata, and call `this.parse()`.
- A simple scaffold from `$create-command` extends `Command` and may contain the skill's initial
  `console.log`. Move real behavior into a feature when implementing the command.
- Use `BaseCommand` when the command participates in the JSON and central error contracts. Derive
  from `DashboardCommand` when it also has a TUI route.
- For dashboard-capable commands, use adaptive delivery: JSON takes priority, `--no-interactive` or
  a missing TTY selects plain text, and a TTY selects the TUI route.
- `--no-interactive` has no short alias and may be combined with `--json`. Do not add
  `--interactive`, `-i`, or a standalone `ui` command.
- JSON output contains exactly one document without ANSI, logs, spinners, or progress messages.
- Do not invoke another oclif class to share logic; share a use case instead.

## Root invocation and help

- Invoking the binary without arguments opens Dashboard Home when stdin and stdout are TTYs.
- Without a TTY, or with root `--no-interactive`, the binary renders the root help instead.
- Keep help static: it must not mount Ink or enter the alternate screen.
- Use the shared product tokens for TUI and help branding. Each of `NO_COLOR`, `NO_UNICODE`, and
  `TERM=dumb` must select ANSI-free, ASCII-safe help.

## TypeScript and style

- The project uses strict TypeScript, ESM, and `NodeNext` resolution.
- Local imports end in `.js`, including imports through the `@/*` alias.
- Use `import type` for type-only imports.
- Do not leave promises unhandled.
- Follow the repository's Prettier settings: single quotes, no semicolons, trailing commas, and a
  100-character print width.
- Keep help text, code identifiers, and public documentation in English.

## TUI

- Keep a single Ink root and mount it through `src/runtime/`.
- Do not use `console.log`, `this.log()`, or oclif spinners while Ink is rendering. Convert use-case
  events into visual state.
- Cancel pending effects when unmounting and always restore raw mode, the cursor, and the alternate
  screen.
- Respect `NO_COLOR`, `NO_UNICODE`, `NO_MOTION`, `CI`, and the absence of TTY capability.
- Cover narrow and wide terminals when a layout is responsive.

## Tests and validation

- Add tests at every changed level: core, adapters/presenters, command, and/or TUI.
- For commands, cover help, arguments, flags, exit codes, and human and JSON output when applicable.
- For adaptive commands, cover all combinations of TTY availability, `--json`, and
  `--no-interactive`.
- Fix terminal width and use `NO_MOTION=1` and `NO_UNICODE=1` in visual tests.
- Run the checks directly related to the change first.
- Before completing a meaningful code change, run `npm run check`.
- After adding, renaming, or removing commands, validate discovery with `npm run build` and
  `npm run manifest`.
- For changes that affect the published package, run `npm run smoke:package`.

## Documentation and generated files

- Update the README when commands, JSON contracts, or exit codes change.
- Update `docs/architecture.md` when contracts or dependencies between layers change.
- Do not edit `dist/`, `coverage/`, or `oclif.manifest.json` manually; they are generated artifacts.
- Do not edit `package-lock.json` manually. Generate its changes with npm.
- Preserve existing changes outside the current task.
