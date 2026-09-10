# Robô de Lances — o que existe, o que trava, e o que falta

> **Data desta foto:** 09/09/2026. O que está aqui foi verificado, não deduzido —
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
| Login real em portal | ✅ | Portal de Compras Públicas, 08/09 à noite |
| VNC mostra a tela ao vivo | ✅ | janela ocupa 100% de 1920×1080 desde 09/09 |
| Navegar até a disputa | ✅ | processo **002/2026** achado em "Seus Processos" e aberto, 08/09 — falta só repetir com um edital em sessão |
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
rotas                      7  — /health, /sessao/{iniciar,pausar,encerrar},
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
| **Falta um dado do cliente** | Compras.gov, BLL, BNC | `.pfx` / senha numérica |
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
sem existir para este portal. Isso só se escreve **vendo** a sala com pregão
acontecendo — é o único item que ainda depende do Rafael.

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
`souLider()` existe em **1 dos 23 módulos**, e `PORTAIS_COM_LANCE_LIBERADO` está
vazio. A regra é boa e ainda não foi exercida contra uma tela real.

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

## 8. Como conferir cada afirmação daqui

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

## 9. Ligações

- `docs/agente-cloud-pendencias.md` — o diário: cada investigação com comandos e
  datas. Seções 11 a 17 cobrem tudo que está resumido aqui.
- `docs/auditoria-agente-v2.2.0.md` — a auditoria de 02/09, onde o defeito do
  robô cobrindo o próprio lance foi encontrado.
- `src/lib/robo/portais.ts` — a autoridade dos 23 portais e do vocabulário do
  agente.
- `capturas-robo/` — as fotos que o robô tirou durante os testes.
