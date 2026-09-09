# Agente Cloud — pendências no agente (VPS em v2.2.0)

Começou como diagnóstico em 16/08/2026, sondando
`https://agente.praefectus.com.br` de fora. Virou o registro de como as
pendências foram fechadas — e as especificações continuam valendo como contrato
para quem for reimplementar.

> ## ✅ Resolvido em produção em 02/09/2026
>
> As três pendências do agente foram implementadas **direto no código que roda
> na VPS** (`/opt/agente-lances`), que passou a **v2.2.0**. O botão "Testar
> freio" do Checklist de Ativação respondeu **"Freio de emergência confirmado
> pelo agente. Níveis 2 e 3 liberados."**
>
> O que sobra é o item 3 desta lista — a automação de navegador por portal —,
> que não é rota e sim trabalho de portal.

## Situação em uma olhada

| # | Pendência | Onde | Status |
| --- | --- | --- | --- |
| 1 | **`POST /kill-switch`** — freio de emergência | **agente** | ✅ **resolvido em 02/09 — níveis 2 e 3 liberados** |
| 2 | `POST /api/proposta/enviar` — envio da proposta | **agente** | ✅ rota no ar; responde 501 nomeando o portal cujo formulário falta |
| 3 | Declarar as rotas disponíveis no `/health` | **agente** | ✅ resolvido — campo `rotas` com as 6 |
| 4 | Heartbeat (sinal de vida) | Praefectus | ✅ resolvido — passamos a puxar via `/health` |
| 5 | Selo "Agente Online" mentiroso | Praefectus | ✅ resolvido — healthcheck real, três estados |
| 6 | Kill-switch anunciando parada não confirmada | Praefectus | ✅ resolvido — relata o resultado real |
| 7 | Níveis 2/3 sem freio comprovado | Praefectus | ✅ resolvido — bloqueados até o teste passar |
| 8 | Painel VNC bloqueado pela CSP | Praefectus | ✅ resolvido |
| 9 | Certificado negado apesar de instalado | Praefectus | ✅ resolvido — considera o relato do agente |
| 10 | `CRON_SECRET` compartilhado com o cron do PNCP | Praefectus | ✅ resolvido — usa a chave do próprio agente |
| 11 | Chave de cifra das senhas derivada da service role | Praefectus | ✅ **resolvido em 31/08** — ver seção 6 |
| 12 | Robô de Lances não parte da pasta do processo | Praefectus | ✅ resolvido — atalho em Módulos, processo ativo e pré-seleção |
| 13 | `src/portals/index.js` saía do gerador com sintaxe inválida | template | ✅ **resolvido em 31/08** — ver seção 8 |
| 14 | Checklist consultava `credenciais_portal` (singular) | Praefectus | ✅ **resolvido em 31/08** — ver seção 9 |
| 15 | "Certificado instalado" era verde sem arquivo existir | agente | ✅ **resolvido em 02/09** — ver seção 10 |
| 16 | "Healthcheck de Seletores" não testava seletor nenhum | Praefectus | ✅ **resolvido em 02/09** — ver seção 10 |
| 17 | **VNC servia tela vazia** — x11vnc morto e pm2 dizendo "online" | agente | ✅ **resolvido em 08/09** — ver seção 11 |
| 18 | **Chrome era headless** — nada para o VNC mostrar | agente | ✅ **resolvido em 08/09** — ver seção 11 |
| 19 | Portas 5900 e 6080 abertas na internet, x11vnc sem senha | agente | ✅ **resolvido em 08/09** — ver seção 11 |
| 20 | **Certificado detectado mas nunca apresentado ao portal** | agente | ✅ **resolvido em 09/09** — ver seção 15 |
| 21 | `browser.js` e `start-vnc.sh` não existem no template do repo | template | ❌ **aberto** — ver seção 11 |
| 22 | `/sessao/iniciar` só responde no fim da sessão — a chamada estoura antes | agente | ❌ **aberto** — ver seção 13 |
| 23 | **Licitações-e exige o Módulo de Segurança do BB** — o login por Chave J não é automatizável como está | agente | ❌ **aberto** — ver seção 14 |
| 24 | **A VPS tem 8 dos 23 módulos de portal** do template | agente | ❌ **aberto** — ver seção 14 |
| 25 | `compras-gov` (tela) × `comprasgov` (agente) — vocabulários diferentes | app | ✅ **resolvido em 09/09** — ver seção 14 |

## O que falta agora

**Uma coisa só, e ela não é rota:** o método `enviarProposta(dados)` e a
automação de lance em cada `src/portals/<portal>.js` da VPS. O contrato está
documentado em `base-portal.js`; os seletores dependem de abrir o portal e
olhar, e não podem ser escritos às cegas.

Enquanto nenhum portal implementar, `POST /api/proposta/enviar` responde **501
nomeando o portal** — que é o estado honesto: a rota existe, o formulário
daquele portal ainda não foi automatizado. O 404 anterior não distinguia as
duas coisas.

## Como o servidor foi acessado

Registrado porque descobrir isso custou uma tarde em 02/09/2026.

O Rafael tem **duas contas HostGator**. A `xfin` está vazia — o VPS dela
(`129.121.46.35`) foi cancelado em abril/2026 por falta de pagamento, e o painel
diz "Nenhum servidor ainda", o que leva à conclusão errada de que não há acesso.
A conta certa é a **`praefectusbrasil`**, com outro Google.

```
IP      129.121.48.145        VPS OCI NVMe 8
SSH     porta 22022           — a 22 e a 2222 estão fechadas
código  /opt/agente-lances
proc    pm2: agente-lances (cluster) + vnc-stack
proxy   nginx: agente.praefectus.com.br → http://127.0.0.1:3500
```

Acesso por chave: **VPS → Gerenciar → Chaves SSH → Adicionar chave**. A chave
entra sem senha e sincroniza sozinha com o servidor.

## O que foi aplicado em 02/09/2026

Três mudanças, **uma de cada vez, com verificação entre elas** — se as três
fossem juntas e o freio falhasse, o espaço de busca triplicaria.

**1. As rotas.** `killAll()` no `session-manager.js`, espelhando o `endSession()`
que já existia; `POST /kill-switch` e `POST /api/proposta/enviar` no `index.js`;
campo `rotas` no `/health`. Testado antes numa cópia completa do agente
(`/opt/staging-agente`, porta 3599) — 8 casos, do 403 sem chave ao 501 por
portal. Verificado pelo botão "Testar freio" do app, que é o caminho inteiro:
navegador → edge function → Cloudflare → agente → gravação no banco.

**2. `CALLBACK_URL` apontava para o projeto Supabase errado.**

