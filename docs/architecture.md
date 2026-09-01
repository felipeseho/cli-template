# Arquitetura

## Princípio central

O template separa intenção, execução e apresentação. Um comando oclif e uma
tela Ink chamam o mesmo caso de uso; nenhum deles chama o outro.

```text
┌──────────────────┐       ┌──────────────────┐
│ comandos oclif   │──────▶│                  │
└──────────────────┘       │  casos de uso    │──▶ portas ──▶ infraestrutura
                           │                  │
┌──────────────────┐       └────────┬─────────┘
│ telas Ink        │───────────────▶│
└──────────────────┘                ▼
                          eventos e resultados tipados
                           │                      │
                           ▼                      ▼
                    presenters CLI          estado da TUI
```

Essa divisão evita acoplamento entre o ciclo de vida do terminal e a regra de
negócio. Em particular, serviços não escrevem em `console`, não usam
`this.log()` e não renderizam spinners. Eles retornam dados ou publicam eventos.

## Estrutura do projeto

```text
bin/
  dev.js
  run.js

src/
  index.ts
  cli/
  commands/
    ui.ts
    doctor.ts
    task/
      list.ts
      run.ts
  runtime/
  components/
    ui/
  lib/
    terminal-themes/
  providers/
  features/
    workspace/
      core/
      adapters/
      cli/
      tui/
    tasks/
      core/
      adapters/
      cli/
      tui/
    doctor/
      core/
      adapters/
      cli/
      tui/
  tui/
    app.tsx
    router.tsx
    routes.ts
    keymap.ts
    screens/
      home.tsx
      help.tsx
    components/
      ui/
      app/
    hooks/

test/
  features/
  cli/
  commands/
  tui/
  fixtures/
  package/
scripts/
docs/
.github/workflows/
```

### `bin/`

Entrypoints executáveis e mínimos. `dev.js` inicializa oclif em modo de
desenvolvimento com suporte a TypeScript/TSX; `run.js` carrega os comandos
compilados. O manifesto gerado fica fora do Git para que o modo de
desenvolvimento sempre redescubra `src/commands`; `dev.js` remove esse artefato
descartável antes de iniciar. Os entrypoints não contêm regra de negócio.

### `src/commands/`

Classes oclif finas. Cada classe declara argumentos, flags, help e exemplos,
valida combinações específicas da CLI e delega para um caso de uso ou para o
runtime interativo. A estrutura de arquivos determina os tópicos: por exemplo,
`commands/task/list.ts` é descoberto como `task list` porque o separador do
projeto é um espaço.

### `src/runtime/`

Fronteira de inicialização: compõe dependências, detecta TTY, instala e remove
handlers de sinais e monta a raiz Ink. É também onde o terminal entra e sai do
alternate screen. `waitUntilExit()` deve ser aguardado e todo cleanup fica em
um bloco `finally`. `services.ts` define a única fachada consumida pelos
comandos e pela TUI; somente o container conhece implementações concretas.

### `src/cli/`

Infraestrutura compartilhada da interface textual: `BaseCommand`, serialização
JSON sem ANSI, sanitização de texto, tabelas e o contrato de mapeamento de erros.
Presenters e mapeadores específicos permanecem na feature que os utiliza.

### `src/features/`

Módulos verticais organizados em quatro fronteiras internas:

- `core`: tipos, portas e casos de uso independentes de framework;
- `adapters`: implementações concretas das portas da feature;
- `cli`: presenters, DTOs e tradução de erros específicos;
- `tui`: telas e controladores de estado específicos.

As features atuais são:

- `workspace`: encontra e lê o `package.json` do diretório atual.
- `tasks`: lista scripts e executa uma tarefa, emitindo eventos tipados.
- `doctor`: agrega verificações do ambiente em diagnósticos tipados.

Os contratos principais são `Workspace`, `Task`, `TaskEvent`, `TaskResult` e
`DiagnosticCheck`. Arquivos de `core` não importam oclif, Ink, React, Execa nem
uma fronteira externa da própria feature. `workspace` é a dependência
fundamental compartilhada por `tasks` e `doctor`; estas duas features não se
conhecem.

O executor em `tasks/adapters` chama `npm` com programa e argumentos separados,
`shell: false`, diretório de trabalho explícito e `AbortSignal`.

### `src/tui/`

Contém o shell de uma única aplicação Ink:

- `screens`: telas globais `home` e `help`; telas de tarefas e doctor ficam nas
  respectivas features.
