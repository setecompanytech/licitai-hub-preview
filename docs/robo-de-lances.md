# Robô de Lances — o que existe, o que trava, e o que falta

> **Data desta foto:** 15/09/2026 — depois da reestruturação do front pelo XFIN (§1, "14–15/09"). O que está aqui foi verificado, não deduzido —
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
| Interface dispara sessão | ✅ | botão "Enviar ao robô", carimbo `2026-09-09.10` no ar; **desde 14/09 na página própria da disputa (`/robo-lances/disputa/:id`) e na aba Robô do processo — front novo publicado (`2026-09-15.1`), function nova não deployada** |
| Edge function traduz e grava | ✅ | linha em `sessoes_lance_real`, com recusa antes de gravar quando o portal não existe |
| Agente aceita e abre o Chrome | ✅ | `/health` mostra as sessões; 8 registradas hoje |
| Login real em portal | ✅ | Portal de Compras Públicas, 08/09 à noite; **Compras.gov (gov.br + certificado A1), 10/09 às 16:31 e cinco vezes seguidas em 14/09, ~40 s cada** |
| VNC mostra a tela ao vivo | ✅ | janela ocupa 100% de 1920×1080 desde 09/09; **desde 14/09 só em Admin › Robô de Lances (`/admin/robo-lances`), papel `admin`** — ver "14–15/09" abaixo |
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

### 14–15/09 — a reestruturação do front pelo XFIN, e o que ficou desencontrado

> Registro feito em 15/09/2026, lendo o remoto (`origin/feature/rebrand-ui-ux`,
> `220497ad`) contra o local (`ec834bac`, o nosso push da madrugada de 14/09),
> **sem `pull`** — para que o que está escrito aqui seja o que estava lá, e não
> o que sobrou depois de um merge. Serve de respaldo: quem mudou o quê, quando,
> e em que estado a produção ficou.

Na noite de 14/09 a apresentação para o cliente — ver o robô entrando no
portal pela tela remota — não aconteceu: **a tela remota não estava mais na
tela do Robô de Lances**. Não foi apagada. Foi movida, junto com uma
reestruturação inteira do módulo feita no mesmo dia pelo XFIN (a conta do
Rafael, cliente e dono do produto), em 19 commits entre 08:13 de 14/09 e
10:15 de 15/09, dos quais **4 são do robô**.

#### Os 19 commits, na ordem em que entraram

| Hash | Data/hora | Autor | Título |
| --- | --- | --- | --- |
| `9019fc18` | 14/09 08:13 | XFIN Consultoria Empresarial | feat(navegacao): cabecalho horizontal, diretorio de ferramentas e painel novo |
| `6ffe3269` | 14/09 10:09 | XFIN Consultoria Empresarial | feat(documentos): cinco abas, regua unica de situacao e uniao de PDF que une |
| `167146ee` | 14/09 10:14 | XFIN Consultoria Empresarial | fix(documentos): falha de carga nao vira afirmacao sobre o cofre |
| `3d9e9573` | 14/09 11:14 | XFIN Consultoria Empresarial | fix(licitacao): painel e historico passam a usar o vocabulario unico de status |
| `0c3effa1` | 14/09 11:14 | XFIN Consultoria Empresarial | feat(documentos): atestados de capacidade tecnica passam a ser da empresa |
| `4d02752b` | 14/09 11:16 | XFIN Consultoria Empresarial | fix(documentos): normalizar-arquivos-documentos exige CRON_SECRET |
| `27121989` | 14/09 11:21 | XFIN Consultoria Empresarial | fix(documentos): migration de atestados sem min(uuid), que o Postgres nao tem |
| **`63d985bf`** | **14/09 11:47** | XFIN Consultoria Empresarial | **feat(robo-lances): fundacao da integracao do robo ao processo** |
| **`a72ab9b4`** | **14/09 12:25** | XFIN Consultoria Empresarial | **feat(robo-lances): robo integrado ao processo, precificacao aprovada e parada honesta** |
| `33abad15` | 14/09 12:45 | XFIN Consultoria Empresarial | fix(precificacao): rodape e cartoes no celular, motivo de aprovacao com versao vigente |
| `7815db49` | 14/09 13:00 | XFIN Consultoria Empresarial | fix(gestao): tabelas de contratos e do robo cabem na tela |
| **`83d05869`** | **14/09 13:57** | XFIN Consultoria Empresarial | **feat(robo-lances): separa o que e da empresa do que e da operacao Praefectus** |
| **`7f73f5c9`** | **14/09 15:14** | XFIN Consultoria Empresarial | **feat(robo-lances): lista so de participacoes e pagina propria por disputa** |
| `d7acbc05` | 14/09 18:05 | XFIN Consultoria Empresarial | fix(kanban): arrastar ate a ultima coluna do quadro de licitacoes |
| `546dd1f7` | 14/09 18:28 | XFIN Consultoria Empresarial | fix(financeiro): tabela de lancamentos cabe na tela sem cortar acoes |
| `7f2b3a60` | 14/09 19:02 | gpt-engineer-app[bot] (Lovable) | Changes |
| `75040ad7` | 14/09 19:03 | gpt-engineer-app[bot] (Lovable) | Changes |
| `8fcd8e05` | 14/09 19:03 | gpt-engineer-app[bot] (Lovable) | Corrigiu a rota de verificação |
| `220497ad` | 15/09 10:15 | XFIN Consultoria Empresarial | feat(compromissos): pasta manual para processos fora do PNCP |

Carimbo de versão (`src/lib/versao.ts`) ao longo do dia: `2026-09-14.4`
(`a72ab9b4`) → `.6` (`83d05869`) → `.7` (`7f73f5c9`) → **`2026-09-15.1`**
(`220497ad`) — e é este último que o domínio serve em 15/09. O front novo
**está publicado**.

#### O que cada commit do robô muda

| Commit | Cria | Apaga / reescreve |
| --- | --- | --- |
| `63d985bf` fundação | `src/lib/robo/comandos.ts`, `src/lib/robo/situacao-da-participacao.ts`, `src/lib/precificacao/versao.ts` (+ testes); migration `20260914000002` (425 linhas) | — |
| `a72ab9b4` robô no processo | **aba Robô dentro da pasta do processo** (`src/components/workspace/robo/`: `AbaRoboDoProcesso`, `ControleDoRobo`, `PainelDoItem`, `ValoresDoItem`, `consultas`, `itens-da-disputa`); aprovação de precificação (`src/components/workspace/precificacao/`, 12 arquivos; `hooks/usePrecificacaoVersoes`); `painel/PainelDeParticipacoes`; `functions/_shared/robo-acao.ts`; migration `20260914000003` **segredos fora do navegador** | `robo-lances-webhook` +477 linhas; `credenciais-portal`; `KillSwitchButton`, `SessoesDoRobo`, `SimulacaoDisputa`, `AceiteTermosDialog`, `VncWebViewer` (avisos do "parar": confirmada / solicitada / falha), `RoboLances.tsx` (+246) |
| `83d05869` empresa × Praefectus | **página `/admin/robo-lances`** (`src/pages/AdminRoboLances.tsx`, só papel `admin`, abas: Agente e infraestrutura · **Sessões e tela remota** · Diagnóstico · Avisos aos clientes · Auditoria); `src/components/admin-robo/` (diagnóstico entre empresas, registro de chamadas, gestor de avisos); a tela do cliente vira **ligar/desligar o robô da empresa** (`src/components/robo-lances/cliente/`: `LigarDesligarRobo`, `CabecalhoDoRobo`, `FaixaDaEmpresa`, `SituacaoDoRoboEmLinha`, `AvisosDosPortais`, `DialogoModoDeOperacao`); `functions/_shared/robo-plataforma.ts` (624 linhas); migration `20260914000004` | `robo-lances-webhook` +1.188 linhas; `RoboLances.tsx` (597 linhas mexidas); `PainelDeControle`, `AtivacaoChecklist`, `PedidoDoRobo`, `EstrategiaIAPanel` |
| `7f73f5c9` uma página por disputa | `src/pages/RoboLancesDisputa.tsx` (rota `/robo-lances/disputa/:id`); `src/components/robo-lances/disputa/` (16 arquivos: `AcoesDaDisputa`, `AcompanhamentoDaDisputa`, `CabecalhoDaDisputa`, `ContextoDaDisputa`, `EstrategiaDaDisputa`, `EventosDaDisputa`, `ItensDaDisputa`, `ParadaDaSessao`, hooks `useDisputaDoRobo`, `useEnviarAoRobo`, `useOperacoesDaDisputa`, `useParadaDaSessao`, `useSalvarDisputa`); `cliente/useModoDeOperacao` | **apagados:** `DisputasResumo.tsx`, `PainelDeControle.tsx`, `PainelRisco.tsx`; `RoboLances.tsx` **−1.779 linhas** (vira a lista de participações) |

**O que não foi tocado:** `src/lib/agent-template/` e
`src/lib/agente-template-generator.ts` — **zero commits**. O agente na VPS roda
os nossos cinco consertos de 14/09 (§4.2), e a function nova continua mandando
ao `/sessao/iniciar` o mesmo contrato: `portal_id`, `credenciais_portal`,
`uasg`, `itens`, `tipo_disputa`, `max_lances`. O `docs/robo-de-lances.md` também
não foi tocado (idêntico nas duas pontas) — esta seção não conflita com o
`pull`.

#### Migrations — quatro novas, três do robô, e as três do robô **já estão aplicadas**

Conferido em 15/09 com sonda REST usando a chave pública
(`/rest/v1/<tabela>?select=*&limit=0`): tabela existe → 200; não existe → 404;
SELECT revogado → "permission denied for table".

| Migration | O que faz | Aplicada? |
| --- | --- | --- |
| `20260914000001_atestados_da_empresa` (commit `0c3effa1` 11:14, corrigida em `27121989` 11:21) | atestados de capacidade técnica passam a ser da empresa — documentos, não robô | não confirmado (a sonda não achou tabela com esse nome; pode ser `ALTER`) |
| `20260914000002_robo_integrado_ao_processo` (`63d985bf` 11:47) | `precificacao_versoes`, `precificacao_versao_itens` (+ triggers `_proteger`, `_conferir_empresa`); policies "Membros da empresa veem as sessões do robô / os lances das sessões"; função `limites_operacionais_do_processo` | **✅** — as duas tabelas respondem 200 |
| `20260914000003_robo_segredos_fora_do_navegador` (`a72ab9b4` 12:25) | **`REVOKE SELECT`** de `agente_externo_config` e `credenciais_portais` para `anon` e `authenticated`; devolve a `authenticated` só as colunas **sem** segredo (`api_key_hash` e `senha_hash` ficam fora). O navegador deixa de conseguir ler cifra | **✅** — a sonda com a chave pública recebe "permission denied for table" nas duas |
| `20260914000004_robo_separacao_plataforma` (`83d05869` 13:57) | `robo_empresa_config` (ligar/desligar por empresa, trigger `_carimbar`), `robo_avisos_portal` (+ índice de vigentes), função `is_empresa_operador`, `nomes_de_empresas_para_plataforma`; policies "Plataforma lê sessões / registro de chamadas / configuração dos agentes", "Operadores ligam e desligam o robô", "Clientes leem avisos vigentes" | **✅** — as duas tabelas respondem 200 |

As quatro têm seção em `SQL_MIGRATIONS.md` (+116 linhas no remoto).

#### Edge functions — seis arquivos, +2.135 linhas, e **nenhuma foi deployada**

`npx supabase functions list --project-ref uwtyuwktxalnpgrcbbgk`, 15/09:

| Function | No remoto (commits de 14/09) | No ar | Consequência de não estar no ar |
| --- | --- | --- | --- |
| `robo-lances-webhook` | **2.319 linhas** (a v30 tem 1.236): `_shared/robo-plataforma.ts` (624), `_shared/robo-acao.ts` (117), ação nova `situacao-do-robo`, registro de chamadas (`ler-agente`, `ler-credencial`, `gravar-sessao`, `gravar-itens`…), resposta do `parar-sessao` com `resultado.estado` (`confirmada` / `solicitada` / falha) | **v30 — 11/09 12:40** (a nossa, do UASG) | o front publicado pergunta `situacao-do-robo`, lê `resultado.estado`, espera o registro de chamadas — a v30 não conhece nada disso. Ligar/desligar, situação e diagnóstico devem estar respondendo erro ou vazio |
| `credenciais-portal` | a lista devolve `tem_senha` em vez de `senha_hash` (o navegador nunca vê a cifra); cifra com `_shared/credenciais-cifra.ts` | **v17 — 08/09 21:56** | a function velha roda com service role e continua devolvendo `senha_hash` ao navegador — a intenção da migration 000003 só se cumpre com o deploy |
| `normalizar-arquivos-documentos` | passa a exigir `CRON_SECRET` (hoje, `verify_jwt = false` + service role: qualquer um na internet dispara e recebe nomes de documentos de todas as empresas) | **v3 — 03/09 15:26** | a correção de segurança não está no ar |
| `_shared/certificado-agente.ts` | 19 linhas | (entra com o webhook) | — |

Ou seja: dos três caminhos de publicação (front pelo Lovable, SQL colado no
editor, function pelo CLI), **dois foram feitos e o terceiro não** — e o
Publish do Lovable não sobe function. Em 15/09 a produção está com front
novo + banco novo + functions velhas.

#### Onde a tela remota mora agora

