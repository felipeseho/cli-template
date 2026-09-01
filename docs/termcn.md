# termcn neste template

termcn fornece componentes de terminal para Ink e OpenTUI seguindo o modelo
shadcn. Este projeto usa somente a variante **Ink**: o registry copia os fontes
para o repositório e esses arquivos passam a ser mantidos junto da aplicação.
O runtime não consulta `termcn.dev`.

## Configuração do registry

`components.json` registra o namespace:

```json
{
  "registries": {
    "@termcn": "https://termcn.dev/r/{name}.json"
  }
}
```

Os aliases do mesmo arquivo apontam cada artefato para sua pasta real:

- componentes compartilhados: `src/components`;
- primitivas de UI: `src/tui/components/ui`;
- hooks: `src/tui/hooks`;
- bibliotecas e utilitários: `src/lib`;
- alias TypeScript: `@/*` resolve a partir de `src/*`.

O `ThemeProvider` explícito fica em `src/providers`. Tipos, helpers, temas e
providers também são código vendorizado e usam o mesmo alias raiz `@/*`.

O arquivo real do projeto é a fonte de verdade; não substitua seus aliases por
paths genéricos copiados de um projeto web.

## Adicionando um componente

Consulte o componente no catálogo e use sempre o caminho da variante Ink:

```bash
npx shadcn@latest add @termcn/ink/spinner
```

Depois da geração:

1. revise os arquivos adicionados e seus imports;
2. mantenha-os em `src/tui/components/ui`;
3. mova composições específicas do produto para `components/app`;
4. confirme que dependências usadas em runtime estão em `dependencies`;
5. execute typecheck, testes, build e smoke do pacote;
6. faça commit dos fontes gerados.

Adicionar um componente é uma alteração de código, não uma instalação de tema
remoto em runtime. Uma atualização futura deve ser revisada como qualquer diff
local, pois customizações do projeto pertencem ao projeto.

## Aliases e ESM publicado

Os fontes importam, por exemplo:

```tsx
import {Spinner} from '@/tui/components/ui/spinner.js'
```

Node ESM não entende `@/` por conta própria. O projeto usa `module: NodeNext` e
`moduleResolution: NodeNext`, por isso todo import local — inclusive os aliases
copiados do registry — termina em `.js`; o TypeScript o associa ao respectivo
fonte `.ts`/`.tsx`. Após adicionar ou atualizar um componente termcn, normalize
eventuais imports locais sem extensão antes do typecheck. O build executa
`tsc-alias` depois de `tsc` para reescrever aliases como caminhos relativos
válidos no JavaScript executado pelo Node.

```text
TypeScript + @/* ──tsc──> JavaScript + @/* ──tsc-alias──> JavaScript relativo
```

Não remova a etapa de alias do build. `npm run smoke:package` procura imports
`@/...` residuais dentro do tarball instalado e falha se encontrar algum.

## Tema e componentes locais

`ThemeProvider` fica na raiz da TUI. Tokens semânticos devem ser usados em vez
de cores repetidas nas telas, permitindo trocar o tema sem reescrever cada
componente.

Os componentes mínimos do template são:

- `AppShell` para cabeçalho, conteúdo e atalhos;
- `CommandPalette` para navegação por `/`;
- `Menu`/`Select` e `Table` para listas navegáveis;
- `Spinner` e `LogPanel` (composição local sobre o `Log` do registry) para
  operações longas;
- `Confirm`, `StatusMessage` e `KeyboardShortcuts`;
- `ThemeProvider` para tokens e capacidades do terminal.

Nem todos precisam vir diretamente do registry. Componentes de produto podem
compor primitivas termcn e permanecer em `components/app`.

## Capacidades do terminal

A apresentação deve respeitar:

- `NO_COLOR`: remove cores ANSI;
- `NO_UNICODE`: usa símbolos ASCII;
- `NO_MOTION`: desativa animação e frames dependentes de tempo;
- `CI`: escolhe uma saída determinística e conservadora;
- ausência de TTY: nunca tenta iniciar a TUI.

Use `process.stdout.columns` ou o hook de tamanho do Ink para responsividade.
Teste pelo menos 80×24 e 120×40 manualmente; testes automatizados devem fixar
largura e desabilitar movimento/Unicode.

## Particularidades do Ink 7

- Requer Node moderno; este template fixa Node `>=22.0` e React 19.
- A aplicação é montada uma vez com `render(..., {alternateScreen: true})`.
- O chamador aguarda `waitUntilExit()` antes de devolver o controle ao oclif.
- Sinais e desmontagem devem sempre restaurar raw mode, cursor e screen buffer.
- `useInput` coordena teclado; uma tarefa ativa recebe `Ctrl+C` como
  cancelamento, enquanto o estado ocioso o interpreta como saída.

Referências: [termcn registry](https://www.termcn.dev/docs/registry),
[termcn](https://www.termcn.dev/) e [Ink](https://github.com/vadimdemedes/ink).
