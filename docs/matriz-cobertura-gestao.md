# Matriz de cobertura — módulo Gestão

Levantada em 13/09/2026 por inspeção do código, antes de qualquer alteração,
como o comando exige. Cada linha foi verificada no arquivo, não inferida.
Atualizada ao fim da adequação (commit `42e9859d`).

## Situação por função

| Função | Composição da referência | Verificação |
| --- | --- | --- |
| Estratégicas | ✅ indicadores → filtros → tabela → painel | render + captura |
| Compromissos | ✅ idem, 8 abas preservadas | render + captura |
| Calendário | ✅ 65/35, agenda antes no celular | render + captura |
| Workflow IA | ✅ três colunas | render (rota exige plano) |
| Kanban | ✅ colunas 260px, etapa única no celular | render + captura |
| Dossiê | ✅ 7 abas, cabeçalho compacto | render |
| Robô de Lances | ✅ três colunas, seis eixos separados | render (rota exige plano) |
| Histórico | ✅ três eixos separados, painel | render + captura |
| Metas | ✅ Painel/Equipe/Relatórios, critérios visíveis | render + captura |
| Contratos e ATAs | ✅ tabela hierárquica, 4 abas internas | render (rota exige plano) |
| Compras e estoque | ✅ 6 abas, Lista ⇄ Quadro | render (rota exige plano) |

Quatro rotas não puderam ser capturadas no navegador: a conta de teste não tem
plano, e o `PlanGuard` as barra — corretamente. A verificação delas é por teste
de render, que é o que a sessão vinha usando para telas inalcançáveis na
captura automatizada.

Legenda de situação: **✅ adequada** · **⚠️ divergência registrada** (o sistema
faz diferente da referência, e a regra existente vence).

---

## 1. Rotas reais

| Função | Rota | Página | Guarda | Setores que veem no menu |
| --- | --- | --- | --- | --- |
| Estratégicas | `/licitacoes-estrategicas` | `pages/LicitacoesEstrategicas.tsx` | `ProtectedPages` | comercial, licitacoes |
| Compromissos | `/meus-compromissos` | `pages/MeusCompromissos.tsx` | `ProtectedPages` | geral, comercial, licitacoes, juridico |
| Calendário | `/calendario` | `pages/Calendario.tsx` → `components/calendario/CalendarioLicitacoes.tsx` | `ProtectedPages` | geral, comercial, licitacoes |
| Workflow IA | `/workflow-ia` | `pages/WorkflowIA.tsx` | `PlanPages` (plano **profissional**) | comercial, licitacoes |
| Kanban | `/kanban` | `pages/KanbanPage.tsx` | `ProtectedPages` | comercial, licitacoes |
| Dossiê do processo | `/processo/:id` | `pages/ProcessoWorkspace.tsx` | `ProtectedPages` | — (não listado) |
| Robô de Lances | `/robo-lances` | `pages/RoboLances.tsx` | `PlanPages` | — |
| Histórico | `/historico-licitacoes` | `pages/HistoricoLicitacoes.tsx` | `ProtectedPages` | — |
| Metas do Comercial | `/metas-comercial` | `pages/MetasComercial.tsx` | `ProtectedPages` | — |
| Definir metas | `/definir-metas` | `pages/DefinirMetas.tsx` | `ProtectedPages` + `isAdmin` na tela | menu `adminOnly` |
| Contratos e ATAs | `/gestao-contratos` | `pages/GestaoContratos.tsx` | `PlanPages` | — |
| Compras, pedidos e estoque | `/gestao-compras` | `pages/GestaoCompras.tsx` | `PlanPages` | — |
| Produtos | `/produtos` | `pages/Produtos.tsx` | `ProtectedPages` | — |

`ROUTE_SECTOR_MAP` (`src/lib/route-permissions.ts`) só filtra a **visibilidade
no menu** — não barra a rota. A autorização fina vive no RLS e nos triggers.

---

## 2. Abas reais por função

Strings exatas, extraídas do código. Onde o registro `paginas.ts` diverge, está
marcado.

| Função | Abas | Onde mora o estado |
| --- | --- | --- |
| Estratégicas | `oportunidades`, `capag` | era `defaultValue`; passou para `?aba=` |
| Compromissos | `all`, `interessado`, `analisando`, `aprovado`, `cadastrado`, `rejeitado`, `arquivado`, `removidos` | era `useState`; passou para `?aba=` — ⚠️ `paginas.ts` declarava 2 abas (`Ativos`/`Removidos`), são 8 |
| Calendário | `todos` ("Dia"), `proximos` ("Próximos 30d"), `documentos` | `useState` — ⚠️ `paginas.ts` não declarava abas |
| Workflow IA | nenhuma | — |
| Kanban | `kanban`, `compromissos`, `historico` | `?aba=` ✅ |
| Dossiê | `visao`, `documentos`, `anexos`, `precificacao`, `proposta`, `modulos`, `historico` | ⚠️ URL era LIDA mas nunca ESCRITA — corrigido |
| Robô de Lances | `disputar`, `agente`, `portais`, `configuracoes` (as 3 últimas só admin) + subabas `mural`, `simulacao`, `operacoes`, `auditoria` | `useState` |
| Histórico | nenhuma | — |
| Metas | `painel`, `equipe`, `relatorios` | `?tab=` ✅ |
| Contratos | `dashboard`, `itens`, `pedidos` (só contrato), `contratos-derivados` (só ATA), `contratos-aditivos` | `?aba=` ✅ |
| Compras | `pedidos`, `produtos`, `fornecedores`, `estoque`, `nfe`, `certificado` | era `useState` (perdia no F5); passou para `?aba=` |