- `components/ui`: fontes copiadas do registry termcn e versionadas no projeto.
- `components/app`: composições que pertencem ao domínio deste template.
- `hooks`: primitives vendorizadas pelo termcn.
- `routes.ts`, `router.tsx` e `keymap.ts`: contratos de navegação, composição de
  telas e atalhos globais.

### `src/components/`, `src/lib/` e `src/providers/`

Código de suporte explícito dos componentes termcn vendorizados. `components`
mantém tipos compartilhados, `lib` concentra estilo, texto, símbolos e temas de
terminal, e `providers` contém o `ThemeProvider`. Os aliases do
`components.json` direcionam cada tipo de artefato para sua pasta real; imports
locais usam o alias raiz `@/*` para acessar estes helpers sem caminhos relativos
profundos.

### `test/`

- `features`: core, adapters, CLI e TUI organizados pela mesma feature do fonte.
- `cli`: helpers compartilhados da interface textual.
- `commands`: comportamento oclif, streams, JSON e códigos de saída.
- `tui`: frames e entrada de teclado com `ink-testing-library`.
- `fixtures`: workspaces determinísticos.
- `package`: verificações auxiliares do artefato publicado.

### `scripts/`, `docs/` e `.github/workflows/`

`scripts` contém automações de manutenção que não pertencem ao runtime, como o
smoke do tarball. `docs` registra decisões e fluxos de extensão. O workflow de
CI executa as mesmas verificações públicas disponíveis nos scripts npm.

## TypeScript e manifesto

`tsconfig.json` cobre apenas `src`, com `rootDir: src`, `outDir: dist`,
`module: NodeNext` e `moduleResolution: NodeNext`. `tsconfig.test.json` amplia o
escopo para testes sem alterar o contrato do build. `tsconfig.build.json` emite
JavaScript e declarações; em seguida, `tsc-alias` converte `@/*` em imports
relativos com extensão `.js` válidos no Node ESM.

O build e o typecheck usam o compilador nativo TypeScript 7. O
`typescript-eslint` ainda depende da API JavaScript do compilador, por isso o
pacote de compatibilidade TypeScript 6 fica instalado lado a lado conforme a
estratégia oficial de migração. Todo o toolchain e suas dependências transitivas
são validados em Node `>=24.15.0`.

O npm 12 bloqueia scripts de instalação transitivos por padrão. A allowlist
`package.json#allowScripts` libera somente `esbuild` e `fsevents`, necessários
para transformação e file watching no toolchain atual.

`oclif.manifest.json` é gerado depois do build, faz parte do tarball e é
removido pelo `postpack`. Ele não é versionado: ao criar, renomear ou remover
comandos, execute `npm run build && npm run manifest` para validar a descoberta
localmente; `prepack` repete o processo antes de publicar.

## Fluxos principais

### Listagem de tarefas

1. O adaptador informa o diretório atual ao leitor de workspace.
2. O adapter de workspace lê `package.json#scripts`.
3. O caso de uso de tasks transforma e ordena as tarefas.
4. O comando usa o presenter humano ou retorna o DTO JSON; a tela atualiza a
   tabela.

Sem `package.json`, a saída textual informa como corrigir o workspace, a saída
JSON mantém seu contrato e a TUI mostra um empty state em vez de quebrar.

### Execução de tarefa

1. O caso de uso valida o nome contra a lista do workspace; comandos arbitrários são
   rejeitados antes de criar um processo.
2. O runner inicia `npm run -- <nome>` sem shell; `--` impede que nomes de
   scripts iniciados por hífen sejam interpretados como opções do npm, e então
   publica `started`.
3. stdout/stderr viram eventos `output`; o adaptador decide como exibi-los.
4. O encerramento produz `completed`, `failed` ou `cancelled` e um `TaskResult`.
5. A saída retida em memória é limitada; streaming não precisa ser limitado.

Um único `AbortSignal` liga `Ctrl+C` ao subprocesso. Cancelamento retorna `130`
e a desmontagem restaura raw mode, cursor e alternate screen.

## Limites de dependência

- `core` depende apenas de outros contratos de core explicitamente permitidos.
- `adapters`, `cli` e `tui` de uma feature dependem para dentro e não importam
  implementações de outras features.
- imports internos usam caminhos relativos; consumidores externos usam o
  `index.ts` da feature para acessar seu core.
- `commands`, `runtime` e o shell da TUI compõem as features.
- `commands` não importa telas individuais; pede ao runtime uma rota inicial.
- `tui` não executa classes oclif.
- Apenas o composition root conhece implementações concretas de todas as
  camadas.

Esses limites devem ser preservados à medida que novas telas e comandos forem
adicionados.
