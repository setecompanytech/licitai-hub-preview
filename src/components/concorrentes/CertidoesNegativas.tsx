import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Search, Shield, ExternalLink, Loader2, AlertTriangle,
  CheckCircle2, AlertCircle, HelpCircle, Download, FileSpreadsheet, FileDown, FileText,
  Wifi, WifiOff, Bot, Globe, Clock, Zap, ShieldAlert, MapPin, Building2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { downloadCSV, downloadTextReport, downloadPDF } from '@/lib/download-utils';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CERTIDOES_POR_ESTADO, getPortaisCertidoes, getMunicipiosCadastrados } from '@/data/certidoes-estaduais-municipais';
import { REGIOES_ESTADOS } from '@/data/regioes-brasil';

// ── Types for Verification mode ──
type Certidao = {
  nome: string; orgao: string; url: string; validadeDias: number;
  documentosNecessarios: string[]; statusProvavel: 'regular' | 'pendente' | 'verificar';
  observacoes: string; verificacaoReal?: boolean; dataVerificacao?: string; fonteVerificacao?: string;
};
type VerificacaoReal = {
  fonte: string; status: 'regular' | 'irregular' | 'erro' | 'verificando';
  detalhes: string; dataConsulta: string; url?: string;
};
type ResultadoCertidoes = {
  verificacoesReais?: VerificacaoReal[]; certidoes: Certidao[];
  resumo: string; recomendacoes: string[]; alertas?: string[];
};

// ── Types for Emission mode ──
type EmissaoResult = {
  certidao: string; status: 'emitida' | 'pendente' | 'erro' | 'captcha';
  conteudo?: string; codigo?: string; validade?: string; dataEmissao?: string;
  url?: string; detalhes: string; screenshot?: string;
};
type EmissaoResponse = {
  resultados: EmissaoResult[];
  resumo: { total: number; emitidas: number; captcha: number; pendentes: number; erros: number };
  dataConsulta: string;
};

/**
 * Certidões negativas — componente interno da aba "Certidões" da tela
 * Concorrentes: começa direto no conteúdo, sem cabeçalho de página.
 *
 * Cor de estado (identidade 12/09) vem SEMPRE das famílias em tinta
 * (`*-tint` / `*-ink` / `*-line`), via variante do Badge ou da caixa — nunca
 * de alfa composto à mão; e todo estado carrega TEXTO, não só cor.
 */
const statusConfig = {
  regular: { label: 'Regular', icon: CheckCircle2, variante: 'success' as const },
  pendente: { label: 'Irregular', icon: AlertCircle, variante: 'danger' as const },
  verificar: { label: 'Verificar', icon: HelpCircle, variante: 'warning' as const },
};
const verificacaoStatusConfig = {
  regular: { label: 'Regular', icon: CheckCircle2, tinta: 'text-success-ink', caixa: 'border-success-line bg-success-tint' },
  irregular: { label: 'Irregular', icon: AlertCircle, tinta: 'text-destructive-ink', caixa: 'border-destructive-line bg-destructive-tint' },
  erro: { label: 'Erro', icon: WifiOff, tinta: 'text-muted-foreground', caixa: 'border-border bg-muted' },
  verificando: { label: 'Verificando', icon: Loader2, tinta: 'text-muted-foreground', caixa: 'border-border bg-muted' },
};
const emissaoStatusConfig = {
  emitida: { label: 'Emitida', icon: CheckCircle2, variante: 'success' as const, caixa: 'border-success-line bg-success-tint' },
  pendente: { label: 'Pendente', icon: HelpCircle, variante: 'warning' as const, caixa: 'border-warning-line bg-warning-tint' },
  erro: { label: 'Irregular', icon: AlertCircle, variante: 'danger' as const, caixa: 'border-destructive-line bg-destructive-tint' },
  captcha: { label: 'CAPTCHA', icon: ShieldAlert, variante: 'muted' as const, caixa: 'border-border bg-muted' },
};

