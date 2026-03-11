import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Search, Shield, ExternalLink, Loader2, AlertTriangle,
  CheckCircle2, AlertCircle, HelpCircle, Download, FileSpreadsheet, FileDown, FileText,
  Wifi, WifiOff, Bot, Globe, Clock
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { downloadCSV, downloadTextReport, downloadPDF } from '@/lib/download-utils';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type Certidao = {
  nome: string;
  orgao: string;
  url: string;
  validadeDias: number;
  documentosNecessarios: string[];
  statusProvavel: 'regular' | 'pendente' | 'verificar';
  observacoes: string;
  verificacaoReal?: boolean;
  dataVerificacao?: string;
  fonteVerificacao?: string;
};

type VerificacaoReal = {
  fonte: string;
  status: 'regular' | 'irregular' | 'erro' | 'verificando';
  detalhes: string;
  dataConsulta: string;
  url?: string;
};

type ResultadoCertidoes = {
  verificacoesReais?: VerificacaoReal[];
  certidoes: Certidao[];
  resumo: string;
  recomendacoes: string[];
  alertas?: string[];
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
  verificando: { label: 'Verificando', icon: Loader2, color: 'text-accent' },
};

export default function CertidoesNegativas() {
  const [cnpjInput, setCnpjInput] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ResultadoCertidoes | null>(null);
  const [erro, setErro] = useState('');

  const handleConsultar = async () => {
    const cnpjLimpo = cnpjInput.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) { setErro('CNPJ deve conter 14 dígitos'); return; }
    setErro(''); setLoading(true); setResultado(null);

    try {
      const { data, error } = await supabase.functions.invoke('certidoes-negativas', {
        body: { cnpj: cnpjLimpo, razaoSocial },
      });
      if (error) throw error;
      if (data.error) { setErro(data.error); } else {
        setResultado(data);
        const reaisOk = (data.verificacoesReais || []).filter((v: VerificacaoReal) => v.status === 'regular').length;
        const reaisIrreg = (data.verificacoesReais || []).filter((v: VerificacaoReal) => v.status === 'irregular').length;
        toast.success(`Análise concluída! ${reaisOk} verificações reais OK, ${reaisIrreg} alertas.`);
      }
    } catch (e: any) {
      setErro(e.message || 'Erro ao consultar certidões');
    } finally {
      setLoading(false);
    }
  };

  const certidoesReais = resultado?.certidoes.filter(c => c.verificacaoReal) || [];
  const certidoesIA = resultado?.certidoes.filter(c => !c.verificacaoReal) || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-1">
          <Shield className="w-4 h-4 text-accent" />
          Certidões Negativas – Verificação Real + IA
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Consulta automática em APIs públicas (CEIS, CNEP, CEPIM, Receita Federal) + análise complementar com IA
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="CNPJ do concorrente"
            value={cnpjInput}
            onChange={(e) => setCnpjInput(e.target.value)}
            className="flex-1"
          />
          <Input
            placeholder="Razão Social (opcional)"
            value={razaoSocial}
            onChange={(e) => setRazaoSocial(e.target.value)}
            className="flex-1"
          />
          <Button onClick={handleConsultar} disabled={loading} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Search className="w-4 h-4 mr-1" />}
            {loading ? 'Verificando...' : 'Verificar'}
          </Button>
        </div>
        {/* Badges de fontes */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          <Badge variant="outline" className="text-[10px] gap-1 bg-success/10 text-success border-success/30">
            <Wifi className="w-3 h-3" /> Portal da Transparência (API)
          </Badge>
          <Badge variant="outline" className="text-[10px] gap-1 bg-success/10 text-success border-success/30">
            <Wifi className="w-3 h-3" /> BrasilAPI / Receita Federal
          </Badge>
          <Badge variant="outline" className="text-[10px] gap-1 bg-accent/10 text-accent border-accent/30">
            <Globe className="w-3 h-3" /> Firecrawl (Scraping)
          </Badge>
          <Badge variant="outline" className="text-[10px] gap-1 bg-muted text-muted-foreground">
            <Bot className="w-3 h-3" /> IA (Complementar)
          </Badge>
        </div>
        {erro && (
          <div className="flex items-center gap-2 mt-3 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4" /> {erro}
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="bg-card rounded-xl border border-border/50 p-8 shadow-sm text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-accent mb-3" />
          <p className="text-sm text-muted-foreground">Consultando APIs públicas em tempo real...</p>
          <div className="flex justify-center gap-3 mt-3">
            {['CEIS', 'CNEP', 'CEPIM', 'Receita', 'TST', 'FGTS'].map(fonte => (
              <Badge key={fonte} variant="outline" className="text-[10px] animate-pulse">
                {fonte}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {resultado && (
        <div className="space-y-4 animate-fade-in">
          {/* Painel de verificações reais */}
          {resultado.verificacoesReais && resultado.verificacoesReais.length > 0 && (
            <div className="bg-card rounded-xl border border-accent/30 p-5 shadow-sm">
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <Wifi className="w-4 h-4 text-accent" />
                Verificações em Tempo Real
                <Badge variant="outline" className="text-[10px] ml-auto bg-accent/10 text-accent">
                  <Clock className="w-3 h-3 mr-0.5" />
                  {new Date().toLocaleTimeString('pt-BR')}
                </Badge>
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                {resultado.verificacoesReais.map((v, i) => {
                  const cfg = verificacaoStatusConfig[v.status] || verificacaoStatusConfig.erro;
                  const Icon = cfg.icon;
                  return (
                    <TooltipProvider key={i}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className={`rounded-lg border p-3 text-center cursor-help transition-all hover:shadow-md ${
                            v.status === 'regular' ? 'border-success/30 bg-success/5' :
                            v.status === 'irregular' ? 'border-destructive/30 bg-destructive/5' :
                            'border-border/50 bg-muted/30'
                          }`}>
                            <Icon className={`w-5 h-5 mx-auto mb-1 ${cfg.color} ${v.status === 'verificando' ? 'animate-spin' : ''}`} />
                            <p className="text-[10px] font-semibold truncate">{v.fonte}</p>
                            <p className={`text-[9px] font-medium ${cfg.color}`}>{cfg.label}</p>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs">
                          <p className="text-xs font-semibold">{v.fonte}</p>
                          <p className="text-xs text-muted-foreground mt-1">{v.detalhes}</p>
                          {v.url && <p className="text-[10px] text-accent mt-1">🔗 {v.url}</p>}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
            </div>
          )}

          {/* Alertas */}
          {resultado.alertas && resultado.alertas.length > 0 && (
            <div className="bg-destructive/5 rounded-xl border border-destructive/30 p-4">
              <h4 className="text-xs font-semibold text-destructive flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-4 h-4" /> Alertas Identificados
              </h4>
              <ul className="space-y-1">
                {resultado.alertas.map((a, i) => (
                  <li key={i} className="text-xs text-destructive/80">{a}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Resumo */}
          <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Resumo da Análise</h3>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline"><Download className="w-3.5 h-3.5 mr-1" /> Exportar</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => {
                    downloadCSV('certidoes-negativas', ['Certidão', 'Órgão', 'Validade (dias)', 'Status', 'Fonte', 'URL', 'Observações'],
                      resultado.certidoes.map(c => [c.nome, c.orgao, String(c.validadeDias), statusConfig[c.statusProvavel]?.label || 'Verificar', c.verificacaoReal ? '✅ API Real' : '🤖 IA', c.url, c.observacoes]));
                    toast.success('CSV exportado!');
                  }}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" /> CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    const txt = [
                      `CERTIDÕES NEGATIVAS – ${cnpjInput}`,
                      `Gerado: ${new Date().toLocaleString('pt-BR')}`,
                      '='.repeat(60), '',
                      '🔴 VERIFICAÇÕES EM TEMPO REAL:',
                      ...(resultado.verificacoesReais || []).map(v => `  [${v.status.toUpperCase()}] ${v.fonte}: ${v.detalhes}`),
                      '', resultado.resumo, '',
                      ...resultado.certidoes.map(c =>
                        `${c.verificacaoReal ? '✅' : '🤖'} ${c.nome}\n  Órgão: ${c.orgao}\n  Validade: ${c.validadeDias} dias\n  Status: ${statusConfig[c.statusProvavel]?.label || 'Verificar'}\n  Fonte: ${c.verificacaoReal ? 'API Real' : 'IA'}\n  URL: ${c.url}\n  Obs: ${c.observacoes}\n`
                      ),
                      '', 'RECOMENDAÇÕES:', ...resultado.recomendacoes.map(r => `  → ${r}`),
                      ...(resultado.alertas?.length ? ['', 'ALERTAS:', ...resultado.alertas.map(a => `  ⚠️ ${a}`)] : []),
                    ].join('\n');
                    downloadTextReport('certidoes-negativas', txt);
                    toast.success('TXT exportado!');
                  }}>
                    <FileDown className="w-4 h-4 mr-2" /> TXT
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    downloadPDF('certidoes-negativas', `Certidões Negativas – ${cnpjInput}`,
                      ['Certidão', 'Órgão', 'Validade', 'Status', 'Fonte'],
                      resultado.certidoes.map(c => [c.nome, c.orgao, `${c.validadeDias}d`, statusConfig[c.statusProvavel]?.label || 'Verificar', c.verificacaoReal ? 'API Real' : 'IA']));
                    toast.success('PDF exportado!');
                  }}>
                    <FileText className="w-4 h-4 mr-2" /> PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <p className="text-sm text-muted-foreground">{resultado.resumo}</p>
            {resultado.recomendacoes.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border/30">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Recomendações:</p>
                <ul className="space-y-1">
                  {resultado.recomendacoes.map((r, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <span className="text-accent mt-0.5">→</span> {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Certidões com verificação real */}
          {certidoesReais.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5 text-success" />
                Verificadas via API ({certidoesReais.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {certidoesReais.map((cert, i) => {
                  const st = statusConfig[cert.statusProvavel] || statusConfig.verificar;
                  const Icon = st.icon;
                  return (
                    <div key={i} className="bg-card rounded-xl border-2 border-accent/20 p-4 shadow-sm hover:shadow-md transition-shadow relative">
                      <div className="absolute top-2 right-2">
                        <Badge className="text-[8px] bg-accent/15 text-accent border-accent/30 gap-0.5">
                          <Wifi className="w-2.5 h-2.5" /> REAL
                        </Badge>
                      </div>
                      <div className="flex items-start justify-between mb-2 pr-14">
                        <h4 className="text-xs font-semibold leading-tight flex-1 mr-2">{cert.nome}</h4>
                      </div>
                      <Badge variant="outline" className={`${st.className} text-[10px] mb-2`}>
                        <Icon className="w-3 h-3 mr-0.5" /> {st.label}
                      </Badge>
                      <p className="text-[11px] text-muted-foreground mb-2">{cert.orgao}</p>
                      <div className="text-[10px] text-muted-foreground space-y-1">
                        {cert.validadeDias > 0 && <p>Validade: <span className="font-medium text-foreground">{cert.validadeDias} dias</span></p>}
                        <p className="line-clamp-3">{cert.observacoes}</p>
                        {cert.dataVerificacao && (
                          <p className="text-accent">
                            <Clock className="w-3 h-3 inline mr-0.5" />
                            Verificado: {new Date(cert.dataVerificacao).toLocaleString('pt-BR')}
                          </p>
                        )}
                      </div>
                      {cert.url && cert.url !== '#' && (
                        <a href={cert.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 mt-2 text-[10px] text-accent hover:underline">
                          <ExternalLink className="w-3 h-3" /> Acessar portal
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Certidões complementares (IA) */}
          {certidoesIA.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-muted-foreground" />
                Complementar – Análise IA ({certidoesIA.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {certidoesIA.map((cert, i) => {
                  const st = statusConfig[cert.statusProvavel] || statusConfig.verificar;
                  const Icon = st.icon;
                  return (
                    <div key={i} className="bg-card rounded-xl border border-border/50 p-4 shadow-sm hover:shadow-md transition-shadow relative opacity-90">
                      <div className="absolute top-2 right-2">
                        <Badge variant="outline" className="text-[8px] gap-0.5">
                          <Bot className="w-2.5 h-2.5" /> IA
                        </Badge>
                      </div>
                      <div className="flex items-start justify-between mb-2 pr-10">
                        <h4 className="text-xs font-semibold leading-tight flex-1 mr-2">{cert.nome}</h4>
                      </div>
                      <Badge variant="outline" className={`${st.className} text-[10px] mb-2`}>
                        <Icon className="w-3 h-3 mr-0.5" /> {st.label}
                      </Badge>
                      <p className="text-[11px] text-muted-foreground mb-2">{cert.orgao}</p>
                      <div className="text-[10px] text-muted-foreground space-y-1">
                        {cert.validadeDias > 0 && <p>Validade: <span className="font-medium text-foreground">{cert.validadeDias} dias</span></p>}
                        <p className="line-clamp-2">{cert.observacoes}</p>
                      </div>
                      {cert.url && cert.url !== '#' && (
                        <a href={cert.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 mt-2 text-[10px] text-accent hover:underline">
                          <ExternalLink className="w-3 h-3" /> Emitir certidão
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
