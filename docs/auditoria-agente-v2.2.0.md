# Auditoria do Agente de Lances — v2.2.0

**Data:** 02/09/2026
**Escopo:** 1.278 linhas de JavaScript em `/opt/agente-lances` (VPS, em produção)
mais o template equivalente em `src/lib/agente-template-generator.ts` e
`src/lib/agent-template/`.
**Método:** leitura integral do código, checagem de cada chamada de API contra a
versão do Puppeteer instalada, e rastreio do ciclo de vida de uma sessão do
início ao fim.

**Motivo:** o freio de emergência foi liberado em 02/09, destravando os níveis 2
e 3. Antes de qualquer disputa real, era preciso saber o que de fato acontece
quando alguém aperta "iniciar".

> **Achado central:** o código de automação **não executa**. E se executasse,
> daria lance contra si mesmo até o piso. As duas coisas são invisíveis de fora —
> o `/health` responde 200 e o painel fica verde.

---

## Resumo

| | Achados | Corrigidos em 02/09 |
| --- | --- | --- |
| 🔴 Impedem funcionar | 3 | 1 (A1) |
| 🟠 Funcionariam errado, com custo financeiro | 4 | 3 (B1, B2, B3) |
| 🟡 Vazamento de recurso ou de estado | 6 | 3 (C1, C2, C5) |
| 🔵 Segurança | 3 | 1 (D3) |

**Corrigidos nos dois lados** — VPS e template do repo — na mesma leva, para não
recriar a divergência que este documento registra. O que ficou aberto exige
decisão de arquitetura (A2, A3), acesso a portal (seletores) ou é risco aceito e
registrado (C3, C4, C6, D1, D2).

> ### A correção estruturante
>
> A decisão de preço saiu de dentro do `_startBiddingLoop`, onde estava
> duplicada e sem teste, e virou **`src/estrategia.js` — arquivo único, função
> pura, 12 testes**. Os testes em `src/test/robo-estrategia.test.ts` extraem e
> executam **o mesmo texto que vai para o ZIP do agente**, não uma reescrita:
> testar uma cópia provaria apenas que a cópia funciona.
>
> `decidirLance(estado)` devolve `{ acao, valor, motivo }`, onde `acao` é
> `lance`, `aguardar` ou `encerrar`. Toda decisão vem com o motivo escrito, e
> `aguardar` virou callback `rodada-sem-lance` — o painel passa a ver por que o
> robô não deu lance, em vez de silêncio.

**Os dois lados têm os mesmos defeitos**, e o template do repo tem mais
ocorrências que a VPS:

| Defeito | VPS | Template |
| --- | --- | --- |
| `page.waitForTimeout` | 15 | 60 |
| `page.on('dialog')` em vez de `once` | 8 | 21 |
| Lance contra si mesmo | ✓ | ✓ |
| `heartbeatInterval` vaza no erro | ✓ | ✓ |

---

## 🔴 Impedem funcionar

### A1 — `page.waitForTimeout` não existe no Puppeteer instalado

`waitForTimeout` foi depreciado no Puppeteer 21 e **removido no 22**. A VPS tem
**22.15.0**, e o código chama a função 15 vezes, espalhadas pelos 8 portais.

Resultado: `TypeError: page.waitForTimeout is not a function` no primeiro comando
de qualquer portal. Nenhuma sessão sobrevive à primeira interação.

Isso explica um sintoma que ficou sem causa no diagnóstico de 16/08: o VNC nunca
mostrou navegador. Não era falta de sessão ativa — era que nenhuma sessão chega a
existir.

**Correção:** `await new Promise((r) => setTimeout(r, ms))`.

### A2 — O certificado digital nunca é usado

```js
if (certPath && fs.existsSync(certPath)) {
  console.log(`📜 Certificado A1 encontrado: ${certPath}`);
  // Para mTLS, configure via proxy ou flags do Chrome 120+
}
```

Um `console.log` e um comentário de TODO. **`CERT_PASSWORD` não é lido em nenhum
ponto do código.**

Instalar o `.pfx` no servidor **não** resolveria: a autenticação mTLS não está
implementada. O `comprasgov.js` faz login por certificado, então esse caminho
inteiro é inoperante.

**Correção:** decisão de arquitetura pendente — injeção via NSS DB do Chromium,
ou proxy TLS local que apresenta o certificado.

### A3 — O navegador roda headless, e o VNC promete mostrá-lo

`headless: 'new'` no `browser.js`. Não existe janela para exibir, então o painel
VNC não pode funcionar por construção. O "Failed to connect to server" observado
em 16/08 foi atribuído à ausência de sessões; a causa é outra.

