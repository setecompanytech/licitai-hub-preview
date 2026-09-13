import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, Building2, FileText, Loader2, AlertTriangle, ExternalLink, Download, FileSpreadsheet, FileDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { downloadCSV, downloadTextReport, downloadPDF } from '@/lib/download-utils';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const UFS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
];

type DadosSintegra = {
  cnpj: string;
  inscricaoEstadual: string;
  razaoSocial: string;
  nomeFantasia: string;
  situacaoCadastral: string;
  dataSituacao: string;
  regimeApuracao: string;
  uf: string;
  municipio: string;
  endereco: string;
  cep: string;
  atividadePrincipal: string;
  dataConsulta: string;
};

/**
 * A situação cadastral do SINTEGRA volta como texto livre da SEFAZ de cada UF
 * ("HABILITADA", "NÃO HABILITADA", "BAIXADA", "SUSPENSA"…). A tinta do badge
 * tem que acompanhar o texto: verde só quando a situação é positiva de fato —
 * "NÃO HABILITADA" contém "HABILITADA" e não pode cair em tinta de sucesso.
 * Situação que não se reconhece fica em `muted`, nunca em verde.
 */
const SITUACAO_NEGATIVA = /\b(NAO|SEM)\b|BAIXAD|CANCELAD|SUSPENS|INAPT|INATIV|IRREGULAR|NULA|DESABILITAD|BLOQUEAD|IMPEDID/;
const SITUACAO_POSITIVA = /HABILITAD|ATIV|REGULAR/;

function varianteSituacao(situacao: string): 'success' | 'danger' | 'muted' {
  const texto = (situacao ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
  if (!texto) return 'muted';
  if (SITUACAO_NEGATIVA.test(texto)) return 'danger';
  if (SITUACAO_POSITIVA.test(texto)) return 'success';
  return 'muted';
}

/**
 * Consulta SINTEGRA — componente interno da aba "Sintegra" da tela
 * Concorrentes: começa direto no conteúdo, sem cabeçalho de página.
 */
function InfoField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 text-base text-foreground ${highlight ? 'font-semibold' : ''}`}>{value || '—'}</dd>
    </div>
  );
}

export default function ConsultaSintegra() {
  const [cnpjInput, setCnpjInput] = useState('');
  const [uf, setUf] = useState('PA');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<DadosSintegra | null>(null);
  const [erro, setErro] = useState('');

  const handleConsultar = async () => {
    const cnpjLimpo = cnpjInput.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) { setErro('CNPJ deve conter 14 dígitos'); return; }
    setErro(''); setLoading(true); setResultado(null);

    try {
      const { data, error } = await supabase.functions.invoke('consulta-sintegra', {
        body: { cnpj: cnpjLimpo, uf },
      });
      if (error) throw error;
      if (data.error) { setErro(data.error); } else {
        setResultado(data);
        toast.success('SINTEGRA consultado com sucesso!');
      }
    } catch (e: any) {
      setErro(e.message || 'Erro ao consultar SINTEGRA');
    } finally {
      setLoading(false);
    }
  };

  const rows = resultado ? [
    ['CNPJ', resultado.cnpj],
    ['Inscrição Estadual', resultado.inscricaoEstadual],
    ['Razão Social', resultado.razaoSocial],
    ['Nome Fantasia', resultado.nomeFantasia],
    ['Situação', resultado.situacaoCadastral],
    ['Regime de Apuração', resultado.regimeApuracao],
    ['UF', resultado.uf],
    ['Município', resultado.municipio],
    ['Endereço', resultado.endereco],
    ['CEP', resultado.cep],
    ['Atividade Principal', resultado.atividadePrincipal],
  ] : [];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Building2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          Consulta SINTEGRA — inscrição estadual
        </h2>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-sm">
            <label htmlFor="sintegra-cnpj" className="text-sm font-medium text-foreground">CNPJ</label>
            <Input
              id="sintegra-cnpj"
              placeholder="Ex.: 12.345.678/0001-01"
              value={cnpjInput}
              inputMode="numeric"
              aria-invalid={erro ? true : undefined}
              onChange={(e) => setCnpjInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConsultar()}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="sintegra-uf" className="text-sm font-medium text-foreground">UF</label>
            <Select value={uf} onValueChange={setUf}>
              <SelectTrigger id="sintegra-uf" className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-80">
                {UFS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
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
          <a href="http://www.sintegra.gov.br" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
            <ExternalLink className="h-3 w-3" aria-hidden="true" /> SINTEGRA oficial
          </a>
        </div>
      </div>

      {resultado && (
        <div className="animate-fade-in space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <FileText className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> Resultado SINTEGRA
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline"><Download className="h-4 w-4" /> Exportar</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => { downloadCSV(`sintegra-${resultado.cnpj.replace(/\D/g, '')}`, ['Campo', 'Valor'], rows); toast.success('CSV exportado!'); }}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" /> CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { downloadTextReport(`sintegra-${resultado.cnpj.replace(/\D/g, '')}`, `CONSULTA SINTEGRA – ${resultado.cnpj}\n${new Date().toLocaleString('pt-BR')}\n${'='.repeat(50)}\n\n${rows.map(r => `${r[0]}: ${r[1]}`).join('\n')}`); toast.success('TXT exportado!'); }}>
                    <FileDown className="w-4 h-4 mr-2" /> TXT
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { downloadPDF(`sintegra-${resultado.cnpj.replace(/\D/g, '')}`, `Consulta SINTEGRA – ${resultado.razaoSocial}`, ['Campo', 'Valor'], rows); toast.success('PDF exportado!'); }}>
                    <FileText className="w-4 h-4 mr-2" /> PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Badge variant={varianteSituacao(resultado.situacaoCadastral)}>
                {resultado.situacaoCadastral || 'Situação não informada'}
              </Badge>
            </div>
          </div>
          <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <InfoField label="CNPJ" value={resultado.cnpj} />
            <InfoField label="Inscrição Estadual" value={resultado.inscricaoEstadual} highlight />
            <InfoField label="Razão Social" value={resultado.razaoSocial} />
            <InfoField label="Nome Fantasia" value={resultado.nomeFantasia} />
            <InfoField label="Situação Cadastral" value={resultado.situacaoCadastral} highlight />
            <InfoField label="Regime de Apuração" value={resultado.regimeApuracao} />
            <InfoField label="Atividade Principal" value={resultado.atividadePrincipal} />
            <InfoField label="Município/UF" value={`${resultado.municipio} / ${resultado.uf}`} />
            <InfoField label="Endereço" value={resultado.endereco} />
            <InfoField label="CEP" value={resultado.cep} />
          </dl>
        </div>
      )}
    </div>
  );
}