export default function CertidoesNegativas() {
  const [cnpjInput, setCnpjInput] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [ufSelecionada, setUfSelecionada] = useState('');
  const [municipioSelecionado, setMunicipioSelecionado] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingEmissao, setLoadingEmissao] = useState(false);
  const [resultado, setResultado] = useState<ResultadoCertidoes | null>(null);
  const [emissaoResult, setEmissaoResult] = useState<EmissaoResponse | null>(null);
  const [erro, setErro] = useState('');
  const [activeTab, setActiveTab] = useState('verificar');

  // Build list of all UFs sorted
  const ufsDisponiveis = useMemo(() => {
    const ufs: { uf: string; nome: string }[] = [];
    Object.values(REGIOES_ESTADOS).forEach(regiao => {
      regiao.estados.forEach(e => ufs.push({ uf: e.uf, nome: e.nome }));
    });
    return ufs.sort((a, b) => a.nome.localeCompare(b.nome));
  }, []);

  // Build list of municipalities for selected UF
  const municipiosDisponiveis = useMemo(() => {
    if (!ufSelecionada) return [];
    // Get municipalities from regioes-brasil (comprehensive list)
    const regiao = Object.values(REGIOES_ESTADOS).find(r => r.estados.some(e => e.uf === ufSelecionada));
    const estado = regiao?.estados.find(e => e.uf === ufSelecionada);
    return estado?.cidades?.sort() || [];
  }, [ufSelecionada]);

  // Get regional portals for selected UF/municipality
  const portaisRegionais = useMemo(() => {
    if (!ufSelecionada) return [];
    return getPortaisCertidoes(ufSelecionada, municipioSelecionado || undefined);
  }, [ufSelecionada, municipioSelecionado]);

  const handleConsultar = async () => {
    const cnpjLimpo = cnpjInput.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) { setErro('CNPJ deve conter 14 dígitos'); return; }
    setErro(''); setLoading(true); setResultado(null);
    try {
      const { data, error } = await supabase.functions.invoke('certidoes-negativas', { body: { cnpj: cnpjLimpo, razaoSocial } });
      if (error) throw error;
      if (data.error) { setErro(data.error); } else {
        setResultado(data);
        const reaisOk = (data.verificacoesReais || []).filter((v: VerificacaoReal) => v.status === 'regular').length;
        const reaisIrreg = (data.verificacoesReais || []).filter((v: VerificacaoReal) => v.status === 'irregular').length;
        toast.success(`Análise concluída! ${reaisOk} verificações OK, ${reaisIrreg} alertas.`);
      }
    } catch (e: any) { setErro(e.message || 'Erro ao consultar certidões'); }
    finally { setLoading(false); }
  };

  const handleEmitir = async () => {
    const cnpjLimpo = cnpjInput.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) { setErro('CNPJ deve conter 14 dígitos'); return; }
    setErro(''); setLoadingEmissao(true); setEmissaoResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('emitir-certidoes', {
        body: {
          cnpj: cnpjLimpo,
          uf: ufSelecionada || undefined,
          municipio: municipioSelecionado || undefined,
          portaisRegionais: portaisRegionais.map(p => ({
            nome: p.nome,
            url: p.url,
            tipo: p.tipo,
            descricao: p.descricao,
            requerLogin: p.requerLogin,
          })),
        },
      });
      if (error) throw error;
      if (data.error) { setErro(data.error); } else {
        setEmissaoResult(data);
        const r = data.resumo;
        toast.success(`Emissão: ${r.emitidas} emitidas, ${r.captcha} requerem CAPTCHA, ${r.pendentes} pendentes.`);
      }
    } catch (e: any) { setErro(e.message || 'Erro ao emitir certidões'); }
    finally { setLoadingEmissao(false); }
  };

  const certidoesReais = resultado?.certidoes.filter(c => c.verificacaoReal) || [];
  const certidoesIA = resultado?.certidoes.filter(c => !c.verificacaoReal) || [];
  const isLoading = loading || loadingEmissao;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Shield className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          Certidões negativas — verificação e emissão automática
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Consulta em APIs públicas + emissão automática via scraping nos portais oficiais
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="certidoes-cnpj" className="text-sm font-medium text-foreground">CNPJ</label>
            <Input id="certidoes-cnpj" placeholder="Ex.: 12.345.678/0001-01" value={cnpjInput}
              inputMode="numeric" aria-invalid={erro ? true : undefined}
              onChange={(e) => setCnpjInput(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="certidoes-razao" className="text-sm font-medium text-foreground">Razão social (opcional)</label>
            <Input id="certidoes-razao" placeholder="Razão social da empresa" value={razaoSocial}
              onChange={(e) => setRazaoSocial(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="certidoes-uf" className="text-sm font-medium text-foreground">UF (estado)</label>
            <Select value={ufSelecionada} onValueChange={(v) => { setUfSelecionada(v); setMunicipioSelecionado(''); }}>
              <SelectTrigger id="certidoes-uf" className="w-full">
                <MapPin className="mr-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <SelectValue placeholder="Selecione a UF" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {ufsDisponiveis.map(e => (
                  <SelectItem key={e.uf} value={e.uf}>{e.uf} — {e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="certidoes-municipio" className="text-sm font-medium text-foreground">Município</label>
            <Select value={municipioSelecionado} onValueChange={setMunicipioSelecionado} disabled={!ufSelecionada}>
              <SelectTrigger id="certidoes-municipio" className="w-full">
                <Building2 className="mr-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <SelectValue placeholder={ufSelecionada ? 'Selecione o município' : 'Selecione a UF primeiro'} />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {municipiosDisponiveis.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {portaisRegionais.length > 0 && (
          <div className="mt-4 rounded-md border border-border bg-muted p-3">
            <p className="flex items-center gap-1 text-sm font-medium text-foreground">
              <MapPin className="h-4 w-4" aria-hidden="true" /> Portais regionais identificados ({portaisRegionais.length}):
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {portaisRegionais.map((p, i) => (
                <Badge key={i} variant="muted">
                  {p.tipo === 'estadual' ? '🏛️' : '🏙️'} {p.nome.split(' - ')[0]}
                  {p.requerLogin && ' 🔒'}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={handleConsultar} disabled={isLoading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {loading ? 'Verificando…' : 'Verificar status'}
          </Button>
          <Button onClick={handleEmitir} disabled={isLoading} variant="outline">
            {loadingEmissao ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {loadingEmissao ? 'Emitindo…' : 'Emitir certidões'}
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="success" className="gap-1"><Wifi className="h-3 w-3" aria-hidden="true" /> APIs públicas</Badge>
          <Badge variant="muted" className="gap-1"><Globe className="h-3 w-3" aria-hidden="true" /> Firecrawl (scraping)</Badge>
          <Badge variant="muted" className="gap-1"><Bot className="h-3 w-3" aria-hidden="true" /> IA (extração)</Badge>
        </div>

        {erro && (
          <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Loading states */}
      {loading && (
        <div role="status" className="rounded-lg border border-border bg-card p-6 text-center shadow-sm">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
          <p className="text-base text-muted-foreground">Consultando APIs públicas em tempo real…</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {['CEIS', 'CNEP', 'CEPIM', 'Receita', 'TST', 'FGTS'].map(f => (
              <Badge key={f} variant="muted" className="animate-pulse">{f}</Badge>
            ))}
          </div>
        </div>
      )}

      {loadingEmissao && (
        <div role="status" className="rounded-lg border border-border bg-card p-6 text-center shadow-sm">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
          <p className="text-base font-medium text-foreground">Emitindo certidões nos portais oficiais…</p>
          <p className="mt-1 text-sm text-muted-foreground">Preenchendo formulários e extraindo resultados via scraping</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {['Receita Federal', 'TST', 'Caixa/FGTS', 'Transparência'].map(f => (
              <Badge key={f} variant="muted" className="animate-pulse">{f}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Tabs for results */}
      {(resultado || emissaoResult) && (
        <Tabs value={emissaoResult ? 'emissao' : activeTab} onValueChange={setActiveTab}>
          <TabsList>
            {resultado && <TabsTrigger value="verificar"><Search className="mr-1 h-4 w-4" aria-hidden="true" /> Verificação</TabsTrigger>}
            {emissaoResult && <TabsTrigger value="emissao"><Zap className="mr-1 h-4 w-4" aria-hidden="true" /> Emissão</TabsTrigger>}
          </TabsList>

          {/* ══ Emission Results ══ */}
          {emissaoResult && (
            <TabsContent value="emissao" className="space-y-4 animate-fade-in">
              {/* Summary cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="mt-2 text-[2rem] font-bold leading-10 tabular-nums text-foreground">{emissaoResult.resumo.total}</p>
                </div>
                <div className="rounded-lg border border-success-line bg-success-tint p-6 shadow-sm">
                  <p className="text-sm text-success-ink">Emitidas</p>
                  <p className="mt-2 text-[2rem] font-bold leading-10 tabular-nums text-success-ink">{emissaoResult.resumo.emitidas}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted p-6 shadow-sm">
                  <p className="text-sm text-muted-foreground">CAPTCHA</p>
                  <p className="mt-2 text-[2rem] font-bold leading-10 tabular-nums text-foreground">{emissaoResult.resumo.captcha}</p>
                </div>
                <div className="rounded-lg border border-destructive-line bg-destructive-tint p-6 shadow-sm">
                  <p className="text-sm text-destructive-ink">Irregulares</p>
                  <p className="mt-2 text-[2rem] font-bold leading-10 tabular-nums text-destructive-ink">{emissaoResult.resumo.erros}</p>
                </div>
              </div>

              {/* Export button for emissions */}
              <div className="flex justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline"><Download className="h-4 w-4" /> Exportar emissão</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => {
                      downloadPDF(
                        `emissao-certidoes-${cnpjInput.replace(/\D/g, '')}`,
                        `Emissão de Certidões – ${cnpjInput}`,
                        ['Certidão', 'Status', 'Código', 'Validade', 'Data Emissão', 'Detalhes'],
                        emissaoResult.resultados.map(r => [
                          r.certidao,
                          emissaoStatusConfig[r.status]?.label || r.status,
                          r.codigo || '—',
                          r.validade ? new Date(r.validade).toLocaleDateString('pt-BR') : '—',
                          r.dataEmissao ? new Date(r.dataEmissao).toLocaleString('pt-BR') : '—',
                          r.detalhes,
                        ])
                      );
                      toast.success('PDF exportado!');
                    }}><FileText className="w-4 h-4 mr-2" /> PDF</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      downloadCSV(
                        `emissao-certidoes-${cnpjInput.replace(/\D/g, '')}`,
                        ['Certidão', 'Status', 'Código', 'Validade', 'Data Emissão', 'Detalhes', 'URL'],
                        emissaoResult.resultados.map(r => [
                          r.certidao, emissaoStatusConfig[r.status]?.label || r.status,
                          r.codigo || '', r.validade || '', r.dataEmissao || '', r.detalhes, r.url || '',
                        ])
                      );
                      toast.success('CSV exportado!');
                    }}><FileSpreadsheet className="w-4 h-4 mr-2" /> CSV</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      const txt = [
                        `EMISSÃO DE CERTIDÕES – ${cnpjInput}`,
                        `Data: ${new Date(emissaoResult.dataConsulta).toLocaleString('pt-BR')}`,
                        '='.repeat(60), '',
                        `Resumo: ${emissaoResult.resumo.emitidas} emitidas, ${emissaoResult.resumo.captcha} CAPTCHA, ${emissaoResult.resumo.erros} irregulares`, '',
                        ...emissaoResult.resultados.map(r =>
                          `[${emissaoStatusConfig[r.status]?.label}] ${r.certidao}\n  ${r.detalhes}${r.codigo ? `\n  Código: ${r.codigo}` : ''}${r.validade ? `\n  Validade: ${new Date(r.validade).toLocaleDateString('pt-BR')}` : ''}\n`
                        ),
                      ].join('\n');
                      downloadTextReport(`emissao-certidoes-${cnpjInput.replace(/\D/g, '')}`, txt);
                      toast.success('TXT exportado!');
                    }}><FileDown className="w-4 h-4 mr-2" /> TXT</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Results grid */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {emissaoResult.resultados.map((r, i) => {
                  const cfg = emissaoStatusConfig[r.status];
                  const Icon = cfg.icon;
                  return (
                    <div key={i} className={`rounded-lg border p-6 shadow-sm transition-shadow hover:shadow-md ${cfg.caixa}`}>
                      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                        <h3 className="min-w-0 text-base font-semibold text-foreground">{r.certidao}</h3>
                        <Badge variant={cfg.variante} className="gap-1">
                          <Icon className="h-3 w-3" aria-hidden="true" /> {cfg.label}
                        </Badge>
                      </div>
                      <p className="line-clamp-3 text-sm text-muted-foreground">{r.detalhes}</p>
                      {r.codigo && (
                        <p className="mt-2 text-sm text-foreground">
                          Código: <span className="font-mono font-medium">{r.codigo}</span>
                        </p>
                      )}
                      {r.validade && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          Válida até: <span className="font-medium text-foreground">{new Date(r.validade).toLocaleDateString('pt-BR')}</span>
                        </p>
                      )}
                      {r.dataEmissao && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          Emitida: {new Date(r.dataEmissao).toLocaleString('pt-BR')}
                        </p>
                      )}
                      {r.url && (
                        <a href={r.url} target="_blank" rel="noopener noreferrer"
                          className="mt-3 flex items-center gap-1 text-sm text-primary hover:underline">
                          <ExternalLink className="h-3 w-3" aria-hidden="true" /> {r.status === 'captcha' ? 'Emitir manualmente' : 'Acessar portal'}
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          )}

          {/* ══ Verification Results (existing) ══ */}
          {resultado && (
            <TabsContent value="verificar" className="space-y-4 animate-fade-in">
              {resultado.verificacoesReais && resultado.verificacoesReais.length > 0 && (
                <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                  <h3 className="mb-3 flex flex-wrap items-center gap-2 text-lg font-semibold text-foreground">
                    <Wifi className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> Verificações em tempo real
                    <Badge variant="muted" className="ml-auto gap-1">
                      <Clock className="h-3 w-3" aria-hidden="true" />{new Date().toLocaleTimeString('pt-BR')}
                    </Badge>
                  </h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                    {resultado.verificacoesReais.map((v, i) => {
                      const cfg = verificacaoStatusConfig[v.status] || verificacaoStatusConfig.erro;
                      const Icon = cfg.icon;
                      return (
                        <TooltipProvider key={i}><Tooltip><TooltipTrigger asChild>
                          <div className={`cursor-help rounded-md border p-3 text-center transition-shadow hover:shadow-md ${cfg.caixa}`}>
                            <Icon className={`mx-auto mb-1 h-5 w-5 ${cfg.tinta} ${v.status === 'verificando' ? 'animate-spin' : ''}`} aria-hidden="true" />
                            <p className="truncate text-sm font-semibold text-foreground">{v.fonte}</p>
                            <p className={`text-sm font-medium ${cfg.tinta}`}>{cfg.label}</p>
                          </div>
                        </TooltipTrigger><TooltipContent side="bottom" className="max-w-xs">
                          <p className="text-sm font-semibold">{v.fonte}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{v.detalhes}</p>
                          {v.url && <p className="mt-1 break-all text-xs text-muted-foreground">{v.url}</p>}
                        </TooltipContent></Tooltip></TooltipProvider>
                      );
                    })}
                  </div>
                </div>
              )}

              {resultado.alertas && resultado.alertas.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  <AlertDescription>
                    <p className="font-semibold">Alertas</p>
                    <ul className="mt-1 list-inside list-disc space-y-1">
                      {resultado.alertas.map((a, i) => <li key={i}>{a}</li>)}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold text-foreground">Resumo da análise</h3>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline"><Download className="h-4 w-4" /> Exportar</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {
                        downloadCSV('certidoes-negativas', ['Certidão', 'Órgão', 'Validade', 'Status', 'Fonte', 'URL', 'Observações'],
                          resultado.certidoes.map(c => [c.nome, c.orgao, String(c.validadeDias), statusConfig[c.statusProvavel]?.label || 'Verificar', c.verificacaoReal ? 'API' : 'IA', c.url, c.observacoes]));
                        toast.success('CSV exportado!');
                      }}><FileSpreadsheet className="w-4 h-4 mr-2" /> CSV</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        const txt = [`CERTIDÕES – ${cnpjInput}`, `Gerado: ${new Date().toLocaleString('pt-BR')}`, '='.repeat(60), '',
                          ...(resultado.verificacoesReais || []).map(v => `[${v.status.toUpperCase()}] ${v.fonte}: ${v.detalhes}`),
                          '', resultado.resumo, '',
                          ...resultado.certidoes.map(c => `${c.verificacaoReal ? '[API]' : '[IA]'} ${c.nome}\n  Status: ${statusConfig[c.statusProvavel]?.label}\n  URL: ${c.url}\n`),
                          '', ...resultado.recomendacoes.map(r => `→ ${r}`),
                        ].join('\n');
                        downloadTextReport('certidoes-negativas', txt); toast.success('TXT exportado!');
                      }}><FileDown className="w-4 h-4 mr-2" /> TXT</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        downloadPDF('certidoes-negativas', `Certidões – ${cnpjInput}`,
                          ['Certidão', 'Órgão', 'Validade', 'Status', 'Fonte'],
                          resultado.certidoes.map(c => [c.nome, c.orgao, `${c.validadeDias}d`, statusConfig[c.statusProvavel]?.label || 'Verificar', c.verificacaoReal ? 'API' : 'IA']));
                        toast.success('PDF exportado!');
                      }}><FileText className="w-4 h-4 mr-2" /> PDF</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <p className="text-base text-muted-foreground">{resultado.resumo}</p>
                {resultado.recomendacoes.length > 0 && (
                  <div className="mt-4 border-t border-border pt-4">
                    <p className="text-sm font-semibold text-foreground">Recomendações:</p>
                    <ul className="mt-2 space-y-1">{resultado.recomendacoes.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground"><span aria-hidden="true" className="mt-0.5">→</span> {r}</li>
                    ))}</ul>
                  </div>
                )}
              </div>

              {certidoesReais.length > 0 && (
                <div>
                  <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
                    <Wifi className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> Verificadas via API ({certidoesReais.length})
                  </h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {certidoesReais.map((cert, i) => {
                      const st = statusConfig[cert.statusProvavel] || statusConfig.verificar;
                      const Icon = st.icon;
                      return (
                        <div key={i} className="rounded-lg border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
                          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                            <h4 className="min-w-0 text-base font-semibold text-foreground">{cert.nome}</h4>
                            <Badge variant="muted" className="gap-1"><Wifi className="h-3 w-3" aria-hidden="true" /> Verificação real</Badge>
                          </div>
                          <Badge variant={st.variante} className="mb-2 gap-1"><Icon className="h-3 w-3" aria-hidden="true" /> {st.label}</Badge>
                          <p className="text-sm text-muted-foreground">{cert.orgao}</p>
                          <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                            {cert.validadeDias > 0 && <p>Validade: <span className="font-medium text-foreground">{cert.validadeDias} dias</span></p>}
                            <p className="line-clamp-3">{cert.observacoes}</p>
                            {cert.dataVerificacao && (
                              <p className="flex items-center gap-1 text-xs">
                                <Clock className="h-3 w-3" aria-hidden="true" />Verificado: {new Date(cert.dataVerificacao).toLocaleString('pt-BR')}
                              </p>
                            )}
                          </div>
                          {cert.url && cert.url !== '#' && (
                            <a href={cert.url} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center gap-1 text-sm text-primary hover:underline">
                              <ExternalLink className="h-3 w-3" aria-hidden="true" /> Acessar portal
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {certidoesIA.length > 0 && (
                <div>
                  <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
                    <Bot className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> Complementar — IA ({certidoesIA.length})
                  </h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {certidoesIA.map((cert, i) => {
                      const st = statusConfig[cert.statusProvavel] || statusConfig.verificar;
                      const Icon = st.icon;
                      return (
                        <div key={i} className="rounded-lg border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
                          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                            <h4 className="min-w-0 text-base font-semibold text-foreground">{cert.nome}</h4>
                            <Badge variant="muted" className="gap-1"><Bot className="h-3 w-3" aria-hidden="true" /> IA</Badge>
                          </div>
                          <Badge variant={st.variante} className="mb-2 gap-1"><Icon className="h-3 w-3" aria-hidden="true" /> {st.label}</Badge>
                          <p className="text-sm text-muted-foreground">{cert.orgao}</p>
                          <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                            {cert.validadeDias > 0 && <p>Validade: <span className="font-medium text-foreground">{cert.validadeDias} dias</span></p>}
                            <p className="line-clamp-2">{cert.observacoes}</p>
                          </div>
                          {cert.url && cert.url !== '#' && (
                            <a href={cert.url} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center gap-1 text-sm text-primary hover:underline">
                              <ExternalLink className="h-3 w-3" aria-hidden="true" /> Emitir certidão
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}
