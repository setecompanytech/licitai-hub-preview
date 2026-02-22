import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Search, Shield, ExternalLink, Loader2, AlertTriangle,
  CheckCircle2, AlertCircle, HelpCircle, Download, FileSpreadsheet, FileDown, FileText
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { downloadCSV, downloadTextReport, downloadPDF } from '@/lib/download-utils';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Certidao = {
  nome: string;
  orgao: string;
  url: string;
  validadeDias: number;
  documentosNecessarios: string[];
  statusProvavel: 'regular' | 'pendente' | 'verificar';
  observacoes: string;
};

type ResultadoCertidoes = {
  certidoes: Certidao[];
  resumo: string;
  recomendacoes: string[];
};

const statusConfig = {
  regular: { label: 'Regular', icon: CheckCircle2, className: 'bg-success/15 text-success border-success/30' },
  pendente: { label: 'Pendente', icon: AlertCircle, className: 'bg-destructive/15 text-destructive border-destructive/30' },
  verificar: { label: 'Verificar', icon: HelpCircle, className: 'bg-warning/15 text-warning border-warning/30' },
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
        toast.success('Análise de certidões concluída!');
      }
    } catch (e: any) {
      setErro(e.message || 'Erro ao consultar certidões');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-1">
          <Shield className="w-4 h-4 text-accent" />
          Certidões Negativas – Análise com IA
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Análise automatizada das certidões obrigatórias para licitações (Lei 14.133/2021)
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
            {loading ? 'Analisando...' : 'Analisar'}
          </Button>
        </div>
        {erro && (
          <div className="flex items-center gap-2 mt-3 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4" /> {erro}
          </div>
        )}
      </div>

      {loading && (
        <div className="bg-card rounded-xl border border-border/50 p-8 shadow-sm text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-accent mb-3" />
          <p className="text-sm text-muted-foreground">A IA está analisando as certidões necessárias...</p>
          <p className="text-xs text-muted-foreground mt-1">Isso pode levar alguns segundos</p>
        </div>
      )}

      {resultado && (
        <div className="space-y-4 animate-fade-in">
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
                    downloadCSV('certidoes-negativas', ['Certidão', 'Órgão', 'Validade (dias)', 'Status', 'URL', 'Observações'],
                      resultado.certidoes.map(c => [c.nome, c.orgao, String(c.validadeDias), statusConfig[c.statusProvavel].label, c.url, c.observacoes]));
                    toast.success('CSV exportado!');
                  }}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" /> CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    const txt = [`CERTIDÕES NEGATIVAS – ${cnpjInput}`, `Gerado: ${new Date().toLocaleString('pt-BR')}`, '='.repeat(60), '', resultado.resumo, '', ...resultado.certidoes.map(c =>
                      `• ${c.nome}\n  Órgão: ${c.orgao}\n  Validade: ${c.validadeDias} dias\n  Status: ${statusConfig[c.statusProvavel].label}\n  URL: ${c.url}\n  Obs: ${c.observacoes}\n`
                    ), '', 'RECOMENDAÇÕES:', ...resultado.recomendacoes.map(r => `  → ${r}`)].join('\n');
                    downloadTextReport('certidoes-negativas', txt);
                    toast.success('TXT exportado!');
                  }}>
                    <FileDown className="w-4 h-4 mr-2" /> TXT
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    downloadPDF('certidoes-negativas', `Certidões Negativas – ${cnpjInput}`,
                      ['Certidão', 'Órgão', 'Validade', 'Status', 'Observações'],
                      resultado.certidoes.map(c => [c.nome, c.orgao, `${c.validadeDias}d`, statusConfig[c.statusProvavel].label, c.observacoes]));
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

          {/* Certidões */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {resultado.certidoes.map((cert, i) => {
              const st = statusConfig[cert.statusProvavel] || statusConfig.verificar;
              const Icon = st.icon;
              return (
                <div key={i} className="bg-card rounded-xl border border-border/50 p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-xs font-semibold leading-tight flex-1 mr-2">{cert.nome}</h4>
                    <Badge variant="outline" className={`${st.className} text-[10px] shrink-0`}>
                      <Icon className="w-3 h-3 mr-0.5" /> {st.label}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-2">{cert.orgao}</p>
                  <div className="text-[10px] text-muted-foreground space-y-1">
                    <p>Validade: <span className="font-medium text-foreground">{cert.validadeDias} dias</span></p>
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
  );
}
