# Redesign visual v3 — achados de lógica anotados pelas frentes (21/09/2026)

Registro do que as frentes do redesign (só apresentação, 19–21/09/2026)
**viram e não tocaram**, porque mexer seria mudar comportamento — e o comando
do dono proibia. Cada item aponta arquivo e trecho; nada aqui foi corrigido.
Serve de pauta para as próximas ondas de manutenção. As "decisões de
apresentação a validar" são mudanças visuais que passam perto de texto ou de
hierarquia e merecem um olhar do dono.


## Gestão / Kanban (28ee9fb5)
- MeusCompromissos.handleConfirmarAcao retorna depois de setExecutandoAcao(true) sem finally.
- MarcarInteresseDialog grava `data_abertura: edital.data_encerramento`.
- HistoricoLicitacoes: nota `perdasForaDaContagem` obsoleta.
- CalendarioLicitacoes: `hoje = new Date()` a cada render; dois componentes de contagem regressiva paralelos.
- AnaliseCapag `catch (e: any)`.

## Robô de Lances (14ca8885)
- ConfigurarLanceDialog.applyImportedItems aplica 95%/80% automaticamente.
- NivelAutomacaoSelector menciona "2FA" contradizendo AceiteTermosDialog.
- AgenteExternoConfig `planSlug = isAdmin ? 'enterprise'`.

## Documentos / Jurídico / Contábil (9619ef29)
- ReequilibrioIA: botão "Buscar Índice/CCT/Comprovação" com `onClick={() => {}}`; modelo 'gemini-2.5-flash' fixo no salvarVersao.
- PedidosJuridicosList: exclusão via `confirm()`; `supabase.from('juridico_pedidos' as any)` importado no clique.
- BaseJuridicaUpload / BaseContabilUpload: handleDelete engole erro.
- AnaliseDocsConcorrente: lista `licitacoes` sem filtro de empresa_id (só RLS).
- AssessoriaCadastral: KPI "Expirados" em âmbar × selo vermelho (LinhaKpis agora tem tom critico — ajustar depois).
- ModelosTemplatesTab: `style={{ zoom }}`.
- Decisões: chip "IA Jurídica"/"IA Contábil" → selo "Praefectus IA"; coluna "Empresa" não adicionada (cofre é de uma empresa).

## Financeiro núcleo (dc66049f)
- FinKanban.saldoContaAtual soma todas as contas (inclusive inativas) × FinLancamentos só ativas — mesmo rótulo "Saldo atual", dois números.
- FinCalendarioFinanceiro: badge do popover mostra `l.status` cru.
- FinPedidosAFaturar: prévia divide igualmente; insert põe sobra de centavos na última parcela.
- FinFluxoCaixa: série "Financiamento" era `--accent` (= primário) → trocada para `--info` (apresentação).

## Financeiro restante (62652043) — detalhe em financeiro-restante-relatorios.md
- Integrações: datas `YYYY-MM-DD` parseadas em UTC (mês anterior); selos com valor cru; stub Open Finance avança `ultima_sincronizacao` com erro; Pix "Marcar paga" grava data do clique; BR Code enviado a api.qrserver.com.
- Emissor NF-e: IPI por item não entra em `valor_total`; "Total produtos" com ponto decimal; CST PIS/COFINS deduzido só da alíquota; Sefaz início da competência em UTC; FinConfigNFe `select("*")` traz `api_token` ao estado.
- Utilitários: calendário com ramo `realizado` morto e badge cru colorido por data.
- Importações: exportação XLSX com 5 colunas inexistentes (sempre vazias); OFX marca conciliado sem gravar conciliação e Confirmar ativo com 0 linhas; XLSX datas em UTC; planilha não valida data_competencia; CNAB remessa é stub; extração `lancId="ok"` sem vínculo.
- Operações: transferência grava 1 linha × LancamentoDialog 2 pernas; chaves de query `fin-lancamentos` × `financeiro-lancamentos`; baixa em lote sobrescreve conta_id; vigência "hoje" em UTC; status redeclarado no VinculoContratoSelector.
- Cadastros: `validacao` nunca renderizado; erro do nome antes de digitar; `window.confirm`; "Nova conta" sempre disabled.
- Auditoria/relatórios: `includes("a_pagar")` nunca verdadeiro; `agrupamento` não lido; AuditoriaBancos coluna Nome sempre "OK".
- Apuração: DRE por substring de `codigo_dre` × `grupo_dre`; Balanço "Desbalanceado" por construção; orçamento não permite zerar meta; janela 12 meses em UTC.
- Decisões de apresentação: "Aprovar"/"Gerar" viraram outline; prévias de importação viraram tabela com rótulos de coluna novos; filtros de Contas reordenados; QR Pix em `bg-white`.