**Correção:** decisão pendente — rodar com display virtual (`xvfb` em `:99`), já
que a visualização ao vivo é promessa central para o operador.

---

## 🟠 Funcionariam errado

### B1 — O robô dá lance contra si mesmo

O achado mais grave da auditoria.

```js
const melhorLance = await session.portal.lerMelhorLance();
const novoValor = Math.max(
  (melhorLance || session.valor_atual) - decremento,
  session.valor_minimo
);
await session.portal.enviarLance(novoValor);
```

`lerMelhorLance()` lê **o melhor lance da sessão** — que, quando lideramos, é o
nosso. Verifiquei os oito portais: **nenhum distingue lance próprio de lance
alheio.** Não existe verificação de "eu já estou ganhando".

Sem nenhum concorrente cobrir, o robô baixa o próprio preço a cada 30 segundos
até bater no piso e encerrar.

**Por que é o pior dos achados:** um robô que não dá lance falha visivelmente e
alguém conserta. Um robô que dá lance contra si mesmo *parece* funcionar — e
entrega a licitação no valor mínimo.

### B2 — Leitura falha vira lance às cegas

`(melhorLance || session.valor_atual)`. Se o seletor quebrar e `lerMelhorLance`
devolver `null`, o robô dá lance mesmo assim, partindo do próprio valor. O
correto é parar e avisar: sem leitura confiável não há estratégia.

### B3 — Lance rejeitado é contabilizado como aceito

`verificarResultado()` devolve uma string e nada é feito com ela. Se o portal
recusar o lance, o loop grava `valor_atual = novoValor` e a rodada seguinte parte
de uma premissa falsa.

### B4 — Sem noção de fase da disputa

Intervalo fixo de 30 segundos. Pregão eletrônico tem fase aberta, fase fechada e
prorrogação automática de 2 minutos, em que os lances ficam frenéticos. Um robô
com cadência fixa perde a janela que decide.

---

## 🟡 Vazamentos e estado perdido

### C1 — Sessão que falha vira zumbi eterno

No `catch` do `createSession`: fecha o browser, marca `status = 'erro'` — e
**não limpa o `heartbeatInterval`**. Um timer de 30 segundos por sessão falhada,
para sempre. Como toda sessão falha hoje por causa do A1, cada tentativa deixa
um zumbi batendo no callback.

### C2 — Pausar não fecha o navegador e ainda libera o slot

`pauseSession` limpa o intervalo de lances e marca `pausado`. O Chromium
continua aberto, consumindo ~500MB. Mas `getActiveSessions()` filtra
`status === 'ativo'`, então **a sessão pausada não conta na capacidade**.

Pausar três e abrir três novas dá seis navegadores ocupando três slots. Repetir
até estourar a RAM.

### C3 — Estado só existe em memória

As sessões vivem num `Map`. Com `autorestart: true` no pm2, qualquer crash, OOM
ou deploy apaga tudo **sem avisar o Praefectus**, que segue mostrando "ativo"
para sessões que não existem mais.

### C4 — `max_memory_restart: '1G'` com sessões de 500MB

Se a contabilidade do pm2 alcançar os processos filhos, duas sessões reiniciam o
agente no meio de um pregão.

### C5 — `page.on('dialog')` acumula handler a cada lance

```js
this.page.on('dialog', async dialog => { await dialog.accept(); });
```

Dois erros: `on` em vez de `once`, dentro do método de enviar lance — vinte
lances deixam vinte handlers; e registrado **depois** do clique que abre o
diálogo, o que é uma corrida.

### C6 — `pausado` é beco sem saída

Não existe `resumeSession` no gerenciador da VPS. Uma sessão pausada não pode
voltar. O Praefectus não chama `/sessao/retomar` hoje, então não é bug ativo —
mas o estado é um caminho sem volta.

---

## 🔵 Segurança

### D1 — Chave do agente hardcoded no bundle do navegador

