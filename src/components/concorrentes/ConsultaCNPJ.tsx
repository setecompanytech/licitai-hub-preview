import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Building2, Globe, FileText, CheckCircle2, AlertTriangle, Loader2, ExternalLink, Download, FileSpreadsheet, FileDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { downloadCSV, downloadTextReport } from '@/lib/download-utils';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type DadosCNPJ = {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  situacao: string;
  dataAbertura: string;
  naturezaJuridica: string;
  cnaePrincipal: string;
  cnaesSecundarios: string[];
  endereco: string;
  municipio: string;
  uf: string;
  porte: string;
  capitalSocial: string;
  email: string;
  telefone: string;
};

function InfoField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-sm ${highlight ? 'font-semibold text-accent' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}

export default function ConsultaCNPJ() {
  const [cnpjInput, setCnpjInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<DadosCNPJ | null>(null);
  const [erro, setErro] = useState('');

  const handleConsultar = async () => {
    const cnpjLimpo = cnpjInput.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) {
      setErro('CNPJ deve conter 14 dígitos');
      return;
    }
    setErro('');
    setLoading(true);
    setResultado(null);

    try {
      const { data, error } = await supabase.functions.invoke('consulta-cnpj', {
        body: { cnpj: cnpjLimpo },
      });

      if (error) throw error;
      if (data.error) {
        setErro(data.error);
      } else {
        setResultado(data);
        toast.success('CNPJ consultado com sucesso!');
      }
    } catch (e: any) {
      setErro(e.message || 'Erro ao consultar CNPJ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
          <Search className="w-4 h-4 text-accent" />
          Consulta de CNPJ – Receita Federal (BrasilAPI)
        </h3>

        <div className="flex gap-2">
          <Input
            placeholder="Digite o CNPJ (ex: 12.345.678/0001-01)"
            value={cnpjInput}
            onChange={(e) => setCnpjInput(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleConsultar()}
          />
          <Button onClick={handleConsultar} disabled={loading} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span className="ml-1">{loading ? 'Consultando...' : 'Consultar'}</span>
          </Button>
        </div>

        {erro && (
          <div className="flex items-center gap-2 mt-3 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4" /> {erro}
          </div>
        )}

        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <a href="https://brasilapi.com.br" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-accent transition-colors">
            <ExternalLink className="w-3 h-3" /> BrasilAPI
          </a>
          <a href="https://servicos.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-accent transition-colors">
            <ExternalLink className="w-3 h-3" /> Receita Federal
          </a>
        </div>
      </div>

      {resultado && (
        <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm animate-fade-in space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-accent" />
              Resultado da Consulta
            </h3>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Download className="w-3.5 h-3.5 mr-1" /> Exportar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => {
                    downloadCSV(
                      `cnpj-${resultado.cnpj.replace(/\D/g, '')}`,
                      ['Campo', 'Valor'],
                      [
                        ['Razão Social', resultado.razaoSocial],
                        ['Nome Fantasia', resultado.nomeFantasia],
                        ['CNPJ', resultado.cnpj],
                        ['Situação', resultado.situacao],
                        ['Data Abertura', resultado.dataAbertura],
                        ['Natureza Jurídica', resultado.naturezaJuridica],
                        ['CNAE Principal', resultado.cnaePrincipal],
                        ['Porte', resultado.porte],
                        ['Capital Social', resultado.capitalSocial],
                        ['Endereço', resultado.endereco],
                        ['Município/UF', `${resultado.municipio}/${resultado.uf}`],
                        ['E-mail', resultado.email],
                        ['Telefone', resultado.telefone],
                        ...resultado.cnaesSecundarios.map((c, i) => [`CNAE Secundário ${i + 1}`, c]),
                      ]
                    );
                    toast.success('CSV exportado!');
                  }}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" /> Exportar CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    const report = [
                      `CONSULTA CNPJ – ${resultado.cnpj}`,
                      `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
                      '='.repeat(50),
                      '',
                      `Razão Social: ${resultado.razaoSocial}`,
                      `Nome Fantasia: ${resultado.nomeFantasia}`,
                      `Situação: ${resultado.situacao}`,
                      `Data Abertura: ${resultado.dataAbertura}`,
                      `Natureza Jurídica: ${resultado.naturezaJuridica}`,
                      `CNAE Principal: ${resultado.cnaePrincipal}`,
                      `Porte: ${resultado.porte}`,
                      `Capital Social: ${resultado.capitalSocial}`,
                      `Endereço: ${resultado.endereco}`,
                      `Município/UF: ${resultado.municipio}/${resultado.uf}`,
                      `E-mail: ${resultado.email}`,
                      `Telefone: ${resultado.telefone}`,
                      '',
                      `CNAEs Secundários (${resultado.cnaesSecundarios.length}):`,
                      ...resultado.cnaesSecundarios.map(c => `  • ${c}`),
                    ].join('\n');
                    downloadTextReport(`cnpj-${resultado.cnpj.replace(/\D/g, '')}`, report);
                    toast.success('Relatório exportado!');
                  }}>
                    <FileDown className="w-4 h-4 mr-2" /> Exportar Relatório TXT
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Badge variant="outline" className={
                resultado.situacao === 'ATIVA' ? 'bg-success/15 text-success border-success/30' : 'bg-destructive/15 text-destructive border-destructive/30'
              }>
                <CheckCircle2 className="w-3 h-3 mr-1" /> {resultado.situacao}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoField label="Razão Social" value={resultado.razaoSocial} />
            <InfoField label="Nome Fantasia" value={resultado.nomeFantasia} />
            <InfoField label="CNPJ" value={resultado.cnpj} />
            <InfoField label="Situação Cadastral" value={resultado.situacao} highlight />
            <InfoField label="Data de Abertura" value={resultado.dataAbertura} />
            <InfoField label="Natureza Jurídica" value={resultado.naturezaJuridica} />
            <InfoField label="Porte" value={resultado.porte} />
            <InfoField label="Capital Social" value={resultado.capitalSocial} />
            <InfoField label="CNAE Principal" value={resultado.cnaePrincipal} highlight />
            <InfoField label="Endereço" value={resultado.endereco} />
            <InfoField label="Município/UF" value={`${resultado.municipio} / ${resultado.uf}`} />
            <InfoField label="E-mail" value={resultado.email} />
            <InfoField label="Telefone" value={resultado.telefone} />
          </div>

          {resultado.cnaesSecundarios.length > 0 && (
            <div className="border-t border-border/30 pt-4">
              <h4 className="text-xs font-semibold text-muted-foreground mb-3">
                CNAEs Secundários ({resultado.cnaesSecundarios.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {resultado.cnaesSecundarios.map((cnae, i) => (
                  <Badge key={i} variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
                    {cnae}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
