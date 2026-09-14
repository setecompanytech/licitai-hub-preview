# Robô de Lances — o que existe, o que trava, e o que falta

> **Data desta foto:** 14/09/2026, madrugada do pregão 7/2026 SEDUC/PA. O que está aqui foi verificado, não deduzido —
> cada afirmação tem como conferir. Onde não deu para verificar, está escrito que
> não deu.

Este documento é o **mapa**: o estado do robô e o retrato de cada portal, com o
muro específico de cada um e o que falta para derrubá-lo.

Duas leituras diferentes moram aqui, e vale saber qual você procura:

- **Seções 1 a 6 — os portais.** Onde o robô entra, onde para, e o que falta
  para cada porta abrir.
- **Seção 7 — a régua do produto.** O que um robô de lances maduro faz, medido
  contra o nosso, e a esteira de três fases até lá. É sobre **estratégia de
  disputa**, não sobre acesso.

Ele não substitui o `docs/agente-cloud-pendencias.md`, que é o **diário** — lá
está o passo a passo de cada investigação, com os comandos, os erros e as datas.
Aqui está a conclusão. Quando este documento disser "ver seção 14", é lá.

---

## 1. O que existe hoje

### A corrente inteira, e onde ela se prova

```
Tela (Robô de Lances)
  └─ edge function  robo-lances-webhook
       └─ POST /sessao/iniciar  →  agente.praefectus.com.br
            └─ Puppeteer  →  Chrome VISÍVEL em Xvfb (:99)
                 └─ x11vnc → websockify → noVNC no iframe da aba Agente Cloud
```

Isso não é desenho de arquitetura: **é o caminho que já rodou de ponta a ponta**,
com uma exceção — o último elo, o lance, que está travado de propósito (§2).

| Elo | Estado | Prova |
| --- | --- | --- |
| Interface dispara sessão | ✅ | botão "Enviar ao robô", carimbo `2026-09-09.10` no ar |
| Edge function traduz e grava | ✅ | linha em `sessoes_lance_real`, com recusa antes de gravar quando o portal não existe |
| Agente aceita e abre o Chrome | ✅ | `/health` mostra as sessões; 8 registradas hoje |
| Login real em portal | ✅ | Portal de Compras Públicas, 08/09 à noite; **Compras.gov (gov.br + certificado A1), 10/09 às 16:31 e cinco vezes seguidas em 14/09, ~40 s cada** |
| VNC mostra a tela ao vivo | ✅ | janela ocupa 100% de 1920×1080 desde 09/09 |
| Navegar até a disputa | ✅ | processo **002/2026** achado em "Seus Processos" e aberto, 08/09; **Compras.gov: compra 7/2026 UASG 925315 achada entre dez homônimas e a sala (`acompanhamento-compra`) aberta pelo botão certo, 14/09 03:27, 77 s do envio** |
| Ler a tela de lances | ⬜ | depende de pregão ao vivo |
| Dar lance | 🔒 | travado — ver §2 |

### O primeiro login, que é o marco

Em 08/09/2026 à noite o robô entrou no **Portal de Compras Públicas** e a foto
registrou o cabeçalho:

> Você está logado como: RAFAEL WILLIAM CASTRO DA SILVA — 24.687.187/0001-01

É o primeiro login que este robô fez em toda a sua existência. Até então a pasta
`logs/screenshots/` estava vazia desde 15 de março.

### O agente que está no ar, agora

```
versão                     2.2.0
slots                      8 (0 em uso)
rotas                      14 — /health, /sessoes, /portais,
                                /sessao/{iniciar,pausar,encerrar,retomar,responder,focar},
                                /sessao/:id/{inspecionar,gravacoes},
                                /kill-switch, /api/proposta/enviar, /certificado
portais_suportados         8  — comprasgov, bll, licitacoes-e, pncp,
                                bec-sp, licitanet, portal-compras, bnc
portais_com_lance_liberado []
```

**8 de 23.** O template do repositório tem 23 módulos de portal; a VPS tem 8.
Isso é a pendência 24, e é invisível em qualquer tela — por isso o envio pergunta
ao `/health` antes de disparar, e diz **o que o agente tem** quando não tem o
módulo pedido.

---

## 2. A trava do lance — leia antes de mexer

```js
PORTAIS_COM_LANCE_LIBERADO = []
```

Está assim em `src/lib/agent-template/estrategia.ts` **e** em
`/opt/agente-lances/src/estrategia.js`. Enquanto a lista estiver vazia, nenhum
portal recebe lance, aconteça o que acontecer no resto do código.

A trava existe por causa do defeito mais caro que a auditoria de 02/09 encontrou:
sem `souLider()` escrito para o portal, **o robô cobre o próprio lance** — abaixa
o preço contra si mesmo, rodada após rodada, até o piso. Um portal só entra na
lista depois que alguém viu, numa disputa de verdade, como aquele portal marca
que o melhor lance é nosso.

Incluir um portal aqui é **ato deliberado, com autor e data**. Não é consequência
automática de "o login funcionou".

---

## 3. O quadro dos portais

Os 23 portais da interface, agrupados pelo que realmente impede cada um.

| Grupo | Portais | O que falta |
| --- | --- | --- |
| **Entra e navega hoje** | Portal de Compras Públicas | edital em sessão; plano renovado para disputar |
| **Entra, acha a compra e abre a sala** | Compras.gov | ler a sala com pregão em sessão (`lerMelhorLance`/`souLider` ainda são palpite) — §4.2, 14/09 |
| **Falta um dado do cliente** | BLL, BNC | senha numérica |
| **Muro técnico do portal** | Licitações-e, LicitaNet | decisão de arquitetura |
| **Não tem o que operar** | PNCP | é mural, não pregão — ver §4.6 |
| **Nunca testado** | BEC/SP | credencial |
| **Fora da VPS** | os 15 estaduais | deploy do agente |

E a distinção que mais importa na hora de estimar prazo:

| Natureza do bloqueio | Quais | Custo para resolver |
| --- | --- | --- |
| **Dado que o cliente tem e não mandou** | `.pfx`, senha numérica, edital real | zero de engenharia — só chegar |
| **Permissão comercial** | privados que exigem adesão | zero de engenharia — é documento |
| **Trabalho de módulo** | seletor, navegação, `souLider()` | horas, por portal |
| **Arquitetura nova** | Licitações-e | **o único item caro da lista** |

---

## 4. Os muros, um por um

### 4.1 Portal de Compras Públicas — o que funciona

**Entra.** Autenticação por **Keycloak** (`realms/Portal`), formulário padrão:
`#username`, `#password`, `#kc-login`, em
`operacao.portaldecompraspublicas.com.br/18/loginext/`.

E navega: em 08/09 achou e abriu um processo real. As peculiaridades que sobram
são de conta e de regulamento, não de código:

**A conta está com o acesso VENCIDO — confirmado em 09/09/2026.** Uma sonda
levou o robô até o DashBoard e fotografou a tabela "Situação Cadastral":

```
Situação   Validade     Validade em Dias                Créditos   Ação
Inativo    17/04/2026   Atenção: seu acesso está vencido.   0      [Administre seu Plano]
```

Logo abaixo, um bloco **"Processo de Liberação — Verifique as Pendências"**.

Isso encerra a dúvida do `NaoAssinante` que aparecia na URL: **não é limitação
de perfil, é assinatura vencida desde 17/04/2026, com zero créditos.** A
documentação da empresa, por sua vez, está **homologada desde 23/05/2024** — o
que falhou foi só a mensalidade.

**Mas conta vencida NÃO impede navegar.** Isto precisa ficar registrado porque a
conclusão contrária é tentadora e está errada: em 08/09/2026 o robô achou o
processo **002/2026** em "Seus Processos" e abriu os Dados do Processo (Conselho
Regional de Fisioterapia, Belém/PA), com a conta já nesse estado. Sobre aquela
tela havia o banner amarelo *"Notamos que você ainda não tem um plano ativo aqui
no Portal!"* e a situação *"Encerrado para Operação"*.

Ou seja, o plano vencido bloqueia **operar**, não **listar**. Um edital real
seria encontrado hoje mesmo.

Fotos: `capturas-robo/20260909-120301-portal-compras-sonda-dashboard.png` (a
tabela da conta) e `capturas-robo/20260908-232234-portal-compras-processo.png`
(o processo aberto).

**O regulamento nomeia robôs, e proíbe sem permissão.** Não é interpretação
nossa; está escrito:

| Cláusula | O que diz |
| --- | --- |
| 5.3.1.1 / 5.3.1.2 | uso de robô depende de **permissão expressa** |
| 6.7 | veda automação não autorizada |
| 6.7.2.2 | aponta uma área de **"Desenvolvedores"** |
| 6.7.2.1 / 7.7.1 | penalidade: **bloqueio imediato** |

A conta é do Rafael. Login e navegação, poucos e espaçados, são indistinguíveis
de uma pessoa entrando — mas a permissão precisa ser pedida em paralelo, não
depois.

**A API documentada é somente leitura.** A que aparece como integração de
parceiro é "Consulta pública de processos". Consulta não dá lance. Se existe uma
API de **lance**, ela não está publicada — e essa é a pergunta aberta de §5.

**A navegação está certa — isso foi verificado, não deduzido.** A mesma sonda
listou os 102 links do menu e achou `"Seus Processos" -> /4/SeusPregoes/`, que é
exatamente o caminho que o módulo já usava. A suspeita de que faltasse um
prefixo (`/18/…`) estava errada: a URL pós-login é `/4/NaoAssinante/DashBoard/`,
e o `baseUrl` de `/4` já cobre. **Não há nada a corrigir aqui.**

**O que falta, e o que NÃO falta:**

| | |
| --- | --- |
| Achar e abrir um processo | ✅ já funciona, mesmo com a conta vencida |
| Um edital real | ✅ **feito em 10/09/2026** — ver abaixo |
| Os itens/lotes chegarem ao robô | ✅ **feito em 10/09/2026** — ver abaixo |
| Um pregão **em sessão** | ⬜ o que falta; sem ele não há sala de disputa para ler |
| Renovar o plano | ⬜ necessário para **disputar**, não para navegar |
| `souLider()` | ⬜ exige pregão acontecendo E plano ativo |

#### O teste com edital real — 10/09/2026, 00:14

A dúvida que ficou aberta por dois dias era: **o robô parava por causa do plano
vencido ou porque o edital era inventado?** Está respondida, e é a segunda.