`MANAGED_AGENT_KEY` em
[AgenteExternoConfig.tsx:35](../src/components/robo-lances/AgenteExternoConfig.tsx#L35).
Vai para o JavaScript servido ao navegador: qualquer usuário logado lê no
DevTools e fala direto com o agente.

### D2 — `--no-sandbox` rodando como root

O Chromium sobe sem sandbox, num processo root. Uma página que escape do
renderer tem a máquina. O risco é baixo visitando portais de governo, mas a
mitigação padrão está desligada.

### D3 — `callback.js` sem timeout nem retry

`fetch` sem `AbortSignal`: uma conexão pendurada trava o envio indefinidamente.
Falha é apenas logada — o evento se perde, sem fila nem nova tentativa.

---

## ⚪ Achado sobre esta própria intervenção

### E1 — Bug introduzido em 02/09 e corrigido no mesmo dia

`launchBrowser()` devolve `{ browser, page }`. Ao escrever o
`POST /api/proposta/enviar`, tratei o retorno como se fosse o browser, deixando
`newPage()`, `pages()` e `close()` indefinidos.

Estava mascarado: nenhum portal implementa `enviarProposta`, então o 501 retorna
antes de chegar lá. Quebraria no dia do primeiro portal implementado. Corrigido
e reiniciado em 02/09.

Fica registrado porque auditoria que não olha o próprio trabalho não é auditoria.

---

## Veredito

| Camada | Estado |
| --- | --- |
| Infraestrutura, freio de emergência, callbacks, exposição de rede | ✅ sólida |
| Automação de navegador | ❌ **não executa** |
| Estratégia de lance | ❌ **erra de um jeito que custa dinheiro** |
| Ciclo de vida de sessão | ❌ vaza timer, memória e estado |

**A2 e A3 mudam a estimativa do trabalho.** Não se trata de ajustar seletores:
falta implementar autenticação mTLS, que não existe, e decidir se o navegador
roda com display para o VNC servir de alguma coisa.

## O que foi corrigido em 02/09/2026

Aplicado **na VPS e no template do repo**, com backup em
`/opt/agente-lances.bak-auditoria-2026-09-02-1716`.

| # | Correção | VPS | Template |
| --- | --- | --- | --- |
| A1 | `waitForTimeout` → `new Promise(setTimeout)` | 15 | 60 |
| B1 | Não cobre o próprio lance — guarda `souLider` | ✅ | ✅ |
| B2 | Leitura falha → aguarda, não dá lance às cegas | ✅ | ✅ |
| B3 | Lance recusado não avança `valor_atual` | ✅ | ✅ |
| C1 | `heartbeatInterval` limpo no erro de `createSession` | ✅ | ✅ |
| C2 | Capacidade conta sessões pausadas, que seguram browser | ✅ | ✅ |
| C5 | `page.once('dialog')` no lugar de `on` | 8 | 21 |
| D3 | Callback com `AbortSignal.timeout(10s)` e uma retentativa | ✅ | ✅ |

Mais o contrato novo `souLider()` no `BasePortal`, devolvendo `null` por padrão
— e `null` faz a estratégia aguardar, não arriscar. **Portal que não souber
dizer quem lidera não dá lance**, que é o comportamento seguro enquanto os
seletores não forem validados.

### A trava de liberação por portal

`souLider()` devolvendo `null` já impedia o robô de dar lance. Mas era uma trava
**forte contra acidente e fraca contra pressa**: o caminho mais curto para
"fazer funcionar" é escrever

```js
async souLider() { return false; }
```

Uma linha, que passa despercebida num diff e reabre exatamente o B1 — "nunca
estou liderando" faz o robô cobrir o próprio lance a cada rodada.

Então a consequência virou **interruptor com nome, num lugar só**:

```js
// src/estrategia.js
const PORTAIS_COM_LANCE_LIBERADO = [];
```

A checagem vem **antes de qualquer outra** em `decidirLance`, para que corrigir
um seletor de leitura nunca abra o caminho de escrita por acidente.

| Ganho | Como |
| --- | --- |
| Liberar vira decisão assinada | uma linha num arquivo que existe para isso, com autor e data |
| O atalho para de funcionar | `return false` no portal não basta — ele continua fora da lista |
| O estado fica visível | o `/health` publica `portais_com_lance_liberado` |

Um teste garante que a lista **nasce e permanece vazia**: se alguém liberar um
portal, a suíte falha e obriga a explicar por quê. Liberar continua permitido —
só não pode ser silencioso.

Verificado: `tsc` 0 erros, **1103 testes**, os 31 arquivos do ZIP compilam, e a
estratégia foi exercitada na própria VPS com os três casos que importam
(concorrente à frente → lance; liderando → aguarda; leitura falha → aguarda).

## O que continua aberto

**Precisa de decisão de arquitetura:**
A2 (como injetar o certificado no Chromium), A3 (headless ou display virtual
para o VNC servir de alguma coisa).

**Precisa de acesso a portal:**
os seletores de cada um, o `souLider()` de cada um, e o `enviarProposta()`.

**Risco aceito e registrado:**
C3 (estado só em memória), C4 (`max_memory_restart`), C6 (`pausado` sem volta),
D1 (chave no bundle), D2 (`--no-sandbox` como root).

## Princípio que a auditoria sugere firmar

**A lógica que decide preço mora em um lugar só, e tem teste.**

Hoje ela está duplicada entre a VPS e o template do repo, sem teste em nenhum dos
dois — e diverge. Uma decisão que move dinheiro não pode existir em duas cópias
que ninguém compara.