```
antes   https://sbnlovigyifvrkgsoalj.supabase.co/functions/v1/robo-lances-webhook/callback
depois  https://uwtyuwktxalnpgrcbbgk.supabase.co/functions/v1/robo-lances-webhook/callback
```

Todo callback do agente — lance enviado, sessão encerrada, heartbeat — ia para
um projeto que não é o nosso. **Esta é a causa raiz do item 4 desta lista**, o
`ultimo_heartbeat` parado em 01/06: o Praefectus passou a *puxar* o `/health`, o
que resolveu o sintoma, mas os callbacks continuavam se perdendo. Com o
`/kill-switch` funcionando isso passou a importar mais — o `killAll()` avisa pelo
callback que a sessão morreu, e sem o destino certo o freio pararia o robô sem o
painel ficar sabendo.

**3. A porta 3500 estava aberta na internet.** `app.listen(PORT)` escutava em
`*`, então `http://129.121.48.145:3500/health` respondia direto, contornando o
Cloudflare e entregando versão, RAM, sessões e portais a qualquer um. Passou a
`app.listen(PORT, "127.0.0.1")` — o nginx continua alcançando, o mundo externo
não.

> **Por que não firewall:** ligar o `ufw` numa máquina com SSH em porta
> não-padrão (22022) derruba a sessão no mesmo instante se a regra não for criada
> antes. Bind no loopback resolve sem esse risco.

**Backups, na VPS:**

```
/opt/agente-lances.bak-2026-09-02-1536      diretório inteiro, v2.1.0
/opt/agente-lances/.env.bak-2026-09-02-1603 antes do CALLBACK_URL
/opt/agente-lances/src/index.js.bak-bind    antes do bind no loopback
/opt/agente-lances/package.json.bak-*       antes do bump de versão
```

## Uma lição sobre número de versão

A VPS e o template deste repo se declaravam **ambos v2.1.0** sendo código
diferente — a VPS rodava a versão de março, com 6 rotas e 9 portais; o template
já tinha crescido. Foi isso que escondeu por semanas qual código estava onde.

Agora as quatro fontes dizem a mesma coisa: `package.json`, `/health`, o `pm2` e
o log de boot. **Ao mexer no agente, mude a versão em todas.**

## O que o agente responde hoje (após 02/09/2026)

| Rota | Método | Sem chave | Situação |
| --- | --- | --- | --- |
| `/health` | GET | **200** | ✅ público, com o campo `rotas` |
| `/sessao/iniciar` | POST | **403** | ✅ existe e está protegida |
| `/sessao/pausar` · `/sessao/encerrar` | POST | **403** | ✅ |
| `/kill-switch` | POST | **403** | ✅ **existe** — com a chave, 200 |
| `/api/proposta/enviar` | POST | **403** | ✅ **existe** — com a chave, 501 por portal |
| `/vnc/vnc.html` | GET | **200** | ✅ serve a interface noVNC |
| qualquer rota inventada | POST | **404** | é o que prova que o 403 significa algo |

O par 403/404 é o teste que importa: **403 quer dizer "a rota existe e exige
chave"; 404 quer dizer "não existe".** Antes de 02/09, `/kill-switch` e
`/api/proposta/enviar` devolviam 404.

Payload do `/health` antes das correções, mantido como referência histórica —
hoje ele traz também o campo `rotas` e diz `"version": "2.2.0"`:

```json
{
  "status": "online", "version": "2.1.0", "uptime": 281393,
  "capacidade": { "max_sessoes": 8, "sessoes_ativas": 0, "slots_disponiveis": 8,
                  "ram_total_mb": 7936, "ram_livre_mb": 6870, "ram_por_sessao_mb": 500 },
  "sessoes_ativas": 0, "sessoes": [],
  "portais_suportados": ["comprasgov","bll","licitacoes-e","pncp","bec-sp",
                         "licitanet","portal-compras","bnc"],
  "certificado": { "carregado": true, "path": "./certs/certificado.pfx" }
}
```

Sondei ainda 13 variações de caminho (`/api/kill-switch`, `/sessao/parar`,
`/stop`, `/emergencia`, `/proposta/enviar`, `/docs`, `/openapi.json`…) — todas
404. Como `/sessao/parar` devolve 404 enquanto `/sessao/iniciar` devolve 403, o
roteamento acontece antes da autenticação: as rotas ausentes realmente não
existem, não é caso de renomear a chamada.

---

## 1. `POST /kill-switch` — RESOLVIDO em 02/09/2026

> Implementado na VPS: `killAll()` no `session-manager.js` e a rota no
> `index.js`. O botão "Testar freio" confirmou. **O contrato abaixo permanece
> como especificação** — é o que a rota cumpre, e o que qualquer reimplementação
> precisa continuar cumprindo.

### Contrato (mantido como referência)

**Quem chama:** edge function `robo-lances-webhook`, ação `kill-switch`, acionada
pelo botão de parada emergencial.

**Requisição enviada hoje:**

```http
POST /kill-switch
Content-Type: application/json
X-Agent-Key: <api_key_hash do agente>

{ "motivo": "Parada emergencial acionada pelo operador" }
```

**Resposta esperada:** `200` com corpo livre (o sistema só verifica `resp.ok`).
Efeito exigido: **encerrar imediatamente todas as sessões de lance em execução**
e não aceitar novas até liberação.

**Por que é grave:** o Praefectus encerra as sessões no seu banco (para de mandar
comandos), mas quem opera o navegador no portal é o agente. Sem essa rota, o robô
pode continuar dando lances depois do "pare". A tela agora avisa o operador em
vermelho quando o agente não confirma a parada — mas o aviso é um paliativo, não
a solução.

**Como a liberação acontece:** o Praefectus bloqueia os níveis 2 e 3 até o agente
provar que para. Não é manual nem por confiança — existe a etapa "Freio de
emergência verificado" no Checklist de Ativação, com o botão **Testar freio**,
que aciona `POST /kill-switch` de propósito (recusado pelo servidor se houver
disputa em andamento, para não abortar lances reais) e grava o resultado em
`agente_externo_config.capacidades.kill_switch`.

**O bloqueio lê o registro gravado, não consulta o agente na hora.** Então, depois
de qualquer mudança no agente, é preciso rodar "Testar freio" de novo — senão a
tela repete o último resultado conhecido, mesmo que a rota já funcione.

**Como validar do lado do agente:** implemente a rota, deixe o robô parado e peça
ao operador para clicar em "Testar freio". A requisição chega com
`{"motivo": "...", "teste": true}` — se preferir, trate `teste: true` como
verificação (responder 200 sem efeito) e a ausência do campo como parada real.

## 2. `POST /api/proposta/enviar` — ROTA RESOLVIDA em 02/09/2026

