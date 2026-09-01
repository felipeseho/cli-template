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
    tasks/
    doctor/
  infrastructure/
    workspace/
    process/
    system/
  presenters/
    human/
    json/
  tui/
    app.tsx
    router.tsx
    keymap.ts
    screens/
    components/
      ui/
      app/
    hooks/

test/
  unit/
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
um bloco `finally`.

### `src/features/`

Casos de uso e contratos independentes de framework:

- `workspace`: encontra e lê o `package.json` do diretório atual.
- `tasks`: lista scripts e executa uma tarefa, emitindo eventos tipados.
- `doctor`: agrega verificações do ambiente em diagnósticos tipados.

Os contratos principais são `Workspace`, `Task`, `TaskEvent`, `TaskResult` e
`DiagnosticCheck`. Tipos e casos de uso desta camada não importam oclif, Ink,
React nem Execa.

### `src/infrastructure/`

Implementações das portas de `features`: leitura do sistema de arquivos,
subprocessos com Execa e inspeção de Node/npm/Git/TTY. O executor chama `npm`
com programa e argumentos separados, `shell: false`, diretório de trabalho
explícito e `AbortSignal`.

### `src/presenters/`

Transforma resultados em contratos de saída. Presenters humanos podem produzir
tabelas e mensagens; presenters JSON retornam somente dados serializáveis. A
variante JSON nunca inclui ANSI, spinner ou texto incidental.

### `src/tui/`

Contém uma única aplicação Ink:

- `screens`: telas ligadas às rotas `home`, `task-list`, `task-run`, `doctor` e
  `help`.
- `components/ui`: fontes copiadas do registry termcn e versionadas no projeto.
- `components/app`: composições que pertencem ao domínio deste template.
- `hooks`: coordenação de estado e casos de uso; não implementa infraestrutura.
- `router.tsx` e `keymap.ts`: navegação e atalhos globais.

### `src/components/`, `src/lib/` e `src/providers/`

Código de suporte explícito dos componentes termcn vendorizados. `components`
mantém tipos compartilhados, `lib` concentra estilo, texto, símbolos e temas de
terminal, e `providers` contém o `ThemeProvider`. Os aliases do
`components.json` direcionam cada tipo de artefato para sua pasta real; imports
locais usam o alias raiz `@/*` para acessar estes helpers sem caminhos relativos
profundos.

### `test/`

- `unit`: casos de uso com portas fake.
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

As versões diretas de TypeScript, typescript-eslint, Vite e Rollup são
deliberadamente limitadas às linhas cuja árvore completa aceita Node 22.0. Ao
atualizar o toolchain, confira também os `engines.node` transitivos antes de
alterar o requisito público `>=22.0.0`.

`oclif.manifest.json` é gerado depois do build, faz parte do tarball e é
removido pelo `postpack`. Ele não é versionado: ao criar, renomear ou remover
comandos, execute `npm run build && npm run manifest` para validar a descoberta
localmente; `prepack` repete o processo antes de publicar.

## Fluxos principais

### Listagem de tarefas

1. O adaptador informa o diretório atual ao leitor de workspace.
2. A infraestrutura lê `package.json#scripts` e cria tarefas tipadas.
3. O caso de uso ordena e devolve as tarefas.
4. O comando escolhe presenter humano/JSON; a tela atualiza a tabela.

Sem `package.json`, a saída textual informa como corrigir o workspace, a saída
JSON mantém seu contrato e a TUI mostra um empty state em vez de quebrar.

### Execução de tarefa

1. O caso de uso valida o nome contra o catálogo; comandos arbitrários são
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

- `features` não importa outras camadas externas.
- `infrastructure` implementa portas declaradas por `features`.
- `commands`, `presenters` e `tui` podem importar `features` e o container.
- `commands` não importa telas individuais; pede ao runtime uma rota inicial.
- `tui` não executa classes oclif.
- Apenas o composition root conhece implementações concretas de todas as
  camadas.

Esses limites devem ser preservados à medida que novas telas e comandos forem
adicionados.
