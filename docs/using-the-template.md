# Usando o GitHub Template

## Criar um projeto

1. No repositório original, confirme que **Settings → General → Template
   repository** está habilitado.
2. Selecione **Use this template → Create a new repository**.
3. Escolha proprietário, nome e visibilidade do novo repositório.
4. Clone o repositório criado e instale dependências com `npm install`.

Histórico de commits, branches, secrets, environments, regras de proteção e
configurações de publicação não são copiados pelo GitHub Template. Configure-os
novamente quando forem necessários.

## Checklist obrigatório de personalização

Substitua os placeholders de forma consistente:

- [ ] `package.json#name`: troque `my-cli` pelo nome npm desejado.
- [ ] `package.json#bin`: troque a chave `mycli` pelo comando executável.
- [ ] `package.json#description`, `author`, `homepage`, `bugs` e `repository`.
- [ ] `package.json#oclif#bin` e referências ao binário em help/exemplos, caso
      essa propriedade esteja presente.
- [ ] Título, exemplos, links e texto introdutório do README.
- [ ] Nome/descrição mostrados no cabeçalho e no tema da TUI.
- [ ] Identificadores residuais encontrados com
      `rg -n "my-cli|mycli|cli-template"`.
- [ ] Titular e ano do `LICENSE`, se o novo projeto não for manter os atuais.
- [ ] URL do registry termcn em `components.json` somente se usar outro
      registry; normalmente ela não muda.

Depois das alterações, rode `npm install` para atualizar o lockfile. Não edite
`package-lock.json` manualmente.

## Validar o novo projeto

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run manifest
npm run smoke:package
```

Também valide a TUI manualmente em terminais 80×24 e 120×40:

```bash
./bin/run.js
./bin/run.js task list --interactive
./bin/run.js doctor --interactive
```

Confirme os cenários abaixo antes do primeiro merge:

- o comando raiz abre a TUI em um TTY;
- o comando raiz mostra help e termina quando stdout/stdin não são TTY;
- `doctor --json` e `task list --json` produzem JSON parseável e sem ANSI;
- `--interactive --json` falha com código `2`;
- cancelar uma tarefa não deixa processo órfão nem o terminal alterado;
- o `.tgz` contém build, bins, manifesto, README e licença, mas não contém
  fontes, testes, documentação interna ou segredos;
- o JavaScript empacotado não contém imports `@/...`.

A CI executará essas verificações em Node 22/24 no Linux e em Node 24 no macOS
e Windows.

## Segurança antes de publicar

O template usa `"private": true`. Mantenha essa proteção enquanto nome,
metadados e ownership não estiverem finalizados. Quando o projeto estiver
pronto para publicação:

1. confirme que o nome está disponível no registry npm;
2. reveja o conteúdo com `npm pack --dry-run`;
3. remova `"private": true` conscientemente;
4. defina `publishConfig` apropriado, especialmente para pacotes com escopo;
5. configure autenticação/proveniência no repositório do novo projeto.

Não há workflow de release ou publicação automática no MVP. Adicioná-lo exige
uma decisão explícita do projeto consumidor; nunca copie tokens para o
repositório.

## Próximos passos recomendados

- Remova comandos de exemplo que não façam sentido para o produto.
- Troque tokens do tema antes de customizar cada componente isoladamente.
- Mantenha classes oclif e telas como adaptadores dos casos de uso.
- Ao adicionar um fluxo novo, siga
  [adicionando um comando e sua tela](adding-a-command.md).
- Atualize o README sempre que o contrato JSON ou os códigos de saída mudarem.
