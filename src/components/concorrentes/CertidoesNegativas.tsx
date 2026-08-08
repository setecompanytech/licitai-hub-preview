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

const statusConfig = {
  regular: { label: 'Regular', icon: CheckCircle2, className: 'bg-success/15 text-success border-success/30' },
  pendente: { label: 'Irregular', icon: AlertCircle, className: 'bg-destructive/15 text-destructive border-destructive/30' },
  verificar: { label: 'Verificar', icon: HelpCircle, className: 'bg-warning/15 text-warning border-warning/30' },
};
const verificacaoStatusConfig = {
  regular: { label: 'Regular', icon: CheckCircle2, color: 'text-success' },
  irregular: { label: 'Irregular', icon: AlertCircle, color: 'text-destructive' },
  erro: { label: 'Erro', icon: WifiOff, color: 'text-muted-foreground' },
  verificando: { label: 'Verificando', icon: Loader2, color: 'text-muted-foreground' },
};
const emissaoStatusConfig = {
  emitida: { label: 'Emitida', icon: CheckCircle2, color: 'text-success', bg: 'border-success/30 bg-success/5' },
  pendente: { label: 'Pendente', icon: HelpCircle, color: 'text-warning', bg: 'border-warning/30 bg-warning/5' },
  erro: { label: 'Irregular', icon: AlertCircle, color: 'text-destructive', bg: 'border-destructive/30 bg-destructive/5' },
  captcha: { label: 'CAPTCHA', icon: ShieldAlert, color: 'text-muted-foreground', bg: 'border-border/50 bg-muted/30' },
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
      <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-1">
          <Shield className="w-4 h-4 text-muted-foreground" />
          Certidões Negativas – Verificação & Emissão Automática
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Consulta em APIs públicas + emissão automática via scraping nos portais oficiais
        </p>
        <div className="flex gap-2">
          <Input placeholder="CNPJ" value={cnpjInput} onChange={(e) => setCnpjInput(e.target.value)} className="flex-1" />
          <Input placeholder="Razão Social (opcional)" value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} className="flex-1" />
        </div>
        <div className="flex gap-2 mt-2">
          <div className="flex-1">
            <Select value={ufSelecionada} onValueChange={(v) => { setUfSelecionada(v); setMunicipioSelecionado(''); }}>
              <SelectTrigger className="w-full">
                <MapPin className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                <SelectValue placeholder="UF (Estado)" />
              </SelectTrigger>
              <SelectContent>
                {ufsDisponiveis.map(e => (
                  <SelectItem key={e.uf} value={e.uf}>{e.uf} – {e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Select value={municipioSelecionado} onValueChange={setMunicipioSelecionado} disabled={!ufSelecionada}>
              <SelectTrigger className="w-full">
                <Building2 className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                <SelectValue placeholder={ufSelecionada ? "Município" : "Selecione UF primeiro"} />
              </SelectTrigger>
              <SelectContent>
                {municipiosDisponiveis.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {portaisRegionais.length > 0 && (
          <div className="mt-2 p-2 rounded-lg bg-muted border border-border">
            <p className="text-xs font-medium text-foreground mb-1 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Portais regionais identificados ({portaisRegionais.length}):
            </p>
            <div className="flex flex-wrap gap-1">
              {portaisRegionais.map((p, i) => (
                <Badge key={i} variant="outline" className="text-xs bg-background text-muted-foreground border-border">
                  {p.tipo === 'estadual' ? '🏛️' : '🏙️'} {p.nome.split(' - ')[0]}
                  {p.requerLogin && ' 🔒'}
                </Badge>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-2 mt-3">
          <Button onClick={handleConsultar} disabled={isLoading} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Search className="w-4 h-4 mr-1" />}
            {loading ? 'Verificando...' : 'Verificar Status'}
          </Button>
          <Button onClick={handleEmitir} disabled={isLoading} variant="outline" className="border-success/50 text-success hover:bg-success/10">
            {loadingEmissao ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Zap className="w-4 h-4 mr-1" />}
            {loadingEmissao ? 'Emitindo...' : 'Emitir Certidões'}
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          <Badge variant="outline" className="text-xs gap-1 bg-success/10 text-success border-success/30"><Wifi className="w-3 h-3" /> APIs Públicas</Badge>
          <Badge variant="outline" className="text-xs gap-1 bg-muted text-muted-foreground border-border"><Globe className="w-3 h-3" /> Firecrawl (Scraping)</Badge>
          <Badge variant="outline" className="text-xs gap-1 bg-muted text-muted-foreground"><Bot className="w-3 h-3" /> IA (Extração)</Badge>
        </div>
        {erro && <div className="flex items-center gap-2 mt-3 text-sm text-destructive"><AlertTriangle className="w-4 h-4" /> {erro}</div>}
      </div>

      {/* Loading states */}
      {loading && (
        <div className="bg-card rounded-xl border border-border/50 p-8 shadow-sm text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Consultando APIs públicas em tempo real...</p>
          <div className="flex justify-center gap-3 mt-3">
            {['CEIS', 'CNEP', 'CEPIM', 'Receita', 'TST', 'FGTS'].map(f => (
              <Badge key={f} variant="outline" className="text-xs animate-pulse">{f}</Badge>
            ))}
          </div>
        </div>
      )}

      {loadingEmissao && (
        <div className="bg-card rounded-xl border border-border/50 p-8 shadow-sm text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-foreground">Emitindo certidões nos portais oficiais...</p>
          <p className="text-xs text-muted-foreground mt-1">Preenchendo formulários e extraindo resultados via scraping</p>
          <div className="flex justify-center gap-3 mt-3">
            {['Receita Federal', 'TST', 'Caixa/FGTS', 'Transparência'].map(f => (
              <Badge key={f} variant="outline" className="text-xs animate-pulse bg-muted text-muted-foreground border-border">{f}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Tabs for results */}
      {(resultado || emissaoResult) && (
        <Tabs value={emissaoResult ? 'emissao' : activeTab} onValueChange={setActiveTab}>
          <TabsList>
            {resultado && <TabsTrigger value="verificar"><Search className="w-3.5 h-3.5 mr-1" /> Verificação</TabsTrigger>}
            {emissaoResult && <TabsTrigger value="emissao"><Zap className="w-3.5 h-3.5 mr-1" /> Emissão</TabsTrigger>}
          </TabsList>

          {/* ══ Emission Results ══ */}
          {emissaoResult && (
            <TabsContent value="emissao" className="space-y-4 animate-fade-in">
              {/* Summary cards */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-card rounded-xl border border-border/50 p-3 text-center shadow-sm">
                  <p className="text-lg font-bold text-foreground">{emissaoResult.resumo.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div className="bg-success/5 rounded-xl border border-success/30 p-3 text-center shadow-sm">
                  <p className="text-lg font-bold text-success">{emissaoResult.resumo.emitidas}</p>
                  <p className="text-xs text-success">Emitidas</p>
                </div>
                <div className="bg-muted/30 rounded-xl border border-border/50 p-3 text-center shadow-sm">
                  <p className="text-lg font-bold text-muted-foreground">{emissaoResult.resumo.captcha}</p>
                  <p className="text-xs text-muted-foreground">CAPTCHA</p>
                </div>
                <div className="bg-destructive/5 rounded-xl border border-destructive/30 p-3 text-center shadow-sm">
                  <p className="text-lg font-bold text-destructive">{emissaoResult.resumo.erros}</p>
                  <p className="text-xs text-destructive">Irregulares</p>
                </div>
              </div>

              {/* Export button for emissions */}
              <div className="flex justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline"><Download className="w-3.5 h-3.5 mr-1" /> Exportar Emissão</Button>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {emissaoResult.resultados.map((r, i) => {
                  const cfg = emissaoStatusConfig[r.status];
                  const Icon = cfg.icon;
                  return (
                    <div key={i} className={`bg-card rounded-xl border-2 ${cfg.bg} p-4 shadow-sm hover:shadow-md transition-shadow relative`}>
                      <div className="absolute top-2 right-2">
                        <Badge variant="outline" className={`text-xs gap-0.5 ${cfg.color}`}>
                          <Icon className="w-2.5 h-2.5" /> {cfg.label}
                        </Badge>
                      </div>
                      <h4 className="text-xs font-semibold leading-tight pr-16 mb-2">{r.certidao}</h4>
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-3">{r.detalhes}</p>
                      {r.codigo && (
                        <p className="text-xs text-foreground mb-1">
                          Código: <span className="font-mono font-medium">{r.codigo}</span>
                        </p>
                      )}
                      {r.validade && (
                        <p className="text-xs text-muted-foreground mb-1">
                          Válida até: <span className="font-medium text-foreground">{new Date(r.validade).toLocaleDateString('pt-BR')}</span>
                        </p>
                      )}
                      {r.dataEmissao && (
                        <p className="text-xs text-muted-foreground">
                          <Clock className="w-3 h-3 inline mr-0.5" />
                          Emitida: {new Date(r.dataEmissao).toLocaleString('pt-BR')}
                        </p>
                      )}
                      {r.url && (
                        <a href={r.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 mt-2 text-xs text-accent hover:underline">
                          <ExternalLink className="w-3 h-3" /> {r.status === 'captcha' ? 'Emitir manualmente' : 'Acessar portal'}
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
                <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <Wifi className="w-4 h-4 text-muted-foreground" /> Verificações em Tempo Real
                    <Badge variant="outline" className="text-xs ml-auto bg-muted text-muted-foreground">
                      <Clock className="w-3 h-3 mr-0.5" />{new Date().toLocaleTimeString('pt-BR')}
                    </Badge>
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                    {resultado.verificacoesReais.map((v, i) => {
                      const cfg = verificacaoStatusConfig[v.status] || verificacaoStatusConfig.erro;
                      const Icon = cfg.icon;
                      return (
                        <TooltipProvider key={i}><Tooltip><TooltipTrigger asChild>
                          <div className={`rounded-lg border p-3 text-center cursor-help transition-all hover:shadow-md ${
                            v.status === 'regular' ? 'border-success/30 bg-success/5' :
                            v.status === 'irregular' ? 'border-destructive/30 bg-destructive/5' : 'border-border/50 bg-muted/30'
                          }`}>
                            <Icon className={`w-5 h-5 mx-auto mb-1 ${cfg.color} ${v.status === 'verificando' ? 'animate-spin' : ''}`} />
                            <p className="text-xs font-semibold truncate">{v.fonte}</p>
                            <p className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</p>
                          </div>
                        </TooltipTrigger><TooltipContent side="bottom" className="max-w-xs">
                          <p className="text-xs font-semibold">{v.fonte}</p>
                          <p className="text-xs text-muted-foreground mt-1">{v.detalhes}</p>
                          {v.url && <p className="text-xs text-muted-foreground mt-1">🔗 {v.url}</p>}
                        </TooltipContent></Tooltip></TooltipProvider>
                      );
                    })}
                  </div>
                </div>
              )}

              {resultado.alertas && resultado.alertas.length > 0 && (
                <div className="bg-destructive/5 rounded-xl border border-destructive/30 p-4">
                  <h4 className="text-xs font-semibold text-destructive flex items-center gap-1.5 mb-2">
                    <AlertTriangle className="w-4 h-4" /> Alertas
                  </h4>
                  <ul className="space-y-1">{resultado.alertas.map((a, i) => <li key={i} className="text-xs text-destructive/80">{a}</li>)}</ul>
                </div>
              )}

              <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">Resumo da Análise</h3>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline"><Download className="w-3.5 h-3.5 mr-1" /> Exportar</Button>
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
                <p className="text-sm text-muted-foreground">{resultado.resumo}</p>
                {resultado.recomendacoes.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/30">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Recomendações:</p>
                    <ul className="space-y-1">{resultado.recomendacoes.map((r, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5"><span className="text-muted-foreground mt-0.5">→</span> {r}</li>
                    ))}</ul>
                  </div>
                )}
              </div>

              {certidoesReais.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5 text-success" /> Verificadas via API ({certidoesReais.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {certidoesReais.map((cert, i) => {
                      const st = statusConfig[cert.statusProvavel] || statusConfig.verificar;
                      const Icon = st.icon;
                      return (
                        <div key={i} className="bg-card rounded-xl border-2 border-border p-4 shadow-sm hover:shadow-md transition-shadow relative">
                          <div className="absolute top-2 right-2">
                            <Badge className="text-xs bg-muted text-muted-foreground border-border gap-0.5"><Wifi className="w-2.5 h-2.5" /> REAL</Badge>
                          </div>
                          <h4 className="text-xs font-semibold leading-tight pr-14 mb-2">{cert.nome}</h4>
                          <Badge variant="outline" className={`${st.className} text-xs mb-2`}><Icon className="w-3 h-3 mr-0.5" /> {st.label}</Badge>
                          <p className="text-xs text-muted-foreground mb-2">{cert.orgao}</p>
                          <div className="text-xs text-muted-foreground space-y-1">
                            {cert.validadeDias > 0 && <p>Validade: <span className="font-medium text-foreground">{cert.validadeDias} dias</span></p>}
                            <p className="line-clamp-3">{cert.observacoes}</p>
                            {cert.dataVerificacao && <p className="text-muted-foreground"><Clock className="w-3 h-3 inline mr-0.5" />Verificado: {new Date(cert.dataVerificacao).toLocaleString('pt-BR')}</p>}
                          </div>
                          {cert.url && cert.url !== '#' && (
                            <a href={cert.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 mt-2 text-xs text-accent hover:underline">
                              <ExternalLink className="w-3 h-3" /> Acessar portal
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
                  <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Bot className="w-3.5 h-3.5 text-muted-foreground" /> Complementar – IA ({certidoesIA.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {certidoesIA.map((cert, i) => {
                      const st = statusConfig[cert.statusProvavel] || statusConfig.verificar;
                      const Icon = st.icon;
                      return (
                        <div key={i} className="bg-card rounded-xl border border-border/50 p-4 shadow-sm hover:shadow-md transition-shadow relative opacity-90">
                          <div className="absolute top-2 right-2"><Badge variant="outline" className="text-xs gap-0.5"><Bot className="w-2.5 h-2.5" /> IA</Badge></div>
                          <h4 className="text-xs font-semibold leading-tight pr-10 mb-2">{cert.nome}</h4>
                          <Badge variant="outline" className={`${st.className} text-xs mb-2`}><Icon className="w-3 h-3 mr-0.5" /> {st.label}</Badge>
                          <p className="text-xs text-muted-foreground mb-2">{cert.orgao}</p>
                          <div className="text-xs text-muted-foreground space-y-1">
                            {cert.validadeDias > 0 && <p>Validade: <span className="font-medium text-foreground">{cert.validadeDias} dias</span></p>}
                            <p className="line-clamp-2">{cert.observacoes}</p>
                          </div>
                          {cert.url && cert.url !== '#' && (
                            <a href={cert.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 mt-2 text-xs text-accent hover:underline">
                              <ExternalLink className="w-3 h-3" /> Emitir certidão
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