## Monitoramento (104f2aa4)
- useAlertas.buscarAlertas grava mensagem genérica (erro agora exibido em Alert).
- MonitoramentoEditais.carregarDetalhes engole falha e resolve PNCP só pela URL (princípios 3 e 4).
- DiariosOficiais e Boletins descartam `error` do Supabase.
- Código morto: MuralLicitacoes (2.323 linhas), LicitacoesTab, DiariosOficiaisTab, ConfiguracaoPesquisaTab, DispensaEletronicaTab, GuiaComprasGov, ScoreViabilidade, MonitoramentoDiariosCard, CadastroManualEdital, ChatAureliaEditais, alertas/AlertaBadge.

## Prontuário (fb5c6aad)
- DocumentosManager busca `empresas` com `.limit(1).maybeSingle()` sem filtrar a empresa ativa.
- loadPrecificacao / ItensEditalPrecificacao filtram/apagam por `user_id` (colega não vê).
- Diálogo "Novo Documento" sem Cancelar; exclusões via `window.confirm`.

## IA / Aurélia (b264d984)
- Assistente.tsx é página morta (rota redireciona para /aurelia).
- useFabArrastavel.TAMANHO = 56 assume FAB antigo (agora 48).
- Workflow IA "em execução" segue âmbar (etapas.ts mapeia analisando → atencao; comando pede azul).
- `.aurelia-fab`/`.aurelia-glow` em index.css sem uso.
- Decisão: Ferramentas.tsx passou a vir do registro (chips Novo/Premium sumiram; respeita permissões).

## Proposta Técnica (7149bf66)
- "Limpar e iniciar nova proposta" apaga o rascunho sem confirmação (o "Nova proposta" do topo confirma).
- PropostaDownload aceita `declaracoesAtivas` mas PDF/Word usam lista fixa; a página nem passa a prop.
- EnvioProposta lê `pendingItems` do carrinho que a página já limpou (lista vazia com planilha cheia).
- PlanilhaPrecos `parseFloat(x.replace(',', '.'))` ignora milhar × `parseBRL` da página.
- PropostaRenderer.handleAssinar simula assinatura (setTimeout) e diz "assinada digitalmente".
- Código morto: DadosEmpresaUploader, SimplesNacionalCalculadora.
- ImportarDoCatalogo exclusão via `confirm()`.

## Órfãos sem rota (fora do redesign)
- src/pages/Licitacoes.tsx, BuscaInteligenteIA.tsx, ComprasGovEnvio.tsx; components/monitoramento/BuscaInteligenteTab, BuscaSemanticaAurelia; workspace/PropostaTab.

## Gestão de Compras (b6f0ce55)
- GestaoCompras ~875–877: três `console.log` de depuração no handleNfePdf (base64, erro, dado do invoke).
- Select de situação da aba NF-e com `aria-label="Situação do estoque"` (copiado da aba Estoque) — agora visível como Label; rever redação.
- PedidosDeCompra FaturadoContaDialog: parcelas `valor_total / n` com toFixed(2) em cada uma; sobra de centavos não vai à última parcela.
- PedidosDeCompra handleSave: grava `quantidade = soma dos itens` e `valor_unitario = valorTotal` em contrato_pedidos (quantidade × unitário ≠ total).
- PedidosDeCompra DatePickerBtn: `toISOString().slice(0,10)` (UTC).
- CadastroProdutos handleDelete exclui sem confirmação; NCM/CEST abrem diálogo só por clique no div (sem teclado).
- CertificadoDigital handleUpload: certificado novo entra `ativo: true` sem desativar o anterior.
- Decisões: alternâncias em tonal; quadro sem barra/borda coloridas; três ações do catálogo no "⋯"; rótulo flutuante → rótulo acima.