---

## 3. Relacionamentos preservados

O comando exige que estes vínculos continuem inteiros. Todos foram verificados
no código:

| Vínculo | Como é feito hoje |
| --- | --- |
| Processo → documentação | `processo_habilitacao_checklist`, `processo_documentos` (+ versões), `processo_anexos`, bucket `processo-arquivos` |
| Processo → precificação | `licitacao_itens` ← espelho PNCP; `catalogo_itens_precificados`; `rascunhos` (`modulo='precificacao_planilha'`) |
| Processo → proposta | `PropostaTecnica` embutido com `licitacaoIdEmbed` |
| Kanban → sessão do robô | `ConfigurarLanceDialog` importa de `licitacoes` e resolve itens pela cascata de 4 fontes |
| Workflow → processos e compromissos | por texto: a esteira encaminha para `/meus-compromissos` para aprovação |
| ATA → contrato | `contratos.ata_srp_id` (FK auto-referencial); derivado = `tipo_documento='contrato' AND ata_srp_id IS NOT NULL` |
| Contrato → itens | `contrato_itens` (com `ata_item_id`, `produto_id`, saldos) |
| Contrato → empenho | `contrato_empenhos` + `contrato_empenho_itens` + `contrato_empenho_movimentos` |
| Empenho → pedido | `contrato_pedidos.empenho_id` |
| Pedido → nota | `contrato_pedidos` → `pre_notas_fiscais` → `notas_fiscais`; entrada por `nfe_entradas` |
| Nota → estoque | `estoque_movimentos` com `origem` e `nfe_id`/`contrato_pedido_id`; `uq_estoque_mov_contrato_pedido` impede baixa dupla |
| Pedido → financeiro | `financeiro_lancamentos` via `VincularLancamentoDialog` |

---

## 4. Divergências entre referência e sistema

Registradas conforme o item 9 do comando. Em todas, **a regra existente
venceu** e só a apresentação mudou.

| # | Referência mostra | Sistema faz | Decisão |
| --- | --- | --- | --- |
| 1 | Estoque com Saldo físico / Reservado / Disponível | modelo tem só `produtos.saldo_atual`; reserva é calculada em memória e só na aba Pedidos do contrato | ver relatório da tela — ou reusar o mesmo cálculo declarando que é derivado, ou marcar como não apurado; **nunca inventar coluna** |
| 2 | Certificado A3 com "Verificar dispositivo" e bloco de compatibilidade | detecção de A3 **não existe**; hoje é só um alerta afirmando que o sistema detecta | não implementar; corrigir o texto para a verdade |
| 3 | Contadores, valores, CNPJs, datas e órgãos nas imagens | dados ilustrativos | nenhum copiado para produção |
| 4 | Score tratado como chance de vitória | modelo não validado para isso; no fallback do banco os scores são fixos em 50 | rotular como "score"/"recomendação" e sinalizar quando vier do fallback |
| 5 | ATA e derivados somados numa régua só | bases de cálculo distintas | aviso explícito de que não se somam |

---

## 5. Achados de código que a inspeção revelou

Não estavam no pedido, mas o comando manda registrar divergências e proíbe
"funcionalidades existentes inacessíveis". Cada um foi tratado na tela
correspondente ou registrado como pendência.

**Travas de segurança que não travam**
- Robô: `limiteFinanceiro` nunca recebe valor (não existe `setLimiteFinanceiro`), então a checagem `excedeLimite` do diálogo de autorização fica desligada.
- Robô: o "2FA" do aceite de termos gera o código no cliente e o exibe no próprio toast.

**Dados que se perdem**
- Metas: `useSalvarMeta` aceita `meta_quitacao` mas não o inclui no payload do upsert — a meta de NF-e quitada digitada nunca chega ao banco.
- Certificado: `nome_titular`, `cnpj_titular` e `validade` nunca são gravados; o badge "Vencido/Válido" sempre diz "Válido".

**Falha silenciosa (princípio 3 do CLAUDE.md)**
- Calendário: as 3 queries não expõem `isLoading` nem tratam `error` — falha de rede é idêntica a "nada agendado".
- Kanban, Histórico, dossiê, `HistoricoExtracoes`: `error` descartado na desestruturação.
- `CertificadoDigital.loadCerts`: erro ignorado, vira lista vazia.
- Workflow IA: `onError` marca a etapa como **concluída** e descarta a mensagem real do `ai-stream`.

