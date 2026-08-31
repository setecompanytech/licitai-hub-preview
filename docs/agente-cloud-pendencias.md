# Agente Cloud — pendências no agente (VPS em v2.1.0, template em v2.2.0)

Diagnóstico feito em 16/08/2026 sondando `https://agente.praefectus.com.br`
diretamente. **Nada aqui depende do Praefectus** — são rotas que o sistema
chama e que o agente ainda não implementa. O lado do Praefectus já foi
corrigido para não mentir enquanto isso.

> **Reteste em 31/08/2026** pelo botão "Testar freio" do Checklist de Ativação:
> o agente respondeu **404** ao `POST /kill-switch`. O item 1 continua aberto.
>
> **O que mudou desde então: as três pendências do agente foram escritas no
> template deste repositório** (`src/lib/agente-template-generator.ts`), que
> passou a **v2.2.0**. Falta só o deploy na VPS — ver "O que falta agora".

## Situação em uma olhada

| # | Pendência | Onde | Status |
| --- | --- | --- | --- |
| 1 | **`POST /kill-switch`** — freio de emergência | **agente** | 🚚 **no template; falta deploy — bloqueia níveis 2 e 3** |
| 2 | `POST /api/proposta/enviar` — envio da proposta | **agente** | 🚚 rota no template; formulário por portal a implementar |
| 3 | Declarar as rotas disponíveis no `/health` | **agente** | ✅ resolvido no template (`rotas: [...]`) |
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

**Enquanto o item 1 não for implementado, o envio automático (níveis 2 e 3) fica
bloqueado pelo próprio sistema.** Nível 1 (assistente, sem envio automático)
segue liberado.

## O que falta agora

Um passo, e ele é na VPS:

```sh
# na VPS, a partir do ZIP gerado em Robô de Lances → Agente Cloud → baixar template
npm install && pm2 restart agente-lances    # ou o gestor de processo em uso
curl -s https://agente.praefectus.com.br/health | jq '.version, .rotas'
# esperado: "2.2.0" e a lista com 9 rotas
```

Depois disso, "Testar freio" no Checklist de Ativação deve passar e liberar os
níveis 2 e 3. O `POST /api/proposta/enviar` passa a responder **501** nomeando o
portal — que é o estado honesto: a rota existe, o formulário daquele portal ainda
não foi automatizado. O 404 atual não distinguia as duas coisas.

**O que continua sendo trabalho de portal, não de rota:** o método
`enviarProposta(dados)` em cada `src/portals/<portal>.js`. O contrato está
documentado em `base-portal.js`; os seletores dependem de acesso ao portal e não
podem ser escritos às cegas.

## O que o agente responde hoje

| Rota | Método | Resposta | Situação |
| --- | --- | --- | --- |
| `/health` | GET | **200** em ~0,4s | ✅ funcionando |
| `/sessao/iniciar` | POST | **403** (exige autenticação) | ✅ existe e está protegida |
| `/vnc/vnc.html` | GET | **200** | ✅ serve a interface noVNC |
| `/kill-switch` | POST | **404** | ❌ **não existe** |
| `/api/proposta/enviar` | POST | **404** | ❌ **não existe** |

Payload atual do `/health` (referência do que o agente já expõe):

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

## 1. `POST /kill-switch` — PRIORIDADE ALTA (segurança)

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

**Enquanto não existir:** o Praefectus **bloqueia** os níveis 2 e 3. A liberação
não é manual nem por confiança: existe a etapa "Freio de emergência verificado"
no Checklist de Ativação, com o botão **Testar freio**, que aciona
`POST /kill-switch` de propósito (recusado pelo servidor se houver disputa em
andamento, para não abortar lances reais) e grava o resultado. Só depois de o
agente confirmar a parada é que o envio automático é liberado.

**Como validar do lado do agente:** implemente a rota, deixe o robô parado e peça
ao operador para clicar em "Testar freio". A requisição chega com
`{"motivo": "...", "teste": true}` — se preferir, trate `teste: true` como
verificação (responder 200 sem efeito) e a ausência do campo como parada real.

## 2. `POST /api/proposta/enviar` — prioridade média

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

**Estado atual:** o Praefectus **já trata o 404 corretamente** — devolve 502,
grava em `agent_acoes_log` e exibe "Falha ao conectar com o Agente Cloud". Nenhum
usuário é enganado; a função simplesmente não opera até a rota existir.

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