## Gestão de Contratos (c8192df4)
- ContratoDashboard "Composição de custos": barras somam custos da tabela + pedidos, denominador inclui custoDoFinanceiro sem barra (nunca fecha 100%).
- EvolucaoMensalDashboard "Lucro Bruto" usa só custo_total dos pedidos × Resumo desconta também o Financeiro (mesmo rótulo, duas bases).
- ContratoArquivos.openEdit liga o aditivo pelo tipo, não pelo arquivo_id (dois termos do mesmo tipo → edita o primeiro).
- ContratoPedidos: CustoInlineEditor nunca usado; DialogTrigger importado sem uso (aqui e em ContratoItens).
- GerarPreNotaDialog: useEffect([open]) lê eligiblePedidos fora das deps.
- Emojis como texto mantidos (📄 Contrato Original, 📄/💰/📅, ⛓, ⚠).

## Precificação (70c178ef)
- CotacaoFornecedorUpload:68 `useState(() => { loadSavedCotacoes(); })` — efeito no inicializador; com user nulo no 1º render nunca recarrega.
- CalculadoraUnificada: salvarNoCatalogo grava custo×(1+margem/100) ignorando impostos/frete × enviarParaProposta usa formarPreco (catálogo e proposta com preços distintos); `parseFloat(margemLucro) || 15` transforma margem 0 em 15%; Lucro Real inventa `receitaEstimada || 100000` e apura adicional de IRPJ sobre lucro mensal.
- ComparativoDashboard: `govbrData` nunca preenchido (KPI/coluna Gov.br sempre zero).
- InteligenciaPrecos: modo manual `meuPreco = mediaMercado` → tudo "manter"; consulta ao catálogo sem filtro de usuário/empresa.
- AureliaPrecificacaoChat: "margem" e "aderência" sintetizadas da posição na lista; fallback gera cotações por IA com preços inventados (só nota de rodapé).
- LicitacaoSelector 191–198: `documentos` filtrado por user_id — edital de colega não conta e pode disparar purga de itens.
- Precificacao.tsx: `itensPesquisa` é `[]` constante (bloco e handleAddToProposta mortos).
- ServicoMDOCalculadora:87 salário mínimo 1518 fixo.
- Decisões: chips "IA Contábil"/"IA Tributária" → SeloPraefectusIA; "×" de remover → Trash2; "Enviar à Proposta" em outline.

## Configurações / Empresa / Certificado / API (1e8d5406)
- Configuracoes.handleSalvar não checa `error` dos upserts (mostra "salvas com sucesso" mesmo falhando); handleConsultaSintegraInternal engole erro.
- ApiIntegracao: fallback do BASE_URL aponta para o projeto `sbnlovigyifvrkgsoalj` (não `uwtyuwktxalnpgrcbbgk`) — sem VITE_SUPABASE_PROJECT_ID a tela ensina a URL errada.
- SegurancaConta: `currentPassword` existe no estado mas nunca é renderizado nem exigido — senha troca sem a atual.
- PlanoVerificacao: teste "API de Integração" retorna true no catch; "Escrita de Dados" insere e apaga tarefa real no Kanban.
- BackupAgendado filtra licitacoes/contratos/documentos por user_id (princípio 2) — registros de colegas ficam fora do backup.
- Empresas.handleDelete toasta erro genérico; validade do certificado é texto puro (selo válido/vencendo/vencido exigiria lógica nova — não feito).
- Planos: PLANS (3 faixas) × plans (5 faixas) × data/pricing-config divergem; veredito com "71%"/"69%" literais ao lado de números calculados.
- Decisões: "Ativa" no seletor de empresa (texto novo pedido pelo comando); sem "Cancelar" novo em diálogos; endpoints em lista (não Table); input do certificado `hidden` → `sr-only`.

