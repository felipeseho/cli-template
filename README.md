# my-cli

Template para criar CLIs modernas com duas experiências sobre a mesma regra de
negócio: comandos oclif para automação e uma interface interativa construída
com React, Ink e componentes termcn.

> Este repositório é um ponto de partida. Antes de publicar um projeto criado a
> partir dele, troque o nome `my-cli`, o binário `mycli` e os metadados indicados
> no [checklist de personalização](docs/using-the-template.md).

## O que o template demonstra

- Node.js 22+, TypeScript ESM e npm.
- oclif v4 com comandos hierárquicos separados por espaço.
- React 19, Ink 7 e componentes termcn/Ink copiados para o projeto.
- Uma camada de casos de uso compartilhada por CLI textual e TUI.
- Saída humana, streaming de processos e JSON estável para automação.
- Execução segura de scripts já declarados em `package.json`, sem shell livre.
- Testes unitários, de comandos, de TUI e do tarball npm real.
- CI multiplataforma em Linux, macOS e Windows.

## Requisitos

- Node.js `>=22.0`
- npm compatível com a versão do Node
- Git
- Um terminal com TTY para usar o modo interativo

## Começando

Crie um repositório com **Use this template**, clone-o e execute:

```bash
npm install
npm run build
./bin/run.js --help
```

Durante o desenvolvimento, o entrypoint TypeScript pode ser executado sem um
build prévio:

```bash
./bin/dev.js
./bin/dev.js doctor
./bin/dev.js task list
```

No Windows, use os scripts npm equivalentes:

```powershell
npm run dev -- doctor
npm run dev -- task list
```

## Comandos de exemplo

| Comando                                 | Resultado                                                            |
| --------------------------------------- | -------------------------------------------------------------------- |
| `mycli` ou `mycli ui`                   | Abre a tela inicial quando há TTY; sem TTY, mostra o help e termina. |
| `mycli task list`                       | Lista os scripts do `package.json` do diretório atual.               |
| `mycli task list --interactive`         | Abre a lista filtrável de tarefas.                                   |
| `mycli task run <script>`               | Executa um script existente com saída em streaming.                  |
| `mycli task run <script> --interactive` | Confirma e acompanha a tarefa em uma tela com logs e resumo.         |
| `mycli doctor`                          | Verifica Node, npm, Git, TTY, workspace e `package.json`.            |
| `mycli doctor --interactive`            | Abre o diagnóstico visual e permite repeti-lo.                       |
| `mycli ... --json`                      | Produz um único documento JSON, sem ANSI.                            |

`--interactive` exige TTY e não pode ser combinado com `--json`. `task run`
aceita apenas um nome presente em `package.json#scripts`; argumentos livres e
strings de shell não fazem parte do MVP.

Os códigos de saída são `0` para sucesso, `2` para uso inválido ou modo
interativo sem TTY, `130` para cancelamento e, quando uma tarefa falha, o código
de saída do processo executado.

## Tela interativa

A TUI usa uma única raiz Ink em alternate screen. Ela inclui:

- Home com contexto do workspace, ações rápidas e execuções da sessão.
- Lista pesquisável de scripts, com detalhes e ação de execução.
- Execução com confirmação, spinner, duração, logs e cancelamento.
- Doctor em formato de tabela, com recomendações e nova verificação.
- Paleta de comandos em `/`, ajuda em `?` e navegação por setas, Tab, Enter e
  Esc.

Durante uma tarefa, `Ctrl+C` cancela o subprocesso. Quando a aplicação está
ociosa, `Ctrl+C` encerra a TUI. A interface se adapta para uma ou duas colunas
de acordo com a largura do terminal.

## Arquitetura

```text
comando oclif ─┐
               ├──> caso de uso ──> eventos/resultado ──> texto ou JSON
tela Ink ──────┘                         └───────────────> estado da TUI
```

Comandos e telas são adaptadores. Leitura de workspace, diagnóstico e execução
de tarefas ficam em casos de uso que não importam oclif, React ou Ink. Assim, a
mesma funcionalidade pode crescer nas duas interfaces sem duplicação.

Veja a [arquitetura e a função de cada pasta](docs/architecture.md) e o guia
[adicionando um comando e sua tela](docs/adding-a-command.md).

## Desenvolvimento

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run manifest
npm run smoke:package
```

`npm run check` executa as verificações locais agregadas definidas pelo
template. O smoke gera um `.tgz`, valida seu conteúdo, instala-o em uma pasta
temporária e chama o binário instalado; portanto, ele detecta problemas que uma
execução direta de `src/` não encontraria.

## termcn

termcn segue o modelo shadcn: o código dos componentes é copiado para
`src/tui/components/ui` e passa a pertencer ao projeto. Não há dependência do
registry em runtime ou na CI. Para adicionar ou atualizar componentes, siga
[a convenção termcn deste template](docs/termcn.md).

## Usando como GitHub Template

O pacote começa com `"private": true` para evitar publicação acidental. O fluxo
completo de criação, renome, validação e preparação para publicação está em
[usando o template](docs/using-the-template.md). A opção **Template repository**
deve ser habilitada manualmente nas configurações deste repositório.

## Documentação

- [Arquitetura](docs/architecture.md)
- [Adicionar um comando e uma tela](docs/adding-a-command.md)
- [Componentes termcn](docs/termcn.md)
- [Usar e personalizar o template](docs/using-the-template.md)

## Licença

[MIT](LICENSE)