Sessão disparada direto ao agente com o edital **`002/2026`** — um processo de
verdade da conta, tirado da lista que a própria mensagem de erro passou a
mostrar. O log inteiro, sem cortes:

```
🔐 Iniciando login no Portal de Compras Públicas...
✅ Login no Portal de Compras Públicas realizado
📋 Navegando para edital: 002/2026 (2 item(ns), disputa por item)
🎯 Disputa por item — 2 item(ns) recebido(s): #1, #2
⚠️  1 de 2 item(ns) vieram SEM piso definido — para esses o robo nao deve dar lance
⚠️  CONTA INATIVA no portal: o acesso esta vencido desde 17/04/2026, com 0 creditos
📋 Procurando "002/2026" em .../4/SeusPregoes/
📋 Processo encontrado: .../DadosPregao/?slA=Edit&ttCD_CHAVE=453864
⚠️  Conta impedida no portal (o portal informa que a conta nao tem plano ativo)
✅ Sessão ativa
```

Oito segundos do login ao processo aberto. Três coisas ficam provadas:

1. **O bloqueio era o número inventado.** Com edital real, a conta **vencida**
   acha o processo em "Seus Processos" e abre os Dados do Processo. O plano
   bloqueia disputar; não bloqueia entrar, listar nem abrir.
2. **Os itens atravessam.** Até 09/09 o agente recebia só a string do edital —
   num pregão de 40 itens ele abria a página certa sem saber o que acompanhar.
   Agora recebe a lista, e o log nomeia o que recebeu.
3. **Piso ausente é estado próprio.** O aviso de "SEM piso definido" existe
   porque nulo não é zero: um item que ninguém avaliou não pode ser confundido
   com um item autorizado a descer até R$ 0,00.

**O que o teste NÃO entregou, e por quê.** O `002/2026` está *"Encerrado para
Operação"* — pregão já acabado. A página é "Dados do Processo", não a sala de
disputa. Então os seletores de `lerMelhorLance()` continuam sendo os três
palpites de sempre (`.valor-lance, .melhor, td.valor`) e o `souLider()` continua
**sem implementação própria** neste portal — ele herda o da `BasePortal`, que
devolve `null`, ou seja "não sei dizer quem lidera". Isso só se escreve **vendo**
a sala com pregão acontecendo — é o único item que ainda depende do Rafael.

Foto: `capturas-robo/20260910-001419-portal-compras-processo-002-2026.png`.

**Um defeito foi encontrado por esse teste, e teria passado batido.** A rota
`POST /sessao/iniciar` desestrutura uma **lista fixa** de campos do `req.body` e
repassa um a um ao `createSession`. Campo que não está nomeado ali é descartado
em silêncio — sem erro, sem log. A edge function mandava os itens, o
session-manager sabia usá-los, o módulo do portal sabia registrá-los, e essa
linha no meio jogava tudo fora. O `tsc` não vê (o agente é string dentro de
template literal), o lint não vê, o build passa. Corrigido, e agora há teste em
`src/test/agente-template.test.ts` que lê o texto gerado e falha se voltar.

Uma correção saiu da sonda. O módulo detectava plano inativo lendo o banner
amarelo — **depois** de abrir o processo. Quando o processo não é encontrado,
essa verificação nunca chega a rodar, e a única frase que sobra manda "conferir
o número do edital", apontando para o lugar errado. Agora `estadoDaConta()` lê a
tabela "Situação Cadastral" no DashBoard, antes de sair dele, e cobre as duas
redações — o banner e a tabela.

### 4.2 Compras.gov.br — falta o arquivo, e só

O caminho inteiro do certificado está **construído e testado**:

```
upload do .pfx na tela → cifra AES-GCM → Storage → edge function
   → POST /certificado no agente → pk12util → base NSS do Chrome
   → policy AutoSelectCertificateForUrls → apresenta sem diálogo
```

O que foi provado antes de escrever qualquer código:

- `openssl s_client` mostrou que **só `certificado.sso.acesso.gov.br` pede
  certificado de cliente** — os outros domínios do gov.br não pedem. Por isso a
  policy é estreita de propósito: gov.br, banparanet e bbmnet, nada além.
- O handshake mTLS foi validado com certificado autoassinado e servidor local
  antes de tocar no portal.
- O Chrome-for-Testing lê a policy em `/etc/opt/chrome_for_testing/policies`, e
  **não** em `/etc/opt/chrome/` — descoberto com `strings` no binário. Colocar no
  lugar errado falha em silêncio.

**A peculiaridade que quase virou mentira:** sem certificado, o gov.br faz um
vai-e-volta (`sso.acesso.gov.br → servicos.acesso.gov.br → sso.acesso.gov.br`) e
**devolve a tela de login**. Certificado ausente e certificado recusado são
indistinguíveis pelo lado do portal — os dois terminam na mesma tela. A primeira
versão chutou "recusado" e mandava conferir a validade de um certificado que não
existia. Agora quem responde é a própria máquina, consultando a base NSS.

De quebra, isso derrubou o tempo de falha de **204s para 17s**: o módulo lê o
desfecho em vez de esperar uma navegação que nunca vem, e `comRetry` passou a
honrar `err.semRetry` — certificado ausente continua ausente na terceira
tentativa.

**O que falta:** o `.pfx` A1 do cliente, com a senha. O **A3 não serve** — é
token ou cartão físico, e não existe leitor num servidor.

**Vale saber:** este portal tem **lance automático nativo** (IN SEGES/ME 73/2022,
art. 19). O robô entra num portal que já oferece a função — o que muda é de onde
vem a decisão de preço.

#### 10/09/2026, à tarde — a bateria antes do teste do Rafael

Produção passou a ser a branch `feature/rebrand-ui-ux` (ver
`docs/rebranding-front-end.md`). Antes de o Rafael clicar, o que foi conferido:

| | Resultado |
| --- | --- |
| Código do robô na branch × `main` (`agent-template/`, gerador, `lib/robo/`, edge function, `_shared/`) | **byte a byte iguais** — só a UI diverge, pelo rebrand |
| `RoboLances.tsx` | as três chamadas ao webhook são as mesmas; o diff é o cabeçalho com a foto |
| Suíte na branch | 1160 / 78 |
| Agente | 2.2.0, trava `[]`, `comprasgov` entre os 8 portais, certificado carregado |
| **"Enviar ao robô" pela tela da branch** (Ian, 13:46, localhost) | chegou ao agente, entrou no PCP, falhou em "TESTE-001 não encontrado" — a falha esperada do edital fictício. O caminho tela → edge function → agente está íntegro na branch |

O "Token inválido" que apareceu no localhost logo depois foi sessão do navegador
morta (login/logout na produção revoga os refresh tokens de todas as abas), não
defeito do envio — o envio já tinha passado.

#### 10/09/2026, à tarde — o certificado passou; o portal procurou no diretório errado

O Rafael desligou a verificação em duas etapas da conta gov.br da Santa Rosa
("pra teste do robô") e pediu o teste neste portal. Duas sessões reais, disparadas
de dentro da VPS, só leitura, trava `[]`:

| Sessão | O que aconteceu |
| --- | --- |
| `cccccccc…`, 13:53 | gov.br **aceitou o certificado sozinho** — sem clique humano e sem código de 6 dígitos. É o 2FA desligado funcionando. Mas a volta caiu na tela "Acesse sua Conta" com aviso vermelho: **"Não foi possível recuperar o usuário no senha-rede (422)"**. O módulo declarou "login realizado com sucesso" mesmo assim e seguiu para a busca de edital, que morreu em `detached Frame`. |
| `dddddddd…`, 14:02 | com o conserto abaixo instalado. Desta vez o **hCaptcha barrou o clique automático** (não é determinístico — na sessão anterior passou) e o robô ficou esperando o clique humano na tela remota. |

**A causa cabe numa letra.** A tela "Acesse sua Conta" tem três perfis, e o
`loginPortal.js` do portal manda cada um para uma ASP: `mudaPerfilBotao(1)` →
`loginPortalFornecedor.asp`, `(2)` → `loginPortalUASG.asp` (Governo). A URL do
SSO que cada página monta difere em **um parâmetro**:

```
Fornecedor:  …&scope=…&state=F&redirect_uri=…/landing_sso.asp
Módulo:      …&scope=…&state=G&redirect_uri=…/landing_sso.asp
```

`state=G` é Governo. O gov.br autentica igual, mas na volta o `landing_sso.asp`
lê o `state` e vai procurar o CPF no **senha-rede — o diretório de servidores
públicos**. A Santa Rosa é fornecedora; não está lá; 422. O `portaLogin` do
módulo também apontava para a página do governo (`loginPortalUASG.asp`). O módulo
foi escrito com a URL do lado errado do balcão.

Conserto, no template e instalado na VPS (md5 `9d7559a8…`, `pm2 restart`):

- `state=F` e `portaLogin` → `loginPortalFornecedor.asp`;
- a checagem de sucesso deixou de procurar a palavra "Compras" — está no logo de
  **toda** página do portal, inclusive a de login, e foi o falso positivo. Agora
  reconhece o aviso do senha-rede e a tela de escolha de perfil como **falha**, com
  a mensagem do portal, e só aceita sinais de área logada.

**O que fica em aberto:** provar o login inteiro como Fornecedor — a sessão `dddddddd`
ficou no clique humano, que é operação normal (o painel do pedido na tela mostrou
o cartão certo). E a busca do edital (`navegarParaDisputa`) continua sendo uma
lista de seletores-palpite, nunca lida da tela logada — é o próximo mapeamento,
igual ao que foi feito no PCP em 4.1.

**Limpeza anotada, não bloqueio:** o módulo lê `credenciais.cpf`, a edge function
manda `{ login, senha }`. O CPF nunca é digitado; o caminho é o do certificado,
que não precisa dele. Se um dia o CPF for necessário, o campo é `login`.

#### 14:44 — entrou como Fornecedor. 15:02 e 15:07 — a aba fugiu

Com o `state=F` instalado, o Ian reenviou **pela tela** (sessão `8c761be3`):
hCaptcha barrou, o cartão do clique apareceu, ele clicou na tela remota, e às
14:44:49 o log disse *"Autenticado — o login saiu do gov.br"*. O screenshot
seguinte é a **Área de Trabalho do Fornecedor Brasileiro**: Compras.gov.br /
SICAF / Contratos.gov.br, CNPJ e razão social da Santa Rosa, usuário Rafael,
menu Dados Cadastrais | Compras | SICAF | Contratos | Sair. **O login no
Compras.gov está provado.**

