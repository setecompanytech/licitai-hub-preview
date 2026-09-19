# Praefectus / Licitai Hub

App de gestão de licitações. Vite + React 18 + TypeScript + Tailwind + shadcn/ui, backend Supabase
(projeto `uwtyuwktxalnpgrcbbgk`), build mobile via Capacitor.

> ⚠️ Este repo **também é editado pelo Lovable**, que commita direto no `main`. O remoto muda sem
> ação local. Por isso: **sempre sincronizar antes de mexer e antes de qualquer push.**

> 🎨 **Mexendo em aparência?** Há um rebranding em andamento, em branch separada, com paleta e
> tipografia novas já definidas. Leia `docs/rebranding-front-end.md` **antes** de escolher
> qualquer cor: ele traz a tabela de tradução do protótipo para os tokens do app, a fronteira
> de arquivos entre as frentes, e a regra de que cor nunca é escrita à mão dentro de `.tsx`.

## Rotinas (slash commands em `.claude/commands/`)

| Comando | Quando usar |
| --- | --- |
| `/sync` | Antes de começar a trabalhar e antes de commitar — puxa o remoto sem sobrescrever nada |
| `/salvar` | Mudança pronta — sincroniza, registra SQL, commita com mensagem padrão e faz push |
| `/sql` | Qualquer alteração de banco — gera migration + entrada em `SQL_MIGRATIONS.md` |
| `/run-local` | Sobe o app local (Vite em http://localhost:8080) |

Fora do Claude: `npm run run-local` ou `run-local.cmd` na raiz.

> ⚠️ `npm run build` passa com **identificador inexistente** — o Vite não checa tipos, e
> `tsc -p tsconfig.json` também não (a raiz tem `"files": []`, só referências). A checagem
> que pega isso é `npx tsc --noEmit -p tsconfig.app.json`, e ela é obrigatória antes de
> commitar edição feita por script: uma substituição que não casa falha em silêncio, o
> build passa e a tela quebra em branco no navegador.
>
> ⚠️ E o tsc **não vê hook depois de return antecipado** — a tela branca de 02/09 veio
> daí, duas vezes no mesmo dia. Quem pega é `npx eslint <arquivos tocados>`
> (react-hooks/rules-of-hooks é erro). Editou componente → lint no arquivo antes do
> commit, sempre.

## Comandos

```sh
npm run run-local   # install (se preciso) + dev server na porta 8080
npm run dev         # dev server
npm run test        # vitest
npm run lint        # eslint
npm run build       # build de produção — NÃO faz checagem de tipos
npx tsc --noEmit -p tsconfig.app.json   # a checagem de tipos de verdade
npm run preview     # servir o build
```

## Convenções

**Commits** — Conventional Commits em português, imperativo, escopo = módulo real do app:

```
feat(precificacao): avaliacao por IA, filtro de margem e integracao ML
fix(auth): nao derruba sessao quando TOKEN_REFRESHED falha transitoriamente
```

**Git** — histórico linear: `git pull --rebase`. Nunca `push --force`, nunca `reset --hard` sem confirmar.

**SQL** — toda mudança de schema entra em dois lugares, com o mesmo conteúdo:
1. `supabase/migrations/<AAAAMMDD>0000NN_<slug>.sql`
2. seção nova **no fim** de `SQL_MIGRATIONS.md`

SQL sempre idempotente (`IF NOT EXISTS`, `DROP POLICY IF EXISTS` antes de `CREATE POLICY`).
Toda tabela nova: `empresa_id` + `ENABLE ROW LEVEL SECURITY` + policies com
`public.is_empresa_member(auth.uid(), empresa_id)` (delete via `is_empresa_admin`).
As migrations **não são aplicadas automaticamente** — o SQL é colado no Supabase SQL Editor.

**Percentuais** — há duas convenções no repo, e a fronteira é o *conceito*, não o módulo:

| Conceito | Convenção | Exemplos |
| --- | --- | --- |
| **Alíquota legal transcrita** — copiada de uma tabela publicada em percentual | **percentual 0–100** (`18` = 18%) | Anexos do Simples, presunções do Presumido, PIS/COFINS, ICMS, ISS, MVA, redução de base |
| **Razão derivada** — nasce de uma divisão, nunca é transcrita | **fração 0–1** (`0.18` = 18%) | `tx_ganho_padrao`, `percentualRealizado`, margem calculada |

Alíquota é transcrita por humano de um texto legal; reescrevê-la como fração é uma chance de
errar um zero a cada atualização de tabela. Razão derivada não tem essa exposição — e
`src/lib/metas/projecao.ts` já a trata como fração.

Regras que sustentam a fronteira:
- Conversão de alíquota só em `src/lib/tributario/aliquota.ts` (helper `aplicar(aliquota, base)`),
  com validação de faixa em runtime. Nenhum outro arquivo divide alíquota por 100 solto.
- `CHECK (>= 0 AND <= 100)` só nas colunas que são alíquota tributária de verdade. **Nunca por
  varredura de nome**: `aliquota_st_mva` legitimamente passa de 100 e `variacao_pct` é negativa.
- Formatador de percentual declara a convenção no nome (`formatPercentual` / `formatFracao`).
  Dois `formatPercent` com semânticas opostas foi o vetor de erro 100× que existia aqui.

**Nomes de tabela** — não criar nada com prefixo `fin_` (família legada, metade vazia). Verdade
fiscal compartilhada vai em `financeiro_*`; artefato de precificação vai em `precificacao_*`.
Não escrever na tabela `precificacao` (singular) — é legado morto, apesar de aparecer no `types.ts`.

**Versão publicada** — `src/lib/versao.ts` carrega um carimbo (`AAAA-MM-DD.N`) que
deve ser incrementado a cada leva de mudanças enviada ao Lovable.
`bash scripts/verificar-publicacao.sh` compara o carimbo do repo com o que o
domínio serve e diz se o Publish já saiu. Sem ele, só dá para conferir mudança
que cria texto novo — correção de navegação ou de parâmetro de URL não deixa
assinatura, e ficava sem verificação.

**Segredos** — `.env` é versionado neste repo, então só pode conter chaves `anon`/`publishable`.
Chave `service_role`, senha ou token de API paga nunca entram em commit.

## Princípios de arquitetura

Padrões firmados em 2026-08 (auditoria do painel → automação → prontuário). Toda mudança
nova — inclusive as commitadas pelo Lovable — deve nascer alinhada a eles:

1. **Vocabulário único de status** — `src/lib/licitacao/status.ts` é a autoridade (espelho
   Deno em `functions/_shared/licitacao-status.ts`). Nunca redeclarar listas de status em
   tela ou função: três cópias divergentes mantiveram o arquivamento automático quebrado
   por meses (`Homologada` × `Homologado`).
2. **Processo é da empresa** — consultas a `licitacoes` filtram por `empresa_id` (ou por
   `id`, deixando o RLS decidir). Nunca `eq('user_id')` em licitações — nem no front, nem
   em edge function (o `user_id !== userId → 404` barrava colegas). Pessoais de verdade:
   `processos_interesse`, `monitoramento_editais`, `editais_favoritos`, `rascunhos`.
3. **Falha silenciosa é proibida** — toda operação que pode falhar deixa rastro e oferece
   retry: lápide `em_andamento` gravada ANTES de processar (workers do sync), card de erro
   com "Tentar novamente" (espelho PNCP, viewer), mensagem real do banco no toast. Job de
   cron "succeeded" não prova entrega: `net.http_post` é assíncrono.
4. **Coordenadas PNCP via helper** — `functions/_shared/pncp-coords.ts` (URL → colunas do
   processo → número de controle). Resolver só pela URL causou o mesmo defeito três vezes.
   No front, o mesmo padrão em `ProcessoWorkspace`. Dados do espelho: cache
   (`pncp_editais_cache`) primeiro, consulta ao vivo como complemento.
5. **Rotina temporária nasce com condição de parada** — jobs de tarefa pontual são
   desligados ao concluir (a restauração do financeiro rodou 3 meses à toa; o cleanup nunca
   rodou). Cron novo usa `public.supabase_project_url()` e `public.cron_auth_header()`.
6. **Publicação é pelo Lovable** — o domínio é servido por ele; FTP/Hostgator foi
   aposentado. Edge functions: `npx supabase functions deploy <fn> --project-ref
   uwtyuwktxalnpgrcbbgk` (o CLI leva o `_shared/` junto; o dashboard não).
   **Exceção: a `feature/rebrand-ui-ux` tem publicação própria** — ver abaixo.
7. **Política de cliente não vira regra de produto** — isto é SaaS: quando uma
   prática soa como "o certo" (bônus só após a NF quitada, meta medida sobre
   faturamento, prazo de convite de 7 dias), quase sempre é a prática de UM
   assinante. Vira coluna de configuração com padrão explícito, não `IF` no
   código nem `CHECK` no banco. Sinais de que a linha foi cruzada: a regra
   chegou por um caso concreto do dono do produto; escrevê-la exige a palavra
   "sempre"; nenhuma tela permite desligá-la. Duas obrigações ao configurar:
   registro existente herda o valor que reproduz o comportamento atual (mudança
   de política é decisão de alguém, nunca efeito colateral de migration), e
   ausência de configuração não é barrada por um padrão inventado — quem ainda
   não escolheu não pode ser bloqueado pela escolha alheia.

## Robô de Lances — regras de produto do dono (17/09/2026)

Decididas pelo Rafael Castro testando o cadastro. Detalhe, arquivos e testes em
`docs/robo-de-lances.md` ("17/09, tarde"). Mudança que contrarie qualquer uma
delas precisa passar por ele:

- **Processo vencido não vira disputa de lance.** Sessão num dia anterior só é
  cadastrada como acompanhamento, com o Modo Automático desligado
  (`lib/robo/prazo-da-disputa.ts`). Sessão de hoje que já abriu só avisa: pode
  estar em andamento. A lista de processos do cadastro esconde os encerrados
  por padrão.
- **Estratégias somam.** Melhor preço, Iminência e Desempatar no 1º lugar são
  caixas: uma, duas ou as três, e ao menos uma. O robô cobre o 1º quando
  qualquer marcada autoriza. Leitura única por `estrategiasDoItem`, em três
  cópias que mudam juntas: front, `_shared/robo-estrategias.ts` e o agente.
- **Pregão remarcado não é troca de data.** Edital alterado muda itens,
  quantidades e unidades (Lei 14.133, art. 55 §1º). Nada troca só a data da
  disputa: a sessão passada leva a "Conferir alterações", o gatilho do processo
  só avisa, e o webhook tira o lance do robô quando a licitação mudou desde o
  cadastro (`_shared/robo-alteracoes-da-licitacao.ts` + espelho em `lib/robo`).
- **Sininho do robô guarda 24 horas; o histórico, 12 meses.** Aviso do robô
  (link `/robo-lances…` ou `/admin/robo-lances…`) é apagado do sininho depois
  de 24 horas, só se já estiver em `robo_historico`, a tabela da plataforma
  lida só por admin da plataforma em Admin › Configurações do Robô de Lances ›
  Histórico do robô (migration `20260917000004`). Não esconder: apagar. Não
  liberar leitura por empresa: há aviso só da equipe, com a tela remota.
- **Nome de botão é do produto, não do portal.** "Conferir alterações", não
  "Conferir no Compras.gov": a mesma tela precisa servir aos próximos portais.
- **A fase do processo é lida da operação, não do Kanban (19/09).** Sessão de
  disputa cadastrada no robô move o processo para "Em Disputa"; proposta
  registrada como enviada (aba Proposta) move para "Proposta Enviada". Só para
  a frente, nunca sobre decidido/arquivado, e sessão de acompanhamento não
  promove — a promoção carimba `data_proposta_enviada`, que as metas contam
  como participação. Regra em `lib/licitacao/promocao-de-fase.ts`; gravação por
  `useLicitacaoIntegration.promoverFase`. O espelho PNCP (Revogada/Anulada/
  Suspensa) só PEDE desfecho na agenda; nunca decide por ninguém.

## Permissões — o que é da plataforma não aparece ao cliente (pedido do Rafael em 14/09, decidido em 19/09/2026)

O Rafael quer que parte do sistema deixe de ficar exposta às contas das
empresas que usam o plano e passe a viver só num acesso admin (mensagem de
14/09: "todos os usuários visualizam configurações que só quem desenvolve o
sistema deveria ter"). **O Grupo Santa Rosa é CNPJ do próprio Rafael**, não
cliente (Giovanny, 19/09); a BAQPLAST parece ser do mesmo grupo ("a gente
utiliza a empresa Baqplast", Rafael, 19/09 — a confirmar). A regra vale mesmo
assim: o pedido foi dele, sobre o próprio login ("não cabe ao usuário aderente
ao plano"), e o sistema é SaaS — há assinantes de fora (ex.: Voltele). **A lista completa do que esconder ainda
não existe** — confirmar com ele antes de mexer. Já há permissões no banco e
em docs do sistema: partir delas.

**Decidido em 19/09 (Ian, com o Rafael ciente):** a plataforma ganha **uma
conta de engenharia, `engsoft@praefectus.com.br`, admin da plataforma**
(`user_roles.role = 'admin'`) — a "gestão técnica do sistema" / Sys Admin
de que o Giovanny falou em 18/09. **Os dois admins coexistem** (Ian, 19/09):
a `comercial@gruposantarosa.com.br` — login do Rafael, admin da Santa Rosa e
até então o ÚNICO admin da plataforma — **mantém o papel** para a gestão do
negócio (assinaturas, marketing, métricas, o resto do grupo Admin).

**No robô, a divisão é por natureza: operação × oficina técnica** (Ian,
19/09, revendo no mesmo dia um desenho que mandava tudo ao `engsoft@`). Os
prints do Rafael (18/09) eram da aba Agente e infraestrutura: agente, RAM,
portais no ar, checklist — *"configurações internas do desenvolvedor do
sistema"*. Ele não apontou a tela remota, e é ele quem clica o captcha toda
manhã, pelo login da Santa Rosa; um segundo login para isso seria atrito
diário, e captcha perdido é disputa perdida.
- **Operação — todo admin da plataforma**, a Santa Rosa sem segunda conta:
  Sessões e tela remota, Avisos aos clientes, Histórico do robô, o toast da
  tela remota e os avisos de captcha / "assistir ao vivo" / "robô entrando".
- **Oficina técnica — só a conta de engenharia**: as abas Agente e
  infraestrutura e Diagnóstico, o cru técnico do webhook (`detalhe_tecnico`,
  nome e endereço de agente, saúde completa), configurar agente, testar o freio.

Três camadas, o mesmo corte:
- tela — `ABAS_DA_ENGENHARIA` em `AdminRoboLances.tsx`, com
  `useContaDeEngenharia`; a rota segue com o `AdminGuard`;
- banco — `sou_conta_de_engenharia()` só em agentes, registro de chamadas e
  `contas_para_plataforma` (migrations `20260919000006` + `000007`);
- servidor — `robo-lances-webhook` com duas perguntas por ação: `ehAdmin` para
  a operação, `verDetalhe` para o cru.

O gov.br do robô não muda (segue o CPF do Rafael pela Santa Rosa).
**Passos 1 e 2 feitos em 19/09** (SQL no Editor, pelo Ian): `engsoft@` criado
já confirmado, papéis `admin, user`, sem empresa, nome "Engenharia
Praefectus". A migration `20260919000002` registra só o papel.

**A conta de engenharia não cria empresa nem entra em empresa** (19/09).
Definição por fato, não por e-mail: **admin da plataforma sem empresa
nenhuma** (`lib/conta-de-engenharia.ts`, espelhada no banco em
`eh_conta_de_engenharia`). A da Santa Rosa, também admin, está na empresa e
fica de fora — é o que deixa os dois admins coexistirem sem a regra atingir o
login do Rafael. Na tela: o seletor mostra "Conta de engenharia" sem "Cadastrar
empresa", o assistente de boas-vindas não abre, `/empresas` não cadastra e
`EmpresaContext.addEmpresa` recusa (os três caminhos de criação passam por
ela). No banco, a trava de verdade: migration `20260919000003`, com gatilhos
em `empresa_membros` e `empresas` — **aplicada em 19/09** e conferida
(`eh_conta_de_engenharia`: engsoft@ `true`, comercial@gruposantarosa `false`).

A mesma mensagem pedia outra coisa, **fora do código**: passar Claude, IA,
Supabase, Lovable, GitHub e pagamentos dos e-mails da xfin e do
`praefectusbr@gmail.com` para o `engsoft@`. É do Giovanny. Trocou chave de
serviço → os secrets das edge functions (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`,
`RESEND_API_KEY`, `STRIPE_SECRET_KEY`, Z-API…) mudam **no mesmo dia**, senão a
função para calada. GitHub e Lovable mudam juntos: são o caminho do Publish.

Passos da conta de engenharia:
1. ✅ criar a conta `engsoft@` no sistema (19/09, SQL no Editor);
2. ✅ SQL idempotente dando `admin` a ela (migration `20260919000002`);
3. ✅ (local, 19/09) o admin do robô mostra a configuração de agente **de todas
   as contas**, com o dono de cada uma (`contas_para_plataforma`, migration
   `20260919000004`); para a conta de engenharia, o checklist de ativação, a
   trilha de auditoria e o tempo real — que leem a conta logada — dão lugar a
   um aviso. A trilha dos clientes NÃO foi aberta à plataforma: guarda valores
   de lance e ações de cada cliente. Esses três painéis saíram de vez;
   `AuditTrailViewer` e `DisputaRealtimePanel` ficaram sem uso no app;
4. testar os dois lados: logado como `engsoft@` (as cinco abas) e como a
   Santa Rosa (Sessões, Avisos e Histórico; captcha e tela remota sem trocar
   de conta);
5. ~~tirar o `admin` da `comercial@gruposantarosa`~~ — **não será feito**
   (Ian, 19/09: os dois admins coexistem). No lugar, **operação × oficina
   técnica** (acima):
   - **banco** — `20260919000006` **aplicada** (tudo à engenharia) e
     `20260919000007` **aplicada e conferida em 19/09** (a operação volta a
     todo admin; `pg_policies`: 4 regras de operação com `has_role`, 2 da
     oficina com `sou_conta_de_engenharia()` — agentes e registro de chamadas);
   - **tela** — local: as abas da oficina, e o toast de volta a todo admin;
   - **servidor** — **pronto local, pendente de deploy**:
     - `verDetalhe` para o cru, `ehAdmin` para a operação;
     - healthcheck: completo para a engenharia; reduzido para quem opera, com
       as sessões e os pedidos de toda empresa;
     - aviso novo "Robô entrando" a todo admin, menos a quem clicou, antes de
       acionar o robô (manual e agendador);
     - arquivos: `_shared/robo-plataforma.ts` e `_shared/robo-estado-da-sala.ts`.

O exemplo dele: **as configurações do robô não ficam no acesso das empresas.**
Como está em 19/09:
- a tela do cliente (`/robo-lances`) já perdeu as abas Agente, Portais e
  Configurações em 14/09; o que é da operação mora em Admin › Configurações do
  Robô de Lances (`/admin/robo-lances`), que só abre para o operador do SaaS;
- ao **admin da empresa** a tela do cliente ainda mostra, na `FaixaDaEmpresa`,
  o cadastro dos acessos aos portais (`CredenciaisPortalForm`) e o checklist
  de ativação (`AtivacaoChecklist modo="cliente"`). Se isso também sai do
  cliente, é decisão dele.

Em 19/09 a divisão ainda não tinha sido feita: as três levas do Giovanny desse
dia (design Fluent, dashboard, financeiro) não tocam em permissão.

As permissões são **em camadas**, e as duas de baixo já existem; o pedido novo
é sobre a de cima. A mudança se apoia nelas (não criar um quarto nível):

| Camada | Quem é | Onde se decide |
| --- | --- | --- |
| 1. Plataforma — o operador do SaaS (pedido novo) | `user_roles.role = 'admin'` → `useUserRole().isSystemAdmin` | rotas `/admin/*` (`ehRotaDoOperador` em `lib/route-permissions.ts`), `AdminGuard` na rota, RLS com `has_role(auth.uid(), 'admin')` |
| 2. Empresa — quem assina (Santa Rosa, BAQPLAST, Voltele) | `empresa_membros.papel = 'admin'` na empresa ATIVA | `ROTAS_ADMINISTRATIVAS` (empresas, equipe, configurações, integração) |
| 3. Sub-acessos da empresa, por setor — pedido do Rafael meses atrás (ex.: no escritório da Santa Rosa, separar o comercial do financeiro) | `empresa_membros.papel` (`operador`/`viewer`) + `equipe` (setor) + `permissoes` (módulos) | `ROUTE_SECTOR_MAP` via `useMembroPermissoes().canAccessRoute`; convite por setor (`create-sector-invite` → `empresa_convites.email_setor`); login de setor compartilhado com identificação individual (`ColaboradorIdentificacaoModal`, `nome_individual`/`login_individual`); tela Equipe › Permissões |

Cuidados que a divisão precisa respeitar:
- **Conta de cliente não vira admin da plataforma.** Quem tem
  `user_roles.role = 'admin'` vê o admin inteiro, menos a oficina técnica do
  robô — e inclusive a tela remota, compartilhada entre as empresas, e as
  sessões e os pedidos de código de todas elas. A ÚNICA exceção aceita é a
  `comercial@gruposantarosa`, login do dono do produto (decisão de 19/09).
  Nenhuma outra conta de empresa ganha esse papel: o acesso técnico é do
  `engsoft@`.
- Esconder menu não protege: a trava de verdade é a rota (`AdminGuard`) e o
  RLS. Tela que só some do menu continua aberta pela URL.
- **O admin da plataforma enxerga a operação, não o negócio do cliente.**
  Levantamento de 19/09 (`pg_policies` com `has_role(... 'admin')`, 46
  regras): certas as de operação (robô, logs, portais), catálogo do produto,
  negócio da Praefectus (assinaturas, leads, suporte) e LGPD. As quatro
  "dono OU admin" sobre dado de cliente (`notas_fiscais`, `nota_fiscal_itens`,
  `sub_tarefas`, `transacoes_bancarias`) foram fechadas na migration
  `20260919000005`, vazias no dia — **aplicada e conferida em 19/09**
  (nenhuma das quatro com `has_role`). Regra nova com passe do admin sobre
  dado de empresa não entra sem essa conversa.
- Não incluir conta em empresa alheia para testar: foi o que misturou Santa
  Rosa e BAQPLAST na tela em 16/09 (`docs/robo-de-lances.md`).

Abertos em 19/09, para o Rafael decidir:
- `financeiro+financeiro-01@gruposantarosa` é **admin** da Santa Rosa, e admin
  da empresa pula a trava de setor: vê comercial e robô. Deveria ser operador?
- A camada 3 **só esconde o menu**: nenhuma rota confere o setor
  (`useAuthorization().isAllowed` não tem quem chame; `/financeiro` está em
  `ProtectedPages`), e as migrations não têm RLS por setor. Confirmar pelas
  regras do banco (`pg_policies` das tabelas `financeiro_%`) antes de afirmar.
- "Configurações" e "API e integração" saem do admin da empresa?
- As contas `comercialbaqplast+com-0N@gmail.com` estão na empresa **O S
  Distribuidora**, não numa "BAQPLAST": é a mesma empresa?

## Preview do rebranding — a branch tem DOIS remotos

A `feature/rebrand-ui-ux` está no ar em **https://praefectus-preview.pages.dev**,
para o Rafael navegar e avaliar sem esperar merge. Por isso ela tem dois destinos:

| Remoto | Repositório | Serve a |
| --- | --- | --- |
| `origin` | `xfinconsultoriaempresarial-a11y/licitai-hub` | o time — é onde Ian e Caio se encontram |
| `sete` | `setecompanytech/licitai-hub-preview` | o Cloudflare Pages, que compila e publica |

O `sete` existe porque a organização principal tinha trava de permissão com a
Cloudflare. O projeto no Pages é `praefectus-preview`, ligado a esse repo, com
`npm run build` → `dist` e **`feature/rebrand-ui-ux` como branch de produção**.

```sh
git push origin feature/rebrand-ui-ux   # o time vê
git push sete   feature/rebrand-ui-ux   # o Rafael vê  ← não esqueça este
```

> ⚠️ **Esquecer o segundo push não gera erro.** O commit entra no `origin`, o time
> vê, tudo parece certo — e o Rafael continua avaliando a versão velha, sem nada
> na tela avisando. É exatamente a falha silenciosa que o princípio 3 proíbe, e o
> `/salvar` já foi ajustado para fazer os dois.

Conferir sem abrir o painel da Cloudflare — os dois hashes têm que bater:

```sh
git rev-parse --short HEAD
git ls-remote --heads sete feature/rebrand-ui-ux
```

Para provar que o ar é ESTE código, e não só que respondeu 200: os nomes dos
assets carregam hash de conteúdo, então `ls dist/assets/` depois de um
`npm run build` local dá o nome exato que o site tem que servir.

Rota profunda funciona (`/dashboard` sem 404) por causa de `public/_redirects`,
que traz `/*  /index.html  200`. Se ele sumir, o Rafael cai em 404 ao recarregar
qualquer tela — e só ele vai notar.

## Estrutura

```
src/                   app React (alias @ -> ./src)
supabase/migrations/   migrations versionadas
supabase/functions/    edge functions (Deno) — precisam de deploy separado
docs/                  notas de infra e roteiros de teste
scripts/               utilitários de edge functions
SQL_MIGRATIONS.md      log de SQL para colar no SQL Editor
```
