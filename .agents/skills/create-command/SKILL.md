---
name: create-command
description: Create and validate a new oclif command in this repository by asking about its name, description, aliases, arguments, flags, and examples. Use when the user asks to add, create, or generate a CLI command scaffold; do not use to implement business logic for an existing command.
---

# Create an oclif command

Create a compilable TypeScript scaffold in `src/commands/`. The command's initial behavior must be only a `console.log`; oclif parsing and metadata do not count as business logic.

## Before asking questions

Read `package.json`, `docs/adding-a-command.md`, and the most similar existing command. Preserve local conventions if the project has changed since this skill was created.

In this repository:

- oclif discovers commands from their path under `src/commands/`;
- the public topic separator is a space;
- simple commands extend `Command` from `@oclif/core`;
- classes are exported as `default`, use `static override`, and call `this.parse()`;
- the code uses TypeScript ESM, single quotes, no semicolons, and a 100-column width.

Do not use `BaseCommand` for this scaffold. It enables `--json`, while `console.log` does not participate in the project's JSON contract.

## Collect the information

Before editing files, ask one compact question containing only the fields that are still missing. Request:

1. **Command ID** — required, in lower-kebab-case segments separated by spaces, for example `project create`.
2. **Description** — required and suitable for help output.
3. **Summary** — optional; derive a short version of the description if omitted.
4. **Command aliases** — optional; accept a space or `:` as the topic separator.
5. **Positional arguments** — optional; for each one: name, description, whether it is required, default value, allowed options, and whether it accepts multiple values.
6. **Flags** — optional; for each one: long name, type (`boolean`, `string`, or `integer`), short character, description, whether it is required, and default value. Ask about allowed options and multiplicity only for `string`; for `integer`, ask about minimum, maximum, and multiplicity. Do not ask about options or multiplicity for `boolean`.
7. **Additional examples** — optional; always generate at least the canonical invocation example.

Tell the user they can answer `default` for all optional fields. Do not repeat questions that have already been answered. If only one required detail remains ambiguous, ask only about that detail.

## Validate and derive names

- Accept `project create` and `project:create` as input, but use `project create` when communicating and in examples.
- Convert the canonical ID to `src/commands/project/create.ts` and the `ProjectCreate` class.
- In `static override aliases`, normalize hierarchical aliases to oclif's internal format, such as `project:new`.
- Require non-empty lower-kebab-case segments. Reject absolute paths, `.`, `..`, slashes, backslashes, and any destination outside `src/commands/`.
- Reject `index` as the last segment: oclif removes this name from the discovered ID and could register another command or cause a collision.
- Confirm that the file, ID, and aliases do not already exist. Never overwrite a file without explicit confirmation.
- Keep argument and flag names unique. Keep flag short characters unique.
- Place required arguments before optional ones. An argument with multiple values must be the last and only argument of its kind, and all arguments before it must be required.
- Do not invent aliases, arguments, or flags. Use empty lists when the user answers `default`.
- Show the derived ID, path, and class name before writing only when normalization is ambiguous or there is a collision; otherwise, proceed.

## Generate the file

Create only `src/commands/<segments>.ts`, unless the user explicitly asks for tests, documentation, a feature, or a TUI. Do not edit `dist/`, `oclif.manifest.json`, or manually register the command.

Use conditional imports of `Args`, `Command`, and `Flags`. Omit empty static blocks. Preserve the following order when blocks exist: `aliases`, `args`, `description`, `examples`, `flags`, `summary`.

The result should follow this form, adapted to the answers:

```ts
import {Args, Command, Flags} from '@oclif/core'

export default class ProjectCreate extends Command {
  static override aliases = ['project:new']
  static override args = {
    name: Args.string({
      description: 'Name of the project.',
      required: true,
    }),
  }
  static override description = 'Create a new project.'
  static override examples = [
    '<%= config.bin %> project create example',
    '<%= config.bin %> project new example',
  ]
  static override flags = {
    force: Flags.boolean({
      char: 'f',
      description: 'Overwrite an existing project.',
    }),
  }
  static override summary = 'Create a project'

  async run(): Promise<void> {
    const {args, flags} = await this.parse(ProjectCreate)

    console.log('Command "project create" executed.', {args, flags})
  }
}
```

Template rules:

- Use `Args.string()` for positional arguments.
- Use `Flags.boolean()`, `Flags.string()`, or `Flags.integer()` according to the answer.
- In `Flags.boolean()`, never include `options` or `multiple`.
- In `Flags.string()`, `options` must contain strings; `multiple` is allowed.
- In `Flags.integer()`, use `min` and `max` to limit values; `multiple` is allowed, but do not generate `options`.
- When `multiple: true`, any `default` must be an array of the corresponding type.
- Include only properties that have an informed or necessary value.
- Use `<%= config.bin %>` in examples; aliases appear with spaces in examples and with `:` in `aliases`.
- If there are no arguments or flags, still execute `await this.parse(ClassName)` and then `console.log('Command "id" executed.')`.
- If there are arguments or flags, use both objects returned by `parse` in `console.log`, as in the example, to keep the placeholder observable and avoid unused variables.
- `console.log` must be the command's only action. Do not add services, I/O, runtime prompts, JSON, interactive mode, or error handling without an explicit request.

## Verify

After creating the file:

1. Format only the new file with `npm exec -- prettier --write <file>`.
2. Run `npm exec -- eslint <file>`.
3. Run `npm run typecheck`.
4. Run the command in development with safe values for all required arguments and flags and confirm the `console.log` message.

If the user asks for full repository validation, run `npm run check` and `npm run smoke:package`. Do not fix pre-existing failures or files outside the scope without authorization.

When complete, report the created path, canonical invocation, aliases, and which checks passed. Call out any assumed default or validation that could not be run.
