# Agente Cloud — pendências no agente (v2.1.0)

Diagnóstico feito em 16/08/2026 sondando `https://agente.praefectus.com.br`
diretamente. **Nada aqui depende do Praefectus** — são rotas que o sistema
chama e que o agente ainda não implementa. O lado do Praefectus já foi
corrigido para não mentir enquanto isso.

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

**Enquanto não existir:** não usar automação de nível 2 (semiautomático) ou 3
(automação controlada). Nível 1 (assistente, sem envio automático) permanece
seguro.

## 2. `POST /api/proposta/enviar` — prioridade média

**Quem chama:** edge function `enviar-proposta-portal` (botão "Enviar Proposta"
na aba Proposta).

**Requisição enviada hoje:**

```http
POST /api/proposta/enviar
Content-Type: application/json
X-Agent-Key: <CRON_SECRET>

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

**Observação de segurança:** hoje esta chamada se autentica com `CRON_SECRET`, o
mesmo segredo dos jobs de sincronização do PNCP. Convém o agente aceitar uma
chave própria — rotacionar uma não deveria derrubar a outra.

## 3. Heartbeat — RESOLVIDO do lado do Praefectus

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

## 4. VNC — verificar durante uma disputa real

`/vnc/vnc.html` carrega (200), mas o noVNC mostra "Failed to connect to server".
Com **0 sessões ativas** não há navegador rodando para exibir, então isso pode ser
comportamento esperado. Vale reconferir durante uma sessão de lance real; se
persistir com sessão ativa, o websockify precisa de atenção.

*(A exibição do painel dentro do Praefectus estava bloqueada pela política de
segurança da página e já foi liberada.)*

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