`VncWebViewer.tsx` continua existindo. Quem o renderiza no remoto é **só**
`src/pages/AdminRoboLances.tsx` (aba "Sessões e tela remota"), atrás de
`<AdminGuard>` na rota (`App.tsx:190`) e, no banco, de
`has_role(auth.uid(), 'admin')`. No local (`ec834bac`) ele ainda está na aba
Agente do `RoboLances.tsx:1599`. A regra está escrita no próprio arquivo:

> A tela remota é compartilhada entre todas as empresas. O navegador remoto
> roda no mesmo servidor para todos os clientes: quem abre vê qualquer sessão
> em operação naquele momento. **Nunca mostre esta tela, nem o endereço dela,
> a um cliente.**

É uma decisão de produto coerente (um Chrome só para todas as empresas) — e é
ela que fez a apresentação de 14/09 à noite não ter tela para mostrar: a tela
estava em **menu Admin › Robô de Lances**, visível só para quem tem o papel.

**A rota direta, para operar a exceção** (descoberta em 16/09, com o robô
esperando um clique e ninguém com o papel de admin à mão):

```
https://agente.praefectus.com.br/vnc/vnc.html?path=/vnc/&autoconnect=true&resize=scale&reconnect=true
```

É a mesma URL que o `VncWebViewer` carrega no iframe — a tela é servida pela
**VPS**, não pelo Praefectus, então ela não passa pelo `AdminGuard`. Serve
para quem opera o robô resolver captcha e olhar a sessão sem depender do papel
no sistema. Duas armadilhas: `vnc_auto.html` **não** funciona (tenta o caminho
padrão do noVNC e devolve "connection is closed" — o nosso websocket está em
`/vnc/`), e a tela continua sendo **compartilhada entre todas as empresas**,
então o endereço é da operação, nunca do cliente.

#### O clique humano do gov.br, com a tela remota na área admin — e a direção dada em 15/09

O login do Compras.gov **exige um clique humano** (hCaptcha na página do
gov.br — provado seis vezes em 14/09, §4.2). Até 13/09 esse clique era dado
pela pessoa na frente da tela do Robô de Lances; a partir de 14/09 **só um
admin da Praefectus** alcança a tela remota. A operadora do cliente não
consegue mais dar o clique — e o `PedidoDoRobo` da tela do cliente não
oferece a tela remota (`permitirTelaRemota` só na admin).

Três saídas possíveis, levantadas em 15/09:

1. **Operação assistida** — um operador da Praefectus de plantão dá o clique
   quando o robô pede (o pedido já existe: `interacao.pedir`, aba Diagnóstico).
2. **Sessão logada persistente** — perfil de usuário do Chrome (`userDataDir`)
   guardando os cookies do gov.br/Comprasnet entre sessões: um clique por dia
   ou por expiração, não por disputa. Não foi testado; depende de quanto dura a
   sessão do SSO.
3. **Um Chrome por empresa** (display próprio) — aí a tela remota pode voltar
   ao cliente, só com a sessão dele. É arquitetura, não ajuste.

**Direção em 15/09** (seção seguinte): o robô do Compras.gov tem de rodar "por
trás, sem precisar que o usuário veja" e "sem muita intervenção humana". O
caminho escolhido é a **saída 2** — sessão persistente e login antes da hora —
com a **saída 1 como exceção**: se o captcha ainda aparecer, o admin da
Praefectus é avisado com o link da tela remota. A tela remota fica onde o
Rafael a colocou, para auditoria e exceção.

#### O que este registro não afirma

- Que as telas novas funcionem — não foram testadas por nós; o que está aqui é
  o que o código diz e o que a sonda do banco e o `functions list` devolvem.
- Que a migration 000001 esteja aplicada — a sonda não confirmou.
- Que alguém tenha rodado deploy fora do CLI — o `functions list` é a
  autoridade, e diz v30/v17/v3.

### 15/09 — o que foi decidido para o Compras.gov, e o caminho até lá

> Registro de 15/09/2026 com base em: a reunião de **14/09, das 20:28 às
> 21:38** (Giovanny Valente e Ian Lima, gravada em quatro vídeos e transcrita);
> o checklist enviado no grupo em **14/09 às 20:10**; e a divisão de frentes
> combinada em **15/09, das 13:03 às 14:06**. As falas entre aspas são da
> transcrição. Esta seção é a lista de trabalho do robô do Compras.gov a partir
> de agora — cada item fecha com uma entrada neste documento.

#### A técnica, em uma frase

O robô é **automação de navegador** (RPA — *Robotic Process Automation*): um
Chrome de verdade no servidor, controlado pelo Puppeteer, que lê a página e
digita e clica como uma pessoa faria. A conversa entre a tela do Praefectus, a
edge function e o agente na VPS é **API REST comum** (HTTP/JSON). Não é RPC, e
não há API do portal por trás — ver abaixo.

#### O que foi apurado na reunião

| Vídeo | O que se viu |
| --- | --- |
| 1 (20:28–20:38) | Tela do robô do **ConLicitação** (referência usada pelo Rafael para o módulo) e as regras de negócio: valor unitário, marca, modelo, limite de lances, piso, estratégias e modos de disputa |
| 2 (20:39–20:50) | Na conta da Santa Rosa no **Licitanet**, a tentativa de gerar chave de integração com um CNPJ de parceiro devolveu **"Parceiro não encontrado, verifique!"** — a API de fornecedor dos portais privados exige cadastro de parceiro (software house) e plano. "A gente vai ter que comprar também um plano… eles vão cadastrar a gente no CNPJ do parceiro." Pesquisa de "API Compras.gov robô de lances" no Google e no YouTube, e o Swagger de `dadosabertos.compras.gov.br` |
| 3 (21:05–21:18) | Consulta a um assistente de IA com o link do Swagger, perguntando "qual o endpoint para cadastro de proposta e lances do robô de lances?". Resposta: a API do Compras.gov é **de dados abertos** (consulta de compras, atas, itens) e **não tem endpoint de proposta nem de lance**; plataformas comerciais (Effecti, Licitei) usam automação de navegador em nuvem ou extensão. "Automação de tela, que o RPA, né?" (Giovanny) |
| 4 (21:23–21:38) | Decisão e divisão das frentes (tabela abaixo). "No Compras tem que ser o máximo automatizado possível, sem interferência do usuário." Sobre a tela: "Aquela solução com a tela, ela ainda vai continuar sendo usada para esse propósito, né?" (Ian) — "Só Compras." (Giovanny). Sobre risco de lance: "Ele tá com uma trava, né?" — "Sim, tá com uma trava." |

Extensão de navegador × servidor: a extensão usa a sessão já logada no
computador do operador e depende dele ligado; o servidor não depende. O robô
continua no servidor.

#### As decisões

| # | Decisão | Quem / quando |
| --- | --- | --- |
| D1 | O Compras.gov **não tem API de lance nem de proposta**; segue por **automação de navegador (RPA)** | reunião, vídeos 3 e 4 |
| D2 | "No Compras tem que ser **o máximo automatizado possível, sem interferência do usuário**." "Vai pelo caminho que for melhor, desde que a experiência fique boa e fluida, sem muita intervenção humana. Isso pro Compras.gov só; os demais vamos via API." | Giovanny — reunião; WhatsApp 15/09 13:59 |
| D3 | **Divisão das frentes.** Giovanny: integração com o **Licitanet via API**, ajuste do **design system para um modelo mais clássico**, e frentes do financeiro. Ian: **robô do Compras.gov** e os itens do checklist do grupo ("além daquele 2 ou 3 que mandei lá no grupo") | Giovanny — WhatsApp 15/09 13:03–13:04 |
| D4 | O robô "deve funcionar como já deixou — mas com ele **rodando por trás sem precisar necessariamente que o usuário veja**, via RPA / browser automation" | Giovanny — WhatsApp 15/09 13:03 |
| D5 | **Autorização para dar lance:** "pode testar fazer lances sem problemas, pra validar se ele tá conseguindo dar lance". A retirada da trava foi autorizada por **Giovanny e Rubens** | Giovanny — WhatsApp 15/09 13:03; Giovanny e Rubens |
| D6 | A esteira do robô: **"1. cadastrar a proposta → 2. fazer o lance no dia do pregão"** | Giovanny — WhatsApp 15/09 13:03 |
| D7 | **Pré-configurado no próprio Praefectus, com agendamento:** a disputa é cadastrada com antecedência e, no dia e hora da sessão, o robô **entra sozinho na sala** — sem esperar permissão nem clique do usuário. O usuário **é avisado** do que o robô faz (entrou, a disputa começou, lance enviado ou recusado, encerrou), em vez de precisar ficar olhando a tela. É o modelo do ConLicitação e o que o Rafael espera do módulo | alinhamento 14–15/09; reforçado pelo Ian em 16/09 |
| D8 | Regras de disputa que a estratégia tem de seguir: iminência no modo aberto, lance final no aberto e fechado, limite de lances ou disputa contínua até o piso (ver "As regras de disputa") | Giovanny — reunião, vídeo 1 |
| D9 | O checklist do grupo (literal, abaixo) | Giovanny — grupo, 14/09 20:10 |
| D10 | A tela remota **sai do caminho do usuário** e fica para **auditoria e exceção** (captcha) — é onde o Rafael a colocou em 14/09 (`/admin/robo-lances`) | alinhamento 14–15/09 |
| D11 | Demonstrações passam a ser **ao vivo, em call**: "quando for assim, acione eles em uma call pra demonstrar, fica melhor" | Giovanny — WhatsApp 15/09 14:01 |
| D12 | **A sessão do Compras.gov pode ficar aberta no servidor o dia todo, todos os dias**, no perfil do certificado do Rafael; o robô tem de ficar atento às disputas configuradas no Praefectus e entrar sozinho em cada uma | Rafael Castro — autorização repassada pelo Ian em 16/09 |
| D13 | **Acompanhar a disputa pela tela do Praefectus, sem precisar da tela remota**: uma interface simples que mostre como a disputa está indo. **A tela remota continua de pé** (auditoria e captcha) | reunião de 14/09 e WhatsApp de 15/09 ("rodando por trás sem precisar necessariamente que o usuário veja"); reforçado pelo Ian em 16/09 |

Decisões do Ian sobre o caminho (15/09): o checklist do grupo **fica na nossa
lista por ora** (sai se algum item for do Giovanny); o mapeamento e o primeiro
lance acontecem **em pregão real** da Santa Rosa, e não no ambiente de
treinamento; o captcha é tratado com **sessão persistente + aviso ao admin**.

#### A referência: o robô do ConLicitação — as telas, como foram vistas

Módulo "Robô de Lance Inteligente" (BETA v.112), navegado na reunião e revisto
nas telas trazidas pelo Ian em 15/09. Cabeçalho com CNPJ e razão social da
empresa, botão "Gerenciar Portais" e um botão de energia que abre o painel
**"Conexão de robôs"**.

- **Ligar/desligar é do robô, não da disputa.** O painel mostra "Robô web —
  Não conectado", botão verde **"Ligar"**, e passa por "Conectando… /
  Iniciando…". Enquanto está desligado, qualquer ação responde **"Robô
  desligado — Ligue o robô Web para continuar"**. Os portais que esse robô
  cobre estão escritos ali: **BLL, BNC, Licitanet e Compras Públicas** —
  **o Compras.gov não está na lista**. No produto de referência, esse portal
  não é atendido pelo robô web.
- **Quatro abas de estado, com contador:** Cadastradas · Configuradas · Em
  disputa · Encerradas. Cada linha traz o portal (selo "Licitanet"), o
  processo (34/2026), órgão e cidade, modalidade, a **abertura de lances com
  data e hora** (23/09/2026, 08:30:00), a situação ("Aguardando") e três
  ações: configurar, editar e excluir.
- **A esteira em dois passos, na ordem que o Giovanny descreveu:** tela de
  itens ("Passo 2 de 2") com descrição, quantidade, valor unitário estimado,
  total, **marca** e **modelo** → botão **"Enviar proposta"** → "Enviando sua
  proposta…" → **"Sucesso! Sua proposta foi enviada ao portal"** → botão
  **"Configurar lances"**.
- **Estratégia por item**, preenchida ao vivo na demonstração: **Proposta
  inicial**, **Intervalo entre lances (R$)** (o decremento) e **Valor mínimo
  (R$)**, este marcado como **campo obrigatório**. Ao lado, três opções em
  caixa de seleção, com a explicação do próprio produto:
  - **Melhor preço pelo portal** — "o robô disputa o melhor preço possível
    pelo portal, sem ultrapassar seu limite";
  - **Iminência** — "o robô envia lances apenas nos 2 minutos finais da etapa
    aberta";
  - **Desempatar no 1º lugar** — com a margem em reais no campo ao lado.

  Os valores usados na demonstração: piso R$ 0,01 no item 1 e R$ 0,02 no item
  2, iminência R$ 350,00 e desempate R$ 10,00. Ao salvar: **"Configuração
  salva! Os lances agora serão aplicados…"**.
- **Limite de lances**, debatido na mesma tela: teto fixo (por exemplo, 30)
  ou disputa contínua enquanto estiver acima do piso — "roda a madrugada".
- **Duas travas de estado** que valem copiar: ao editar, **"Editar essa
  proposta resetará sua configuração de lances!"**; ao cadastrar de novo,
  **"Proposta já cadastrada — identificamos que você já possui uma proposta
  ativa para esta licitação. Deseja editar sua proposta?"**.
- **"Encontrar licitações"** é a busca própria do ConLicitação (270.996
  licitações no momento da consulta), com filtros de objeto, estado, cidade,
  nº do edital, modalidade e datas, e ações por resultado: ver itens, baixar
  edital, resumo por IA, perguntar ao edital, gerenciar licitação. No
  Praefectus esse papel é do **Monitoramento** (PNCP), que já alimenta o
  Kanban.