> A rota existe na VPS e responde: 400 para payload inválido, 400 para portal
> desconhecido, **501 nomeando o portal** cujo formulário ainda não foi
> automatizado, 503 sem slot de RAM, 500 com screenshot em caso de falha.
> **O que falta é o `enviarProposta()` de cada portal** — trabalho de portal, não
> de rota. O contrato abaixo permanece como especificação.

### Contrato (mantido como referência)

**Quem chama:** edge function `enviar-proposta-portal` (botão "Enviar Proposta"
na aba Proposta).

**Requisição enviada hoje:**

```http
POST /api/proposta/enviar
Content-Type: application/json
X-Agent-Key: <api_key_hash do agente>

{
  "action": "enviar_proposta",
  "portal": "comprasgov",
  "numero_pregao": "PE-044/2026",
  "credencial_id": "<uuid da credencial no cofre>",
  "empresa_id": "<uuid>",
  "itens": [{ "numero": 1, "descricao": "...", "quantidade": 10,
              "unidade": "UN", "valor_unitario": 1579.66,
              "marca": "...", "modelo": "...", "fabricante": "..." }],
  "declaracoes": { "me_epp": true, "inexistencia_fato": true,
                   "menor_aprendiz": true, "elaboracao_independente": true },
  "anexos_urls": ["https://..."],
  "user_id": "<uuid>",
  "timestamp": "2026-08-16T18:00:00.000Z"
}
```

**Resposta esperada:** `200` para aceite (o sistema registra a sessão como
`proposta_em_envio`); qualquer não-2xx é tratado como erro e mostrado ao usuário.

**Estado atual:** a rota existe e responde. Enquanto nenhum portal implementar o
`enviarProposta()`, ela devolve **501 nomeando o portal** — e o Praefectus trata
qualquer não-2xx como erro visível, com 502 e registro em `agent_acoes_log`.
A diferença em relação ao 404 anterior é que agora a mensagem diz *qual* portal
falta, em vez de sugerir que o agente está fora do ar.

**Segurança — já corrigido no Praefectus:** esta chamada usava o `CRON_SECRET`,
o mesmo segredo dos jobs de sincronização do PNCP; rotacionar o segredo do agente
derrubaria o cron junto. Agora ela envia a chave do próprio agente
(`agente_externo_config.api_key_hash`), como as demais chamadas. **O agente deve
aceitar essa chave** ao implementar a rota.

## 3. Declarar as rotas no `/health` — sugestão

Sondamos `HEAD` e `OPTIONS` para descobrir automaticamente quais rotas existem:
`HEAD` devolve 404 tanto para rota ausente quanto para rota que só aceita `POST`,
e `OPTIONS` devolve 204 para qualquer caminho (o handler de CORS captura tudo).
Ou seja, não há como o Praefectus saber o que o agente implementa sem tentar —
e tentar o `/kill-switch` às cegas abortaria uma disputa real.

Bastaria o `/health` incluir algo como:

```json
"rotas": ["GET /health", "POST /sessao/iniciar", "POST /kill-switch"]
```

Com isso, o sistema saberia de antemão o que está disponível, sem testes
invasivos.

## 4. Heartbeat — RESOLVIDO do lado do Praefectus

O agente nunca enviou sinal de vida: a coluna `ultimo_heartbeat` estava parada em
01/06/2026 e a tela dizia "Agente Online" lendo esse registro fóssil.

**Solução aplicada:** o Praefectus passou a **puxar** o sinal (nova ação
`robo-lances-webhook/healthcheck`, que consulta `/health` e atualiza versão, RAM,
sessões ativas e horário). Não é preciso mudar nada no agente.

Se ainda assim quiserem implementar o *push*, o destino é:

```http
POST https://uwtyuwktxalnpgrcbbgk.supabase.co/functions/v1/robo-lances-webhook/callback
X-Agent-Key: <api_key_hash>

{ "sessao_id": "<uuid>", "tipo": "heartbeat", "payload": { ...saúde... } }
```

## 6. Chave de cifra das senhas de portal — RESOLVIDO em 31/08/2026

> **Como foi resolvido:** a contagem de `credenciais_portais` deu **zero
> registros**. Sem senha cifrada em produção, a migração descrita abaixo não era
> necessária — não havia o que re-cifrar. A troca virou uma substituição direta:
>
> 1. segredo `CREDENCIAIS_ENCRYPTION_KEY` cadastrado nas Edge Functions;
> 2. `credenciais-portal` passou a derivar a chave dele, nunca mais da service
>    role, e a marcar o texto cifrado com o prefixo de versão `v2:`;
> 3. o `atob()` de retrocompatibilidade foi removido — formato desconhecido
>    agora falha alto, em vez de devolver lixo como se fosse senha.
>
> A derivação foi movida para dentro dos ramos `save` e `decrypt`: sem o segredo,
> `list` e `delete` continuam funcionando em vez de a tela inteira quebrar.
>
> Validado em produção com uma credencial de teste: gravou e leu de volta com
> `v2:` e 52 caracteres — os 3 do prefixo, 16 do IV e 32 do texto cifrado, em
> base64. Credencial de teste removida em seguida.
>
> **A ressalva de arquitetura abaixo continua valendo como leitura**, e é o
> motivo da mudança. O plano de migração em três passos fica registrado para o
> caso de a chave precisar ser rotacionada quando já houver senhas gravadas.

### Diagnóstico original (16/08)

As senhas dos portais são cifradas com AES-256-GCM antes de ir para o banco
(chave derivada por PBKDF2, 100 mil iterações, IV aleatório por senha) e a view
`credenciais_portais_safe` nunca as expõe. O desenho é sólido, **com uma ressalva
de arquitetura**: a chave de cifra é derivada da **service role key** do Supabase
— o mesmo segredo que dá acesso administrativo ao banco inteiro. Quem obtiver
essa chave decifra todas as senhas de portal.

**O que se ganharia:** um segredo dedicado (ex.: `CREDENCIAIS_ENCRYPTION_KEY`),
guardado à parte, cria uma segunda barreira: vazar o banco deixa de bastar.

**Por que não é uma mudança rápida:** todas as senhas já cifradas precisam ser
re-cifradas com a chave nova, sem janela em que alguma fique ilegível. Exige:

1. criar o segredo dedicado;
2. decifrar com a chave antiga e cifrar com a nova, registro a registro,
   aceitando as duas durante a transição;
3. só então remover o caminho antigo.

Perder a chave nova **inutiliza as senhas** (não há como recuperá-las) — por isso
merece planejamento próprio, com backup verificado antes de começar.

## 7. Robô de Lances desconectado da pasta do processo — PLANEJADO