**Código morto**
- `components/contratos/`: `ContratoAditivos` (815 l.), `ContratoCustos` (887 l.), `ContratoComissoes` (437 l.), `ContratoNotasFiscais` (213 l.) — zero imports; a funcionalidade existe reimplementada inline.
- `components/robo-lances/`: `GuiaPassoAPasso`, `DeteccaoPortais`.
- Dossiê: `pncpArquivos` nunca recebe valor — o bloco "Arquivos (N)" é inalcançável.
- Robô: aba "Operações" sempre vazia (`operations` sem setter).
- Estratégicas: badge "Salva" nunca dispara (`lic.salva` é sempre `false`).
- `ui/sidebar.tsx` (22,8 KB) ficou órfão quando a coluna saiu — voltou a ter dono? **Não**: `AppSidebar.tsx` é próprio. Continua órfão.

**Duplicação**
- `pages/Produtos.tsx` × `components/gestao-compras/ProdutosOmie.tsx`: clones do mesmo cadastro, servidos por rotas com proteção diferente.
- Dois sistemas de pedido de compra: `pedidos`/`pedido_itens` (vivo, no quadro) e `pedidos_compra`/`itens_pedido_compra` (legado inline).
- Duas fontes de fornecedor: `fornecedores` e `financeiro_pessoas`.
- Três registros de navegação paralelos: `menu.ts`, `paginas.ts` e a lista interna de `GlobalSearch.tsx` — o terceiro já divergiu.
- Três autoridades de papel: `usePapelEmpresa`, `useMembroPermissoes`, `useAuthorization`.

**Escopo de dados**
- `GestaoCompras.loadContratos` filtra por `user_id`, violando o princípio 2 do CLAUDE.md: contrato de colega não aparece no select de vínculo do pedido.

**Agregação divergente**
- Histórico: o KPI "Perdidas" conta `resultado === 'Perdida'`, mas `registrarPerda` grava `'Perdedor'` — perdas registradas pelo caminho oficial não entram no número.
- Compromissos, Estratégicas, Histórico: KPIs calculados sobre a lista completa enquanto a tabela mostra a filtrada.

**Bug de cache**
- Calendário: `.sort()` in-place sobre o array do react-query, mutando o cache.

---

## 6. Pendências que ficaram com o dono do produto

Nenhuma delas é trabalho de apresentação: todas mexem em dado gravado, em
regra de negócio ou em backend, e mudá-las por conta própria seria alterar o
produto sem que ninguém tivesse decidido.

| Pendência | Onde | Por que ficou |
| --- | --- | --- |
| `dupla_autenticacao_verificada` é gravada como `true` no aceite de nível 3, mas o código de 6 dígitos é sorteado no navegador e mostrado a quem vai digitá-lo | `AceiteTermosDialog` | É registro falso no banco. Consertar de verdade é gerar e conferir no servidor, com segundo canal. Os textos da tela e da política já deixaram de chamar aquilo de dois fatores |
| "Perdidas" conta `resultado='Perdida'`, mas o fluxo oficial grava `'Perdedor'` | Histórico | Somar as duas grafias muda a agregação, e a definição vive em outras telas. A tela passou a declarar quantos registros ficam de fora |
| Dois sistemas de pedido de compra convivem (`pedidos` × `pedidos_compra`) | Compras | `nfe_entradas.pedido_id` e `estoque_movimentos.pedido_id` têm FK para o legado; migrar exige mexer nas duas e pode haver dado de cliente |
| Extração de itens do certificado `.pfx` | Certificado | Exige abrir o PKCS#12, que é cifrado com a senha — e a senha não é (nem deve ser) armazenada. Hoje os campos são digitados, rotulados como tal |
| `types.ts` do Supabase defasado (16/08; migrations até 09/09) | Todo o módulo | Daí os `as any` nos casts. Regenerá-lo é trabalho próprio |
| Rodapés com a marca do sistema em exportações que costumam ser anexadas à proposta | `mdo-export.ts`, calculadora de engenharia | Mesma família do carimbo de cópia já corrigido, mas em artefato gerado — decisão de produto |
| O timbrado da proposta não passa por `lib/timbrado/timbrado.ts` | Proposta | Rodapé e ajustes de posição da empresa não chegam ao PDF; SVG aparece na prévia e some no arquivo |

## 7. O que NÃO foi feito, e por quê

- Nenhuma regra de negócio, cálculo, status, permissão, RLS ou trigger foi alterada.
- Nenhuma operação real de envio, faturamento, estoque, proposta ou lance foi executada para validar visual.
- Detecção de certificado A3 não foi implementada: não existe e a referência apenas a sugere.
- `types.ts` do Supabase está defasado (16/08, migrations até 09/09) — daí os `as never`/`as any` no módulo. Regenerá-lo é trabalho próprio, fora deste comando.