**O que vale reaproveitar — sem refazer o front**, que o Rafael já
reestruturou:

1. o interruptor **ligar/desligar** do robô — já existe no Praefectus
   (`robo_empresa_config.ligado`, migration `20260914000004`; o envio novo
   recusa quando a empresa está desligada);
2. as **três estratégias por item** com piso obrigatório;
3. a **esteira proposta → configurar lances**, com as duas travas de estado;
4. **data e hora** de abertura na lista — hoje a disputa guarda só a hora;
5. o **teto de lances opcional**, com a alternativa de disputar até o piso.

O que não entra na nossa frente: a tela de integrações por API (Licitanet,
BLL, BNC, Compras Públicas) — é a frente do Giovanny. A nossa é o Compras.gov
por automação de navegador, que no próprio ConLicitação não é coberto pelo
robô web.

#### As regras de disputa que a estratégia precisa seguir

Nas palavras do Giovanny (vídeo 1):

> "O robô envia lances apenas nos dois minutos finais da etapa de Aberto. Por
> exemplo, Aberto: tu tem 10 minutos mais 2 minutos para cada lance… o Aberto e
> Fechado é 15 minutos, entrou 15 minutos aí encerramento aleatório."

> "Se for no fechado e aberto, o sistema ele vai reconhecer os três menores
> lances… Eu tenho lá 1 milhão, 2 milhões, 3 milhões… o sistema vai somar mais
> 10%… Se a minha empresa for a quarta colocada, ela vai entrar no modo de
> lance."

> "Lembra que a gente tem um limite de lances? Aí eu quero cadastrar 30 ou
> infinitamente até chegar no meu limite."