Quatro segundos depois o módulo saiu dessa página para testar quatro URLs
chutadas no host do SPA (`/comprasnet-web/seguro/fornecedor`…), todas 404, e a
checagem nova — corretamente — recusou o 404 como área logada. Removido: a área
de trabalho onde o SSO deixa o robô **é** a área logada; a navegação até a
compra é assunto do `navegarParaDisputa`.

Nas duas sessões seguintes (`729e3b82`, `e5e76e12`) o hCaptcha **não** barrou, o
robô clicou sozinho — e 11s depois: *"Session closed. Most likely the page has
been closed"*, seguido de `detached Frame`. A primeira hipótese (clique do
operador na tela remota) caiu na segunda sessão: **ninguém estava no VNC**. O
que resta, e bate com os 11s: na volta do gov.br para o comprasnet o Chrome
**trocou de aba** — descartou a que abriu o login e seguiu em outra — e o
Puppeteer ficou segurando a morta. O login tinha dado certo na aba nova.

Feito: `BasePortal.adotarAbaViva()` — se a aba que o módulo segura fechou,
adota a última aba viva do navegador; chamado a cada volta dos laços do
certificado (automático e humano) e antes dos passos pós-login. Screenshot
deixou de ser causa de morte. O session-manager segue a aba do portal depois
do login, e passa a registrar **toda aba que nasce ou morre, com URL** — a
prova que faltou nas duas sessões. Instalado na VPS (`session-manager.js`
`8beec21d…`, `base-portal.js` `f4a006fd…`, `comprasgov.js` `ae57d0e4…`).

**Aberto:** confirmar com o log de abas que a troca é isso mesmo, e então a
busca da compra a partir da área de trabalho — o menu "Compras" é o ponto de
partida a mapear.

#### 15:43 — a aba não fugiu: ela morreu de pé, com o login feito

O log de abas respondeu, e a hipótese acima estava **errada na metade**. Sessão
`a0a42536`, clique automático às 15:43:29, e a sequência:

| Hora | O que o log disse | O que significa |
| --- | --- | --- |
| 15:43:32 | `🆕 aba aberta: comprasnet.gov.br/popup/popup.asp?ambiente=3` | é o **aviso do Sicaf** que o Comprasnet abre numa janelinha depois do login — só existe com o login feito |
| 15:43:35 | `Tentativa 1/3: Protocol error (Runtime.callFunctionOn): Target closed` | o primeiro `evaluate` pós-login (`verificarHCaptcha`) achou o alvo do CDP fechado |
| 15:43:37, :41 | `Attempted to use detached Frame` | o frame principal morreu — mas a aba **não fechou**: nenhum `🧯` no log |

Ou seja: o certificado, a senha, o `state=F` — tudo certo; o login **entrou**.
O robô morreu 3s depois porque `adotarAbaViva()` só perguntava
`page.isClosed()`, e a aba continuava aberta. O que fechou foi o alvo do
protocolo (o Chrome 153 trocou o processo da aba, e o Puppeteer 22.15 — feito
para o Chrome 127, 26 versões atrás — não reatou o frame).

Testado em separado na VPS, com o mesmo `launchBrowser` do agente:
navegação simples gov.br → comprasnet → gov.br → comprasnet **não** mata o
frame, nem com nem sem isolamento de origem. Logo o gatilho é algo do fluxo
real — o POST com certificado mTLS (`certificado.sso.acesso.gov.br`) e/ou o
`window.open` do aviso — e **não se sabe ainda qual**. O que se sabe é como
sobreviver a ele.

Feito, instalado na VPS e espelhado no template (md5 iguais nos dois lados:
`browser.js` `2b844c62…`, `base-portal.js` `5aa9e2fd…`, `comprasgov.js`
`7ff0bd5a…`):

- **`abaMorta(p)`** — aba morta é a fechada **ou** a que tem `mainFrame().detached`.
  `adotarAbaViva()` passa a usar isso.
- **Diagnóstico no instante da morte** — o log lista os alvos do navegador
  (`🧯 A aba em uso morreu (apos autenticar) — alvos no navegador agora: page
  https://… | page https://…`). É a prova que faltou hoje: a próxima falha
  diz o que existia no Chrome naquele segundo.
- **Aba nova quando nenhuma serve** — a candidata é a última aba viva que não
  seja `about:blank` nem o aviso (`/popup/`); sem candidata, `browser.newPage()`.
  Os cookies são do navegador, não da aba: a sessão do portal continua válida.
- **`urlDeRetorno`** — uma aba vazia ou de aviso é levada até
  `loginPortalFornecedor.asp`, que, logado, deve cair na área do fornecedor.
  *Deve*: sem sessão, no teste ela mostrou "Faça o Login" — a confirmação com
  sessão é a próxima rodada.
- O reate acontece **antes** do primeiro `evaluate` pós-login (`'apos
  autenticar'`), não só no `'depois do login'`.
- Chrome nasce com `--disable-site-isolation-trials
  --disable-features=IsolateOrigins,site-per-process`. Não provou resolver
  (o teste isolado não reproduz a morte), mas não atrapalha em nada e tira
  uma variável.

**O crash das 15:51 — e fui eu.** A sessão seguinte (`d0088ed9`) nem abriu o
Chrome: *"Failed to launch the browser process"* com uma asserção do D-Bus
(`dbus_pending_call_set_notify… pending != NULL`). Causa: o `pm2 restart
--update-env` das 15:50 **injetou o ambiente da sessão SSH no agente** —
`DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/0/bus`, `SSH_TTY`,
`XDG_RUNTIME_DIR`. Esse socket só existe enquanto há login SSH; a sessão
fechou, o socket sumiu, o Chrome seguinte abortou tentando falar com ele. Única
ocorrência em todo o `error.log`. Corrigido relançando do
`ecosystem.config.js` com `env -i` (19 variáveis, zero `DBUS`/`SSH_`/`XDG`) e
`pm2 save`. **Regra que fica: nunca `--update-env` a partir de uma sessão
SSH.** O `vnc-stack` ainda carrega o `DBUS` velho no dump; Xvfb e x11vnc não
usam, ficou quieto.

Duas lições de método, pagas hoje: `pkill -f`/`pgrep -f` com um padrão que
aparece na própria linha de comando remota **mata a sessão SSH** (exit 255) —
proteger com `[p]adrao`; e um teste que abre o Chrome e não o fecha não
"trava", só nunca termina — o relógio de 40s no script foi o que separou os
dois.

**Aberto:** a rodada seguinte com a `TESTE-COMPRASGOV` — o log vai dizer
`🧯 … alvos no navegador agora:` (o mecanismo) e se a aba nova cai na área do
fornecedor (a recuperação). Depois, o menu "Compras".

#### 16:26 e 16:31 — entrou, ficou de pé; a busca é o muro seguinte

Com o Chrome sem *site isolation*, duas sessões seguidas **sobreviveram à
volta do gov.br** — nenhum `🧯`, nenhum `Target closed`:

- `8abf4f67` (16:26) — clique automático, sem hCaptcha, 7s do envio à área
  logada. Recusada pelo diagnóstico com a Área de Trabalho na tela: a área
  logada é `comprasnet.gov.br/intro.htm`, um **frameset** de três frames
  (`t_top.asp`, `main2.asp`, `main.asp`), e `document.body.innerText` do
  documento de cima é vazio. Feito: `BasePortal.textoDaTela()` soma o texto
  de todos os frames; o diagnóstico e a checagem de "autorizar" leem por ele.
- `6c118f0f` (16:29) — hCaptcha barrou o clique automático; o Ian clicou pelo
  VNC às 16:30; **`✅ Login no Compras.gov realizado com sucesso` às 16:31:34**,
  a primeira vez que essa linha existe no log. Tela remota mostrando a Área
  de Trabalho: CNPJ da Santa Rosa, usuário Rafael, SIASG Ambiente Produção.

O que veio depois, e é o muro de agora: `navegarParaDisputa` foi para a
página pública **"Compras eletrônicas"**
(`cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras`), tentou
12 seletores chutados, não achou nenhum, e terminou com **"✅ Na sala de
disputa" sem ter saído do formulário** — falso positivo, removido.

**O formulário foi mapeado da página real** (PrimeNG), com um Chrome
separado, sem login:

| Campo | Seletor |
| --- | --- |
| Situação: Em andamento / Finalizadas | `#emAndamento` / `#finalizadas` |
| Etapa: Abertas / Em disputa / Em seleção | `#abertasParticipacao` / `#emDisputa` / `#emSelecaoDeFornecedores` |
| Unidade compradora (código UASG) | `#unidadeCompradora` |
| Número da compra | `input[placeholder="Ex: 102021"]` — sem id; formato **número+ano colados** (`90012/2024` → `900122024`) |
| Pesquisar | `button.br-button.is-primary` |

E a lista de resultados, vista pela tela remota: um card por compra, começando
por `MODALIDADE N° número/ano`, depois `UASG - ÓRGÃO`, à direita `Etapa:` /
`Até:` ou o estado (`COMPRA REVOGADA`, `COMPRA SUSPENSA`), e dois ícones de
ação (lista e seta). **O que o ícone abre ninguém viu** — o Ian clicou e a
tela não mudou.

Feito, instalado e espelhado (`comprasgov.js` `054ec1c1…`, `browser.js`
`d5bfc938…`):

- `navegarParaDisputa` real: exige número/ano no edital (o
  `TESTE-COMPRASGOV` é recusado **antes** de abrir página, com a frase que
  diz o que cadastrar); marca Abertas + Em disputa; preenche UASG se vier em
  `alvo.uasg`; pesquisa; espera resultados, "nenhum" ou captcha por 30s.
- **hCaptcha na pesquisa**: a busca feita em headless caiu num captcha
  visível e não devolveu nada; na janela logada passou limpa. Quando cair,
  pede o clique humano como no login (`interacao.pedir`, tipo `captcha`).
- Acha o card pelo texto `N° número/ano`, registra `🎯 Compra localizada`,
  clica no primeiro ícone de ação, tira foto e diz onde caiu — e termina
  com `📍 A sala de disputa ainda nao foi mapeada`. **Não afirma estar
  nela.**