Hoje o Robô de Lances não sabe em qual processo você está: a página não lê o
processo ativo, e o vínculo com a licitação só nasce quando o operador busca e
seleciona o edital de novo, dentro do diálogo "Configurar Lance". Também não há
atalho para o Robô na aba **Módulos** do prontuário.

O caminho natural — monitorar → mandar para o Kanban → abrir a pasta → disputar
com os dados que já estão lá (itens, preços, valor de referência) — ainda não
existe. Cada disputa recomeça a seleção do zero, com risco de configurar o lance
para o processo errado.

**Corrigido em 16/08/2026:** o Robô ganhou atalho na aba Módulos, passou a ler o
processo ativo (com a barra de contexto e o caminho de volta) e o diálogo "Nova
disputa" importa sozinho a licitação da pasta aberta. A lista de outros processos
só aparece atrás de "Escolher outro processo" — travamento com saída deliberada,
já que configurar disputa para outro pregão a partir do próprio Robô continua
sendo um uso legítimo.

## 5. VNC — verificar durante uma disputa real

`/vnc/vnc.html` carrega (200), mas o noVNC mostra "Failed to connect to server".
Com **0 sessões ativas** não há navegador rodando para exibir, então isso pode ser
comportamento esperado. Vale reconferir durante uma sessão de lance real; se
persistir com sessão ativa, o websockify precisa de atenção.

*(A exibição do painel dentro do Praefectus estava bloqueada pela política de
segurança da página e já foi liberada.)*

## 8. O template não bootava — RESOLVIDO em 31/08/2026

Achado ao gerar o ZIP e rodar `node --check` em cada arquivo: **29 dos 30
passavam, e o que falhava era `src/portals/index.js`**.

```js
// gerado (inválido — barra invertida antes de cada crase):
throw new Error(\`Portal "\${portalId}" não suportado...\`);
```

