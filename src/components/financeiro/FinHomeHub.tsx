import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, LayoutDashboard, ListOrdered, Wallet, Users, Tags, Banknote, ArrowDownCircle, ArrowUpCircle, FolderTree, LineChart, FileBarChart, Briefcase, ScanLine, Plug, FileText, Inbox, BookOpen, Scale, Target, FileDown, Calculator, Eye, ArrowRightLeft, Upload, CheckCheck, FileSpreadsheet, ShieldCheck, Receipt, Building2, Sparkles, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

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
  { id: "resumo", label: "Resumo", description: "Visor executivo com saldo, projeção e atrasos.", icon: Eye, group: "operacao", highlight: true },
  { id: "quadro_omie", label: "Quadro Financeiro", description: "Visão estilo Omie com 9 cards de operação consolidados.", icon: LayoutDashboard, group: "operacao", badge: "Novo" },
  { id: "dashboard", label: "Dashboard", description: "KPIs, gráficos e indicadores em tempo real.", icon: LayoutDashboard, group: "operacao" },
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

  // Fiscal
  { id: "emissor_nfe", label: "Emissor NF-e", description: "Emissão homologada SEFAZ schema 4.00.", icon: FileText, group: "fiscal" },
  { id: "nfe_entrada", label: "NF-e Entrada", description: "Consulta e download de XML por chave.", icon: Inbox, group: "fiscal" },
  { id: "nfse", label: "NFS-e Municipal", description: "Monitor e emissão multi-prefeitura.", icon: Building2, group: "fiscal", badge: "Novo" },
  { id: "config_nfe", label: "Configuração NF-e", description: "Provedor (FocusNFe / NFe.io / SEFAZ direto), ambiente e credenciais por empresa.", icon: ShieldCheck, group: "fiscal", badge: "Novo" },
  { id: "pix_cobranca", label: "Cobrança PIX", description: "Gera BR Code (Pix Copia e Cola) e QR Code conforme padrão BACEN.", icon: QrCode, group: "fiscal", badge: "Novo" },
  { id: "ocr", label: "OCR de Documentos", description: "Extraia dados de notas e boletos via IA.", icon: ScanLine, group: "fiscal" },

  // Relatórios
  { id: "dre", label: "DRE", description: "Demonstrativo de Resultados completo.", icon: FileBarChart, group: "relatorios" },
  { id: "demonstracoes", label: "Demonstrações Contábeis", description: "Balanço Patrimonial, DFC Indireta e DMPL conforme NBC TG 26/03.", icon: Scale, group: "relatorios", badge: "Novo" },
  { id: "resumo_exec", label: "Resumo Executivo", description: "One-pager imprimível com CP, CR e contas correntes detalhadas.", icon: Sparkles, group: "relatorios", badge: "Novo" },
  { id: "atividade_usuarios", label: "Atividade dos Usuários", description: "Auditoria cronológica por usuário, data e tipo (modelo Omie).", icon: Activity, group: "relatorios", badge: "Novo" },
  { id: "previsto_realizado", label: "Previsto × Realizado", description: "Compare orçamento com execução mensal.", icon: Target, group: "relatorios", badge: "Novo" },
  { id: "relatorios", label: "Relatórios", description: "Exportações personalizadas em PDF/Excel.", icon: FileDown, group: "relatorios" },
  { id: "apuracao", label: "Apuração", description: "Apuração de impostos e tributos.", icon: Calculator, group: "relatorios" },
  { id: "aprovacoes", label: "Aprovação de Pagamentos", description: "Workflow multi-nível com alçada por valor.", icon: ShieldCheck, group: "relatorios", badge: "Novo" },
  { id: "calc_margem", label: "Calculadora de Margem", description: "Sugere margem % ideal a partir dos lançamentos reais e do regime tributário.", icon: Calculator, group: "relatorios", badge: "Novo" },

  // Cadastros
  { id: "pessoas", label: "Clientes & Fornecedores", description: "Cadastro unificado com integração Receita.", icon: Users, group: "cadastros" },
  { id: "categorias", label: "Categorias", description: "Categorias de receita e despesa.", icon: Tags, group: "cadastros" },
  { id: "centros_custo", label: "Centros de Custo", description: "Departamentos, projetos e rateios.", icon: FolderTree, group: "cadastros" },
  { id: "plano_contas", label: "Plano de Contas", description: "Estrutura contábil hierárquica.", icon: BookOpen, group: "cadastros" },
  { id: "saldos_abertura", label: "Saldos de Abertura", description: "Saldos iniciais por conta.", icon: Scale, group: "cadastros" },
  { id: "orcamento", label: "Orçamento", description: "Planejamento orçamentário anual.", icon: Target, group: "cadastros" },
  { id: "folha", label: "Folha de Pagamento", description: "Provisões e lançamentos da folha.", icon: Briefcase, group: "cadastros" },
  { id: "comissoes", label: "Comissões de Vendas", description: "Cálculo e quitação de comissões.", icon: Receipt, group: "cadastros" },
];

const GROUPS = [
  { id: "operacao", label: "Operação Diária", description: "O que você usa todos os dias", color: "from-primary/10 to-primary/5" },
  { id: "bancos", label: "Bancos & Conciliação", description: "Integração com instituições financeiras", color: "from-blue-500/10 to-blue-500/5" },
  { id: "fiscal", label: "Fiscal & Documentos", description: "Notas, boletos e fiscalização", color: "from-amber-500/10 to-amber-500/5" },
  { id: "relatorios", label: "Análises & Relatórios", description: "Visão consolidada do negócio", color: "from-emerald-500/10 to-emerald-500/5" },
  { id: "cadastros", label: "Cadastros & Configuração", description: "Estrutura base do financeiro", color: "from-muted to-muted/50" },
] as const;

interface FinHomeHubProps {
  onNavigate: (tabId: string) => void;
}

export default function FinHomeHub({ onNavigate }: FinHomeHubProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return HUB_ITEMS;
    return HUB_ITEMS.filter(
      (i) => i.label.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)
    );
  }, [search]);

  const grouped = useMemo(() => {
    const map = new Map<string, HubItem[]>();
    filtered.forEach((item) => {
      if (!map.has(item.group)) map.set(item.group, []);
      map.get(item.group)!.push(item);
    });
    return map;
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar funcionalidade... (ex: conciliação, NF-e, comissão)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-11 text-sm"
          autoFocus
        />
      </div>

      {GROUPS.map((group) => {
        const items = grouped.get(group.id);
        if (!items?.length) return null;
        return (
          <section key={group.id} className="space-y-3">
            <div className={cn("rounded-lg p-4 bg-gradient-to-r border", group.color)}>
              <h2 className="text-base font-semibold">{group.label}</h2>
              <p className="text-xs text-muted-foreground">{group.description}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <Card
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={cn(
                      "group cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/40",
                      item.highlight && "border-primary/40 bg-primary/5"
                    )}
                  >
                    <CardContent className="p-4 flex items-start gap-3">
                      <div
                        className={cn(
                          "shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                          item.highlight
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                        )}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium text-sm leading-tight">{item.label}</h3>
                          {item.badge && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                              {item.badge}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {item.description}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}

      {filtered.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma funcionalidade encontrada para "{search}".
          </CardContent>
        </Card>
      )}
    </div>
  );
}
