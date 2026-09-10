# Capturas do Robô de Lances

Fotos que o **agente tira sozinho** enquanto opera. O código chama
`this.screenshot(...)` a cada login e em cada passo relevante da navegação.

## Por que esta pasta existe

As imagens moram em `/opt/agente-lances/logs/screenshots/`, na VPS. Nenhuma tela
do Praefectus as mostra — o único jeito de vê-las é por SSH.

Isso já custou caro: em 08/09/2026 uma sessão disparada pela interface entrou na
conta do portal e ficou **11 minutos** com o navegador aberto, e quem disparou
não viu nada, porque olhou o VNC durante uma tentativa anterior que tinha
falhado. A prova de que funcionou estava aqui, invisível.

Até existir um painel de sessões que exiba as imagens, esta pasta é a ponte.

## Como atualizar

```sh
rsync -a agente-praefectus:/opt/agente-lances/logs/screenshots/ capturas-robo/
```

Os arquivos chegam com epoch em milissegundos no nome
(`portal-compras-pos-login-1788920545338.png`). Renomear para
`AAAAMMDD-HHMMSS-<passo>.png` deixa a listagem em ordem cronológica — e os
**segundos** importam: houve três sessões dentro do mesmo minuto.

## O que cada nome quer dizer

| Sufixo | Momento |
| --- | --- |
| `-login` | a tela de login, antes de entrar — serve para conferir seletor |
| `-pos-login` | **depois de autenticar**. É a prova de que o robô entrou |
| `-processo` | a página do pregão, já dentro da conta |
| `-sso-gov-br` | a tela do gov.br no caminho do certificado |

## As duas que valem uma reunião

- **`20260908-232225-portal-compras-pos-login.png`** — o portal mostrando
  "Você está logado como: RAFAEL WILLIAM CASTRO DA SILVA — 24.687.187/0001-01".
  O robô autenticado, sozinho.
- **`20260908-232234-portal-compras-processo.png`** — nove segundos depois, os
  "Dados do Processo" do pregão **002/2026** aberto. Ele procurou o número na
  lista da conta, achou e abriu.

  Esta traz dois avisos do próprio portal que valem levar ao cliente: o alerta
  amarelo *"você ainda não tem um plano ativo"* e a situação *"Encerrado para
  Operação"* — aquele pregão já tinha acabado, então serviu para provar a
  navegação, não para disputar.

- **`20260909-120301-portal-compras-sonda-dashboard.png`** — a resposta à
  pergunta que ficou em aberto acima. A tabela "Situação Cadastral" da conta:

  ```
  Inativo · validade 17/04/2026 · "Atenção: seu acesso está vencido." · 0 créditos
  ```

  O `NaoAssinante` da URL não era perfil limitado — é **mensalidade vencida**. A
  documentação da empresa está homologada desde 23/05/2024; só o plano caducou.

  Vale ler junto com a foto do processo acima: as duas são do mesmo estado de
  conta, e a de 08/09 prova que **conta vencida ainda lista e abre processos**.
  O plano bloqueia disputar, não navegar — conclusão oposta à que a tela do
  DashBoard sugere sozinha.

- **`20260910-001419-portal-compras-processo-002-2026.png`** — a mesma tela do
  processo, agora com o robô sabendo **o que** disputar dentro dele. O log da
  mesma sessão:

  ```
  🎯 Disputa por item — 2 item(ns) recebido(s): #1, #2
  ⚠️  1 de 2 item(ns) vieram SEM piso definido — para esses o robo nao deve dar lance
  📋 Processo encontrado: .../DadosPregao/?slA=Edit&ttCD_CHAVE=453864
  ```

  Vale por duas coisas. A primeira: até 09/09 o agente recebia só o número do
  edital, então num pregão de 40 itens ele abria a página certa sem saber o que
  acompanhar. A segunda: piso **ausente** é estado próprio, diferente de zero —
  a linha de aviso existe para que um item que ninguém avaliou não seja
  confundido com um item autorizado a descer até R$ 0,00.

  A situação continua **"Encerrado para Operação"**: serve para provar a
  navegação e o transporte dos itens, não para ler a sala de disputa. Os
  seletores de `lerMelhorLance()` e o `souLider()` seguem pendentes, e dependem
  de um pregão em sessão.

## Fora do git, de propósito

A pasta está no `.gitignore`. Duas razões:

1. **São dados de conta de cliente.** Nome, CNPJ e, numa delas, um telefone.
   O repositório é privado, mas é compartilhado com a equipe e com o Lovable —
   e imagem em git é permanente: apagar depois exige reescrever o histórico.
2. **São artefato, não fonte.** 15 MB de PNG que crescem a cada teste. O que
   precisa ser versionado é o código que as gera.

Se alguma imagem precisar ir para uma apresentação ou para o cliente, tire dela
uma cópia deliberada, com nome que diga o que é — em vez de versionar o
diretório inteiro por comodidade.