## Análise de Mercado / Concorrentes / Analytics (7255cd06)
- CertidoesNegativas: `<Tabs value={emissaoResult ? 'emissao' : activeTab}>` — após uma emissão a aba "Verificação" fica inalcançável.
- ContratosTransparencia: cabeçalho diz "{dados.length} resultado(s)" mas renderiza `dados.slice(0, 50)`.
- TransparenciaPA: `transparencia_empenhos` lida/apagada por user_id (princípio 2, se a tabela for da empresa); eixos em "B/M/K" × resto do app "bi/mi/mil"; ContratosGov `hoje` via toISOString (UTC).
- Analytics: assinatura Realtime filtrada por user_id (comentário já documenta).
- dashboard/AnalyticsKpiCards.tsx (fora do escopo deles): `text-[17px]` e gridTemplateColumns inline — pendência minha.
- Paleta `--chart-*`: no claro, chart-4 fora da faixa de luminosidade, chart-8 lê como cinza, chart-3/4/6/7 < 3:1 contra o cartão; no escuro `--chart-1` = `--success` = `--primary` — reestepar tokens `.dark` (pendência de DS).
- Decisões: selo "IA" das certidões → "Praefectus IA"; coluna "Andamento" âmbar → info-ink.

## Moldura extra / acesso (00a6f376)
- NotFound: textos em inglês ("Oops! Page not found", "Return to Home") e `<a href>` que recarrega a página em vez de `Link`.
- Auth (passo signup): Labels sem htmlFor / Inputs sem id; placeholder "Mínimo 6 caracteres" + minLength 6 × validatePasswordStrength exige 8 + maiúscula/minúscula/número/especial; passo só alcançável por `?step=signup`.
- Cadastro: mesma ausência de id/htmlFor; canNext aceita senha de 6 e `cnpj.length >= 14` sem máscara; `.select().single()` do lead ignorado; chips de passos futuros clicáveis sem efeito.
- AceitarConvite / ResetPassword: campos de senha só com placeholder; política 8 × 6.
- GlobalSearch: lista `pages` paralela ao registro de navegação (Dashboard em `/` em vez de `/dashboard`).
- OnboardingWizard: `portaisSelecionados` nunca gravado.
- MascoteBoasVindas: texto "Ele mora em Ferramentas, no topo da tela" datado (diretório agora no rodapé da sidebar/topbar).
- NotificationCenter: `loadNotifications` fora das deps; `any` no mapeamento.
- `shared/IlustracaoDocumentos` ficou sem consumidor após sair da moldura de acesso (não removido — decisão do dono).
- DS: `Input` promete 16px no celular mas text-base é 14 (corrigir no primitivo); EstadoVazio sem `tom` e título em <p> (NotFound sem h1); CommandDialog sem className; `--navy-foreground-muted` faltando.

## Equipe / Perfil / WhatsApp / apoio (0ab0ede4)
- TarefasColaborador: SelectItem value="none" em "Vincular licitação" e handleCreate envia `licitacao_id: licitacaoId || null` → "Nenhuma" grava a string "none" num uuid.
- ComissoesColaborador.handleLancar: `!ehPercentual(cfg?.tipo_comissao) ? cfg.valor_fixo : …` estoura com cfg undefined.
- EquipePermissoes.validateChanges: regra 2 (`&& adminCount === 0`) inalcançável.
- EquipeColaboradores: loadMembros descarta error (lista vazia silenciosa); PAPEL_LABELS tem "gerente" que o Select não oferece; handleRemove via confirm().
- WhatsApp: exclusão de templates/broadcast sem confirmação; GripVertical sem arrasto; dados do CRM por user_id (colegas não compartilham a caixa).
- StatusPlataforma: staticServices "Operacional" fixos, sem verificação real.
- CentralAjuda: itens de artigo com cursor-pointer/hover sem clique nem link.
- ExportarDados filtra licitacoes por user_id (princípio 2) — exportação pode omitir processos da empresa.
- DS: avatar de iniciais em ladrilho; SkeletonCartoes; BarraFiltros sem children esconde "Limpar" no celular; paginas.ts sem verbete para /faq, /ajuda, /status, /compliance, /seguranca-informacao.