- User-agent passa a ser o do próprio Chrome (sem "Headless"). Era um
  `Chrome/120` fixo, e o portal abriu com o banner "seu navegador está
  desatualizado" — Chrome 153 fingindo ter três anos.

**Aberto, por ordem:** (1) um número de compra **real** do Compras.gov numa
disputa — sem ele a busca é recusada de propósito; (2) ver o que o ícone do
card abre, e a sala de disputa com um pregão em sessão — `lerMelhorLance` e
`souLider` continuam palpite; (3) a UASG ainda não viaja da tela ao agente
(`alvo.uasg` não existe no payload); (4) o painel do VNC mostra "Nenhuma
sessão ativa" por cima de uma tela viva quando a sessão terminou em erro e
o Chrome ficou 60s em observação.

#### 11/09 — o pregão pode acontecer sem ninguém olhando: gravador, raio-X e UASG

O Giovanny quer o teste num pregão real, com uma operadora da Santa Rosa
disputando do jeito de sempre. Ela não vai esperar a gente; então o robô
tem que guardar sozinho o que viu, para o mapeamento acontecer depois. Três
peças, instaladas na VPS e espelhadas no template (md5 iguais: `index.js`
`55d718ee…`, `session-manager.js` `ba698406…`, `base-portal.js`
`97f54bb5…`, `comprasgov.js` `d74a6bf5…`):

**`BasePortal.inspecionarTela()` — o raio-X.** URL, título e, para cada
frame: texto visível, campos (`input/select/textarea/button`) com atributos
e caminho no DOM, **cada valor em reais com o caminho até ele** (é assim que
se descobre qual célula é o melhor lance e qual é o nosso), e as tabelas com
cabeçalho e primeiras linhas. Só leitura; frame que não responde entra
vazio. Testado na `intro.htm` real: 116 campos, 34 KB, 10 ms.

**Gravador da sessão.** Liga depois do login (antes ligava antes — ver 14/09) e grava em
`logs/sessoes/<id>/HHMMSS.png` + `HHMMSS.json` a cada
`GRAVADOR_INTERVALO_S` (10; 0 desliga), horário local para casar com o log.
Raio-X idêntico ao anterior não vira arquivo — no primeiro teste o horário
da captura entrava no hash e tela parada gerava 360 arquivos/hora; corrigido.
Desliga no encerrar, no kill-switch e ao fim da janela de observação. O
`/health` mostra `gravador: {pasta, capturas, ligado}`. Provado com uma
sessão no PNCP (público, sem tocar na conta do Rafael): ligou, capturou,
desligou com "5 captura(s)"; a segunda rodada, com a deduplicação certa, deu
2 capturas em 40s de página parada.

**Rotas `GET /sessao/:id/inspecionar` e `GET /sessao/:id/gravacoes`** — o
raio-X ao vivo, para quem estiver olhando, e a lista do que já foi gravado,
para saber de fora se há material antes de abrir SSH.

**UASG.** O número da compra não é único no Compras.gov (cinco "N° 1/2022"
de cinco órgãos, 10/09). O formulário "Configurar Nova Sessão de Lance"
ganha o campo **UASG** quando o portal é Compras.gov (e a dica de formato
número/ano no Nº do edital); grava em `robo_lances_disputas.uasg` (migration
`20260911000001`, **aplicar antes do Publish**); viaja no corpo do
`enviar-sessao` fora do `sessaoData` (a sessão não muda de esquema); o
agente passa `alvo.uasg` e o módulo do Compras.gov preenche "Unidade
compradora" e **prefere o card que traz a UASG**, avisando quando o
escolhido não a tem. Edge function publicada.

De passagem: `killAll` chamava `encerrar(config.sessao_id)` com `config`
fora de escopo — o `try` engolia o `ReferenceError` e o pedido humano
sobrevivia ao kill-switch. Corrigido para `session.sessao_id`.

**O formato do teste com a operadora** (combinado em 11/09): ela disputa do
PC dela, com o CPF dela; o robô entra com o do Rafael, na mesma compra, e
**assiste** — trava de lance fechada, ninguém clica em lance pela tela
remota. Como é a mesma empresa, se houver proposta cadastrada o robô abre a
sala como participante, que é a tela a mapear. O que ela precisa passar:
número/ano da compra, UASG, data e hora da sessão, se há proposta, e se o
login dela é o próprio CPF (se for o do Rafael, o robô entrando pode
derrubá-la). Mapeamento à tarde, com a pasta do gravador.

**Aberto:** o número real; o que o ícone do card abre; a sala. O gravador
existe para responder os dois últimos sem ninguém na frente da tela.

#### A tela remota que "não conectava" — 45 arquivos em cascata

No mesmo teste, o painel do VNC em produção ficou em "Conectando ao servidor
VPS…" por mais de um minuto. Não era bloqueio: o x11vnc registrou o cliente do
navegador às 14:06:50. Era **lentidão**, e ela tinha três camadas:

1. o noVNC instalado é o **1.0.0 (Debian, 2018)**, em módulos ES — `ui.js`
   importa 10, `rfb.js` importa 13, e assim por diante: **45 arquivos, 571KB,
   carregados em cascata**, cada nível esperando o anterior;
2. quem os serve é o **websockify** (HTTP em Python: sem gzip, sem cache), atrás
   do nginx, atrás do Cloudflare com `cf-cache-status: MISS` — 0,3 a 0,7s por
   arquivo, daqui; mais, da casa de quem usa;
3. o véu "Conectando…" da nossa tela só saía no `onLoad` do iframe — que numa
   página de módulos ES **só dispara depois que o último módulo executou**. O
   noVNC já estava por baixo mostrando o próprio progresso, coberto por um véu
   preto que dizia o contrário.

Feito: `esbuild` empacotou `app/ui.js` num arquivo só (`app/ui.bundle.js`,
144KB, 46KB comprimido) e o `vnc.html` aponta para ele (`vnc.html.bak-20260910`
guarda o original; um `apt upgrade` do novnc desfaz isto — anotado). De 45
requisições para **5**. E o véu ganhou prazo de 6s, independente do `onLoad`.
O empacotamento vale em produção na hora — é a VPS que serve o noVNC, não o
Lovable; o véu vai no Publish.

#### 14/09, madrugada — o ensaio para o pregão real: seis sessões, cinco defeitos, a sala

A Izabelle (operadora da Santa Rosa) indicou o pregão de teste: **PE SRP
7/2026 SEDUC/PA, UASG 925315, sessão pública 14/09 às 09:00**, modo aberto
(10 min + prorrogações de 2), menor preço por item, orçamento sigiloso. A
disputa foi cadastrada pela tela nova ("Nova sessão"): edital `07/2026`,
Compras.gov.br, UASG `925315`, intervalo 30 s, **máx. lances 500** (contorno
do laço que encerra a sessão em `max_lances` rodadas — ver "Aberto" abaixo),
modo automático desligado, 1 item manual. Às 02:18 o Ian enviou ao robô para
provar o caminho antes das 9h. Foram **seis sessões** até chegar à sala; cada
uma revelou um defeito que a sessão anterior escondia. Todos corrigidos no
template e instalados na VPS com md5 conferido (`index.js` `fc9536e7…`,
`session-manager.js` `e99ad667…`, `comprasgov.js` `c512fafc…`; backups
`*.bak-20260914-*`).

| Sessão | O que travou | Causa, verificada | Conserto |
| --- | --- | --- | --- |
| `a15ba3ba` 02:18 | 3 min entre "Iniciando login" e o clique no certificado; o hCaptcha recusou toda resposta ("Please try again", "Captcha inválido ERL0033800"), inclusive as certas | O **gravador ligava antes do login** e a primeira foto saía com a aba em `about:blank` — travou até o `protocolTimeout` (180 s). O Puppeteer enfileira as fotos de uma mesma aba: a foto que o login tira ao abrir o gov.br ficou presa atrás dela. A página envelheceu 3 min, o primeiro clique voltou "Captcha inválido" e recarregou **sem o `authorization_id`** — daí em diante nada passava. Prova: JSON da captura 021850 sem PNG; captura seguinte só às 02:22:00 (190 s, não 10) | gravador liga **depois** do login; pula captura em `about:blank` |
| `903d686e` 02:42 | login em 37 s ✅; busca voltou "Nenhuma compra encontrada" | O campo "Número da compra" é um **`p-inputmask`** (PrimeNG): intercepta cada tecla e reposiciona o cursor pelo próprio buffer. `page.type('72026')` virou **`20267`** na tela. E o robô não reconhecia "nenhuma compra" (só "nenhum registro/resultado") — ficou "esperando o captcha" com a resposta na frente | `digitarConferindo()`: digita, **lê o valor de volta** (ignorando os `_` da máscara), e se não bater entrega o texto inteiro via `keyboard.sendCharacter` (colar); o log passa a dizer `na tela: …`. Regex de "nenhum" cobre "nenhuma compra" |
| `61362858` 02:48 | `keyboard.insertText is not a function` | Nome de método do Playwright; no Puppeteer é `sendCharacter` | corrigido |
| `dab1837b` 02:51 | `na tela: 72026` ✅, resultados na tela — e o robô "esperando o captcha da pesquisa" por 600 s | `lerDesfechoDaBusca` olhava o captcha **antes** dos resultados, e o iframe do hCaptcha continua no DOM com tamanho depois de resolvido | ordem: resultados → nenhum → captcha; captcha só conta se visível (computed style da cadeia) |
| — | `uasg: null` no `/health` em todas as sessões, com `925315` digitado no formulário | Front, edge function (v30) e session-manager estavam certos. O **`index.js` desestrutura uma lista fixa** de campos do corpo e repassa um a um — `uasg` não estava nela. O próprio comentário da rota avisa que "o que não estiver nomeado aqui é descartado silenciosamente"; foi a segunda vez (a primeira foram os itens) | `uasg` na lista e no `createSession` |
| `acb24f55` 03:21 | tudo ✅ até `🎯 Compra localizada: … 925315 - SECRETARIA DE ESTADO DE EDUCACAO - PA` em **49 s**; o clique no ícone abriu o **"Quadro informativo"** (avisos/impugnações/esclarecimentos), não a sala | O card tem três botões, lidos do DOM gravado pelo `title`: "Quadro Informativo", **"Acompanhar compra"**, "Mostrar detalhes da compra". A versão anterior clicava no primeiro | prefere o botão cujo `title` casa `/acompanhar/`; o log diz qual clicou |
| `171b0dc5` 03:26 | **`📂 Cliquei em "Acompanhar compra"; a tela ficou em …/acompanhamento-compra?compra=92531505000072026`** — a sala, em 77 s | — | — |

