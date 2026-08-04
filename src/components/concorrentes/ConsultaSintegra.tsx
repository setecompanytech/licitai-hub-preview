import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

function InfoField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-sm ${highlight ? 'font-semibold text-accent' : 'text-foreground'}`}>{value || '—'}</p>
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
      <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
          <Building2 className="w-4 h-4 text-accent" />
          Consulta SINTEGRA – Inscrição Estadual
        </h3>
        <div className="flex gap-2">
          <Input
            placeholder="Digite o CNPJ"
            value={cnpjInput}
            onChange={(e) => setCnpjInput(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleConsultar()}
          />
          <Select value={uf} onValueChange={setUf}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {UFS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
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
          <a href="http://www.sintegra.gov.br" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-accent transition-colors">
            <ExternalLink className="w-3 h-3" /> SINTEGRA Oficial
          </a>
        </div>
      </div>

      {resultado && (
        <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm animate-fade-in space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-accent" /> Resultado SINTEGRA
            </h3>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline"><Download className="w-3.5 h-3.5 mr-1" /> Exportar</Button>
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
              <Badge variant="outline" className="bg-success/15 text-success border-success/30 text-xs">
                {resultado.situacaoCadastral}
              </Badge>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>
        </div>
      )}
    </div>
  );
}
