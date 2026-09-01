# Adicionando um comando e sua tela

Use este fluxo quando uma funcionalidade precisar existir tanto como comando
automatizável quanto como tela interativa. Se a funcionalidade for puramente
textual, omita a etapa da tela, mas preserve o caso de uso separado.

## 1. Modele o caso de uso

Crie uma pasta em `src/features/<feature>/` com:

- tipos de entrada, resultado e eventos;
- portas para efeitos externos;
- uma função ou classe que coordene a operação.

O caso de uso não deve importar oclif, React, Ink ou uma implementação de
infraestrutura. Erros esperados devem ter representação estável, para que CLI
e TUI possam apresentá-los de maneiras diferentes.

Para operações longas, publique eventos discriminados em vez de escrever no
terminal:

```ts
export type ExampleEvent =
  | {type: 'started'}
  | {type: 'output'; stream: 'stdout' | 'stderr'; text: string}
  | {type: 'completed'; durationMs: number}
  | {type: 'failed'; message: string}
  | {type: 'cancelled'}
```

Implemente a porta concreta em `src/infrastructure/` e registre-a no container.

## 2. Crie os presenters

Adicione uma transformação humana e uma transformação JSON em
`src/presenters/`. O contrato JSON precisa ser composto apenas por dados e deve
permanecer sem ANSI, logs, mensagens de progresso ou spinner.

Decida antes de implementar:

- forma do resultado de sucesso;
- forma do erro esperado;
- código de saída;
- quais eventos são transmitidos no modo textual.

No modo JSON, acumule o resultado necessário e escreva exatamente um documento
ao final. Não misture streaming textual com JSON.

## 3. Adicione a classe oclif

Crie `src/commands/<topic>/<name>.ts`. A classe deve fazer somente o seguinte:

1. declarar argumentos, flags, descrição e exemplos;
2. chamar `this.parse()`;
3. rejeitar `--json` junto de `--interactive`;
4. exigir TTY antes de abrir uma tela;
5. obter dependências do composition root;
6. chamar o caso de uso ou o runtime da TUI;
7. apresentar o resultado e definir o código de saída.

Com `"topicSeparator": " "`, o caminho
`src/commands/project/create.ts` resulta em `mycli project create`. Não registre
o comando manualmente e não chame outra classe oclif para reaproveitar lógica.
O entrypoint de desenvolvimento redescobre os fontes porque o manifesto gerado
fica no `.gitignore` e é removido antes da inicialização; o empacotamento o
recria a partir do build de produção.

Mantenha o comportamento não interativo como padrão. `--interactive` deve
apenas escolher outro adaptador para o mesmo caso de uso. Se o comando aceitar
`--json`, cubra explicitamente a incompatibilidade entre as flags.

## 4. Adicione a rota e a tela

Inclua uma rota em `ScreenRoute` e conecte-a em `src/tui/router.tsx`. A tela em
`src/tui/screens/` deve:

- receber serviços e estado por props/contexto, sem importá-los de módulos
  globais mutáveis;
- iniciar efeitos em hooks e cancelar trabalho pendente ao desmontar;
- representar `idle`, `loading`, `success`, `failure` e `cancelled` quando forem
  estados possíveis;
- usar componentes de `components/ui` e composições de `components/app`;
- caber em layout de uma coluna e aproveitar duas colunas quando houver espaço;
- fornecer uma saída por `Esc` e respeitar o tratamento global de `Ctrl+C`.

Registre a ação na Home e na command palette. Atualize `keymap.ts` somente para
atalhos globais; atalhos locais permanecem próximos à tela.

Durante a renderização Ink, não use `console.log`, `this.log()` ou spinners do
oclif. Eventos do caso de uso devem virar estado visual.

## 5. Teste os três níveis

### Caso de uso

- sucesso com portas fake;
- validação e falha esperada;
- sequência dos eventos;
- cancelamento e liberação de recursos.

### Comando

- help, argumentos e flags;
- saída humana e JSON parseável;
- JSON sem ANSI;
- `--json --interactive` retorna uso inválido;
- `--interactive` sem TTY retorna código `2`;
- código de saída do processo é preservado.

### TUI

- rota e frame inicial;
- navegação e atalhos;
- loading e frame final;
- confirmação e cancelamento;
- terminal estreito e largo quando o layout mudar.

Use largura fixa, `NO_MOTION=1` e `NO_UNICODE=1` nos testes visuais. Evite
snapshots de tempo decorrido ou animação; prefira as informações semânticas do
último frame.

## 6. Atualize a documentação pública

Inclua o comando na tabela do README e, se ele introduzir um contrato ou uma
nova dependência entre camadas, registre a decisão em `docs/architecture.md`.
Finalize executando:

```bash
npm run check
npm run build
npm run manifest
npm run smoke:package
```
