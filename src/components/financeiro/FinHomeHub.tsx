import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Search, LayoutDashboard, ListOrdered, ArrowLeft, Clock, Folder, Wallet, Users, Tags, Banknote, ArrowDownCircle, ArrowUpCircle,
  FolderTree, LineChart, FileBarChart, Briefcase, ScanLine, Plug, FileText, Inbox, BookOpen, Scale, Target,
  FileDown, Calculator, Eye, ArrowRightLeft, Upload, FileSpreadsheet, ShieldCheck, Receipt,
  Building2, Sparkles, Activity, QrCode, History, Landmark, CalendarDays, Star, Clock4, Zap,
  Command, ChevronRight, Pin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import EstadoVazio from "@/components/shared/EstadoVazio";
import CartaoPasta from "@/components/shared/CartaoPasta";

export type HubItem = {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  group: "operacao" | "bancos" | "relatorios" | "cadastros" | "fiscal";
  badge?: string;
  highlight?: boolean;
};

export const HUB_ITEMS: HubItem[] = [
  // Operação diária
  { id: "panorama", label: "Painel", description: "Visão geral, KPIs CFO/Executivo/Operacional, projeção e atrasos — tudo em um só lugar.", icon: Eye, group: "operacao", highlight: true, badge: "Unificado" },
  { id: "pedidos_faturar", label: "Pedidos a Faturar", description: "Pedidos de contratos aguardando faturamento — ao faturar, lança automaticamente em Contas a Receber.", icon: Receipt, group: "operacao", highlight: true, badge: "Novo" },
  { id: "calendario_financeiro", label: "Calendário Financeiro", description: "Calendário dinâmico de pagamentos e recebimentos com saldo proporcional por dia.", icon: CalendarDays, group: "operacao", badge: "Novo" },
  { id: "quadro_omie", label: "Quadro Financeiro", description: "Visão estilo Omie com 9 cards de operação consolidados.", icon: LayoutDashboard, group: "operacao" },
  { id: "lancamentos", label: "Lançamentos", description: "Todos os lançamentos com filtros avançados.", icon: ListOrdered, group: "operacao" },
  { id: "a_pagar", label: "Contas a Pagar", description: "Pendências, vencimentos e baixa em lote.", icon: ArrowUpCircle, group: "operacao" },
  { id: "a_receber", label: "Contas a Receber", description: "Cobranças, recebimentos e inadimplência.", icon: ArrowDownCircle, group: "operacao" },
  { id: "baixa_lote", label: "Baixa em lote", description: "Liquide múltiplos lançamentos com 1 clique.", icon: Sparkles, group: "operacao", badge: "Novo" },
  { id: "importar_planilha", label: "Importar Planilha", description: "Importação em massa via CSV.", icon: FileSpreadsheet, group: "operacao", badge: "Novo" },
  { id: "fluxo_caixa", label: "Fluxo de Caixa", description: "Entradas, saídas e saldo projetado.", icon: LineChart, group: "operacao" },

  // Bancos
  { id: "contas", label: "Contas Correntes", description: "Saldos consolidados e movimentações.", icon: Wallet, group: "bancos" },
  { id: "conciliacao", label: "Conciliação", description: "Concilie extratos com lançamentos do sistema.", icon: Banknote, group: "bancos" },
  { id: "transferencia", label: "Transferência entre contas", description: "Movimente saldo entre contas correntes.", icon: ArrowRightLeft, group: "bancos", badge: "Novo" },
  { id: "importar_ofx", label: "Importar Extrato OFX", description: "Conciliação sugerida automaticamente.", icon: Upload, group: "bancos", badge: "Novo" },
  { id: "cnab", label: "Remessa & Retorno CNAB", description: "Cobrança 240 + pagamentos em massa.", icon: FileSpreadsheet, group: "bancos", badge: "Novo" },
  { id: "integracoes", label: "Integrações Bancárias", description: "Histórico de transmissões e webhooks.", icon: Plug, group: "bancos" },
  { id: "open_finance", label: "Open Finance", description: "Conexões bancárias automáticas (Pluggy/Belvo) com sincronização programada.", icon: Plug, group: "bancos", badge: "Novo" },
  { id: "auditoria_conciliacao", label: "Auditoria de Conciliação", description: "Histórico reversível de matches automáticos e IA com 1-clique para reverter.", icon: History, group: "bancos", badge: "Fase 3" },

  // Fiscal
  { id: "emissor_nfe", label: "Emissor NF-e", description: "Emissão homologada SEFAZ schema 4.00.", icon: FileText, group: "fiscal" },
  { id: "nfe_entrada", label: "NF-e Recebidas", description: "Notas emitidas contra o CNPJ da empresa: acervo automático, XML, manifestação e Conta a Pagar em 1 clique.", icon: Inbox, group: "fiscal" },
  { id: "nfse", label: "NFS-e Municipal", description: "Monitor e emissão multi-prefeitura.", icon: Building2, group: "fiscal", badge: "Novo" },
  { id: "config_nfe", label: "Configuração NF-e", description: "Provedor (FocusNFe / NFe.io / SEFAZ direto), ambiente e credenciais por empresa.", icon: ShieldCheck, group: "fiscal", badge: "Novo" },
  { id: "pix_cobranca", label: "Cobrança PIX", description: "Gera BR Code (Pix Copia e Cola) e QR Code conforme padrão BACEN.", icon: QrCode, group: "fiscal", badge: "Novo" },
  { id: "ocr", label: "OCR de Documentos", description: "Extraia dados de notas e boletos via IA.", icon: ScanLine, group: "fiscal" },
  { id: "integracoes_fiscais", label: "Integrações Fiscais", description: "SEFAZ por CNPJ, SPED, ECF, ECD, DCTFWeb e apuração de impostos consolidada.", icon: Landmark, group: "fiscal", badge: "Fase 5" },

  // Relatórios
  { id: "dre", label: "DRE", description: "Demonstrativo de Resultados completo.", icon: FileBarChart, group: "relatorios" },
  { id: "demonstracoes", label: "Demonstrações Contábeis", description: "Balanço Patrimonial, DFC Indireta e DMPL conforme NBC TG 26/03.", icon: Scale, group: "relatorios", badge: "Novo" },
  { id: "resumo_exec", label: "Resumo Executivo", description: "One-pager imprimível com CP, CR e contas correntes detalhadas.", icon: Sparkles, group: "relatorios", badge: "Novo" },
  { id: "atividade_usuarios", label: "Atividade dos Usuários", description: "Auditoria cronológica por usuário, data e tipo (modelo Omie).", icon: Activity, group: "relatorios", badge: "Novo" },
  { id: "lotes_auditoria", label: "Auditoria de Lotes", description: "Rastreabilidade da origem dos dados (seed, importação, OFX, Pluggy, manual).", icon: History, group: "relatorios", badge: "Novo" },
  { id: "previsto_realizado", label: "Previsto × Realizado", description: "Compare orçamento com execução mensal.", icon: Target, group: "relatorios", badge: "Novo" },
  { id: "custos_contratos", label: "Custos por Contrato", description: "O que cada contrato vigente custa: despesas vinculadas, custos digitados e rateio opcional. Acesso: admin e Financeiro.", icon: Briefcase, group: "relatorios", badge: "Novo" },
  { id: "relatorios", label: "Relatórios", description: "Exportações personalizadas em PDF/Excel.", icon: FileDown, group: "relatorios" },
  { id: "apuracao", label: "Apuração", description: "Apuração de impostos e tributos.", icon: Calculator, group: "relatorios" },
  { id: "aprovacoes", label: "Aprovação de Pagamentos", description: "Workflow multi-nível com alçada por valor.", icon: ShieldCheck, group: "relatorios", badge: "Novo" },
  { id: "calc_margem", label: "Calculadora de Margem", description: "Sugere margem % ideal a partir dos lançamentos reais e do regime tributário.", icon: Calculator, group: "relatorios", badge: "Novo" },

  // Cadastros
  { id: "pessoas", label: "Clientes & Fornecedores", description: "Cadastro unificado com integração Receita.", icon: Users, group: "cadastros" },
  { id: "categorias", label: "Categorias", description: "Categorias de receita e despesa.", icon: Tags, group: "cadastros" },
  { id: "centros_custo", label: "Centros de Custo", description: "Departamentos, projetos e rateios.", icon: FolderTree, group: "cadastros" },
  { id: "plano_contas", label: "Plano de Contas", description: "Estrutura contábil hierárquica.", icon: BookOpen, group: "cadastros" },
  { id: "plano_contas_padrao", label: "Plano de Contas Padrão", description: "Importe 31 contas pré-configuradas e personalize por empresa.", icon: Sparkles, group: "cadastros", badge: "Fase 4" },
  { id: "saldos_abertura", label: "Saldos de Abertura", description: "Saldos iniciais por conta.", icon: Scale, group: "cadastros" },
  { id: "orcamento", label: "Orçamento", description: "Planejamento orçamentário anual.", icon: Target, group: "cadastros" },
  { id: "folha", label: "Folha de Pagamento", description: "Provisões e lançamentos da folha.", icon: Briefcase, group: "cadastros" },
  { id: "comissoes", label: "Bonificações de Vendas", description: "Cálculo e quitação de bonificações.", icon: Receipt, group: "cadastros" },
];