A regra oficial (Lei 14.133/2021 e IN SEGES/ME 73/2022, conforme o
[TCU — Licitações e Contratos, 3.5 Modos de disputa](https://licitacoesecontratos.tcu.gov.br/3-5-modos-de-disputa/)):

| Modo | Como corre | O que o robô tem de fazer |
| --- | --- | --- |
| **Aberto** | 10 minutos; prorrogação automática de 2 minutos sempre que houver lance nos 2 minutos finais, sucessivamente; encerra quando uma prorrogação passa sem lance | **Iminência**: esperar os 2 minutos finais (e cada prorrogação) em vez de queimar lance no início |
| **Aberto e fechado** | 15 minutos abertos; depois do aviso, encerramento em **até 10 minutos, em tempo aleatório**; o autor da melhor oferta e os das ofertas **até 10% acima** podem dar **um lance final fechado** em até 5 minutos; se forem menos de três, entram os melhores subsequentes **até completar três** | Na fase aberta, a mesma lógica; ao fechar, saber se a empresa está entre os elegíveis e dar o lance final único |
| **Fechado e aberto** | Propostas em sigilo; vão para a fase aberta a de menor preço e as **até 10% acima** (ou as **três melhores**, se forem menos de três); depois segue como o aberto | Saber se a proposta entrou na fase aberta; daí em diante, como o aberto |

Em todos: o edital fixa o **intervalo mínimo de diferença** entre lances (em
reais ou percentual) — é o campo "decremento mínimo" da disputa, e um lance
abaixo dele é recusado pelo portal. O limite pode ser **um teto de lances**
(ex.: 30) **ou nenhum**, disputando até o piso.

#### O checklist do grupo, literal (14/09, 20:10)

1. "Extrair no PNCP os itens do edital no lançamento manual no cadastro de nova sessão"
2. "Coluna de marca e modelo, se houver no anexo — do termo de referência"
3. "Retornar dados da licitação pra complementar as informações"

#### Onde o robô está, diante das decisões (conferido em 15/09)

| Fato | Onde |
| --- | --- |
| A trava de lance é `PORTAIS_COM_LANCE_LIBERADO = []`. O id que ela confere é **`comprasgov`** — o id do portal **no agente**. `compras-gov` é o id da tela; colocar esse na lista deixa a trava fechada sem aviso | `src/lib/agent-template/estrategia.ts:39` e VPS `src/estrategia.js` |
| **`souLider` ainda não existe no módulo do Compras.gov**, e sem ele a regra de proteção responde "o portal não informou quem lidera" em toda rodada. Abrir a trava sozinho **não produz lance** — o `souLider` sai da leitura da sala real | classe `ComprasGovPortal` em `src/lib/agent-template/portals.ts` |
| A leitura do melhor lance e o envio do lance do Compras.gov são listas de seletores genéricos, escritas antes de se ver a sala | idem |
| A decisão de lance (`decidirLance`) sabe **cobrir o melhor lance com o decremento**, sem ultrapassar o piso e sem cobrir a si mesma. Ainda não sabe **modo, fase, tempo restante, posição, os 10% e a estratégia** | `estrategia.ts` |
| O limite de lances é contado por **rodada de leitura**, não por lance enviado, e encerra a sessão antes de qualquer decisão | `_startBiddingLoop` em `agente-template-generator.ts` |
| O cadastro de proposta no portal (`enviarProposta`) ainda não existe; a validação dos dados da proposta existe | `src/lib/robo/proposta.ts`; rota `POST /api/proposta/enviar` |
| A disputa guarda a **hora** (`horario`), não a **data** — hoje nada consegue agendar a entrada; o processo tem `data_abertura` | `robo_lances_disputas`; `licitacoes` |
| Não há agendamento em nenhuma camada ainda | front, functions e migrations |
| O Chrome **não guarda a sessão** entre uma disputa e outra — todo envio é um login novo | `browser.js` |
| hCaptcha nos logins do Compras.gov de 10 a 14/09: **16 logins, 2 entraram sem clique, 10 pediram clique** (os demais eram falhas já corrigidas) | log do agente |
| **14/09, 20:07** — sessão enviada; o gov.br pediu o clique no certificado; a espera de 10 minutos terminou às 20:17 sem o clique. A tela remota fica na área admin desde a tarde de 14/09 | log do agente |
| **Pregão 7/2026 SEDUC/PA (14/09, 9h)** — nenhuma sessão foi enviada entre 07:38 e 15:47; a sala em disputa **ainda não foi gravada** | `logs/sessoes/` na VPS |
| **14/09, 15:47** — sessão da compra **90029/2026** (Fundação Santa Casa de Misericórdia do Pará, UASG 925448, propostas até 17/09): login **sem clique** em 9 s e página da compra aberta em 21 s | log do agente |
| Existe um ambiente de treinamento oficial para fornecedor (`treinamento.comprasnet.gov.br`), com proposta e lance simulados — não é o caminho escolhido | manuais do Comprasnet |
| A leitura dos itens de uma compra no PNCP já existe (`/orgaos/{cnpj}/compras/{ano}/{seq}/itens`); falta chegar a ela a partir de **UASG + número/ano** | `detalhe-licitacao-pncp`, `_shared/pncp-coords.ts` |
| As três edge functions das telas novas ainda não estão no ar | ver "14–15/09" acima |
| **Conferido em 16/09:** nenhum commit novo no remoto desde `220497ad` (15/09, 10:15). No período de 14 a 16/09 os commits são da conta XFIN (16), do Ian (5) e do bot do Lovable (3) — **nada do Giovanny**. O que o remoto tem a mais no robô é front, `src/lib/robo/` e a edge function; **o template do agente (`src/lib/agent-template/`, `agente-template-generator.ts`) segue sem nenhum commit de terceiros**, e a integração com o Licitanet ainda não existe no código | `git fetch` + `git log`/`git diff` contra `origin/feature/rebrand-ui-ux` |

Dois esclarecimentos para não perder no caminho:

- **"Por trás" não é "headless".** No gov.br o Chrome sem janela cai no
  hCaptcha até na página pública (visto em 11/09). O robô continua com janela,
  na tela virtual do servidor — o usuário simplesmente não precisa olhar.
- **Proposta e lance em pregão real são compromisso da empresa.** Por isso o
  primeiro lance do robô sai num item em que a Santa Rosa quer vender, com o
  piso vindo da precificação aprovada.

#### O caminho — lista de trabalho

> **Ordem definida em 16/09.** O mapeamento da sala de disputa continua de pé —
> é o que destrava o lance de verdade —, mas deixa de ser o primeiro passo. O
> que não depende de estar dentro de um pregão vem antes: **agendamento e
> avisos** (Fase 4), **estratégia** (Fase 2) e **itens do PNCP, marca/modelo e
> dados da licitação** (Fase 6), com a medição da sessão persistente correndo
> em paralelo. Assim, quando houver pregão real com proposta da empresa, entrar
> e mapear (Fases 1 e 3) fecha o conjunto, e a liberação do lance (Fase 5) vem
> por último. As fases seguem numeradas como nasceram, para não perder as
> referências já feitas neste documento.

**Fase 0 — base**
- [x] Registrar a reestruturação de 14–15/09 e as decisões de 15/09 (este documento)
- [x] Trazer o remoto para o local — feito em 16/09: os 19 commits de 14–15/09 entraram e a documentação ficou por cima deles. Tipos sem erro e 94 testes do robô passando depois do rebase. (A branch segue o remoto `sete`, então o comando é `git fetch origin && git rebase origin/feature/rebrand-ui-ux`; a forma `git pull --rebase origin <branch>` é recusada por apontar para dois destinos.)
- [x] Publicar as três edge functions das telas novas — feito em 16/09 às 09:57: `robo-lances-webhook` **v31**, `credenciais-portal` **v18**, `normalizar-arquivos-documentos` **v4**. Com isso a produção volta a ficar inteira: banco novo, front novo e functions novas. O `CRON_SECRET` que a terceira passou a exigir já estava cadastrado no projeto, então o job de documentos segue rodando

**Fase 1 — ver a sala e a tela de proposta, em pregão real**
- [ ] Agenda: próximos pregões do Compras.gov com proposta da Santa Rosa, itens e piso aprovado (candidato: 90029/2026, Santa Casa do Pará)
- [ ] Pregão A — robô entra com a trava fechada e o gravador a cada 10 s; a operadora disputa como sempre; pela tela remota do admin, levar o robô até a **sala logada do fornecedor** e à tela de cadastro de proposta
- [x] **Melhor lance, posição e `souLider`** — escritos e no ar em 16/09, a partir da página pública de propostas do item (não da sala logada). O laço de lances passou a perguntar essa classificação a cada rodada, recarregando a página, em vez dos seletores chutados; o CNPJ da empresa atravessa webhook (v36) → `index.js` → `session-manager` → módulo. Provado contra o texto real das capturas; VPS com md5 igual ao template
- [ ] O que a leitura pública ainda não dá: **fase e tempo restante** (iminência), **elegibilidade no fechado**, o **caminho até a sala logada**, o **envio do lance** e a **conferência do resultado** — e confirmar que a página de propostas se atualiza durante a disputa ao vivo

**Fase 2 — estratégia**
- [x] **A decisão de lance por estratégia** — escrita em 16/09 em `src/lib/agent-template/estrategia.ts`, com 54 testes em `src/components/robo-lances/test/estrategia.test.ts` (eram 13). As guardas de antes continuam na mesma ordem de prioridade — trava do portal primeiro, nunca cobrir o próprio lance, nunca lance sem leitura, nunca abaixo do piso — e a função passou a saber:

  | O que | Como decide |
  | --- | --- |
  | **Estratégia do item** | `melhor_preco` cobre o 1º lugar sempre que não estivermos nele, até o piso. `iminencia` faz a mesma conta só nos **2 minutos finais** da etapa aberta, e em todo o encerramento aleatório do aberto e fechado. Item sem estratégia escolhida segue como melhor preço — é o que o robô já fazia, então disputa antiga não muda de comportamento. Estratégia com nome desconhecido **aguarda** e diz o nome, em vez de virar melhor preço por conta própria |
  | **Piso obrigatório** | sem valor mínimo, o robô não disputa o item. Antes, piso vazio virava comparação com zero, e o lance podia descer até um centavo |
  | **Intervalo mínimo do edital** | lido do portal (R$ 0,0100 no 7/2026), em reais ou percentual. Vale como passo quando a empresa não configurou decremento, e sobe o decremento configurado quando ele é menor — lance com diferença menor que a do edital é recusado. O arredondamento para centavos nunca encolhe o passo abaixo do intervalo |
  | **Limite de lances** | conta **lances enviados**, não rodadas de leitura, e é opcional: vazio ou zero disputa até o piso ("30 ou infinitamente até chegar no meu limite") |
  | **Empate perdido** | nosso valor igual ao melhor, com o portal dizendo que não lideramos, é empate decidido por ordem de registro — há o que cobrir |
  | **Fases** | `aguardando` e `suspensa` esperam; `encerrada` encerra; fase com nome desconhecido espera. **Fase não lida não bloqueia o melhor preço** — é a situação de hoje, enquanto a sala não está mapeada |
  | **Fechado e aberto** | proposta fora das classificadas para a etapa aberta encerra o item |
  | **Lance final fechado** (aberto e fechado) | só com a elegibilidade confirmada pelo portal, uma vez só, e **só com o valor escolhido pela empresa** — o robô não escolhe sozinho o número de um lance que não dá para corrigir. Nunca abaixo do piso, e o líder também dá o seu |
  | **Ritmo de leitura** | `proximaLeituraMs`: o intervalo da disputa fora da iminência; a cada **3 s** dentro dela e no lance final fechado; e, faltando menos de um intervalo para a iminência, a próxima leitura cai no começo dela |

  O que ela ainda não recebe de ninguém: **fase, tempo restante e elegibilidade** saem do mapeamento da sala (Fase 1). Até lá chegam vazios, e vazio quer dizer "não sei" — por isso a iminência, hoje, aguarda com o motivo "o tempo restante não foi lido". Posição além do 1º lugar ainda não entra na conta: nenhuma das duas estratégias escritas a usa
- [x] **"Desempatar no 1º lugar"** — escrita em 16/09, depois da definição do Ian. A terceira estratégia da tela do ConLicitação traz uma margem em reais ao lado, e o produto não publica o que ela faz. Na reunião de 14/09 o Giovanny marcou a opção com **10,00** e comentou: *"tu vai ter um desempate no primeiro lugar, eu acho perigoso… porque vai muito do modo de disputa"*, e, sobre o fechado e aberto, *"tua marca desempata no primeiro lugar automaticamente. Então o preço vai cobrir…"* — sem descrever a regra do campo. A leitura escolhida foi a que **não depende de nada que o robô ainda não lê**:

  | O que | Como decide |
  | --- | --- |
  | **A margem é distância máxima** | o robô só cobre o 1º colocado quando a diferença entre o **nosso último lance** e o **dele** cabe na margem do item. Mais longe que isso, não persegue — e diz a distância no motivo |
  | **O passo é o de sempre** | a margem não vira degrau: o lance desce o decremento configurado ou, sem ele, o intervalo mínimo do edital |
  | **Sem margem, ou sem lance nosso** | aguarda: sem um dos dois não há distância para medir |
  | **Guardas** | as mesmas das outras estratégias — trava, liderança, leitura, piso, teto |

  Junto veio a fase **desempate de ME/EPP** (`desempate_me_epp`): quando o portal convoca a pequena empresa, com lance até 5% acima do 1º, a cobri-lo, **qualquer estratégia** dá **um** lance cobrindo o 1º, só com a convocação confirmada pela leitura da sala — e a margem da "Desempatar no 1º lugar" vale também ali. Como fase, tempo e elegibilidade, essa convocação ainda não é lida (Fase 1). Testes: 9 casos novos na decisão e 1 no laço
- [x] **O laço de lances usa a decisão nova** — escrito em 16/09 no `session-manager` (template), com 9 testes em `src/components/robo-lances/test/laco-de-lances.test.ts` que rodam o arquivo gerado com um portal de mentira e o relógio simulado. O que mudou, na prática:
  - **o robô não sai mais da sala em 10 minutos.** O laço encerrava a sessão ao chegar em `max_lances` **rodadas de leitura**, antes de qualquer decisão — com o padrão de 20 rodadas a 30 s, era isso. O teto agora é da decisão e conta lances enviados; o teste roda 25 rodadas com a trava fechada e a sessão continua de pé;
  - **piso e estratégia são do item** que o robô acompanha; o piso da disputa inteira só vale para item sem o próprio;
  - **o nosso valor vem do portal** (o que a página pública mostra para o CNPJ da empresa), ou do último lance que o portal aceitou, se for menor — e não mais do valor inicial da disputa, que num pregão por itens pode ser o número de outro item;
  - **o intervalo mínimo e o modo de disputa são lidos uma vez**, logo depois de abrir a compra (abaixo), e vão para a decisão;
  - **ritmo por `proximaLeituraMs`**: a próxima leitura só é agendada depois que a atual termina — com o relógio fixo de antes, uma leitura lenta da página pública encavalava com a seguinte;
  - pausar e retomar no meio de uma rodada não deixa **dois laços vivos** decidindo pela mesma sessão;
  - uma sessão que só observa (trava fechada, item sem lance possível) acaba no **limite de segurança de 10 horas** (`HORAS_MAXIMAS_SESSAO` no `.env` da VPS), além do botão de parar — um Chrome esquecido ocupa uma das poucas vagas do servidor;
  - **o encerramento diz por quê** (teto, piso, item encerrado, limite de horas, pedido pelo painel), e o aviso de rodada sem lance só sai quando o motivo muda ou a cada 30 s, para a iminência a cada 3 s não virar enxurrada
- [x] **Modo de disputa e intervalo mínimo, lidos do portal** — escrito em 16/09 no módulo do Compras.gov (`lerDetalhesDoItem`). Na página pública da compra, o cabeçalho traz "Modo disputa: Aberto" e o item expandido traz "Intervalo mínimo entre Lances — R$ 0,0100". O robô acha o cartão do item pelo número, clica em "Mostrar detalhes do item", passa de página se o item não estiver na primeira, e lê o texto. A leitura do texto é testada com o que o gravador capturou às 11:00:55 no 7/2026 — inclusive que o intervalo de um item expandido não é emprestado ao item de baixo, e que descrição começando por número não vira outro item. **O clique no cartão certo ainda não rodou no portal**: o caminho foi escrito sobre os rótulos e caminhos do DOM gravado, e se provar na próxima sessão
- [x] **A tela e o webhook** — escritos em 16/09:
  - na grade de itens do cadastro da disputa, ao lado do piso, a coluna **Estratégia** (Melhor preço ou Iminência). A página da disputa, reestruturada em 14/09, não ganhou coluna: a tabela dela já foi medida para caber a 1.280 px, e a escolha fica no cadastro, onde o piso de cada item já é editado;
  - **"Máx. lances por sessão" vazio grava sem limite**, e as telas mostram "Sem limite (até o piso)". Antes o campo vazio virava 20 no salvamento;
  - **"Decremento percentual" vazio deixa de virar 1,5%** ao salvar — o `|| 1.5` gravava um passo que ninguém escolheu. **E o campo passa a nascer vazio** (decisão do Ian em 16/09): o padrão é o intervalo mínimo que o edital publica, para não gastar margem à toa; o decremento, em reais ou em %, só vale quando o operador o preenche. Disputas já salvas com 1,5 continuam com 1,5 até alguém apagar o campo — a regra nova não reescreve o que já foi gravado;
  - a lista de estratégias da tela (`src/lib/robo/estrategia-do-item.ts`) é conferida em teste contra a do agente: um nome que só a tela conhecesse faria o robô aguardar em toda rodada;
  - o webhook leva a estratégia de cada item ao agente, no envio manual e no agendador, e o limite vazio segue vazio (os dois faziam `|| 20`). O agendador passou a registrar no log quando os itens da sessão não são gravados — antes a falha passava calada;
  - o aviso de sessão encerrada, no sino e no mural do processo, cita **o motivo e quantos lances o robô enviou**, e deixou de afirmar "o robô acompanha e não envia lance", que vai deixar de ser verdade quando a trava abrir;
  - migration `20260916000003`: `max_lances` deixa de ser obrigatória. Disputas existentes continuam com o número que têm
- **Pôr no ar, nesta ordem** (cada passo com o OK do Ian). Webhook e agente novos convivem com a tela antiga: estratégia ausente é melhor preço, limite 20 continua 20
  - [x] **1.** SQL `20260916000003` aplicado em 16/09 no editor do projeto `uwtyuwktxalnpgrcbbgk` — `ALTER COLUMN max_lances DROP NOT NULL` respondeu "Success", e o comentário da coluna também foi gravado. Conferido em `information_schema.columns`: `is_nullable = YES`, `column_default = 20` — vazio é aceito, e quem não informa a coluna continua recebendo 20. Veio antes da tela de propósito: com a coluna obrigatória, salvar disputa sem limite daria erro de banco
  - [x] **2.** `robo-lances-webhook` **v37** publicado em 16/09 às 12:16. A ação do agendador, chamada sem o segredo do cron, responde 401 — o bloco de autorização da versão nova respondendo
  - [x] **3.** agente instalado na VPS em 16/09 às 12:18. Antes, conferido que os três arquivos da VPS eram exatamente os que o template gerava antes das mudanças do dia (`estrategia.js` de 10/09 = `f900e672…`; `session-manager.js` = `2d4775c7…` e `portals/comprasgov.js` = `4da507bf…`, os instalados às 11:29) — nada de terceiros foi sobrescrito. Com 0 sessões ativas: backups `.bak-20260916-1218`, `node --check` nos três, cópia, md5 **igual ao template** (`estrategia.js 9a090cbd…`, `session-manager.js 14e7488a…`, `portals/comprasgov.js 7f1f53d7…`), `pm2 restart`. Depois: online, 14 rotas, 8 portais carregados, 0 sessões, `portais_com_lance_liberado: []` — pelo servidor e pelo domínio
  - [x] **2b.** `robo-lances-webhook` **v38** publicado em 16/09 às 12:47, levando a margem de desempate de cada item (a v37 levava só a estratégia). A ação do agendador sem o segredo do cron continua respondendo 401
  - [x] **3b.** agente reinstalado na VPS em 16/09 às 12:48, com "Desempatar no 1º lugar" e a fase de desempate de ME/EPP. A instalação só seguiria se os arquivos da VPS fossem os das 12:18 (`9a090cbd…`, `14e7488a…`) e não houvesse sessão ativa — os dois conferidos. Backups `.bak-20260916-1248`, `node --check`, md5 **igual ao template** (`estrategia.js 4eea9b7d…`, `session-manager.js 26c9ad7b…`); `portals/comprasgov.js` não mudou (`7f1f53d7…`) e ficou como estava. Depois do `pm2 restart`: online, 14 rotas, 8 portais, 0 sessões, `portais_com_lance_liberado: []` pelo servidor e pelo domínio
  - [x] **4a.** push em 16/09: `0bcf5cfd..10812e69` para `origin` e `sete` (os três em `10812e69`), com o remoto conferido parado antes. Seguro mesmo antes do 2b e do 3b: a v37 e o agente das 12:18 ignoram a margem, e um item com "Desempatar no 1º lugar" aguarda com o motivo "estratégia não conhecida por esta versão do robô" em vez de dar lance
  - [x] **4b.** tela publicada pelo Ian no Lovable em 16/09 — `bash scripts/verificar-publicacao.sh` leu https://praefectus.com.br e respondeu **versão `2026-09-16.2`, a mesma do repositório**
- [x] Mostrar a estratégia de cada item também na página da disputa, sem alargar a tabela — feito em 16/09, sob o piso

**Fase 3 — proposta (etapa 1 da esteira)**
- [ ] Cadastro da proposta no Compras.gov pelo robô: valor, marca, fabricante, modelo e descrição por item; declarações do portal só quando o cadastro disser
- [ ] Ação "cadastrar proposta no portal" na página da disputa, com o resultado voltando ao processo

**Fase 4 — autonomia: o robô entra sozinho e avisa** (D7)
- [x] Data e hora da sessão na disputa — escrito em 16/09: migration `20260916000001` (`inicio_sessao` e `enviada_em`, com índice parcial) e o campo "Data da Sessão" no formulário, ao lado do horário. Os dois viram um instante só; sem a data, a disputa continua sendo enviada por clique, como antes. O pré-preenchimento vindo do PNCP fica na Fase 6
- [x] **SQL da `20260916000001` aplicado** em 16/09, no editor do Supabase — conferido de fora: `inicio_sessao` e `enviada_em` respondem na tabela do projeto que o app usa
- [x] Publicar o webhook com a ação `disparar-agendadas` — **v33** em 16/09 às 10:37. Provado no ar: chamada sem o segredo de cron responde `Unauthorized`, que é a resposta do próprio bloco novo — se a ação não fosse reconhecida, a função diria "ação desconhecida"
- [x] **Job de um minuto no ar** — `20260916000002` aplicada em 16/09: `robo-disparar-agendadas`, `* * * * *`, `active = true` (job 32)
- [x] Agendamento no ar em 16/09: a cada minuto, disputas que começam em até 15 minutos, com a empresa ligada, são enviadas ao robô **sem clique de ninguém**. Provado que o job chama e a função responde: `net._http_response` mostra `200` com `{"ok":true,"janela":{…},"encontradas":0}` às 13:42 e 13:43 UTC — ela acordou, olhou a agenda e não achou nada para despachar, que é o certo enquanto nenhuma disputa tem data
- [x] **Prova de ponta a ponta** — 16/09, com a disputa do 7/2026 (SEDUC/PA) marcada para dali a poucos minutos. A primeira tentativa não despachou: o agendador lia o **nome** do portal gravado na disputa ("Compras.gov.br") e o tradutor só conhecia ids — corrigido com `idDeArmazenamento()` em `_shared/robo-portais.ts` (webhook v34). Na segunda, a corrente fechou sem ninguém enviar nada:

  | Hora | O que aconteceu |
  | --- | --- |
  | 10:56:00 | o job despachou a disputa sozinho e o agente abriu a sessão `aded18bb…` |
  | 10:56:15 | o gov.br pediu o clique humano no certificado (hCaptcha) — dado pela rota direta da tela remota |
  | 11:00:03 | autenticado; login no Compras.gov e gravador ligado |
  | 11:00:09 | busca com número **72026** e UASG **925315**, os dois conferidos na tela |
  | 11:00:11 | compra localizada entre as homônimas — etapa "Seleção de fornecedores" |
  | 11:00:15 | "Acompanhar compra" aberto; o gravador registrou 12 capturas |

  O único gesto humano foi o do captcha — é ele que a sessão persistente (abaixo) tenta tirar do caminho
- [x] **Sessão persistente do Chrome** — escrita em 16/09. Todo envio era um login novo, e o gov.br pediu o clique do hCaptcha em 10 de 16 logins entre 10 e 14/09. Agora:
  - no Compras.gov, o Chrome abre com um **perfil guardado na VPS** (`perfis/comprasgov-<hash>`, pasta só do root), **um por identidade de login** — o titular do certificado. O nome da pasta é um hash: CPF não fica escrito no disco. Com a sessão guardada, o gov.br pode devolver o robô já logado, **sem certificado e sem captcha**;
  - o login **reconhece a volta direta**: se o `/authorize` do gov.br devolve o navegador já na Área de Trabalho do Fornecedor, o robô segue dali. Sem isso, a volta seria lida como "o SSO não respondeu" e o robô procuraria um botão de certificado que não aparece mais;
  - **nada cai por causa do perfil**: se outra sessão da mesma identidade estiver com ele aberto (o Chrome não abre a mesma pasta duas vezes), ou se o Chrome não abrir com ele, a sessão entra com perfil temporário, como antes, e o log diz por quê;
  - só no Compras.gov: o login dos outros portais foi escrito supondo navegador limpo, e ninguém conferiu como reagem chegando logados. `PERFIL_PERSISTENTE=false` no `.env` da VPS desliga para todos;
  - **medição**: cada login vira uma linha em `logs/logins.jsonl` na VPS — quando, se havia perfil guardado, **como entrou** (`sessao-reaproveitada`, `certificado-sem-clique`, `certificado-com-clique`, `falhou`) e em quantos segundos. É daí que sai, depois de alguns pregões, quanto o perfil de fato evita o captcha (comando em §9)
- [x] **Aviso quando o robô para esperando uma pessoa** — escrito em 16/09. Todo pedido de ação humana (captcha, código de verificação, de qualquer portal) vira o callback `pedido-humano`, e o webhook avisa na hora: **os administradores da plataforma** recebem um aviso urgente com o que o portal pediu, **até que horas o robô espera** e a rota direta da tela remota; **quem enviou a disputa** recebe um aviso simples, sem tela remota, dizendo que o robô aguarda uma verificação e que a Praefectus já foi chamada. É o que faltou em 14/09 às 20:07, quando o pedido expirou sem ninguém ver. Um aviso que falha não impede o robô de seguir esperando o clique
- [x] **Sessão persistente e aviso no ar** — 16/09, com o OK do Ian, na ordem obrigatória: **1.** `robo-lances-webhook` **v39** às 13:04 (antes do agente, senão o `pedido-humano` voltaria como "tipo desconhecido"); **2.** agente às 13:05. Antes de instalar: `session-manager.js` e `portals/comprasgov.js` eram os do dia (`26c9ad7b…`, `7f1f53d7…`), e `browser.js` (10/09) e `interacao-humana.js` (09/09) foram comparados linha a linha com os novos — a única diferença era a mudança deste item, nada de terceiros sobrescrito. Com 0 sessões ativas e 166 GB livres: backups `.bak-20260916-1305`, `node --check`, md5 **igual ao template** (`browser.js be156823…`, `interacao-humana.js 9aae410a…`, `session-manager.js 24eaba70…`, `portals/comprasgov.js 6eace3e6…`), `pm2 restart`. Depois: online, 14 rotas, 8 portais, 0 sessões, `portais_com_lance_liberado: []` pelo servidor e pelo domínio. **Ainda não provado em sessão real**: a volta direta do gov.br com sessão guardada, o aviso chegando ao sino dos admins e a primeira linha em `logs/logins.jsonl` — os três aparecem no próximo envio ao robô
- **16/09 — o teste da sessão guardada, em rodadas** (disputa do 7/2026 reagendada para 2 minutos à frente, despachada pelo agendador sem clique):

  | Rodada | O que aconteceu |
  | --- | --- |
  | **1ª — 13:13** | despacho sozinho às 13:13:00; Chrome **com o perfil** `perfis/comprasgov-46353b4f41d806ff` (primeiro uso); gov.br pediu o clique às 13:13:15; clique pela rota direta; autenticado às 13:14:33. Medição: `certificado-com-clique`, **93 s**, perfil persistente. Compra localizada e aberta às 13:14:44 e, pela primeira vez no portal de verdade, **"Item 1: modo Aberto, intervalo mínimo entre lances R$ 0,01"** — o clique em "Mostrar detalhes do item" achou o item certo. Sessão encerrada pela VPS às 13:15; perfil gravado (22 MB, só root), sem trava |
  | **2ª — 13:23** | despacho sozinho às 13:23:00; Chrome **com o mesmo perfil**; o gov.br **pediu o clique de novo** às 13:23:15. A sessão guardada não foi aproveitada. Encerrada pela VPS às 13:28 sem o clique (o resultado já estava dado); medição: `falhou`, 344 s |
  | **3ª — 13:31** | com o conserto dos cookies de sessão instalado (13:29). Os cookies da 2ª já tinham sido apagados, então o clique era esperado: pedido às 13:31:15, autenticado às 13:31:41, `certificado-com-clique` em **42 s**. Compra aberta, item lido de novo, sessão encerrada às 13:32:27 — agora com o motivo no log ("Encerrada a pedido, pelo painel"), do `index.js` novo. A preferência "continuar de onde parei" continuou gravada depois de o Chrome fechar |
  | **4ª — 13:34** | **o gov.br lembrou do login**: a tela remota mostrou a Área de Trabalho do Fornecedor sem captcha. Mas o robô caiu em 19 s com "botão de certificado não encontrado" — conferiu a tela cedo demais |
  | **5ª — 13:40** | com uma espera pela área logada instalada (13:38). **Lembrou de novo** (a foto das 13:40:04 já mostra a área logada), e o robô caiu igual, em 19 s. Causa real: no instante da conferência a aba **ainda passava pelo `acesso.gov.br`** a caminho do Compras.gov, e a espera só valia fora do gov.br — nunca chegou a rodar. Conserto: `destinoDoSso()`, que pergunta a cada segundo, por até 20 s, se apareceu o botão de certificado (tela de login) ou a área do fornecedor |
  | **6ª — 13:46** | **ponta a ponta, sem ninguém**: despacho às 13:46:00 → **"♻️ O gov.br lembrou do login — entrei sem certificado e sem captcha"** às 13:46:03, `sessao-reaproveitada` em **2 s** → compra localizada 13:46:09 → página aberta 13:46:13 → "Item 1: modo Aberto, intervalo mínimo R$ 0,01" e sessão ativa às 13:46:15. **15 segundos do agendador à sala, zero clique** |

  **Por quê** — conferido nos cookies do perfil (só nomes e validades, nunca os valores): o login do gov.br é o cookie **`Session_Gov_Br_Prod`**, **de sessão** (sem validade), e os da proteção anti-robô (`TS…`, `TSPD_101_DID`, `INGRESSCOOKIE`) também. **O Chrome apaga cookie de sessão toda vez que fecha**, a não ser que o perfil esteja em "continuar de onde parei". O que sobreviveu (`Govbrid`, um `GovbrUid…`, Google Analytics) não basta para entrar. Ou seja: a pasta do perfil funciona; guardar a pasta, sozinha, não guarda o login.

  **O conserto — provado na 6ª rodada**: antes de abrir, o robô liga `session.restore_on_startup = 1` nas preferências do perfil, marca a última saída como normal, abre o Chrome com `--restore-last-session` e fecha as abas que ele reabrir — restaurar é para os cookies, não para as abas. Junto, o login deixou de decidir num instante só (`destinoDoSso`). Instalados na VPS em 16/09 às 13:29 (`browser.js 598042d5…`, com `index.js c51ba9c9…` e a correção das desclassificadas) e às 13:44 (`portals/comprasgov.js ce919242…`), cada um com md5 igual ao template, 0 sessões e backup

  **O que as seis rodadas dizem, e o que ainda não dizem**:
  - o gov.br **lembrou do login 9 minutos** depois do clique (13:31 → 13:40) e **15 minutos** depois (13:31 → 13:46). Quanto tempo a sessão dura de verdade — horas, um dia — só a medição ao longo dos próximos pregões responde (`logs/logins.jsonl`, comando em §9);
  - o primeiro login de cada identidade continua pedindo o clique; os seguintes, dentro da validade da sessão do gov.br, não. Na prática: **um clique de manhã pode cobrir as disputas do dia** — hipótese a confirmar com a medição;
  - um pedido de clique às 13:13:15, 13:23:15 e 13:31:15 deve ter virado aviso urgente para os administradores (callback `pedido-humano`, webhook v39) — **ainda não conferido no banco**

  **Dois achados de caminho**:
  - **proposta desclassificada**: na tela do item 5 (vista pelo Ian na tela remota às 13:15 e gravada), 6 das 13 propostas estavam "Desclassificada", três no topo — o leitor tomava a primeira como melhor lance (R$ 2.000,00, contra R$ 2.785,00 da melhor válida). Corrigido e testado com o texto real (commit local, a instalar): desclassificada não conta como melhor lance nem como posição, e a proposta da própria empresa desclassificada faz o robô aguardar;
  - **a BAQPLAST (22.920.524/0001-33) tem proposta no 7/2026** — itens 1 (R$ 4.999,70, **8º lugar** às 11:04), 2 (R$ 4.247,70), 3 (R$ 5.579,20) e 5 (desclassificada). É o pregão que permite provar o "somos o líder?" ao vivo, o que não deu com a Santa Rosa: basta uma disputa cadastrada para a BAQPLAST
- [ ] Medir: depois de alguns pregões, contar os desfechos em `logs/logins.jsonl` e registrar aqui quantos logins o perfil guardado evitou e **por quanto tempo** o gov.br mantém a sessão
- [x] **Avisos de pedido humano conferidos no banco** (16/09): três linhas "🧑 Robô esperando uma pessoa — 07/2026", criadas às **13:13:15, 13:23:15 e 13:31:16** — o segundo exato de cada pedido de clique das rodadas 1, 2 e 3. Uma linha por pedido indica **um único administrador da plataforma** cadastrado; o aviso simples para quem enviou ("⏳ Robô aguardando verificação") não saiu porque quem enviou a disputa é esse administrador. Quem não é admin (a conta do Ian, hoje) não vê o aviso urgente no sino
- [ ] Sessão encerrada no meio do login: hoje o login ainda tenta de novo depois de o Chrome fechar e manda o aviso "Robô parou" — ruído quando a parada é intencional (visto na 2ª rodada, 13:28). O laço de tentativas deve parar quando a sessão já não está ativa
- [x] **Vigia da sessão** (D12) — escrito em 16/09 em `src/vigia-sessao.js` (template), com 8 testes em `sessao-persistente.test.ts`:
  - a cada **20 minutos** (`VIGIA_SESSAO_MIN` no `.env` da VPS; `0` desliga), abre cada perfil `perfis/comprasgov-*`, passa pelo gov.br (`destinoDoSso`) e fecha — **renova** a sessão se ela vence por inatividade, e **mede**: cada conferência vira linha em `logs/logins.jsonl` (`vigia-logado`, `vigia-vencida`, `vigia-perfil-indisponivel`, `vigia-erro`);
  - **não faz login**: sessão vencida só volta com o clique, que acontece quando uma disputa entrar (o aviso vai aos administradores). Perfil vencido só é conferido de novo depois que uma disputa logar nele — não fica batendo no gov.br sem poder entrar;
  - **nunca disputa a pasta com uma disputa**: perfil em uso é pulado; e a sessão agora **reserva** o perfil antes de abrir o Chrome e, se o vigia estiver conferindo, **espera ele soltar** (segundos) em vez de cair para perfil temporário — o que traria o captcha de volta;
  - o `/health` ganhou `vigia_sessao`, com o último resultado de cada perfil — diz, sem abrir log, se a próxima disputa entra sem captcha;
  - o Chrome do vigia aparece por alguns segundos na tela remota a cada conferência — é ele, não uma disputa
- [x] **Vigia no ar** — 16/09 às 14:06, com o OK do Ian: `index.js fd609c2b…`, `session-manager.js f397e224…` e `vigia-sessao.js 2c80e779…` (novo) na VPS, md5 igual ao template, 0 sessões, backups `.bak-20260916-1406`; conferido antes que `index.js` e `session-manager.js` diferiam dos instalados só pelas linhas do vigia. O vigia faz a primeira conferência 2 minutos depois de o agente subir. **Primeira conferência às 14:08:46**: `{"perfil":"comprasgov-46353b4f41d806ff","desfecho":"vigia-logado","segundos":4}` — a sessão guardada continuava valendo **37 minutos depois do clique das 13:31**
- [x] **O robô pode ser agendado com qualquer antecedência** (pergunta do Rafael, 16/09) — o campo de data não tem limite, a data fica no banco, e o job de um minuto só olha as disputas dos próximos 15 minutos: nada fica rodando durante meses. Condições para dar certo no dia: data e hora preenchidas, robô da empresa ligado, certificado A1 ainda válido (ele vence em um ano) e **proposta cadastrada no portal no prazo do edital** — hoje pela operadora; pelo robô é a Fase 3
- [x] **Duas falhas do agendador corrigidas** (16/09, pedido do Ian), que pesam justamente com meses de antecedência:
  - **pregão remarcado depois do despacho** não voltava para a agenda — a marca `enviada_em` ficava. Migration `20260916000004`: um gatilho no banco limpa a marca (e zera as tentativas) quando a data da sessão **muda de verdade**, por qualquer caminho — tela, Lovable ou SQL; salvar sem mexer na data não rearma nada;
  - **falha passageira na hora** (robô sem resposta, tempo estourado, erro 5xx ou 429) custava o pregão. Agora o agendador tenta de novo no minuto seguinte, **até 5 vezes** (`tentativas_envio`), avisa na primeira falha ("🔁 tentando de novo") e com urgência só se desistir. Falha de configuração (sem item, sem credencial, portal desconhecido, 4xx) segue sem nova tentativa — repetir não resolve;
  - junto, uma proteção: o agendador **não despacha disputa que já tem sessão viva** (sinal nos últimos 15 minutos) — a remarcada ou a enviada pelo botão —, porque duas sessões com o mesmo CPF e certificado derrubam uma à outra
- [x] **Push autorizado pelo Ian em 16/09**: os commits desde `10812e69` — estratégia com desempate, sessão persistente, vigia, correções do agendador, desclassificadas, tela do agendamento e os registros deste documento — foram para `origin` e `sete`, com o remoto conferido parado antes e nenhum segredo no diff. A tela `2026-09-16.3` passa a valer quando for publicada no Lovable
- [x] **Webhook com as correções do agendador no ar** — `robo-lances-webhook` **v40** em 16/09 às 14:09 (funciona antes do SQL: sem a coluna, segue sem nova tentativa)
- [x] **SQL `20260916000004` aplicado** em 16/09 no editor do projeto `uwtyuwktxalnpgrcbbgk` — coluna `tentativas_envio`, função `robo_disputa_remarcada_volta_a_agenda` e gatilho `trg_robo_disputa_remarcada`, com "Success". A partir daqui o webhook v40 tenta de novo nas falhas passageiras e a disputa remarcada volta para a agenda
- [x] **A tela de acordo com as regras novas do robô** (pedido do Ian, 16/09) — conferido e corrigido (versão `2026-09-16.3`, commits locais, a publicar):
  - **a data da sessão não aparecia em lugar nenhum**: o cabeçalho da disputa, o painel de ações e a lista de participações mostravam só o horário. Agora os três dizem a data e **quando o robô entra sozinho** ("Sessão 23/10/2026 às 08:45 · o robô entra sozinho às 08:30"), a partir de uma função única (`src/lib/robo/agendamento.ts`, 6 testes);
  - **só o horário, ou só a data, não agenda — e a tela não dizia**: agora o formulário avisa ao vivo ("Falta a data: sem ela, o robô não entra sozinho — só pelo botão"), e as três telas também;
  - **data sem horário virava meia-noite**: o formulário gravava a sessão às 00:00, e o agendador despacharia o robô às 23:45 da véspera. Sem horário, agora não grava instante nenhum;
  - **item sem piso salvava calado**: o rodapé do cadastro avisa quantos itens estão sem piso (quando também não há piso geral) e quantos estão em "Desempatar no 1º lugar" sem margem — sem impedir salvar, porque a disputa pode ser completada depois;
  - **a estratégia de cada item** aparece na página da disputa, embaixo do piso ("Iminência", "Desempatar no 1º lugar · margem R$ 10,00"), sem coluna nova
- [x] **Avisos ao usuário** — escrito em 16/09. O webhook passou a avisar em três momentos novos: **robô entrou na sala** (callback `sessao-ativa`, criado no agente), **lance recusado pelo portal** e **robô parou com erro**. Os dois últimos são urgentes, e todos levam para a página da disputa. Junto veio um conserto: o agente já enviava `lance-recusado` e o webhook respondia "tipo desconhecido" — o aviso era descartado, como havia acontecido com `rodada-sem-lance` em 08/09. O lance recusado agora entra no histórico com o motivo do portal, **sem** avançar o valor atual, e a linha do tempo da disputa deixa de chamá-lo de "enviado". Falta publicar a função e instalar o agente na VPS (abaixo)
- [x] Publicar o webhook e instalar o agente — feito em 16/09 na ordem obrigatória (função antes do agente, senão o `sessao-ativa` voltaria como "tipo desconhecido"): `robo-lances-webhook` **v32** às 10:17, e o `session-manager.js` na VPS com md5 **igual ao template** (`a452c25a…`), backup `.bak-20260916-1005`, `pm2 restart` e `/health` respondendo online, 14 rotas, `portais_com_lance_liberado: []`
- [ ] **Acompanhamento sem tela remota (D13)** — ordem definida em 16/09: vem antes de "uma aba por pregão"
  - [x] **o robô envia o estado da sala** — escrito em 16/09: callback `estado-da-sala` quando algo muda, ou a cada 30 s como sinal de vida (item, melhor lance, nosso lance, posição, lidera, propostas válidas e desclassificadas, modo, intervalo, fase, estratégia e a decisão da rodada com o motivo). Substitui o `rodada-sem-lance`. O módulo do Compras.gov ganhou `resumoDaClassificacao`, sobre a mesma leitura em cache. 4 testes novos no laço
  - [x] **`lance-concorrente` só quando o melhor lance muda** e não é nosso (a primeira leitura da sessão não conta); o webhook deixou de gravar o valor do concorrente em `sessoes_lance_real.valor_atual` — escrito em 16/09, com testes
  - [x] **o webhook grava** `estado_sala` (com o motivo em linguagem de cliente), e `melhor_lance`, `seu_ultimo_lance`, `sou_lider` e `situacao` em `sessao_lance_itens` — escrito em 16/09; migration `20260916000005` **aplicada pelo Ian** em 16/09 ("Success")
  - [x] **linha do tempo** em `robo_eventos_sessao`, na aba Eventos junto das sessões e dos lances: primeiro retrato da sala, liderança assumida ou perdida, mudança de posição, desclassificação, fase, motivo novo para aguardar, entrou, verificação do gov.br, erro e encerramento. O mesmo estado repetido não vira linha. A regra mora em `_shared/robo-estado-da-sala.ts` (10 testes) — escrito em 16/09
  - [x] **quadro de status** no topo da aba Acompanhamento (`QuadroDaSala`, texto em `src/lib/robo/quadro-da-sala.ts`, 6 testes): "Robô na sala — Item 1 · Modo aberto · 8º lugar · Melhor R$ 3.100,00 · Nosso R$ 4.999,70", o motivo embaixo, a hora da leitura, e aviso quando o robô fica 2 minutos sem dar notícia — escrito em 16/09, versão `2026-09-16.4`
  - [ ] pôr no ar — servidor feito em 16/09: `robo-lances-webhook` **v41** às 14:38; na VPS, `session-manager.js` (md5 `af8444ea…`) e `portals/comprasgov.js` (`1e715087…`) iguais ao template, backups `.bak-20260916-1439`, 0 sessões antes do `pm2 restart` das 14:39, `/health` online, 14 rotas, trava `[]`, vigia ligado. Push feito em 16/09 às 15:10 nos dois remotos (`5ba8d0ae..7fb4bbd7`), com tipos, lint e 165 testes do robô verdes. **Falta** o Publish da versão `2026-09-16.4` no Lovable (o domínio servia a `2026-09-16.2` às 15:10)
    - achado ao conferir: **o preview da Cloudflare (`praefectus-preview.pages.dev`) serve a versão `2026-09-04.6`** — não recompila desde 04/09, apesar dos pushes no `sete`. O push chega ao GitHub (hash conferido), então o problema está do lado da Cloudflare (build falhando ou integração desligada); só quem tem acesso ao projeto `praefectus-preview` consegue ver os deploys
  - [ ] prova com uma disputa da BAQPLAST no 7/2026: 8º lugar no item 1, R$ 4.999,70, visível no quadro e nas colunas — **provada no banco em 16/09**; falta ver na tela depois da publicação da `2026-09-16.4`
    - preparo: a BAQPLAST já existia no Praefectus, com o robô ligado (sem linha em `robo_empresa_config`), mas o usuário dono da credencial do Compras.gov e do agente não era membro dela. O agendador tira agente e credencial do dono da disputa, e o CNPJ, da empresa; a tela só mostra a disputa a membro da empresa. O Ian entrou na BAQPLAST como `viewer` e cadastrou uma cópia da disputa do 7/2026 em nome dela, marcada para 2 minutos depois
    - **14:55:01** o agendador despachou sozinho (sessão `3508533b`); o gov.br lembrou do login em 2 s, sem certificado e sem captcha; compra localizada e item 1 lido às 14:55:15 (modo Aberto, intervalo R$ 0,01); a sessão ficou ativa às 14:55:16 e leu a sala a cada ~34 s, sem lance (trava `[]`)
    - **no banco** (consulta do Ian, 14:59): `estado_sala` com posição **8**, nosso lance **4999.7**, melhor **3100** e o motivo "Só acompanhando: o envio de lances ainda não foi liberado para este portal"; em `sessao_lance_itens`, item 1 com melhor 3100, nosso 4999.7, `sou_lider` false, situação aguardando
    - **linha do tempo**: exatamente 4 eventos — 14:55:16 *entrou* ("Robô entrou na compra 07/2026 · modo Aberto · intervalo mínimo R$ 0,01"), 14:55:49 *acompanhando* ("empresa em 8º lugar (R$ 4.999,70) · melhor R$ 3.100,00"), 14:55:49 *aguardando* e 15:00:25 *encerrou* ("Encerrada a pedido, pelo painel · 0 lance(s) enviado(s)"). As rodadas 2 a 9, com o mesmo estado, não geraram linha — como deve ser
    - encerrada pela VPS às 15:00:25, 14 capturas do gravador; `/health` voltou a 0 sessões
  - [ ] **o agendador confere se o dono da disputa ainda é membro da empresa** antes de despachar. O envio pelo botão recusa quem não é membro; o agendador não confere. Então quem saiu da empresa, ou uma disputa gravada direto no banco, continua mandando o robô entrar com a credencial dessa pessoa. Achado em 16/09, ao montar a prova da BAQPLAST

**Fase 8 — o robô conversa com o processo, o calendário e os avisos** (pedido do Ian em 16/09; aprovada para vir **antes da Fase 7**)

> O que já existe (conferido no código em 16/09): a disputa nasce da pasta do
> processo e puxa itens e horário; a página da disputa mostra a data do
> processo; toda notificação aparece na hora como toast, com som e contador
> (`AppLayout`, realtime em `notificacoes`) — os avisos do robô já saem
> assim; o calendário mostra os processos pela data de abertura e de
> encerramento e exporta `.ics`. O que falta: nenhum lembrete de pregão com
> robô agendado; o cadastro puxa do processo só a hora, não a data (sem data,
> o robô não entra sozinho); a data do processo mudar não chega à disputa; o
> calendário não sabe que o robô está agendado; o resultado da disputa não
> move o kanban sozinho.

- [x] **O cadastro puxa data e hora da sessão do processo** — escrito em 16/09 (`sessaoDoProcesso` em `src/lib/robo/agendamento.ts`, 6 testes; versão `2026-09-16.5`). Antes vinha só a hora, lida em UTC. Agora vêm data e horário lidos em Brasília: da abertura quando existe, senão do fim do prazo de propostas — no Compras.gov, praticamente a hora da sessão (7/2026: propostas até 08:59, sessão às 09:00). A tela diz de onde veio e pede conferência no edital; horário antes das 8h aparece em destaque. Diagnóstico que definiu a regra (consulta do Ian, 20 processos mais recentes): 19 com `data_abertura` vazia e `data_encerramento` igual ao fim do prazo de propostas do PNCP; 1 pasta manual com as duas
- [ ] **Horário do PNCP gravado com o fuso errado** — achado em 16/09 ao fazer o item acima, **a decidir** porque vai além do robô (calendário, painel, alertas de prazo). O PNCP manda as datas sem fuso, no horário de Brasília (`"dataEncerramentoProposta": "2026-09-14T08:59:00"`, conferido na API para o 7/2026). O `crawler-pncp` acrescenta `-03:00`; o `pncp-sync-diario` (três vezes ao dia, com upsert que sobrescreve), o `busca-licitacoes` e o `semear-acervo-pncp` (via `_shared/pncp-cache.ts`) gravam o texto cru, que o banco lê como UTC. Resultado: o prazo aparece **3 horas adiantado** em quase todos os processos do diagnóstico (05:00, 06:00, 07:00 em vez de 08:00, 09:00, 10:00). Conserto: os três gravadores usarem a mesma correção do crawler, e os processos e editais futuros serem relidos do PNCP. Enquanto isso, o cadastro da disputa sinaliza horário antes das 8h
- [x] **Lembrete de prontidão na véspera e 1 hora antes**, com a checagem junto — escrito em 16/09. O agendador, no mesmo minuto em que despacha, olha as disputas não enviadas das próximas 24 horas e manda o lembrete da véspera (24 h antes) e o de 1 hora antes, cada um uma vez (colunas `lembrete_vespera_em` e `lembrete_1h_em`, migration `20260916000006`; a remarcação as zera). A checagem, em `_shared/robo-prontidao.ts` (14 testes): **impede o robô** — robô da empresa desligado, sem agente, portal desconhecido, sem credencial, sem UASG no Compras.gov, sem itens, sessão do gov.br vencida (pelo vigia, no perfil da credencial), robô sem resposta; **só avisa** — itens sem piso, "Desempatar no 1º lugar" sem margem, trava de lance fechada ("o robô entra e só acompanha"). Avisa quem cadastrou e quem opera a empresa (admin/operador); sessão vencida ou robô sem resposta também chamam os administradores da Praefectus. Sai por `notificacoes`, então vira toast com som. Exemplo: "🗓️ Pregão amanhã às 09:00 — 07/2026 · Amanhã às 09:00 é a sessão do pregão 07/2026 (Compras.gov.br). O robô entra sozinho às 08:45. Conferido: robô ligado, credencial do portal cadastrada e itens prontos."
  - **no ar e provado em 16/09**: SQL `20260916000006` aplicado pelo Ian; `robo-lances-webhook` **v42** às 15:40 e **v43** às 15:46 (o "Conferido" passou a dizer "sessão do gov.br ativa (conferida às HH:MM)" quando o vigia confirmou); push `7fb4bbd7..9a47c5dd`. Teste: a disputa de prova da BAQPLAST remarcada para 50 minutos depois às 15:42:40 → às **15:43** chegou no sininho "⏰ Pregão em 1 hora — 07/2026 · Hoje às 16:32 é a sessão do pregão 07/2026 (Compras.gov.br). O robô entra sozinho às 16:17. Conferido: robô ligado, credencial do portal cadastrada e itens prontos. Atenção: o envio de lances ainda não foi liberado para este portal: o robô entra e só acompanha."; depois do teste, a disputa de prova é desmarcada (`inicio_sessao = NULL`)
- [x] **Aviso do robô também no canto da tela** (pedido do Ian em 16/09: "além do sininho, um toast — não é para substituir") — escrito em 16/09, versão `2026-09-16.6`. `LembreteDoRobo`, no mesmo desenho e na mesma pilha dos lembretes de certidão e de convocação: título, "Robô de Lances · há 5 min", a mensagem e o botão para onde leva ("Abrir a disputa", "Abrir a tela remota do robô"). Faixa vermelha para urgente/alerta, amarela para lembrete, verde para informativo. Fica até ser dispensada, e aparece também para quem abre o sistema depois (avisos do robô não lidos das últimas 24 horas, até 3 visíveis). Dispensar **não** marca como lida: o sininho continua sendo o registro. O toast simples que o `AppLayout` mostrava para toda notificação deixa de sair para as do robô, que viraria o mesmo aviso duas vezes. Regra em `src/lib/robo/avisos-do-robo.ts` (8 testes)
- [x] **O sininho chama quando chega aviso do robô** (pedido do Ian em 16/09) — escrito em 16/09, versão `2026-09-16.6`. Treme de leve (um balanço curto a cada 2,4 s) e brilha enquanto houver aviso do robô não lido que chegou depois da última vez que o painel foi aberto; abrir o painel para os dois, mesmo sem marcar como lida. Só com movimento permitido no sistema (`motion-safe`): quem desliga animações vê o contador, sem balanço
- [x] **O vigia avisa os admins assim que a sessão do gov.br vence** — escrito e no ar em 16/09 (`robo-lances-webhook` **v44**, 16:04). O agendador, a cada 5 minutos, lê o `/health` de cada robô ativo; conferência vencida que ainda não virou aviso (marca `vigia-sessao-vencida` no `webhook_log`, chave perfil + instante) vai aos administradores da Praefectus — ou ao dono da conta, se não houver administrador —, com a próxima disputa agendada daquela conta: "🔐 Sessão do gov.br venceu — Compras.gov.br · O vigia do robô encontrou a sessão do gov.br vencida na conferência das 16:00. Na próxima entrada, o robô vai pedir a confirmação do acesso pela tela remota (clique em \"Seu certificado digital\"). Próxima disputa: 07/2026, amanhã às 09:00 — o robô entra às 08:45. Fique de olho nesse horário." Regra em `_shared/robo-prontidao.ts` (3 testes novos). **Limite**: o aviso antecipa o horário do clique, mas ainda não permite renovar a sessão antes — o vigia não faz login de propósito; um botão "renovar agora" na área admin é o passo seguinte, se desejado
  - **toast e sininho vistos na tela pelo Ian às 16:02** (pré-visualização do Lovable): o lembrete "⏰ Pregão em 1 hora" com a faixa de lembrete, os "Robô na sala" com a faixa verde, "e mais 13 avisos do robô" e o sininho com o brilho
- [ ] **Pregão remarcado**: a data do processo mudou e a disputa ainda não foi enviada → a disputa acompanha a data nova, com aviso a quem cadastrou
- [ ] **Marcador no calendário**: "robô agendado" no dia do processo, com a hora em que o robô entra
- [ ] **Canal fora do sistema** (e-mail ou WhatsApp) para os avisos urgentes do robô — o captcha e a falha ao entrar — e para o lembrete de prontidão
- [ ] **Kanban automático**: o resultado da disputa move o processo sozinho — só depois de mapear o encerramento na sala (Fase 1); hoje o registro é pelo botão

**Fase 7 — vários pregões ao mesmo tempo** (pergunta do Ian em 16/09; depois do acompanhamento e da Fase 8)
- [ ] **Um navegador por empresa, uma aba por pregão**: a segunda disputa da mesma identidade abre aba nova no Chrome já logado, em vez de um Chrome com perfil temporário; o Chrome fecha quando a última disputa da empresa termina; o vigia convive com ele
- [ ] **Todos os itens do pregão**, e não só o primeiro: o laço acompanha cada item configurado, com o piso e a estratégia dele
- [ ] Testes simulando duas disputas da mesma empresa ao mesmo tempo, antes de instalar
- [ ] Prova ao vivo: dois pregões no mesmo horário, ou um pregão real com vários itens
- [ ] Observar se um segundo login do mesmo CPF derruba o primeiro (hoje, risco não testado)

**Fase 5 — liberar o lance**
- [ ] Com a sala lida e a estratégia testada, antes do pregão B: `PORTAIS_COM_LANCE_LIBERADO = ['comprasgov']`, com o registro "autorizado por Giovanny Valente e Rubens, 14–15/09/2026"
- [ ] Pregão B — primeiro lance do robô, num item com piso real, acompanhado pela tela remota do admin; lance recusado ou leitura errada devolve a trava a `[]` na hora

**Fase 6 — checklist do grupo** (na nossa lista por ora)
- [ ] Buscar os itens do edital no PNCP a partir de UASG + número/ano, no cadastro manual da nova sessão
- [ ] Marca e modelo como colunas editáveis na grade, pré-preenchidas do termo de referência quando houver
- [ ] Painel da disputa com órgão, objeto, SRP, modo de disputa, critério e data da sessão vindos do PNCP

#### 16/09 — a sessão do Compras.gov aberta o dia todo: o que já está assim e o que falta

Registro feito depois das seis rodadas do teste da sessão guardada (Fase 4) e
da autorização D12.

**O captcha deixa de ser a cada disputa.** Com o perfil guardando os cookies de
sessão, o gov.br devolve o robô já logado enquanto a sessão dele valer — provado
às 13:46, login em 2 s, sem certificado e sem captcha. O clique só volta:

1. no **primeiro login** de cada identidade (o titular do certificado) depois
   que a sessão do gov.br vence;
2. se a sessão **vencer entre uma disputa e outra**.

**O que ainda não se sabe é quanto a sessão do gov.br dura.** Medido até agora:
pelo menos 15 minutos (13:31 → 13:46). E o tipo de validade decide o caminho:

| Se a sessão vence… | Caminho |
| --- | --- |
| **por inatividade** (ninguém usa por X minutos) | **manter a sessão viva**: o robô entra rapidamente no Compras.gov de tempos em tempos, sem disputa — o clique fica para quando o gov.br forçar novo login |
| **por tempo fixo** (ex.: 8 h depois do login) | **aquecimento diário**: numa hora marcada o robô faz login, o administrador recebe o aviso e clica uma vez, e as disputas do dia entram sozinhas |

Com a D12 autorizando a sessão aberta o dia todo, os dois caminhos cabem numa
peça só: um **vigia da sessão** no agente, que de tempos em tempos confere se o
perfil ainda está logado — e, ao conferir, **renova** a sessão se ela vence por
inatividade, e **mede** quando ela vence de qualquer jeito. Cada conferência vira
linha em `logs/logins.jsonl`, sem ninguém precisar reagendar disputa de teste.

**Já está assim? — o que o robô faz hoje, conferido no código e no ar (16/09):**

| O que o cliente pediu | Hoje |
| --- | --- |
| Entrar **sozinho** na disputa configurada no Praefectus | **Sim.** O job de um minuto (`robo-disparar-agendadas`, job 32) despacha toda disputa com **data e hora da sessão** preenchidas que começa nos próximos 15 minutos, com o robô da empresa ligado — sem clique. Provado em 16/09 às 10:56 e em seis rodadas à tarde. Disputa sem data continua dependendo do botão |
| Não pedir captcha a cada disputa | **Sim, dentro da validade da sessão do gov.br** — provado às 13:46 |
| Manter a sessão aberta o dia todo | **Não ainda.** Nada renova a sessão entre uma disputa e outra — é o vigia, próximo passo |
| Entrar na **sala de disputa logada** e dar lance | **Não ainda.** O robô chega à página pública da compra, lê itens, modo, intervalo e classificação; a sala logada só aparece com pregão em andamento (Fase 1) e o lance segue travado (Fase 5) |
| Relogar sozinho quando a sessão vencer | **Não é garantido por ninguém**: o hCaptcha do gov.br pediu clique em 10 de 16 logins entre 10 e 14/09. Quando pedir, o aviso urgente chega aos administradores na hora (conferido no banco: 13:13:15, 13:23:15, 13:31:16) |

**Conferência da compilação feita pelo Gemini em 16/09**, separando fato de
interpretação:

| O que a compilação disse | O que é |
| --- | --- |
| Nos vídeos 3 e 4 o Giovanny lê e comenta "manter o navegador logado o dia todo" / "já mantém uma sessão automatizada" | **Não está na transcrição** dos vídeos registrada em 15/09 — lá, o vídeo 3 fala de API de dados abertos e de "automação de navegador via nuvem ou extensões", e o vídeo 4, de RPA "o máximo automatizado possível". A autorização da sessão aberta é a D12, do Rafael, repassada pelo Ian |
| "O front-end chama /sessao/iniciar" e o robô abre "instância limpa do Chromium" | **Desatualizado**: desde 16/09 quem chama é o **agendador**, sozinho, e o Chrome abre com **perfil persistente** |
| "Faz o login via certificado A1 na hora" | Só quando a sessão do gov.br não vale mais; dentro dela, entra direto |
| "O gov.br derruba por inatividade, geralmente após algumas horas" | **Não medido** — é o que o vigia vai responder |
| "Relogar automaticamente com o certificado se expirar" | Tentar, sim; garantir, não — o hCaptcha pede gesto humano na maioria das vezes |
| "Colisão de sessão se a Izabelle entrar com o mesmo certificado" | **Risco plausível, não observado.** A observar: se a operadora entrar com o CPF do Rafael enquanto o robô está logado, anotar quem cai |
| "Navegar até a sala de lances" | Depende do mapeamento da sala logada (Fase 1) |

#### 16/09 — acompanhar a disputa sem a tela remota (D13)

**O que já existe na tela**, feito pelo XFIN em 14/09, na página de cada
disputa (`/robo-lances/disputa/:id`): a aba **Acompanhamento**
(`AcompanhamentoDaDisputa`: estado do robô, último sinal, parada), a tabela de
itens com as colunas **Seu último lance**, **Melhor lance** e **Situação**
(`ItensDaDisputa`, lendo `sessao_lance_itens`) e a aba **Eventos**
(`EventosDaDisputa`, lendo sessões e `lances_historico`).

**O que falta é o robô alimentar essa tela.** A cada rodada ele já lê o melhor
lance, a posição da empresa, se ela lidera, o modo de disputa, o intervalo mínimo
e decide o que fazer, com motivo — e **não manda nada disso ao Praefectus**
além do número da rodada. Ninguém grava `melhor_lance`, `seu_ultimo_lance`,
`sou_lider` ou `situacao` em `sessao_lance_itens`: as colunas ficam sempre
"não informado", e os eventos só mostram início e fim de sessão.

**Um defeito no mesmo caminho**: o callback `lance-concorrente` sai **a cada
rodada** em que o melhor lance é menor que o valor atual da sessão — não só
quando o melhor lance muda —, e o webhook grava o valor do concorrente em
`sessoes_lance_real.valor_atual`, o campo do **nosso** valor. Numa disputa real,
encheria o histórico a cada 30 s e mostraria o preço do concorrente como se
fosse o nosso.

Registro das falas: a compilação feita pelo Gemini em 16/09 cita frases dos
vídeos ("historizador", "pode ficar oculto") que **não estão na transcrição**
registrada em 15/09; o que está registrado é a mensagem de WhatsApp de 15/09. A
direção é a mesma.

**O plano, em três partes:**

1. **O robô envia o estado da sala** quando algo muda, e no máximo a cada 30 s
   se nada mudar: item, melhor lance, nosso lance, posição, se lidera,
   propostas válidas e desclassificadas, modo, fase, intervalo mínimo e a
   decisão da rodada com o motivo. O `lance-concorrente` passa a sair só quando
   o melhor lance muda.
2. **O webhook grava** nas colunas que a tela já lê (`sessao_lance_itens`) e
   registra na linha do tempo só o que importa: entrou na sala, assumiu ou
   perdeu a liderança, lance enviado, lance recusado, aguardando (com o motivo,
   quando ele muda), encerrou. E deixa de gravar o valor do concorrente no campo
   do nosso valor.
3. **Um quadro de status** no topo da aba Acompanhamento, em uma linha:
   "Robô na sala · Modo aberto · 8º lugar · Melhor R$ 3.100,00 · Nosso
   R$ 4.999,70 · Aguardando: estratégia de iminência" — e a linha do tempo
   embaixo, na aba Eventos.

**Como provar sem pregão ao vivo**: uma disputa da **BAQPLAST** no 7/2026 — a
proposta dela está em **8º no item 1** (R$ 4.999,70, captura das 11:04) — deve
aparecer assim no quadro e nas colunas.

#### 16/09 — vários pregões ao mesmo tempo, no Compras.gov

Pergunta do Ian em 16/09. O que o robô faz hoje:

| Situação | Hoje |
| --- | --- |
| **Empresas diferentes** ao mesmo tempo (cada uma com seu certificado) | **Funciona**: cada sessão tem o próprio Chrome e o próprio perfil. O servidor (8 GB de RAM, 4 núcleos) comporta **até 8 sessões** simultâneas (`MAX_SESSOES_PARALELAS=8`, ~500 MB cada) |
| **A mesma empresa em dois pregões** ao mesmo tempo | **Não funciona bem.** O Chrome não abre a mesma pasta de perfil duas vezes: a segunda sessão entra com perfil temporário, faz login do zero, e o captcha pede clique. E um segundo login do mesmo CPF **pode derrubar a sessão do primeiro pregão** — risco real, **não testado** |
| **Um pregão com vários itens** | O robô acompanha **só o primeiro item** da disputa |

**O caminho — o dos robôs de mercado: um navegador por empresa, uma aba por
pregão.** A empresa tem um Chrome logado (o mesmo que o vigia mantém vivo); cada
pregão daquela empresa abre uma aba nova nele — sem login, sem captcha, sem
derrubar o outro —, e o Chrome só fecha quando a última disputa da empresa
termina. Dentro de cada pregão, o laço passa a acompanhar **todos os itens
configurados**, cada um com seu piso e sua estratégia.

Lembrete de escopo: esta automação de navegador é para o **Compras.gov**; outros
portais seguem por API (D1, D2).

#### O que depende de alguém

| O quê | De quem |
| --- | --- |
| A tela do robô do ConLicitação (ligar/desligar e grade) | Ian |
| Próximos pregões do Compras.gov com proposta da Santa Rosa, itens e piso aprovado | Izabelle / Rafael |
| Confirmar se algum item do checklist do grupo é do Giovanny | Giovanny |
| OK para trazer o remoto e publicar as três edge functions | Ian |

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
`src/components/robo-lances/test/agente-template.test.ts` que lê o texto gerado e falha se voltar.

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

#### 16/09 — o vocabulário da sala de disputa, pelo manual oficial

Antes de ver a sala por dentro, dá para reduzir o chute: o **Manual do Pregão
Eletrônico — Fornecedor** (Comprasnet/MP-SLTI) descreve a tela de lances campo
a campo. É o que o robô vai procurar quando entrar.

| O que a tela tem | Como o manual chama | Para que serve no robô |
| --- | --- | --- |
| Sinal colorido na linha do item | **"Indicador da proposta"** — verde: "o lance ofertado é menor para aquele item, sendo o vencedor até o momento"; vermelho: "houve um lance de valor inferior ao apresentado"; amarelo: proposta empatada | **É o `souLider`.** É esta a informação que falta hoje e sem a qual o robô não pode cobrir lance sem risco de cobrir a si mesmo |
| Número e descrição do item | "Número do item", "Descrição" | achar a linha do item que estamos disputando |
| Melhor lance do momento | **"Lance mínimo"** | o `lerMelhorLance` |
| Nosso último lance | **"Seu último lance"** | saber de onde partir, e não repetir valor |
| Relógio | "Horário oficial da sessão" — sempre Brasília | medir a iminência (os 2 minutos finais) |
| Campo de digitar | **"Lance"** | onde o valor é escrito |
| Botão | **"Enviar"** — "ao efetuar o envio, é solicitada confirmação do valor digitado" | o envio tem **dois passos**: enviar e confirmar |
| Estado do item | **"Situação"**: Fechado · Aberto · Suspenso · Cancelado · Encerrado | saber se o item aceita lance agora |

E uma regra do próprio sistema, que a estratégia tem de respeitar: o licitante
"poderá oferecer lance inferior ao último por ele ofertado e registrado pelo
sistema" — ou seja, cada lance nosso precisa ser menor que o nosso anterior,
não apenas menor que o melhor da sala.

**E o que a página pública de acompanhamento já entrega** — visto ao vivo em
16/09, com o robô dentro dela e o raio-X ligado. Abrindo um item, o portal
mostra, por item:

| Campo | Exemplo lido |
| --- | --- |
| Número, descrição e **descrição detalhada** | "1 NOTEBOOK", com a especificação inteira |
| Quantidade mínima, quantidade solicitada, unidade | 34207 · 34207 · Unidade |
| Critério de julgamento | Menor Preço |
| Valor estimado (unitário e total) | **Sigiloso** |
| Orçamento sigiloso | Sim |
| **Intervalo mínimo entre Lances** | **R$ 0,0100** |
| Tratamento diferenciado | "Sem benefícios ME/EPP (Art. 4º…)" · "Item de participação aberta" · "Cota reservada ME/EPP do item 4" |
| Margem de preferência e conteúdo nacional | Não · Não |
| Situação do item | "Aguardando julgamento" |

O que isso muda, concretamente: **o decremento mínimo não precisa ser digitado
por ninguém**. Ele é regra do edital, está publicado por item, e o robô pode
lê-lo do portal — e conferir contra o que foi cadastrado, do mesmo jeito que
já faz com a lista de itens. Um decremento menor que esse é lance recusado.

A estrutura, para escrever a leitura: o portal usa pares rótulo/valor com as
classes `cp-label` e `cp-valor-item` dentro de `div.col-sm-4.pt-2`
(`R$ 0,0100 → div.col-sm-4.pt-2 > div.cp-valor-item.cp-label`). Vale ler
**pelo texto do rótulo** e pegar o valor ao lado — classe de CSS muda a cada
atualização do portal, o rótulo não.

#### 16/09 — a lista de propostas de um item, por URL pública

Navegando a sessão pelo VNC, o Ian abriu o ícone de propostas de um item, e o
portal mostrou o que pode ser o caminho mais curto para a leitura da disputa:

```
https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras/acompanhamento-compra/item/<numero>?compra=<UASG><05><numero 5 dígitos><ano>
```

A aba **Propostas** lista, para cada fornecedor: **CNPJ**, razão social, **UF**,
**"Valor ofertado (unitário)"**, **"Valor negociado (unitário)"** e os selos
(ME/EPP, "Equidade de gênero (Ouro)", "Programa de integridade"), em **ordem
crescente de valor**. Cada linha expande ("Mostrar proposta do item") com
proposta, anexo e chat.

O raio-X, tirado com a tela aberta (item 3 do 7/2026), leu **11 valores de uma
vez**, todos no mesmo caminho:

```
div.cp-valor-item.cp-label > div.mb-half-half.ng-star-inserted > span > span
```

**Por que isto importa:** é o par que falta para o robô. O menor valor da lista
é o melhor lance do item, e a **posição do nosso CNPJ nessa lista** responde
"somos o líder?" — que é a pergunta que hoje trava o lance (§2). E vem de uma
página **pública**, sem login, por URL previsível a partir do que a disputa já
guarda (UASG + número + ano + número do item).

**Conferido nas 12 capturas da sessão** (trazidas da VPS em 16/09): o corte do
texto por CNPJ amarra cada valor ao seu dono, e a ordem da página é a
classificação. Itens 1, 2 e 3 do 7/2026 — **13, 12 e 11 fornecedores, todos em
ordem crescente**. Cada bloco entrega CNPJ, razão social, UF, selos (ME/EPP,
equidade, integridade) e o valor ofertado.

Duas coisas que as capturas ensinaram, e que viraram código:

- **Ler por texto, não por seletor.** Os valores saem todos no mesmo caminho
  genérico (`div.cp-valor-item.cp-label`), sem dizer de quem são; o CNPJ é o
  único marcador que separa um fornecedor do próximo.
- **A lista monta depois.** A captura das 11:06 saiu vazia e a das 11:08, na
  mesma tela, trouxe os 11 valores. Quem lê precisa esperar a lista existir —
  rede lenta não pode virar "nenhuma proposta", que o robô leria como sala
  vazia.

E um achado que muda o teste: **a Santa Rosa não tem proposta neste pregão** —
nenhum dos 12 CNPJs é o dela. O 7/2026 serviu para mapear a leitura; provar o
`souLider` exige um pregão em que a empresa realmente ofertou.

**Escrito e provado no mesmo dia.** O módulo do Compras.gov ganhou
`lerPropostasDoItem(numero)`, `melhorLanceDoItem(numero)` e
`souLiderNoItem(numero, cnpj)`. A prova não foi "compila": o parser do
**módulo gerado** foi rodado contra o **texto real** das capturas — itens 1, 2
e 3 devolveram 13, 12 e 11 propostas, todas com valor maior que zero, em ordem
crescente, com CNPJ, UF, selo ME/EPP e posição.

`souLiderNoItem` devolve `true` só quando o nosso CNPJ é o primeiro, `false`
quando está na lista e não é o primeiro, e **`null` quando não dá para
afirmar** (lista vazia ou CNPJ ausente). O nulo é o ponto: `decidirLance`
trata "não sei" como motivo para não dar lance — é o que impede o robô de
cobrir o próprio lance.

O caminho até aqui custou **seis defeitos pegos pelo teste do template**,
todos antes de qualquer coisa chegar ao servidor: duas crases em comentário
(que fecham o literal), um `replace` inútil que virou comentário e engoliu a
linha seguinte, e três expressões que perderiam as barras invertidas na
geração. Duas dessas não quebrariam nada visivelmente — `replace(/./g, '')`
apagaria o valor inteiro e `/R$s*(…)/` não casaria preço nenhum: o robô leria
"nenhuma proposta" numa sala cheia. É a razão de o teste existir.

**O que ainda falta confirmar:** se esta mesma página se atualiza **durante** a
sessão de disputa, com os lances chegando. O que foi visto é a etapa "seleção
de fornecedores", depois do pregão. Se atualizar, a leitura da disputa deixa de
depender da área logada; se não, ela vale como conferência e como fonte do
histórico. É a primeira coisa a olhar no próximo pregão ao vivo.

**O que isto não é:** prova. O manual descreve a tela do Comprasnet anterior à
reformulação de 2021, e o que está no ar é o Compras.gov novo (`cnetmobile`,
Angular/PrimeNG). Os nomes tendem a sobreviver — o portal reaproveita o mesmo
vocabulário —, mas o que vale é o que a gravação mostrar de dentro da sala. O
ganho é escrever a leitura **por texto** (procurar "Lance mínimo", "Situação",
o indicador colorido) em vez de por classe de CSS, que é o que se quebra a
cada atualização do portal.

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

> **Antes de tudo, desde 15/09** — dois itens que não estavam na lista e passam
> na frente dela (ver §1, "14–15/09 — a reestruturação do front pelo XFIN"):
>
> | # | O que | De quem depende | Destrava |
> | --- | --- | --- | --- |
> | 0a | **Deploy das três edge functions** do remoto — `robo-lances-webhook` (v30 → nova), `credenciais-portal` (v17 → nova), `normalizar-arquivos-documentos` (v3 → nova) — depois do `pull`, conferindo a versão no `functions list` | nós, com OK do Ian | o front publicado em `2026-09-15.1` conversar com o backend; os dois consertos de segurança entrarem no ar |
> | 0b | **O clique humano do gov.br** — direção dada em 15/09: sessão persistente do Chrome e login antes da hora, com aviso ao admin quando o captcha ainda aparecer. A lista de trabalho completa está em §1, "15/09 — o que foi decidido para o Compras.gov" | Ian | o robô do Compras.gov rodar sem ninguém na tela |

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
`src/components/robo-lances/test/envio-proposta-validacao.test.ts` e viraram `src/lib/robo/proposta.ts`.

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

# A bateria do robô inteira — desde 16/09 numa pasta só, src/components/robo-lances/test/
npx vitest run src/components/robo-lances/test

# Só a lista de portais, o certificado e o leitor da página da compra
npx vitest run src/components/robo-lances/test/agente-template.test.ts

# Só a decisão de preço e a estratégia (54 testes)
npx vitest run src/components/robo-lances/test/estrategia.test.ts

# Só o laço de lances, com portal falso e relógio simulado (9 testes)
npx vitest run src/components/robo-lances/test/laco-de-lances.test.ts

# Quanto o perfil persistente evita o captcha: desfechos de login, com e sem perfil
ssh -p 22022 root@129.121.48.145 'cd /opt/agente-lances && python3 -c "import json,collections; print(collections.Counter((l[\"perfil_persistente\"], l[\"desfecho\"]) for l in map(json.loads, open(\"logs/logins.jsonl\"))))"'

# As fotos que o robô tirou
ls capturas-robo/

# O que o remoto tem que o local não tem — sem pull (fetch só atualiza a referência)
git fetch origin
git log --format='%h %ad %an — %s' --date=format:'%d/%m %H:%M' HEAD..origin/feature/rebrand-ui-ux

# Onde a tela remota é renderizada, no remoto e no local
git grep -n "VncWebViewer" origin/feature/rebrand-ui-ux -- src
git grep -n "VncWebViewer" HEAD -- src

# Quais migrations e functions o remoto trouxe
git diff --stat HEAD..origin/feature/rebrand-ui-ux -- supabase/migrations supabase/functions

# Que versão de cada function está no ar, e de quando (a autoridade é esta, não o repositório)
npx supabase functions list --project-ref uwtyuwktxalnpgrcbbgk

# Uma migration foi aplicada? Sonda com a chave PÚBLICA (a do vite.config.ts), só leitura:
#   200 = tabela existe · 404 = não existe · "permission denied for table" = SELECT revogado
curl -s "https://uwtyuwktxalnpgrcbbgk.supabase.co/rest/v1/robo_empresa_config?select=*&limit=0" \
  -H "apikey: <chave pública>" -H "Authorization: Bearer <chave pública>"
```

> ⚠️ O `.env` aponta para outro projeto (`sbnlovigyifvrkgsoalj`); o app usa o
> que o `vite.config.ts` injeta (`uwtyuwktxalnpgrcbbgk`). Sondar pelo `.env`
> devolve 401/521 e parece que nada existe.

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