A string no gerador tinha uma camada de escape a mais (`\\\`` em vez de `` \` ``).
Como `src/index.js` faz `require('./portals')` na primeira linha, **o agente
inteiro morria no boot** — nenhuma rota subia, nem as que já existiam.

Isto explica a divergência que confundiu o diagnóstico: a VPS e o template se
declaravam ambos **v2.1.0**, mas eram código diferente. O que roda na VPS não
saiu deste template — não teria como.

**Como se evita a reincidência:** o gerador agora é verificável de fora do
navegador.

```sh
# gera o ZIP em Node e valida a sintaxe dos 30 arquivos
npx esbuild <script>.mts --bundle --platform=node --format=esm \
  --alias:@=./src --define:import.meta.env='{"VITE_SUPABASE_URL":"..."}'
for f in $(find agente-lances-externo -name '*.js'); do node --check "$f" || echo "FALHA: $f"; done
```

Vale mais que a checagem de tipos: `tsc` só vê uma `string`, e o conteúdo dela
nunca foi analisado como JavaScript.

## 9. Checklist consultava tabela inexistente — RESOLVIDO em 31/08/2026

O item "Credenciais de Portal" do Checklist de Ativação ficava **eternamente
pendente**, mesmo com credencial cadastrada:

```
GET /rest/v1/credenciais_portal?select=*&user_id=eq...
404 · PGRST205 · "Perhaps you meant the table 'public.credenciais_portais'"
```

A tabela é `credenciais_portais` (plural). Dois agravantes:

- **`as any` na chamada** silenciou o TypeScript, que teria reprovado o nome —
  os tipos gerados só conhecem o plural;
- **o `error` era descartado** (`const { data } = await ...`), então 404 e "não
  há credencial" apareciam idênticos na tela. Falha silenciosa, proibida pelo
  princípio 3 do `CLAUDE.md`.

Corrigido para a view `credenciais_portais_safe` com `select('id')` — nome certo,
e o `senha_hash` deixa de ser trafegado para o navegador só para contar linhas.
O erro passa a aparecer na descrição do item, com estado `erro` em vez de
`pendente`.

## 10. Duas telas verdes sem lastro — RESOLVIDAS em 02/09/2026

Apareceram ao preparar a validação dos portais, e as duas seguem o mesmo molde:
**verificar o proxy fácil em vez do fato.**

### O certificado que não existia

O checklist mostrava, em verde: *"Certificado Digital — Instalado no agente
(./certs/certificado.pfx)"*. A pasta `certs/` **estava vazia**.

O `/health` do agente respondia assim:

```js
certificado: {
  carregado: !!process.env.CERT_PATH,   // só olha se a VARIÁVEL existe
  path: process.env.CERT_PATH || null,
}
```

Conferia a variável de ambiente, nunca o arquivo. Corrigido para checar o disco
e, quando não acha, dizer onde procurou:

```json
{"carregado": false, "path": "./certs/certificado.pfx",
 "motivo": "arquivo nao encontrado em /opt/agente-lances/certs/certificado.pfx"}
```

**Por que importava:** o `comprasgov.js` autentica por certificado digital. Sem o
`.pfx`, o login falha antes de qualquer seletor ser exercitado — e alguém iria
depurar o botão de certificado quando o problema é não haver certificado.

### O healthcheck que não testava seletores

O card se chamava *"Healthcheck de Seletores — Portais"* e mostrava **"12 OK"**.
A edge function `portal-healthcheck` faz `HEAD`/`GET` na URL e olha o status
HTTP — **nunca abre navegador, nunca executa seletor** —, mas gravava o resultado
em campos chamados `seletores_ok` e `seletores_falhos`.

"12 seletores OK" queria dizer "12 sites responderam a um GET".

As colunas do banco mantêm os nomes (renomear exigiria migration, deploy e front
por um ganho cosmético). O que mudou foi o que a tela **afirma**:

| Antes | Agora |
| --- | --- |
| "Healthcheck de Seletores — Portais" | "Portais no ar" |
| "12 OK" · "3 falhas" | "12 responderam" · "3 fora do ar" |
| "Operacional" | "Responde" |
| — | subtítulo dizendo que **não** testa a automação |

**A regra que as duas violavam** é o princípio 3 do `CLAUDE.md`: falha silenciosa
é proibida. Aqui era pior que silêncio — era afirmação positiva sem lastro. Um
seletor quebrado que a tela jura estar "Operacional" só aparece no meio de uma
disputa real.

---

## Como reproduzir os testes

```sh
curl -s https://agente.praefectus.com.br/health | jq

for ep in /kill-switch /api/proposta/enviar /sessao/iniciar; do
  echo -n "POST $ep -> "
  curl -s -o /dev/null -w "%{http_code}\n" -X POST \
    "https://agente.praefectus.com.br$ep" \
    -H 'Content-Type: application/json' -d '{}'
done
# esperado hoje: 404 / 404 / 403
# esperado depois das correções: 401 ou 403 nas três (rota existe, exige chave)
```

Confirmado em 31/08 contra o template v2.2.0 rodando localmente (puppeteer
dublê, só para exercitar o roteamento):

| Chamada | Resposta |
| --- | --- |
| `GET /health` | 200 · `version: "2.2.0"` · 9 rotas declaradas |
| `POST /kill-switch` com chave | **200** · `{"success":true,"sessoes_encerradas":0}` |
| `POST /kill-switch` sem chave | 403 |
| `POST /api/proposta/enviar` payload válido | **501** · nomeia o portal sem `enviarProposta` |
| `POST /api/proposta/enviar` `itens: []` | 400 · diz o que faltou |
| `POST /api/proposta/enviar` portal inexistente | 400 · lista os 23 disponíveis |
| `POST /api/proposta/enviar` sem chave | 403 |

---

## 11. O VNC, o Chrome com janela e o que se descobriu sobre o certificado — 08/09/2026

Contexto: o Rafael cobrou status do Robô de Lances e o Giovanny pediu para
entregar algo demonstrável no mesmo dia. Ao preparar a demonstração, três
defeitos apareceram — dois deles com a mesma assinatura de falha silenciosa.

### O VNC mostrava uma área de trabalho vazia

A tela "Agente Cloud → VNC" existe no app e promete acompanhar o robô
trabalhando. Ela nunca mostrou nada, por **dois** motivos independentes.

**Primeiro: o `x11vnc` estava morto, e o pm2 dizia `online`.** O
`/root/start-vnc.sh` subia os três processos assim:

```sh
Xvfb :99 ... &          # segundo plano
x11vnc -display :99 &   # segundo plano
websockify ... 6080     # PRIMEIRO plano  ← o único que o pm2 vigia
```

Como só o `websockify` ficava em primeiro plano, era só ele que o pm2
observava. O `x11vnc` morreu em algum momento entre março e setembro e **nada
acusou**: o painel seguia verde, a porta 6080 seguia respondendo, e quem
abrisse o VNC via um retângulo cinza. É o princípio 3 do `CLAUDE.md` violado
dentro da própria infraestrutura.

Agora os três vão para segundo plano e o script termina em `wait -n`, que
retorna assim que **qualquer um** deles morre. O script sai com erro, o pm2 vê
o processo cair e reergue a pilha inteira. Um `pkill` no início mata restos que
impediriam o Xvfb de tomar o `:99`.

**Segundo: o Chrome subia sem janela.** O `browser.js` usava
`headless: 'new'`, e ninguém apontava o `DISPLAY` para o `:99`. Mesmo com o
x11vnc vivo não haveria nada para transmitir — o navegador do robô desenhava
num buffer invisível.

Passou a ler de configuração, **mantendo `headless` como padrão**:

```js
const visivel = process.env.HEADLESS === 'false';
headless: visivel ? false : 'new',
env: visivel ? { ...process.env, DISPLAY: display } : process.env,
```

Quem não configurar nada mantém o comportamento antigo. Ligar a janela é ato de
configuração (`HEADLESS=false` no `.env`), reversível sem tocar em código — que
era a exigência para mexer em produção no meio do dia.

**Verificação.** Um script isolado subiu o navegador, abriu uma página neutra,
leu o título e fotografou:

```
🖥️  Chrome VISIVEL no display :99 — acompanhe em /vnc/
titulo lido: Example Domain
logs/screenshots/teste-visivel.png   19.658 bytes
```

Esse arquivo tem significado próprio: **a pasta `logs/screenshots/` estava
vazia desde 15/03**. Como o código fotografa a tela a cada login, a pasta vazia
era a prova de que nenhum portal jamais tinha sido acessado. Aquele PNG é o
primeiro pixel que o robô desenhou.

### As portas do VNC estavam abertas na internet

Ao reerguer a pilha, o `ss` mostrou `0.0.0.0:5900` e `0.0.0.0:6080` — e o
x11vnc sobe com `-nopw`, sem senha. Qualquer um na internet podia assistir e
controlar a área de trabalho de uma máquina que vai guardar certificado digital
e credenciais de portal.

É a mesma classe do problema da porta 3500, corrigido em 02/09, reaparecendo em
outro lugar. O nginx faz `proxy_pass` para `127.0.0.1` nos dois casos, então
fechar não quebra nada: `x11vnc -localhost` e `websockify 127.0.0.1:6080`.

Confirmado depois: `/vnc/vnc.html` continua 200 pelo domínio, e a conexão
direta em `129.121.48.145:6080` passou a ser recusada.

### O certificado nunca foi apresentado a portal nenhum — pendência 20

Este é o achado que mais muda o planejamento, e contradiz o que se supunha.

`CERT_PATH` aparece em três lugares no código: duas linhas de log e a checagem
de "o arquivo existe" que alimenta o `/health`. No `browser.js`, onde ele
deveria entrar de fato, havia isto:

```js
if (certPath && fs.existsSync(certPath)) {
  console.log(`📜 Certificado A1 encontrado: ${certPath}`);
  // Para mTLS, configure via proxy ou flags do Chrome 120+
}
```

Um comentário de "fazer depois", não código. **Instalar o `.pfx` não faria o
Compras.gov nem o PNCP autenticarem** — o Chrome nunca apresentaria o
certificado. A mensagem de log foi corrigida para dizer a verdade, senão
alguém depuraria seletor de botão achando que o mTLS estava de pé.

O que falta para fechar, e o que a máquina ainda não tem:

| Item | Estado em 08/09 |
| --- | --- |
| `pk12util` / `certutil` (`libnss3-tools`) | ausentes — só há `openssl` |
| Base NSS do Chrome (`~/.pki/nssdb`) | não existe |
| Diretório de policy do Chrome | nenhum dos três caminhos existe |
| Chrome usado | o do Puppeteer (Chrome for Testing 127) |

O caminho é: instalar `libnss3-tools` → criar a base NSS → importar o `.pfx` →
criar a policy `AutoSelectCertificateForUrls` (sem ela o Chrome abre uma caixa
de diálogo pedindo o certificado, e diálogo modal trava robô) → usar
`userDataDir` persistente.

**Duas incertezas que só o teste resolve:** o Chrome for Testing pode não
obedecer policy gerenciada como o Chrome de marca; e o login do gov.br pode não
ser mTLS puro, e sim um fluxo com JavaScript onde o certificado é uma etapa
entre outras.

De qualquer forma isto está **bloqueado até o `.pfx` chegar**. E não é o
caminho curto: **6 dos 8 portais entram com usuário e senha** e não dependem
disso.

### `browser.js` e `start-vnc.sh` não estão no template — pendência 21

As correções acima vivem só na VPS. O `src/lib/agent-template/` do repo declara
`ecosystem.config.js`, `setup-nginx.sh`, `setup.sh`, `src/index.js`, a
estratégia e os portais — **os dois arquivos corrigidos hoje não estão lá**.

Se a VPS for reconstruída a partir do template, o VNC volta a servir tela vazia
e o Chrome volta a ser headless, sem nada indicando por quê. É a mesma deriva
que fez a VPS e o repo se declararem ambos v2.1.0 sendo código diferente.

Decisão pendente do time: trazer os dois para o template, ou registrar
explicitamente que a infraestrutura da VPS não é reproduzível pelo gerador.

### Backups desta sessão

```
/opt/agente-lances/src/browser.js.bak-2026-09-08-2122
/opt/agente-lances/.env.bak-2026-09-08-2122
/root/start-vnc.sh.bak-2026-09-08-2122
```

---

## 12. Os primeiros logins reais — 08/09/2026, noite

Com o Chrome visível funcionando, testamos login nos portais de usuário e senha,
usando credenciais reais do Grupo Santa Rosa. **Nenhum dos quatro entrou na
primeira tentativa** — e cada um falhou por um motivo diferente. É o que os
seletores escritos às cegas prometiam.

| Portal | O que aconteceu | Natureza |
| --- | --- | --- |
| BLL | `bll.org.br/login` → caiu no `wp-login.php` | endereço errado |
| Portal de Compras | `/login` → **404** | endereço errado |
| LicitaNet | **403 Forbidden** até na home | bloqueio anti-robô |
| Licitações-e | timeout; foi para a consulta pública | endereço errado |

### Os endereços verdadeiros

Descobertos abrindo a home de cada portal e listando os links que levam ao
acesso — o método que substitui o chute:

```
BLL              https://bllcompras.com/Home/Login        ← OUTRO DOMINIO
Portal Compras   https://operacao.portaldecompraspublicas.com.br/18/loginext/
Licitacoes-e     "Acesso Identificado" e um link javascript:, nao uma URL
LicitaNet        403 antes de qualquer coisa
```

O da BLL é o mais instrutivo: o código apontava para `bll.org.br`, que é o
**site institucional**, enquanto a plataforma de pregão vive em `bllcompras.com`.

### BLL usa teclado virtual embaralhado

Lendo o HTML da página de login verdadeira, apareceram cinco botões assim:

```html
<input type="button" name="2 ou 0" value="2 ou 0">
<input type="button" name="7 ou 3" value="7 ou 3">
<input type="button" name="5 ou 8" value="5 ou 8">
<input type="button" name="1 ou 4" value="1 ou 4">
<input type="button" name="6 ou 9" value="6 ou 9">
<input type="password" id="Contador" name="Contador">
```

É o teclado estilo banco: a senha **não é digitada, é clicada** em pares de
dígitos, e o embaralhamento muda a cada carregamento. Automatizável — ler os
rótulos e clicar o par que contém cada dígito —, mas é trabalho próprio, e
implica **senha numérica**. A credencial que temos para a BLL tem letras e
símbolos, então ou ela é de outro acesso, ou existe caminho alternativo.

### Portal de Compras Públicas — ENTROU ✅

Este redireciona para um **Keycloak** (`realms/Portal`), com formulário padrão:

```
#username · #password · #kc-login
```

Corrigidos endereço e seletores, o login passou:

```
✅ Login no Portal de Compras Públicas realizado
URL final : .../18/4/NaoAssinante/DashBoard/
Titulo    : Portal de Compras Públicas | Painel de Operações
```

E a foto mostra o cabeçalho: **"Você está logado como: RAFAEL WILLIAM CASTRO DA
SILVA - 24.687.187/0001-01"**. É o primeiro login que este robô fez em toda a
sua existência.

> ⚠️ **Reparar no `NaoAssinante` da URL.** A conta pode ter acesso limitado —
> vale confirmar com o Rafael se ela participa de disputa ou só consulta.

### Duas correções de método que saíram junto

**`loggedIn = true` era cravado sem conferir.** Tanto na VPS quanto no template,
o `login()` marcava sucesso logo após esperar a navegação. Credencial errada
virava "login realizado", e o defeito só apareceria rodadas depois, longe da
causa. Agora verifica o texto da página e a permanência do formulário, e
**lança erro** se não entrou.

**A VPS e o template tinham implementações DIFERENTES do mesmo portal.** O
template trazia uma versão de 31/03 que tratava o portal como SPA Angular e
caçava o botão "Entrar" por texto; a VPS tinha a versão ingênua com `/login`.
Nenhuma das duas funcionava hoje, porque o portal migrou para Keycloak nesse
intervalo. O template foi alinhado com o que foi **verificado em produção**.

### O que isso muda no plano

O caminho até o primeiro lance real ficou concreto, e mais curto do lado certo:

1. ✅ Chrome visível e VNC funcionando
2. ✅ Login comprovado no Portal de Compras Públicas
3. ⬜ Navegar até uma disputa (`navegarParaDisputa` ainda tem URL suposta)
4. ⬜ Ler a tela de lances com um pregão ao vivo
5. ⬜ Escrever o `souLider()` do portal
6. ⬜ Liberar o portal em `PORTAIS_COM_LANCE_LIBERADO`

Os passos 3 e 4 dependem de haver disputa acontecendo. Os demais portais
precisam do mesmo tratamento, e a LicitaNet precisa antes de uma resposta ao
403 — que pode exigir mudar user-agent, usar IP residencial, ou falar com o
portal.

---

## 13. O primeiro envio pela interface — 08/09/2026, noite

O botão "Enviar ao robô" foi ao ar e o primeiro clique respondeu **"Edge Function
returned a non-2xx status code"**. Foram três defeitos empilhados, e cada um
escondia o seguinte.

### O aviso não dizia a causa

Prometido: "a mensagem real do servidor". Entregue: uma frase que não diz nada.

O cliente do Supabase, quando a função responde não-2xx, devolve `data: null` e
um `error.message` genérico — o **corpo** da resposta, onde está a causa, fica em
`error.context`, que é o `Response` cru. Ler só `error.message` joga fora
exatamente a informação que interessa.

Custo medido: sem a frase na tela, achar o defeito virou comparar consultas de
duas telas diferentes até topar com um `.single()`.

### `.single()` onde cabem várias linhas

O Checklist mostrava **"Agente Externo Configurado ✓"** e o envio respondia
**"Nenhum agente ativo configurado"**. Mesma tabela, leituras diferentes:

```
checklist       .eq(user_id).find(a => a.status === 'ativo')
enviar-sessao   .eq(user_id).eq(status,'ativo').single()
```

`.single()` falha com mais de uma linha e devolve `data: null`, que o código lia
como "não existe". E ter várias linhas é o normal: o `configurar-agente` faz
upsert com `onConflict: "user_id,nome"`, e o nome carrega o plano — trocar de
plano cria linha nova em vez de atualizar.

### O agente rodava o arquivo velho

Este é o mais instrutivo, e o erro foi de método.

O `portal-compras.js` foi corrigido às 21:39; o agente tinha sido reiniciado às
21:27. **O Node guarda o módulo em cache**, então o processo seguiu usando o
seletor antigo (`#login`) enquanto o disco já tinha o certo (`#username`). Os
testes diretos passavam porque rodavam como processo separado, lendo o arquivo
fresco — a discrepância mais confusa possível.

```
❌ Erro ao iniciar sessão: TimeoutError:
   Waiting for selector `input[name="login"], #login` failed
```

> **Regra:** mexeu em qualquer arquivo de `/opt/agente-lances/src/`,
> `pm2 restart agente-lances`. Teste em processo separado NÃO prova o que o
> agente está executando.

### E a chamada estourava antes do robô terminar — pendência 22

`/sessao/iniciar` faz `await sessionManager.createSession(...)` antes de
responder: abre o Chrome, faz login, navega. Nos logs isso levou **12s só para
falhar** o login. A edge function abortava em **10s** e devolvia "Agente
inacessível".

Efeito: o robô entraria com sucesso e a tela mostraria erro — o pior tipo de
mentira, a que desmente algo que deu certo.

Paliativo aplicado: o tempo subiu para 60s. **O conserto de fundo continua
aberto:** o agente deveria confirmar o recebimento na hora e seguir a sessão em
segundo plano, avisando o resultado pelo callback que já existe. Enquanto for
síncrono, qualquer portal mais lento reintroduz o problema.

### O que os logs provaram

Antes de qualquer um desses consertos, a corrente já funcionava:

```
22:49:06  🚀 Abrindo sessão 361fadb4... (browser #1)
22:49:06  🔐 Login no portal: portal-compras
23:00:04  🚀 Abrindo sessão 9ed4b09a... (browser #1)
```

Duas sessões chegaram pela interface. O botão disparou, a edge function achou o
agente, **a credencial chegou decifrada** e o agente abriu o navegador. Tudo o
que foi construído em 08/09 funcionou; só o último passo usava código velho.

---

## 14. O muro do Banco do Brasil e as três listas de portais — 09/09/2026

Dois achados independentes, no mesmo dia, ambos de "o código estava certo sobre
uma coisa que não era verdade".

### 14.1 O Licitações-e não é automatizável pelo caminho que tentávamos

O Rafael mandou o endereço do portal novo:
`https://licitacoes-e2.bb.com.br/aop-inter-estatico/`. O módulo da VPS apontava
para o legado (`www.licitacoes-e.com.br`) e o do repo apontava para
`licitacoes-e2.bb.com.br/aop/login`.

O `curl` devolve **403 para qualquer caminho** do BB — inclusive os válidos.
Isso é importante porque significa que **não dá para validar URL do BB sem um
navegador de verdade**; uma sonda com Chrome respondeu o que o curl não podia:

| URL | Resultado |
| --- | --- |
| `/aop-inter-estatico/` | 200 — página real "Novo Licitações-e" |
| `/aop/login` (o que o template usava) | redireciona para **"página não encontrada!"** |
| `/aop-inter-estatico/login`, `/aop-inter/`, `/aop/` | 404 |
| `www.licitacoes-e.com.br/aop/index.jsp` (legado) | 200, com o campo de login exposto |

O portal novo **não tem página de login pública** — os únicos links são
`para-fornecedores`, "Solicitar adesão digital" e "Quero vender", os dois
últimos sem `href`.

No legado o campo existe e é `#acessoChaveJ` (placeholder "Chave de acesso") —
nenhum dos três chutes do template (`input[name="inCodigo"]`,
`input[id="codigo"]`, `#txtChave`) existe na página. Há um pop-up cobrindo tudo,
que fecha em `#nlCloseBtn`.

**Mas corrigir o seletor não resolveria.** Com uma chave falsa preenchida, o
clique em OK leva a:

```
https://www.licitacoes-e.com.br/aop/gcs/statics/gas/validacao.bb
"Problemas na verificação da solução de segurança."
```

`gas` é o **Módulo de Segurança do BB** (Warsaw, da Topaz/Stefanini) — o mesmo
que `seg.bb.com.br/home.html` manda instalar. É um binário que roda no sistema
operacional e faz detecção de automação. Sem ele o login para antes de pedir a
senha.

**Consequência:** o Licitações-e não entra pela mesma porta dos outros portais.
As saídas possíveis, nenhuma barata:

1. Instalar o Warsaw na VPS (existe `.deb`) e descobrir se ele aceita rodar sob
   Xvfb — o software é feito justamente para recusar esse cenário.
2. Operar o Licitações-e de uma máquina real com o módulo instalado.
3. Tratar o portal como manual e dizer isso ao cliente.

**Não escrevemos o login v1.** Ter o seletor certo levaria o robô exatamente uma
tela adiante, e a tela seguinte é o muro. Está aqui registrado para ninguém
gastar o dia refazendo a descoberta.

### 14.2 Três listas de portais, três vocabulários

Comparar a interface com o registro do agente mostrou que existiam **três**
listas, e que elas discordavam:

| Onde | Quantos | Observação |
| --- | --- | --- |
| `CredenciaisPortalForm.tsx` (cópia própria) | 23 | nunca foi migrada |
| `src/lib/robo/portais.ts` | 10 | a "autoridade única" de 08/09 |
| `src/portals/index.js` do **template** | 23 | 8 em `portals.ts` + 15 em `portals-estaduais.ts` |
| `/opt/agente-lances/src/portals/` na **VPS** | 8 | o que realmente está no ar |

Dois defeitos saíram daí:

**O hífen.** A tela chama o portal de `compras-gov`; o agente chama de
`comprasgov`. Ninguém traduzia. Uma disputa em Compras.gov passava por toda a
validação, **gravava a linha em `sessoes_lance_real` com status "enviando"**, o
POST era feito — e só o agente reclamava, com `Portal "compras-gov" não
suportado`. Sobrava registro no banco de um trabalho que nunca começou.

**A VPS 15 módulos atrás.** O template tem os 23 portais; a VPS tem 8. Isso não
aparece em lugar nenhum: o `/health` lista o que ela tem, e nada compara com o
que deveria ter.

**O que foi feito:**

- `src/lib/robo/portais.ts` virou autoridade dos 23, e cada portal declara
  explicitamente **como o agente o chama** (`agente:`). O `id` continua imutável
  porque é o que está em `credenciais_portais.portal_id`.
- `CredenciaisPortalForm` passou a consumir essa lista — a terceira cópia
  morreu.
- Espelho Deno em `_shared/robo-portais.ts`, no arranjo de
  `_shared/licitacao-status.ts`. A tradução é decisão do **servidor**: se
  viesse do payload, uma aba aberta desde ontem despacharia sessão para um
  módulo inexistente.
- `robo-lances-webhook` traduz e **recusa antes de gravar**.
- O envio consulta o `portais_suportados` do `/health` e, quando o agente no ar
  não tem o módulo, diz **o que ele tem** em vez de só negar.

**A lista estática não diz se a VPS tem o módulo, de propósito.** Escrever isso
em código seria uma verdade com prazo de validade, que envelhece em silêncio a
cada deploy. Quem sabe é o agente, e é a ele que se pergunta.

Dois testes em `src/test/agente-template.test.ts` trancam a volta do defeito:
todo `agente:` tem que existir no registro do template, e o espelho Deno tem que
ser idêntico ao mapa do app.

### 14.3 O módulo do Licitações-e foi sincronizado mesmo assim

`licitacoes-e.js` da VPS foi de 73 para 445 linhas (md5 idêntico ao extraído do
template; backup em `licitacoes-e.js.bak-20260908`), e o pm2 reiniciado — sem
`pm2 restart`, o cache de `require` do Node continua servindo o módulo antigo,
que foi a armadilha de 08/09.

Ganhou anti-detecção, renovação de JSESSIONID a cada 15 min, verificação de fase
randômica a 1,5s, detecção de CAPTCHA — e, principalmente, **login que confere
se entrou**. O antigo fazia:

```js
await this.page.waitForNavigation({ ... });
this.loggedIn = true;          // sem verificar nada
```

Com o domínio errado, isso escreveria "✅ Login realizado" numa página de erro.
O novo falha alto. Não entra — o muro do 14.1 continua lá —, mas para de mentir.

---

## 15. O certificado que finalmente chega ao portal — 09/09/2026

A pendência 20 estava aberta desde 08/09 com o diagnóstico certo e a extensão
errada. O certificado não era apresentado — mas a causa não era uma, eram
**quatro**, empilhadas, e cada uma sozinha bastaria para o resultado ser zero.

### O que estava quebrado

| # | Elo | Estado |
| --- | --- | --- |
| 1 | A senha do `.pfx` | **descartada** — o formulário exigia, validava e jogava fora |
| 2 | O arquivo → VPS | **não existia** — subia para o Storage e parava lá |
| 3 | O agente receber | **não existia** — nenhuma rota `/certificado` |
| 4 | O Chrome apresentar | **não existia** — sem base NSS, sem policy |

E, coroando: a tela ficava **verde** ao fim do passo que funcionava (o upload),
declarando pronto um caminho que não tinha os outros três. Este é o pior tipo de
verde já encontrado neste projeto, porque consumia uma ação cara e real da
pessoa — pedir o certificado ao contador, pagar por ele, enviá-lo — para não
entregar nada.

### O que foi provado antes de escrever código

Nenhuma linha foi escrita antes de o mecanismo funcionar à mão, com um
certificado autoassinado de teste:

```
pk12util -d sql:/root/.pki/nssdb -i teste.pfx -W ...
  → PKCS12 IMPORT SUCCESSFUL, com chave privada
servidor HTTPS local com requestCert:true
  → CLIENTE=teste-mtls ORG=Praefectus Teste
```

**O Chrome apresentou o certificado sozinho, sem diálogo.** Só então o código foi
escrito.

**A descoberta que teria custado um dia:** o caminho da policy **não** é
`/etc/opt/chrome/`. O binário que o Puppeteer baixa é o *Chrome for Testing*, e
`strings` no executável mostra um único caminho:

```
/etc/opt/chrome_for_testing/policies
```

Configurar na pasta padrão teria deixado a policy num diretório que este Chrome
nunca lê — e o sintoma seria "não funciona", sem pista.

### O defeito que só apareceu ao rodar

A primeira versão de `estado()` lia apenas `certutil -K` (chaves privadas). Ao
remover o certificado de teste com `certutil -D`, o estado continuou dizendo
**instalado** — porque `-D` apaga o certificado e **deixa a chave órfã**.

Duas correções: `estado()` passou a cruzar `-L` (certificados) com `-K`
(chaves), e a substituição usa `-F`, que remove os dois. Quatro testes em
`src/test/agente-template.test.ts` trancam isso, carregando o módulo com o
`child_process` trocado.

### O que existe agora

- **`src/certificado.js`** no agente: grava o `.pfx`, importa na base NSS que o
  Chrome já usa (`~/.pki/nssdb`) e escreve a policy de auto-seleção. Toda
  chamada a `certutil`/`pk12util` fecha o stdin — sem isso eles pedem senha num
  terminal inexistente e entram em laço infinito de "Invalid password".
- **`POST /certificado`** no agente, autenticado. Senha errada devolve a razão
  real (`SEC_ERROR_BAD_PASSWORD`), não um erro genérico.
- **`_shared/certificado-agente.ts`**: Storage → decifra a senha → entrega ao
  agente. O upload chama sozinho; o Checklist tem "Instalar no robô" para
  repetir quando o agente estiver fora do ar.
- **`senha_cifrada`** em `cert_upload_tokens`, com a mesma cifra das senhas de
  portal (chave própria, não a service role).
- **`/health` honesto**: `carregado` só é `true` com arquivo, chave na base NSS
  **e** policy. Antes bastava a variável estar preenchida; depois, o arquivo
  existir. Nenhum dos dois provava nada.

### Escopo do mTLS, de propósito estreito

```js
const URLS_MTLS = [
  'https://[*.]gov.br',
  'https://[*.]banparanet.com.br',
  'https://[*.]bbmnetlicitacoes.com.br',
];
```

Um padrão aberto (`"*"`) faria o Chrome oferecer o certificado da empresa a
qualquer site que pedisse — inclusive um que pedisse só para coletar.

### O que isto NÃO prova

Que o Compras.gov aceita. O que está provado é que o Chrome do agente
**apresenta** o certificado quando o portal pede, e que a cadeia inteira
funciona ponta a ponta com um certificado real de teste. O login gov.br tem
etapas próprias, e elas só se verificam com o certificado do cliente em mãos.

O que mudou é a natureza do que falta: era "não existe", passou a ser "não foi
testado com o certificado do cliente".