const GROUPS = [
  { id: "operacao", label: "Operação Diária", short: "Operação", description: "Lançamentos, contas, fluxo de caixa", icon: Zap },
  { id: "bancos", label: "Bancos & Conciliação", short: "Bancos", description: "Contas correntes, OFX, Open Finance", icon: Banknote },
  { id: "fiscal", label: "Fiscal & Documentos", short: "Fiscal", description: "NF-e, NFS-e, PIX, OCR", icon: FileText },
  { id: "relatorios", label: "Análises & Relatórios", short: "Análises", description: "DRE, dashboards, aprovações", icon: FileBarChart },
  { id: "cadastros", label: "Cadastros & Configuração", short: "Cadastros", description: "Pessoas, categorias, plano de contas", icon: FolderTree },
] as const;

const FAVORITES_KEY = "fin_hub_favorites_v2";
const RECENTS_KEY = "fin_hub_recents_v2";
const MAX_RECENTS = 8;

function loadList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch { return []; }
}
function saveList(key: string, list: string[]) {
  try { localStorage.setItem(key, JSON.stringify(list)); } catch { /* noop */ }
}

interface FinHomeHubProps {
  onNavigate: (tabId: string) => void;
}

export default function FinHomeHub({ onNavigate }: FinHomeHubProps) {
  const [search, setSearch] = useState("");
  /* A pasta aberta. `null` = a estante, com as seis pastas fechadas. Era uma
     lista única com todos os 40+ módulos empilhados por categoria: a página
     rolava sem fim e nenhuma categoria cabia na tela. Agora a pessoa escolhe
     a pasta e só então vê o que tem dentro. A busca ignora as pastas — quem
     digita já sabe o que procura. */
  /* A pasta mora na URL desde 13/09, porque virou destino de menu: a barra
     lateral lista as cinco e cada uma precisa de endereço próprio. De quebra,
     o Voltar do navegador passou a fechar a pasta em vez de sair do
     Financeiro, e a pasta aberta sobrevive ao F5. */
  const [paramsDaUrl, setParamsDaUrl] = useSearchParams();
  const pastaAberta = paramsDaUrl.get('pasta');
  const setPastaAberta = useCallback(
    (id: string | null) => {
      setParamsDaUrl(
        (anterior) => {
          const proximo = new URLSearchParams(anterior);
          if (id) proximo.set('pasta', id);
          else proximo.delete('pasta');
          return proximo;
        },
        // Abrir e fechar pasta não é navegar para outra tela: sem `replace`,
        // sair do Financeiro exigiria desfazer cada pasta visitada.
        { replace: true },
      );
    },
    [setParamsDaUrl],
  );
  const [activeGroup, setActiveGroup] = useState<string>("all");
  const [favorites, setFavorites] = useState<string[]>(() => loadList(FAVORITES_KEY));
  const [recents, setRecents] = useState<string[]>(() => loadList(RECENTS_KEY));
  const inputRef = useRef<HTMLInputElement>(null);

  // Atalho `/` foca a busca
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleNavigate = useCallback((id: string) => {
    setRecents((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, MAX_RECENTS);
      saveList(RECENTS_KEY, next);
      return next;
    });
    onNavigate(id);
  }, [onNavigate]);

  const toggleFavorite = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      saveList(FAVORITES_KEY, next);
      return next;
    });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return HUB_ITEMS.filter((i) => {
      const matchGroup = activeGroup === "all" || i.group === activeGroup;
      const matchQ = !q || i.label.toLowerCase().includes(q) || i.description.toLowerCase().includes(q);
      return matchGroup && matchQ;
    });
  }, [search, activeGroup]);

  const grouped = useMemo(() => {
    const map = new Map<string, HubItem[]>();
    filtered.forEach((item) => {
      if (!map.has(item.group)) map.set(item.group, []);
      map.get(item.group)!.push(item);
    });
    return map;
  }, [filtered]);

  const favoriteItems = useMemo(
    () => favorites.map((id) => HUB_ITEMS.find((i) => i.id === id)).filter(Boolean) as HubItem[],
    [favorites],
  );
  const recentItems = useMemo(
    () => recents.map((id) => HUB_ITEMS.find((i) => i.id === id)).filter(Boolean) as HubItem[],
    [recents],
  );

  return (
    <div className="space-y-6">
      {/* ============ Busca + Command palette hint ============ */}
      <div className="relative">
        <label htmlFor="fin-hub-busca" className="sr-only">Buscar funcionalidade</label>
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
        <Input
          id="fin-hub-busca"
          ref={inputRef}
          placeholder="Buscar funcionalidade... (ex: conciliação, NF-e, bonificação)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-11 pr-28"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-2" aria-hidden="true">
          <kbd className="inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 text-xs font-mono text-muted-foreground">
            <Command className="w-3 h-3" />K
          </kbd>
          <span className="text-xs text-muted-foreground">ou</span>
          <kbd className="inline-flex h-5 items-center justify-center rounded border border-border bg-muted px-1.5 text-xs font-mono text-muted-foreground">
            /
          </kbd>
        </div>
      </div>

      {/* ============ A estante: seis pastas fechadas ============ */}
      {!search && pastaAberta === null && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Recentes vem primeiro: é a pasta que responde "onde eu estava". */}
          <CartaoPasta
            nome="Acessados recentemente"
            descricao={recentItems.length ? "As telas por onde você passou, na ordem" : "Ainda sem histórico nesta sessão"}
            quantidade={recentItems.length}
            icone={<Clock className="h-9 w-9" strokeWidth={1.5} />}
            corDoIcone="text-muted-foreground"
            onAbrir={() => setPastaAberta("recentes")}
          />
          {favoriteItems.length > 0 && (
            <CartaoPasta
              nome="Favoritos"
              descricao="O que você fixou para ter à mão"
              quantidade={favoriteItems.length}
              icone={<Star className="h-9 w-9" strokeWidth={1.5} />}
              corDoIcone="text-warning-ink"
              onAbrir={() => setPastaAberta("favoritos")}
            />
          )}
          {GROUPS.map((g) => (
            <CartaoPasta
              key={g.id}
              nome={g.label}
              descricao={g.description}
              quantidade={HUB_ITEMS.filter((i) => i.group === g.id).length}
              icone={<g.icon className="h-9 w-9" strokeWidth={1.5} />}
              onAbrir={() => setPastaAberta(g.id)}
            />
          ))}
        </div>
      )}

      {/* ============ Dentro de uma pasta, ou resultado de busca ============ */}
      {(search || pastaAberta !== null) && (() => {
        const grupoAberto = GROUPS.find((g) => g.id === pastaAberta);
        const itens = search
          ? filtered
          : pastaAberta === "recentes"
            ? recentItems
            : pastaAberta === "favoritos"
              ? favoriteItems
              : HUB_ITEMS.filter((i) => i.group === pastaAberta);
        const titulo = search
          ? `Resultados para "${search.trim()}"`
          : pastaAberta === "recentes"
            ? "Acessados recentemente"
            : pastaAberta === "favoritos"
              ? "Favoritos"
              : grupoAberto?.label ?? "";
        const subtitulo = search
          ? `${itens.length} de ${HUB_ITEMS.length} módulos`
          : pastaAberta === "recentes"
            ? "Na ordem em que você abriu"
            : pastaAberta === "favoritos"
              ? "Pinados por você"
              : grupoAberto?.description;

        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-foreground">{titulo}</h2>
                {subtitulo && <p className="text-sm text-muted-foreground">{subtitulo}</p>}
              </div>
              <Button
                variant="ghost"
                onClick={() => { setPastaAberta(null); setSearch(""); }}
              >
                <ArrowLeft aria-hidden="true" /> Voltar às pastas
              </Button>
            </div>

            {itens.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {itens.map((item, idx) => (
                  <ModuleRow
                    key={item.id}
                    item={item}
                    idx={idx}
                    isFav={favorites.includes(item.id)}
                    onNavigate={handleNavigate}
                    onToggleFav={toggleFavorite}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <EstadoVazio
                    icone={search ? <Search /> : <Folder />}
                    titulo={search ? "Nenhuma funcionalidade encontrada" : "Pasta vazia"}
                    descricao={
                      search
                        ? `Nada corresponde a "${search.trim()}".`
                        : pastaAberta === "recentes"
                          ? "Assim que você abrir uma tela do Financeiro, ela aparece aqui."
                          : "Marque um módulo com a estrela para ele ficar aqui."
                    }
                    acao={
                      <Button variant="outline" onClick={() => { setPastaAberta(null); setSearch(""); }}>
                        Voltar às pastas
                      </Button>
                    }
                  />
                </CardContent>
              </Card>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ============================================================================
// Subcomponentes
// ============================================================================


function ModuleRow({
  item, idx, isFav, onNavigate, onToggleFav,
}: {
  item: HubItem;
  idx: number;
  isFav: boolean;
  onNavigate: (id: string) => void;
  onToggleFav: (e: React.MouseEvent, id: string) => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => onNavigate(item.id)}
      className={cn(
        "group relative w-full text-left flex items-center gap-3 p-3 pr-2 rounded-lg border bg-card shadow-sm transition-colors duration-200",
        "hover:border-primary/40 hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "animate-in fade-in",
        item.highlight ? "border-primary/40" : "border-border",
      )}
      style={{ animationDelay: `${Math.min(idx * 20, 240)}ms`, animationFillMode: "backwards" }}
    >
      {/* Barra de destaque à esquerda */}
      <span
        className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity"
        aria-hidden="true"
      />

      <div className="shrink-0 w-10 h-10 rounded-md flex items-center justify-center bg-primary-tint text-primary">
        <Icon className="w-5 h-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm leading-tight truncate">{item.label}</span>
          {item.badge && (
            <Badge variant={item.badge === "Novo" ? "success" : "info"} className="shrink-0">
              {item.badge}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.description}</p>
      </div>

      <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => onToggleFav(e as any, item.id)}
          onKeyDown={(e) => { if (e.key === "Enter") onToggleFav(e as any, item.id); }}
          className="p-1.5 rounded-md hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={isFav ? "Remover dos favoritos" : "Fixar nos favoritos"}
        >
          {isFav
            ? <Pin className="w-4 h-4 fill-primary text-primary" />
            : <Pin className="w-4 h-4 text-muted-foreground" />}
        </span>
        <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
      </div>

      {/* Pin sempre visível se favorito */}
      {isFav && (
        <span className="absolute top-1.5 right-1.5 group-hover:opacity-0 transition-opacity" aria-hidden="true">
          <Pin className="w-3 h-3 fill-primary text-primary" />
        </span>
      )}
    </button>
  );
}