Sem UASG a busca por `72026` devolve **dez "7/2026" de outros órgãos só na
primeira página** (ordenados por UASG; a SEDUC, 925315, nem aparece nela).
O UASG não é refinamento: sem ele o robô abriria a compra errada.

**O que ficou provado, com este edital:** login gov.br + certificado A1 em
~40 s com um clique humano (o hCaptcha aceitou de primeira nas cinco sessões
depois do conserto do gravador — o "bloqueio" da primeira era o atraso, não
detecção); número e UASG digitados e **conferidos** na tela; card certo entre
dez homônimos; sala aberta pelo botão certo; gravador ligado na sala; trava
de lance respondendo a cada rodada ("Rodada 5 sem lance: Portal comprasgov
não está liberado"). A busca com UASG nem pediu captcha.

**A sala, na fase de proposta** (`acompanhamento-compra`, página pública):
"Acompanhar Contratação — Pregão Eletrônico N° 7/2026 (SRP) — UASG 925315 —
Critério: Menor Preço / Maior Desconto — Modo disputa: Aberto —
**Contratação em período de cadastramento de proposta**"; aba **Itens**, um
card por item com número, descrição, benefício ME/EPP, **"Aguardando abertura
da sessão pública"** (o estado por item), quantidade e **"Valor estimado
(unitário): Sigiloso"**. É esse texto que muda às 9h, e é o que o gravador vai
registrar a cada 10 s. Dois fatos que valem para a estratégia: com orçamento
sigiloso a referência **nunca** vem do portal (só da nossa precificação), e
o acompanhamento público mostra a disputa sem login — o lance, quando for a
hora, é na área logada.

**Visto de passagem:** no Quadro informativo há **1 impugnação (MICROSENS
S.A., 11/09 18:06) sem resposta** e 7 esclarecimentos — impugnação pendente
pode adiar a sessão; a operadora confere de manhã.

**Aberto, para depois do pregão:** o laço encerra a sessão em `max_lances`
rodadas **antes** da trava (sessão de observação morre em 20 × 30 s = 10 min
sem o contorno do 500); ir direto ao `acompanhamento-compra?compra=<UASG>05<nº
5 dígitos><ano>` quando houver UASG, e só pesquisar sem ela; `lerMelhorLance`
e `souLider` do Compras.gov continuam sendo palpite — o mapeamento é sobre a
pasta `logs/sessoes/<id>` de hoje.

### 4.3 Licitações-e (BB) — o muro caro

Este é o portal nº 1 do cliente, e é o único item da lista que pode exigir
**infraestrutura nova**.

O que acontece: preenchida uma chave falsa e clicado OK, o portal leva a

```
https://www.licitacoes-e.com.br/aop/gcs/statics/gas/validacao.bb
"Problemas na verificação da solução de segurança."
```

`gas` é o **Módulo de Segurança do Banco do Brasil** (Warsaw, da Topaz/Stefanini)
— um binário que roda no sistema operacional e faz detecção de automação. **O
login para antes de pedir a senha.**

Detalhes que economizam o dia de quem for refazer isso:

- `curl` devolve **403 para qualquer caminho** do BB, inclusive os válidos. Não
  dá para validar URL do BB sem um navegador de verdade.
- O portal novo (`licitacoes-e2.bb.com.br/aop-inter-estatico/`) **não tem página
  de login pública**.
- No legado o campo existe e é `#acessoChaveJ`, com um pop-up que fecha em
  `#nlCloseBtn` — e nenhum dos três seletores que o template chutava existe.

**Deliberadamente não escrevemos o login.** Acertar o seletor levaria o robô
exatamente uma tela adiante, e a tela seguinte é o muro.

As três saídas, nenhuma barata:

1. Instalar o Warsaw na VPS (existe `.deb`) e descobrir se ele roda sob Xvfb — o
   software é feito justamente para recusar esse cenário.
2. Operar o Licitações-e de uma **máquina real com o módulo instalado** — uma VPS
   Windows ao lado da Linux atual. É a opção que muda a infra.
3. Verificar se o BB publica **API de lance** em `developers.bb.com.br`. Não
   verificado ainda.
4. Tratar o portal como manual e dizer isso ao cliente.

Pendência 23.

### 4.4 BLL e BNC — o mesmo portal com duas marcas

Descoberto seguindo o link "Início" de `bnc.org.br`: **são a mesma plataforma**.

```
BLL   https://bllcompras.com/Home/Login     ← e não bll.org.br (site institucional)
BNC   https://bnccompras.com/Home/Login
```

**O teclado embaralhado — resolvido.** A senha não é digitada: há cinco teclas,
cada uma com um **par de dígitos** no atributo `name`, e cada dígito aparece em
exatamente um par.

```html
<input type="button" name="0 ou 4">
<input type="button" name="6 ou 9">
```

Para cada dígito da senha, clica-se na tecla que o contém. **Não é imagem** — é
texto no HTML: nenhum OCR, nenhuma visão computacional. E **os pares mudam a cada
carregamento** (verificado: duas visitas à mesma tela deram conjuntos
diferentes), então o mapa é lido em tempo de execução, nunca gravado.

**A consequência é o que trava:** a senha destes portais é obrigatoriamente
**numérica**. Não existe tecla para letra. A credencial que temos tem letras e
símbolos — isso não é um caso a tratar, é um dado errado, e o módulo diz isso em
**0 segundo**, antes de abrir o portal.

A prova de que o resto funciona veio com credencial inexistente:

```
bll  → O portal recusou o acesso: "Usuário ou senha incorretos."   36s
bnc  → O portal recusou o acesso: "Usuário ou senha incorretos."   35s
```

A recusa **é** a prova: domínio certo, e-mail preenchido, teclado lido, dígitos
clicados, contador conferido, botão acionado, resposta interpretada. Se qualquer
elo estivesse errado a mensagem seria outra — cada falha possível tem frase
própria.

**O que falta:** a senha numérica real de cada conta. Com ela o teste é imediato
e **não depende de pregão agendado**: ou entra, ou o portal diz por que não.

### 4.5 LicitaNet — bloqueio antes da porta

**403 Forbidden até na home**, antes de qualquer tentativa de login. Não é
seletor errado nem credencial: é bloqueio anti-robô na borda.

É também o portal que o Rafael citou nominalmente: segundo ele, o ConLicitação
tem um vídeo mostrando como cadastrar a empresa para usar robô de lances no
LicitaNet. Se esse cadastro libera o acesso — por IP, por chave, ou por
autorização de conta — o 403 pode ser efeito de não tê-lo, e não uma decisão
técnica contra nós.

**O que falta:** o vídeo, e a resposta sobre o que exatamente a adesão libera.

### 4.6 PNCP — não há o que operar

**O PNCP não tem sessão de disputa.** É o mural nacional de publicação: o edital
nasce lá, mas o pregão acontece no sistema do órgão. Não existe lance para dar.

Isso corrige uma ideia em circulação — a de que "o Compras.gov é pelo PNCP". São
coisas diferentes:

| | O que é | Serve para |
| --- | --- | --- |
| **PNCP** | mural de publicação | **ler** edital |
| **Compras.gov.br** (SEGES/ME) | sistema operacional do pregão | **dar lance** |

E isso revela um defeito nosso: o agente tem um `src/portals/pncp.js` que faz
login por gov.br e chama `lerMelhorLance()` procurando `[data-lance]`,
`.valor-proposta`, `.melhor-lance` — **numa tela que não existe**. É código
escrito por dedução, do mesmo lote dos seletores que já falharam nos outros
portais, e ele nunca vai funcionar porque não há o que ler.

O PNCP já tem o lugar certo dele no produto: o espelho `pncp_editais_cache` e o
helper `_shared/pncp-coords.ts`, que é leitura de edital. Como **portal de
disputa**, ele deveria sair do seletor.

### 4.7 BEC/SP — módulo existe, nunca rodou

Está entre os 8 da VPS, mas era justamente o portal que faltava na lista de
credenciais que o Rafael mandou. Exige login **e** certificado (`login+cert`).
Nunca foi testado — não há foto, log ou sessão.

### 4.8 Os 15 estaduais — existem no repositório, não na VPS

Banparanet (PA), BBMNet, ComprasBR, Licitar Digital, Compras RJ, ComprasNet BA,
ComprasNet GO, Compras MG, PE Integrado, Compras PR, Compras RS, Compras SC,
e-Compras DF, e-Compras AM, Portal Compras CE.

Os módulos estão em `src/lib/agent-template/portals-estaduais.ts`. **Nenhum está
na VPS** (pendência 24), e nenhum foi testado. O Banparanet importa
particularmente: o cliente atende o Pará, e os municípios de lá usam os portais
regionais.

---

## 5. A questão da adesão e das APIs

O cliente levantou, e a pesquisa confirma em parte: **portal privado exige adesão
para liberar robô; portal público não.**

O que está documentado:

| Portal | O regulamento diz | Fonte |
| --- | --- | --- |
| Portal de Compras Públicas | robô só com **permissão expressa**; bloqueio imediato como pena; aponta área "Desenvolvedores" | regulamento, cláusulas 5.3.1.1, 5.3.1.2, 6.7, 6.7.2.1, 6.7.2.2, 7.7.1 |
| BNC | **silente** sobre automação | regulamento 2026 |
| Compras.gov | tem **lance automático nativo** | IN SEGES/ME 73/2022, art. 19 |
| LicitaNet | não verificado — há indício de cadastro específico | relato do cliente |
| Licitações-e | bloqueio técnico, não regulamentar | §4.3 |

**A pergunta que decide a arquitetura, e que ainda não tem resposta:**

> A adesão entrega uma **API que dá lance**, ou apenas a **permissão** para o
> robô de navegador continuar operando?

As duas hipóteses levam a lugares muito diferentes:

- **Se for permissão:** nada muda no código. É documento, e o robô que já existe
  passa a ser legítimo naquele portal.
- **Se for API de lance:** o módulo daquele portal deixa de dirigir um navegador
  e passa a fazer chamadas HTTP. **O motor não muda** — sessão, estratégia de
  preço, painel de risco, registro, tudo continua igual. Muda só a porta de
  entrada, por portal.

O único dado concreto que temos hoje aponta para a primeira hipótese: a API
publicada do Portal de Compras Públicas é de **consulta**, somente leitura.

---

## 6. O que falta, por ordem de custo

| # | O que | De quem depende | Destrava |
| --- | --- | --- | --- |
| 1 | **Edital real** onde a empresa esteja inscrita | cliente | o teste de navegação de ponta a ponta — funciona já, sem depender do plano |
| 2 | **`.pfx` A1 + senha** | cliente | Compras.gov — cadeia pronta, zero engenharia |
| 3 | **Senha numérica** BLL e BNC | cliente | 2 portais — teste imediato, sem pregão |
| 4 | **Renovar o plano** do Portal de Compras Públicas (vencido em 17/04/2026) | cliente | disputar de verdade — e, com isso, o `souLider()` |
| 5 | **Permissão expressa** nos privados | cliente | uso legítimo; protege a conta dele |
| 6 | **Deploy dos 15 módulos** na VPS | nós | portais estaduais, incluindo o Pará |
| 7 | Tirar o PNCP do seletor de disputa | nós | remove um portal que não pode funcionar |
| 8 | **Decisão sobre o Licitações-e** | nós + cliente | o portal nº 1 — e o único com custo de infra |
| 9 | `/sessao/iniciar` assíncrono (pendência 22) | nós | a chamada estoura antes de o robô terminar |

Os itens 1 a 4 não têm engenharia nenhuma pela frente. O item 1 é o que rende
mais rápido: a navegação já está provada, e um número real fecha a corrente até
a tela da disputa — sem depender de renovação nem de pregão agendado.

---

## 7. A régua do produto — o que um robô maduro faz, e onde estamos

A referência é uma palestra de um desenvolvedor da **Effecti** (2023) descrevendo
o robô de lances deles em produção. Não é lista de desejos: é o que o mercado já
entrega, e por isso serve de régua.

O que segue foi **conferido no código**, não estimado. Onde diz ❌, o `grep`
devolveu zero.

### 7.1 Segurança

| A régua | Nós | Onde |
| --- | --- | --- |
| Não queimar margem quando o lance não melhora a posição | ✅ **e mais rígido** | `decidirLance` para quando `souLider === true` — **e também quando o portal não sabe dizer quem lidera**, caso que a palestra não cobre e é justamente onde o robô fica cego |
| Piso intransponível | ✅ | chegar no piso **encerra**, em vez de dar lance nele: igualar o mínimo entrega a margem inteira sem garantia de vitória |
| Não errar o item ao enviar | ⚠️ | não erramos porque só operamos **um item por sessão**. É ausência de recurso, não proteção |
| Monitor de latência do portal (verde/amarelo/vermelho) | ❌ | nenhuma medição de tempo de resposta existe |

**A ressalva que importa:** a regra de margem está coberta por 16 testes, mas
`souLider()` tem implementação própria em **1 dos 23 módulos** — nos outros 22 é
herdado da `BasePortal`, que devolve `null` —, e `PORTAIS_COM_LANCE_LIBERADO`
está vazio. A regra é boa e ainda não foi exercida contra uma tela real.

#### As duas travas, conferidas na VPS em 10/09/2026

Rodando a `decidirLance` real do agente no ar, com `portalId: 'portal-compras'`:

| Cenário | Decisão |
| --- | --- |
| Como está hoje | `aguardar` — *"Portal não está liberado para enviar lance"* |
| **Se alguém liberasse o portal na lista** | `aguardar` — *"O portal não informou quem está liderando"* |
| Liberado + `souLider: true` | `aguardar` — *"Já estamos liderando"* |
| Liberado + `souLider: false` + melhor lance lido | `lance` de R$ 840 |
| Liberado + `souLider: false` + sem ler melhor lance | `aguardar` |

A leitura que importa: **são duas travas independentes.** Liberar o portal na
lista, sozinho, não destrava nada — `souLider` herdado devolve `null`, e a
função trata "não sei" como "não dá lance". Só a quarta linha produz um lance, e
ela exige três condições que não coexistem hoje.

Uma terceira trava cobre o outro caminho de escrita: `enviarProposta` é
`undefined` em `PortalComprasPortal`, e a rota devolve 501 antes de abrir o
navegador.

### 7.2 Multitarefa

| A régua | Nós |
| --- | --- |
| Vários pregões simultâneos | ✅ até **8 sessões** paralelas, **e agora dá para operá-las** |
| Vários itens por pregão | ⚠️ os itens chegam ao agente desde 10/09; falta a decisão POR item |
| Regras de decremento por item | ⚠️ cada item já leva o **piso próprio**; o decremento ainda é um só |
| Painel colorido: quais pregões já abriram disputa | ⚠️ o painel lista as sessões vivas e marca quais pedem alguém |

#### O que mudou em 10/09/2026 — de capacidade para operação

Aguentar 8 sessões nunca foi o problema; **operá-las** era. Dois defeitos
tornavam o paralelismo inútil na prática:

**O painel só enxergava a primeira.** `VncWebViewer` fazia `sessoesVivas[0]`.
Com dois pregões no mesmo horário — que o cliente descreve como rotina — o
botão de parar interrompia uma sessão **arbitrária**, e nada na tela dizia qual.
Apertar o freio achando que se para um pregão e parar outro é pior que não ter
freio.

**Todas as janelas desenhavam na mesma tela.** `browser.js` usa
`DISPLAY || ':99'` para toda sessão. Oito pregões = oito janelas empilhadas num
monitor virtual, e o VNC mostrando só a de cima. "Quero ver o outro" não era uma
ação possível.

O conserto: o painel passou a listar todas as sessões vivas, marcando quais
estão **esperando uma pessoa** (código de verificação, captcha) e qual está em
exibição; e a rota nova **`POST /sessao/focar`** traz a janela daquele pregão
para a frente.

A alternativa era uma tela virtual por sessão (Xvfb `:99`, `:100`, `:101`…, com
x11vnc e websockify próprios). Resolve mais — duas abas lado a lado — e custa
muito mais: portas, RAM e CPU por sessão. Ficou uma tela só, alternando.

**Duas armadilhas encontradas ao testar, que valem registro:**

`xdotool windowactivate` **não funciona aqui**. A VPS roda Xvfb pelado, sem
gerenciador de janelas, e o comando falha com *"Your windowmanager claims not to
support `_NET_ACTIVE_WINDOW`"*. Quem funciona é `windowraise`, que chama
`XRaiseWindow` direto no servidor X e não depende de WM. O `windowfocus` vai
junto, mas com o erro engolido de propósito.

E a janela é achada por **PID**, nunca por título: `xdotool search --pid`, com o
PID guardado no momento em que o navegador abre. Dois pregões no mesmo portal
têm título idêntico — procurar por título e ativar "a primeira que casar" é
exatamente o defeito que a rota existe para corrigir.

**Provado em 10/09/2026, 01:10:** duas sessões vivas ao mesmo tempo, cada uma
com sua janela (`12582915` e `20971523`), alternando entre elas com sucesso. E
os dois pregões abriram processos **diferentes** no portal — `002/2026` em
`ttCD_CHAVE=453864`, `039/2025` em `447069`.

#### O processo fica sabendo que a sessão acabou

Antes, a sessão terminava e o processo no Kanban não registrava nada: o único
caminho era alguém abrir o Robô de Lances e apertar um botão. Agora o callback
`sessao-encerrada` grava uma mensagem de sistema no processo e dispara
notificação.

**O que ele deliberadamente NÃO faz:** marcar "Vencida" ou "Perdida". O agente
manda `resultado: 'finalizado'` ou `'parada_emergencial'` — ele não tem como
saber quem venceu, e `valor_final` é o valor configurado, não um desfecho (com a
trava ligada nenhum lance chega a ser enviado). Escrever resultado a partir
disso seria inventar dado.

Some-se que **derrota exige motivo** registrado em `comercial_perdas`: um
trigger recusa a mudança de status sem ele. Tentar no callback daria erro de
banco num lugar que ninguém está olhando.

Então grava-se o que se sabe — a sessão acabou, com quantas rodadas e de que
jeito — e quem decide o resultado continua sendo gente.

#### O acompanhamento: alerta de convocação — 10/09/2026

O pedido do cliente: *"após a fase de lances vem o acompanhamento, ele dispara
um alerta toda vez que a empresa é convocada"*.

A auditoria achou **uma corrente de três elos com dois mortos**:

| Elo | Estado antes |
| --- | --- |
| Alguém lê o chat do portal | ❌ `lerMensagensChat()` existia só no Licitações-e, com seletores de palpite, e **nunca era chamado** |
| Alguém grava a mensagem | ❌ `agent_chat_monitor` **não tinha nenhum escritor** no repositório inteiro |
| Alguém alerta | ✅ `notificacoes` funciona, com quatro escritores |

E a tela `MonitoramentoChat` prometia *"você receberá notificações sonoras ao ser
convocado"* lendo `chat_messages` — tabela de conversa com **assistente de IA**
(`role`/`content`), sem escritor desde fevereiro de 2026. Uma aba dizendo "Chat
do Pregoeiro" e mostrando outra coisa, vazia.

**A correção mudou a tabela de destino, e o motivo importa.**
`agent_chat_monitor.licitacao_id` tem chave estrangeira para `agent_licitacoes`
— a tabela do módulo de prospecção, outro universo. A sessão do robô carrega
`licitacao_id` de `licitacoes`; o banco recusaria a linha.

O destino certo é **`licitacao_mensagens`**, que já é onde o robô grava e que o
`LicitacaoChat` já lê — com realtime e **com som quando o tipo é `alerta`**. O
alerta que faltava não precisava de tela nova nem de cron: precisava de alguém
escrevendo na tabela certa. Por isso o cron do `agent-monitor` saiu do plano.

O que classifica como urgente é o texto da mensagem —
`convocad|diligência|habilitação|documento|prazo|apresent|envie|anexe|recurso|negocia`.
Só esses tocam alarme e viram notificação; o resto entra como conversa. Alerta em
tudo deixa de ser alerta.

E o laço **deduplica por id de mensagem**: ele relê a mesma tela a cada rodada, e
sem isso uma fala do pregoeiro viraria alarme a cada 30 segundos até a sessão
acabar.

**O que está bloqueado, e a prova de que é bloqueio e não preguiça.** Uma sonda
rodou em 10/09/2026 contra a página do processo `002/2026`, listou o menu
inteiro e todos os iframes. Resultado: **não existe chat na página do processo**.
O único item de mensagem é "Impugnações" (peça formal, não conversa); os iframes
são de suporte e analytics.

O chat do pregoeiro vive na **sala de disputa**, que só existe com pregão
acontecendo — a mesma dependência externa do `souLider()`. Por isso
`PortalComprasPortal` **não declara `seletoresChat`**, e `lerMensagensChat()`
devolve vazio nele.

Isso é deliberado: seletor inventado falha em silêncio — devolve lista vazia e
parece "nenhuma mensagem". Preferimos o vazio honesto ao vazio que mente.

| | |
| --- | --- |
| Contrato `lerMensagensChat()` na classe base | ✅ |
| Laço chama, deduplica e avisa (`mensagem-pregoeiro`) | ✅ |
| Webhook grava em `licitacao_mensagens` + notifica | ✅ |
| Tela lê o que existe, com destaque e som | ✅ |
| Seletores da sala do Portal de Compras Públicas | ⬜ **precisa de pregão ao vivo** |

#### Cadastro da proposta no portal — 10/09/2026

**O que foi feito.** `validarProposta` e `formatarItens` saíram de dentro de
`src/test/envio-proposta-validacao.test.ts` e viraram `src/lib/robo/proposta.ts`.

Isto merece registro porque era pior do que parecia: o teste **declarava as duas
funções no próprio topo** e testava cópias de si mesmo. Cento e setenta e seis
linhas, doze casos, zero linha de produção coberta. O contrato estava escrito e
acordado — marca, modelo e fabricante já estavam lá desde sempre — e nunca tinha
saído do arquivo de teste. Agora os doze casos cobrem código de verdade.

**O que está bloqueado, e por um motivo diferente do esperado.** O plano supunha
que o envio de proposta não dependeria de pregão ao vivo, porque a janela de
proposta fica aberta por dias. Verdade em geral; falso nesta conta.

Uma sonda listou os processos com as datas de sessão: o mais recente é
`-R./2026` em **20/03/2026**, e `002/2026` em **19/02/2026**. Hoje é 10/09/2026 —
**todos já passaram.** Não há janela de proposta aberta para ler.

E a página do processo **não tem botão de cadastrar proposta**: a sonda listou
todos os links, botões e submits sem filtro algum, e os únicos rótulos ligados a
proposta são itens de menu ("Suas Propostas", "Enviar Documentação", "Dados
Cadastrais"). "Suas Propostas" é uma tela de **busca** — filtros de UF, objeto,
órgão, modalidade —, não de cadastro.

Duas causas possíveis e indistinguíveis daqui: a janela encerrada, ou o plano
vencido escondendo as ações de participação. Em ambos os casos, `enviarProposta`
continua sem selecionadores reais, e escrevê-los de palpite repetiria o erro que
esta documentação registra em três lugares diferentes.

**O achado lateral que vale mais que o item bloqueado.** A página do processo
traz a **tabela de itens do edital**, e ela existe sem pregão acontecendo:

```
| (sel) | Item | Descrição | Valor Ref | Excl. | Quantidade | Julgamento |
```

Doze linhas por página, cinco páginas no `002/2026`, e cada descrição tem id
próprio (`#produtoTexto155`, `156`, `157`…). É a primeira estrutura de itens
REAL que conseguimos ler deste portal — e ela abre um caminho que não depende de
sessão pública: conferir os itens que a nossa tela enviou contra os que o portal
lista, e avisar quando não baterem.

| | |
| --- | --- |
| Validação em código de produção, com teste de verdade | ✅ |
| `PortalComprasPortal.enviarProposta()` | ⬜ **sem formulário para ler** |
| Tela que dispara o envio | ⬜ botão que sempre falha é pior que botão nenhum |

#### Conferência dos itens contra o portal — 10/09/2026

Nasceu do achado lateral acima: a tabela de itens existe na página do processo,
**sem depender de pregão acontecendo**.

O problema que ela resolve: a tela monta os itens do NOSSO lado — Precificação,
Proposta Comercial, extração do edital — e nada disso conversa com o portal. Um
número errado, um lote que mudou, uma republicação do edital, e o robô entra
mirando um item que não existe. Antes, isso só apareceria durante o pregão.

`conferirItens()` é **pura**, como a `decidirLance`, e tem 7 testes próprios.
Compara o que enviamos com o que o portal publicou e devolve três coisas:
itens nossos que não existem lá, divergência de valor de referência (com 1% de
tolerância, porque centavo de arredondamento não é divergência) e itens do
edital que ficaram de fora.

**Três decisões que valem registro:**

*Item sobrando não reprova.* Disputar 3 itens de um edital com 60 é rotina. Se
isso acusasse, o aviso seria ignorado no primeiro pregão grande.

*Lista vazia do portal é "não li", não "nada existe".* Sem leitura, a função
devolve `leu: false` e não afirma nada — acusar 49 itens de faltarem seria
culpar o usuário por uma falha nossa.

*Colunas mapeadas pelo cabeçalho, não por posição.* `celulas[1]` seria mais
curto e quebraria calado no dia em que o portal inserir uma coluna.

**Provado com dado real, `002/2026`:**

```
⚠️ CONFERENCIA: 1 item(ns) que enviamos NAO existem no portal (4321);
                48 item(ns) do edital ficaram de fora
```

Leu **49 itens** através das cinco páginas, achou o `4321` inventado e não
acusou o item 1, que existe.

**E uma ambiguidade que só apareceu por causa do teste.** Mandei o item 1 com
valor absurdo (999999) e nenhuma divergência foi acusada. Duas leituras opostas
cabiam: os valores batem, ou não há valor para comparar. O log passou a dizer
qual é:

```
ℹ️ O portal listou 49 item(ns) e NENHUM com valor de referencia —
   a conferencia de valores nao teve o que comparar
```

Este edital não publica o estimado. A ausência de divergência estava **certa**.
Sem essa linha, teríamos dado por conferido o que nunca foi olhado.

**Duas armadilhas na implementação, ambas custaram uma sessão real:**

`limpa(tds[i])` com `i` além do número de células — cabeçalho, linha de "nenhum
resultado" e linhas com colspan chegam curtas, e a célula vira `undefined`. O
erro (`Cannot read properties of undefined`) ia para o **stderr**, que o pm2
grava em `error.log`, não em `output.log`. Procurar no arquivo errado fez a
falha parecer ausência de execução.

E backtick dentro de comentário do template literal — quebrou o arquivo quatro
vezes num só dia. O teste `agente-template.test.ts` pega, mas só depois de
rodado; o `tsc` acusa como erro de sintaxe em cascata, que não aponta a causa.

**A conferência na tela.** Ela já virava mensagem no processo e notificação, mas
as duas chegam **depois** — e quem está olhando o painel enquanto o robô entra é
justamente quem ainda pode corrigir o cadastro. O `/health` passou a expor
`conferencia` por sessão, e o painel mostra o resultado logo acima da tabela de
itens que ela julga.

São **quatro estados, e nenhum pode ser colapsado**:

| Estado | O que a tela diz |
| --- | --- |
| Ainda não conferiu | "Conferindo os itens…" — não é "está tudo certo" |
| Não conseguiu ler o portal | "Não deu para conferir" — também não é "tudo certo", e muito menos "os itens não existem" |
| Confere | linha verde discreta; verde grande a cada sessão vira paisagem |
| Não confere | os **números dos itens**, que é o que se procura no cadastro para corrigir |

Colapsar os dois primeiros em "ok" seria repetir, na tela, o defeito que a
função pura evita no código: afirmar conferência onde não houve leitura.

### 7.3 Desempenho

Aqui está a lacuna mais séria, e ela é de **arquitetura**, não de código faltando.

A régua descreve reação em **menos de um segundo** ao lance do concorrente. O
nosso robô funciona por **varredura a cada 30 segundos** (`intervalo_segundos`):
acorda, lê, decide, dorme. Não reage a evento, e **não sabe que horas são na
disputa**.

### 7.4 Estratégia por fase — o bloco inteiro está em aberto

| A régua | Nós |
| --- | --- |
| Passivo nos 8 minutos iniciais do modo aberto | ❌ |
| Começar a operar só na prorrogação de 2 min | ❌ |
| Timing de envio: agressivo no início **ou** nos últimos 30s | ❌ |
| Modo aberto/fechado: 15 min de observação | ❌ |
| Antecipar 30s antes da fase aleatória | ❌ |
| Mirar a faixa de 10% do líder (a palestra recomenda 5–6%) em vez do 1º lugar | ❌ |
| Agendar o lance final fechado | ❌ |

`grep -cE "fase|aleatori|prorrog|segundos_restantes|itens"` em
`src/lib/agent-template/estrategia.ts` devolve **0**. O robô não tem noção de
relógio de pregão.

### 7.5 O que destrava quase tudo é UMA coisa

As sete linhas da tabela acima parecem sete trabalhos. Não são. Todas dependem
de ler a tela da sala de disputa — e é a mesma leitura que falta para o
`souLider()`:

```
ler a tela da disputa ─┬─ quem lidera        → souLider()
                       ├─ cronômetro e fase  → estratégia por fase
                       ├─ tempo de resposta  → monitor de latência
                       └─ tabela de itens    → multi-item e regra por item
```

Por isso a ordem da esteira abaixo não é negociável: **inspecionar a sala de
disputa vem antes de escrever qualquer estratégia.** Escrever a máquina de
estados antes de ver a tela seria repetir o erro que gerou os seletores por
dedução — e que custou os dois dias de correção registrados nas seções 4 e 16.

### 7.6 A esteira

**Fase 1 — matar o acesso.** Concluir o login do Compras.gov (o clique do
captcha e o código de verificação, via `POST /sessao/responder`) e do Portal de
Compras Públicas. Sem entrar, nada do resto é observável.

**Fase 2 — inspecionar a sala de disputa.** Numa sessão real assistida pelo VNC,
ler os seletores de: cronômetro e fase, tabela de itens, marcação de liderança,
e o tempo de resposta do portal. **É trabalho de observação, não de código.**

**Fase 3 — a máquina de estados.** Só então: laço orientado a evento no lugar da
varredura de 30s, noção de fase, timing configurável de envio, e regra por item.
É esta seção que baliza o que entra aí.

### 7.7 O que a régua não mede, e nós temos

Duas coisas nossas não aparecem na palestra, e valem ficar registradas:

- **`PORTAIS_COM_LANCE_LIBERADO`** — um portal só envia lance depois que alguém
  conferiu o `souLider()` dele contra a tela real. É recusa deliberada de operar
  no escuro.
- **Parar quando o portal não informa quem lidera.** A palestra trata "não
  melhora a posição" como o caso a evitar; nós tratamos também o caso em que
  *não dá para saber* — que foi exatamente o defeito da auditoria de 02/09, com
  o robô cobrindo o próprio lance até o piso.

Ambas são conservadoras de propósito, e ambas custam funcionalidade hoje em
troca de não perder dinheiro do cliente amanhã.

---

## 8. Benchmark do robô de lances Praefectus com outros robôs do mercado atual

> Levantado em 10 e 11/09/2026, só com o que é público: sites, artigos,
> documentação de API dos portais e um projeto aberto. Nada aqui é
> engenharia reversa de produto de terceiro.

### 8.1 O que cada um diz que faz

| | Effecti | Licitei | WaveCode | Praefectus (hoje) |
| --- | --- | --- | --- | --- |
| Portais com robô | "Compras.gov.br e outras plataformas oficiais" — não lista | ComprasNet, Licitanet, BLL, BNC, Compras Públicas | os mesmos + Licitações-e | login em 2 (Compras Públicas, Compras.gov); sala em **zero** |
| Onde roda | não diz | "100% em nuvem, funciona direto no navegador, não depende da sua máquina" | idem | Chrome na VPS, visível pelo VNC |
| Várias disputas | "múltiplas disputas simultaneamente", painel único | "10, 20 pregões ao mesmo tempo" | sim | 8 slots, painel com seletor e janela em foco (Fase A) |
| O que o operador configura | valor mínimo **por item**, "estratégia por item" | **primeiro lance + lance mínimo**, decremento fixo ou %, perfis agressivo/moderado/conservador, mínimo alterável durante a disputa | valor mínimo "inviolável", intervalo | valor inicial, piso por item, decremento mín./%, intervalo, teto de lances |
| Chat do pregoeiro | "nenhuma mensagem passa despercebida" | — | — | planejado (Plano 2, fase B) |
| Envio de proposta | sim | — | — | 501 em todos os módulos |
| Lance | envia | envia | envia | **travado** (`PORTAIS_COM_LANCE_LIBERADO = []`) |
| Segurança descrita | "respeita limites e intervalos mínimos" | "pode ser desativado a qualquer momento" | "valor mínimo inviolável" | trava por portal, `souLider` obrigatório, piso por item, kill-switch, trilha, `SEGUNDOS_JANELA_APOS_ERRO` |
| Postura | "o acompanhamento estratégico é recomendado" | "intervenha quando quiser" | — | níveis 1/2/3, 2FA e aceite para o 3 |

Todos os três avisam que o robô executa a estratégia de alguém — ninguém
vende autonomia.

### 8.2 A tecnologia é a mesma; a distância é de estrada

**Nenhum portal publica API de envio de lance para fornecedor.** Verificado
em 11/09:

- **Compras.gov** — `dadosabertos.compras.gov.br` ("API Compras.gov.br
  v1.0.0"): 77 endpoints, **73 `GET …consultar…`**; os 4 restantes são criar
  usuário, login, resetar e atualizar senha. Zero com `lance` ou `proposta`.
- **PNCP** — Manual de Integração v2.6 é para órgãos publicarem. "Lance"
  aparece 10 vezes, todas no campo `linkSistemaOrigem: "url do sistema de
  origem para envio de proposta / lance"` — o PNCP remete o lance ao portal.
- **Portal de Compras Públicas** — a única API pública é "Consulta pública de
  processos" (chave por formulário, 7 dias úteis) + integração com ERP via
  chamado. O regulamento proíbe robô sem permissão expressa (5.3.1.1, 6.7) e
  remete a uma área "Desenvolvedores" (6.7.2.2) que **não é pública** — as
  URLs óbvias dão 404. Pode haver um programa de automação autorizada ali;
  só se descobre pedindo à eCustomize, que é também o caminho de conformidade.
- **BLL, BNC, Licitanet, Licitações-e** — nada para fornecedor; a "integração
  com 150 sistemas" da BNC é do lado do órgão.

Effecti, Licitei e WaveCode não afirmam usar API; a Licitei diz que roda
navegador em nuvem. Logo **todo o mercado faz o que fazemos**: navegador em
servidor lendo a tela do portal. As lições de hoje (certificado, hCaptcha,
aba que morre, frameset) eles pagaram há anos.

Quatro coisas reais que se confundem com "API de lance": o **lance
parametrizado do próprio Compras.gov** (IN 67/2021, IN 73/2022 art. 19 — um
recurso dentro do portal, não uma API; a conferir na sala); as APIs de
**consulta**; a **integração de órgãos**; e "integração direta" como frase
de venda.

O que eles têm e nós não: **a sala de disputa mapeada em 5–6 portais**,
corrigida a cada mudança de tela, por anos, com centenas de clientes
reportando quebra. É a distância inteira, e ela se fecha uma sala por vez,
olhando a tela — o gravador existe para isso.

O que nós temos e eles não descrevem: a trava por portal com `souLider`
obrigatório antes de qualquer lance. Eles vendem "manda lance"; nós ainda
perguntamos "e se o melhor lance for o meu?". Isso é vantagem de desenho,
não de cobertura.

### 8.3 O projeto aberto: LanceBot (não encurta o caminho)

`github.com/RodrigoRMarinho/LanceBot` (MIT, Python + Playwright, 15
estrelas, abril/2025). Lido inteiro, 1.040 linhas:

- **não tem sala de disputa** — nem campo de valor, nem botão de confirmar,
  nem contêiner de melhor lance, nem envio de lance;
- login **antigo** do ComprasNet (`loginPortal.asp`, `txtLogin`/`txtSenha`),
  extinto desde o gov.br; busca pela consulta ASP velha;
- `bidding.py` é matemática de estratégia com `current_price` e
  `my_last_bid` como **parâmetros que nada preenche**;
- os 4 "módulos de portal" são stubs de 20 linhas devolvendo "Licitação de
  teste";
- gerado por IA em 19/04/2025 (`deepseek_*.txt` no repositório).

Aproveitável, uma ideia: **liderança por valor** — `my_last_bid <=
current_price` ("se o melhor lance vale o mesmo que o meu último, sou eu").
Como primária é fraca; como **checagem cruzada** é boa: quando o portal
disser `souLider = false` mas `melhorLance === seuUltimoLance`, tela e valor
discordam e o robô deve **parar e avisar**. Uma linha em `decidirLance`,
depois que `souLider` existir de verdade.

### 8.4 O que vale copiar, e o que não

| Vale | Por quê |
| --- | --- |
| **"Primeiro lance" + "lance mínimo"** como os dois números do operador (Licitei) | é mais simples que o nosso formulário, e é o que o Rafael vai querer no dia |
| **Mínimo alterável durante a disputa** (Licitei) | a margem muda quando o concorrente aparece; travar o piso no cadastro obriga a parar o robô para ajustar |
| **Chat do pregoeiro com alerta** (Effecti) | já está no Plano 2, fase B — o benchmark confirma que é tabela de entrada, não diferencial |
| **Checagem cruzada de liderança** (LanceBot) | uma guarda a mais na trava que já existe |

| Não vale | Por quê |
| --- | --- |
| "Estratégia por item" com perfis agressivo/moderado/conservador | rótulo sem definição pública; o nosso decremento mín./% por item já é o mesmo conteúdo, com número em vez de adjetivo |
| Liberar lance "porque o login funcionou" | é o que o mercado vende; é o que a trava impede — e o motivo é o defeito mais caro da auditoria (cobrir o próprio lance) |
| Copiar seletores de projeto aberto | não existem; o único achado era stub |

### 8.5 O que continua faltando, medido contra eles

1. **A sala** — nenhuma mapeada. Gravador pronto; falta o pregão.
2. **Proposta no portal** — eles enviam; nós, 501. Plano 2, fase C.
3. **Chat do pregoeiro** — Plano 2, fase B.
4. **Mínimo ao vivo** — não existe; hoje o piso é do cadastro.
5. **Portais** — 2 com login contra 5–6 com sala.

Fontes: effecti.com.br (robo-de-lance, robo-para-licitacao-como-funciona,
legalidade-do-robo-de-lances), licitei.com.br (robo-de-lances, portais,
blog/robo-de-lances-comprasnet), wavecode.com.br/solucao/robo-de-lances,
dadosabertos.compras.gov.br/v3/api-docs, pncp.gov.br/manual,
portaldecompraspublicas.com.br/regulamento, bibliotecapcp.zendesk.com,
github.com/RodrigoRMarinho/LanceBot.

## 9. Como conferir cada afirmação daqui

```sh
# O que o agente no ar realmente tem
curl -s https://agente.praefectus.com.br/health | python3 -m json.tool

# A trava do lance continua fechada?
curl -s https://agente.praefectus.com.br/health \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['portais_com_lance_liberado'])"

# A interface publicada é a do repositório?
bash scripts/verificar-publicacao.sh

# Os testes que trancam a lista de portais e o estado do certificado
npx vitest run src/test/agente-template.test.ts

# A decisão de preço (16 testes)
npx vitest run src/test/robo-estrategia.test.ts

# As fotos que o robô tirou
ls capturas-robo/
```

E na VPS:

```sh
ls /opt/agente-lances/src/portals/          # quais módulos existem de fato
ls -lt /opt/agente-lances/logs/screenshots/ # o que o robô viu, por último
pm2 logs agente-lances --lines 100
```

> ⚠️ Editar módulo na VPS **exige `pm2 restart`**. O cache de `require` do Node
> continua servindo o arquivo antigo, e foi essa a armadilha de 08/09 — uma
> correção certa que parecia não ter efeito.

---

## 10. Ligações

- `docs/agente-cloud-pendencias.md` — o diário: cada investigação com comandos e
  datas. Seções 11 a 17 cobrem tudo que está resumido aqui.
- `docs/auditoria-agente-v2.2.0.md` — a auditoria de 02/09, onde o defeito do
  robô cobrindo o próprio lance foi encontrado.
- `src/lib/robo/portais.ts` — a autoridade dos 23 portais e do vocabulário do
  agente.
- `capturas-robo/` — as fotos que o robô tirou durante os testes.
