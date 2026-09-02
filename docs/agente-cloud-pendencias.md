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
