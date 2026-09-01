---
name: create-command
description: Criar e validar um novo comando oclif neste repositório a partir de perguntas sobre nome, descrição, aliases, argumentos, flags e exemplos. Use quando o usuário pedir para adicionar, criar ou gerar o scaffold de um comando CLI; não use para implementar a lógica de negócio de um comando existente.
---

# Criar comando oclif

Crie um scaffold TypeScript compilável em `src/commands/`. O comportamento inicial do comando deve ser somente um `console.log`; parsing e metadados do oclif não contam como lógica de negócio.

## Antes de perguntar

Leia `package.json`, `docs/adding-a-command.md` e o comando existente mais parecido. Preserve as convenções locais caso o projeto tenha mudado desde a criação desta skill.

Neste repositório:

- oclif descobre comandos pelo caminho sob `src/commands/`;
- o separador público de tópicos é espaço;
- comandos simples estendem `Command` de `@oclif/core`;
- classes são exportadas como `default`, usam `static override` e chamam `this.parse()`;
- o código usa TypeScript ESM, aspas simples, sem ponto e vírgula e largura de 100 colunas.

Não use `BaseCommand` para este scaffold. Ele habilita `--json`, enquanto `console.log` não participa do contrato JSON do projeto.

## Coletar as informações

Antes de editar arquivos, faça uma única pergunta compacta contendo apenas os campos ainda ausentes. Solicite:

1. **ID do comando** — obrigatório, em segmentos lower-kebab-case separados por espaço, por exemplo `project create`.
2. **Descrição** — obrigatória e adequada para o help.
3. **Resumo** — opcional; derive uma versão curta da descrição se omitido.
4. **Aliases do comando** — opcionais; aceite espaço ou `:` como separador de tópico.
5. **Argumentos posicionais** — opcionais; para cada um: nome, descrição, obrigatório ou não, valor padrão, opções permitidas e se aceita múltiplos valores.
6. **Flags** — opcionais; para cada uma: nome longo, tipo (`boolean`, `string` ou `integer`), caractere curto, descrição, obrigatoriedade e valor padrão. Pergunte opções permitidas e multiplicidade somente para `string`; para `integer`, pergunte mínimo, máximo e multiplicidade. Não pergunte opções ou multiplicidade para `boolean`.
7. **Exemplos adicionais** — opcionais; sempre gere ao menos o exemplo da invocação canônica.

Diga que o usuário pode responder `padrão` para todos os campos opcionais. Não repita perguntas já respondidas. Se somente um detalhe obrigatório continuar ambíguo, pergunte apenas por ele.

## Validar e derivar nomes

- Aceite `project create` e `project:create` como entrada, mas use `project create` ao conversar e nos exemplos.
- Converta o ID canônico em `src/commands/project/create.ts` e na classe `ProjectCreate`.
- Em `static override aliases`, normalize aliases hierárquicos para o formato interno do oclif, como `project:new`.
- Exija segmentos não vazios em lower-kebab-case. Rejeite caminhos absolutos, `.`, `..`, barras, contrabarras e qualquer destino fora de `src/commands/`.
- Rejeite `index` como último segmento: o oclif remove esse nome do ID descoberto e poderia registrar outro comando ou causar colisão.
- Confirme que o arquivo, o ID e os aliases ainda não existem. Nunca sobrescreva um arquivo sem confirmação explícita.
- Mantenha nomes de argumentos e flags únicos. Mantenha caracteres curtos de flags únicos.
- Posicione argumentos obrigatórios antes dos opcionais. Um argumento com múltiplos valores deve ser o último e o único desse tipo, e todos os argumentos anteriores a ele devem ser obrigatórios.
- Não invente aliases, argumentos ou flags. Use listas vazias quando o usuário responder `padrão`.
- Mostre o ID, o caminho e o nome da classe derivados antes de gravar somente quando houver normalização ambígua ou colisão; caso contrário, prossiga.

## Gerar o arquivo

Crie somente `src/commands/<segmentos>.ts`, salvo se o usuário pedir explicitamente testes, documentação, feature ou TUI. Não edite `dist/`, `oclif.manifest.json` nem faça registro manual do comando.

Use imports condicionais de `Args`, `Command` e `Flags`. Omita blocos estáticos vazios. Preserve a seguinte ordem quando os blocos existirem: `aliases`, `args`, `description`, `examples`, `flags`, `summary`.

O resultado deve seguir esta forma, adaptada às respostas:

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

Regras do template:

- Use `Args.string()` para argumentos posicionais.
- Use `Flags.boolean()`, `Flags.string()` ou `Flags.integer()` conforme a resposta.
- Em `Flags.boolean()`, nunca inclua `options` nem `multiple`.
- Em `Flags.string()`, `options` deve conter strings; `multiple` é permitido.
- Em `Flags.integer()`, use `min` e `max` para limitar valores; `multiple` é permitido, mas não gere `options`.
- Quando `multiple: true`, qualquer `default` deve ser um array do tipo correspondente.
- Inclua somente propriedades que tenham valor informado ou necessário.
- Use `<%= config.bin %>` nos exemplos; aliases aparecem com espaços nos exemplos e com `:` em `aliases`.
- Se não houver argumentos nem flags, ainda execute `await this.parse(NomeDaClasse)` e depois `console.log('Command "id" executed.')`.
- Se houver argumentos ou flags, use ambos os objetos retornados pelo parse no `console.log`, como no exemplo, para manter o placeholder observável e sem variáveis não utilizadas.
- O `console.log` deve ser a única ação do comando. Não adicione serviços, I/O, prompts em runtime, JSON, modo interativo ou tratamento de erros sem pedido explícito.

## Verificar

Após criar o arquivo:

1. Formate somente o novo arquivo com `npm exec -- prettier --write <arquivo>`.
2. Execute `npm exec -- eslint <arquivo>`.
3. Execute `npm run typecheck`.
4. Execute o comando em desenvolvimento com valores seguros para todos os argumentos e flags obrigatórios e confirme a mensagem do `console.log`.

Se o usuário pedir a validação completa do repositório, execute `npm run check` e `npm run smoke:package`. Não corrija falhas preexistentes ou arquivos fora do escopo sem autorização.

Ao concluir, informe o caminho criado, a invocação canônica, os aliases e quais verificações passaram. Destaque qualquer default assumido ou validação que não pôde ser executada.
