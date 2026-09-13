import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, FileText, CheckCircle2, AlertTriangle, Loader2, ExternalLink, Download, FileSpreadsheet, FileDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { downloadCSV, downloadTextReport, downloadPDF } from '@/lib/download-utils';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Consulta de CNPJ — componente interno da aba "Consulta CNPJ" da tela
 * Concorrentes: começa direto no conteúdo, sem cabeçalho de página.
 */

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
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 text-base text-foreground ${highlight ? 'font-semibold' : ''}`}>{value || '—'}</dd>
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

  // Situação cadastral: a tinta e o ícone do badge saem juntos do mesmo dado —
  // um CNPJ "BAIXADA"/"SUSPENSA" não pode exibir visto de confirmação.
  const situacaoAtiva = resultado?.situacao === 'ATIVA';
  const IconeSituacao = situacaoAtiva ? CheckCircle2 : AlertTriangle;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Search className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          Consulta de CNPJ — Receita Federal (BrasilAPI)
        </h2>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-md">
            <label htmlFor="cnpj-consulta" className="text-sm font-medium text-foreground">CNPJ</label>
            <Input
              id="cnpj-consulta"
              placeholder="Ex.: 12.345.678/0001-01"
              value={cnpjInput}
              inputMode="numeric"
              aria-invalid={erro ? true : undefined}
              onChange={(e) => setCnpjInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConsultar()}
            />
          </div>
          <Button onClick={handleConsultar} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {loading ? 'Consultando…' : 'Consultar'}
          </Button>
        </div>

        {erro && (
          <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <a href="https://brasilapi.com.br" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
            <ExternalLink className="h-3 w-3" aria-hidden="true" /> BrasilAPI
          </a>
          <a href="https://servicos.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
            <ExternalLink className="h-3 w-3" aria-hidden="true" /> Receita Federal
          </a>
        </div>
      </div>

      {resultado && (
        <div className="animate-fade-in space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <FileText className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              Resultado da consulta
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Download className="h-4 w-4" /> Exportar
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
                  <DropdownMenuItem onClick={() => {
                    downloadPDF(
                      `cnpj-${resultado.cnpj.replace(/\D/g, '')}`,
                      `Consulta CNPJ – ${resultado.razaoSocial}`,
                      ['Campo', 'Valor'],
                      [
                        ['Razão Social', resultado.razaoSocial],
                        ['Nome Fantasia', resultado.nomeFantasia],
                        ['CNPJ', resultado.cnpj],
                        ['Situação', resultado.situacao],
                        ['Data Abertura', resultado.dataAbertura],
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
                    toast.success('PDF exportado!');
                  }}>
                    <FileText className="w-4 h-4 mr-2" /> Exportar PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Badge variant={situacaoAtiva ? 'success' : 'danger'}>
                <IconeSituacao className="mr-1 h-3 w-3" aria-hidden="true" /> {resultado.situacao || 'Situação não informada'}
              </Badge>
            </div>
          </div>

          <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
          </dl>

          {resultado.cnaesSecundarios.length > 0 && (
            <div className="border-t border-border pt-4">
              <h3 className="mb-3 text-base font-semibold text-foreground">
                CNAEs secundários ({resultado.cnaesSecundarios.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {resultado.cnaesSecundarios.map((cnae, i) => (
                  <Badge key={i} variant="muted">{cnae}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
