# Robô de Lances — o que existe, o que trava, e o que falta

> **Data desta foto:** 09/09/2026. O que está aqui foi verificado, não deduzido —
> cada afirmação tem como conferir. Onde não deu para verificar, está escrito que
> não deu.

Este documento é o **mapa**: o estado do robô e o retrato de cada portal, com o
muro específico de cada um e o que falta para derrubá-lo.

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
| Navegar até a disputa | ⬜ | `navegarParaDisputa` ainda usa URL suposta |
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
| **Entra hoje** | Portal de Compras Públicas | edital real + permissão expressa |
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

Três peculiaridades, e nenhuma é técnica:

**A URL final diz `NaoAssinante`.** Depois de entrar, o robô parou em
`.../18/4/NaoAssinante/DashBoard/`. Isso sugere conta com acesso limitado —
possivelmente só consulta, sem participar de disputa. Combina com o aviso que o
Rafael recebeu do próprio portal ("você ainda não tem um plano ativo"). **Ainda
não confirmado.**

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

**O que falta:** um edital real onde a empresa esteja cadastrada. Sem ele,
`navegarParaDisputa` continua com URL suposta e `souLider()` não pode ser
escrito. Os testes com `TESTE-001` chegam ao portal e param ali — as 8 sessões de
hoje no `/health` estão todas em `erro` por esse motivo, e é o resultado correto.

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
| 1 | **`.pfx` A1 + senha** | cliente | Compras.gov — cadeia pronta, zero engenharia |
| 2 | **Senha numérica** BLL e BNC | cliente | 2 portais — teste imediato, sem pregão |
| 3 | **Edital real** onde a empresa esteja cadastrada | cliente | `navegarParaDisputa` e `souLider()` no Portal de Compras |
| 4 | **Permissão expressa** nos privados | cliente | uso legítimo; protege a conta dele |
| 5 | Resposta sobre a conta `NaoAssinante` | cliente | saber se aquela conta disputa ou só consulta |
| 6 | **Deploy dos 15 módulos** na VPS | nós | portais estaduais, incluindo o Pará |
| 7 | Tirar o PNCP do seletor de disputa | nós | remove um portal que não pode funcionar |
| 8 | **Decisão sobre o Licitações-e** | nós + cliente | o portal nº 1 — e o único com custo de infra |
| 9 | `/sessao/iniciar` assíncrono (pendência 22) | nós | a chamada estoura antes de o robô terminar |

Os itens 1 a 3 não têm engenharia nenhuma pela frente. É o cliente mandar, e
testar no mesmo dia.

---

## 7. Como conferir cada afirmação daqui

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

## 8. Ligações

- `docs/agente-cloud-pendencias.md` — o diário: cada investigação com comandos e
  datas. Seções 11 a 17 cobrem tudo que está resumido aqui.
- `docs/auditoria-agente-v2.2.0.md` — a auditoria de 02/09, onde o defeito do
  robô cobrindo o próprio lance foi encontrado.
- `src/lib/robo/portais.ts` — a autoridade dos 23 portais e do vocabulário do
  agente.
- `capturas-robo/` — as fotos que o robô tirou durante os testes.
