import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Building2, Globe, FileText, CheckCircle2, AlertTriangle, Loader2, ExternalLink } from 'lucide-react';

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
  sintegraStatus: string;
  inscricaoEstadual: string;
};

const mockConsulta: Record<string, DadosCNPJ> = {
  '12345678000101': {
    razaoSocial: 'Construtora Norte Ltda.',
    nomeFantasia: 'Construtora Norte',
    cnpj: '12.345.678/0001-01',
    situacao: 'ATIVA',
    dataAbertura: '15/03/2010',
    naturezaJuridica: '206-2 - Sociedade Empresária Limitada',
    cnaePrincipal: '42.11-1-01 - Construção de rodovias e ferrovias',
    cnaesSecundarios: [
      '42.13-8-00 - Obras de urbanização',
      '42.22-7-01 - Construção de redes de abastecimento de água',
      '41.20-4-00 - Construção de edifícios',
    ],
    endereco: 'Av. Augusto Montenegro, 4300 - Coqueiro',
    municipio: 'Belém',
    uf: 'PA',
    porte: 'EMPRESA DE MÉDIO PORTE',
    capitalSocial: 'R$ 5.000.000,00',
    email: 'contato@construtoranorte.com.br',
    telefone: '(91) 3222-5555',
    sintegraStatus: 'HABILITADO',
    inscricaoEstadual: '15-123456-7',
  },
  '98765432000102': {
    razaoSocial: 'Engepará Engenharia S.A.',
    nomeFantasia: 'Engepará',
    cnpj: '98.765.432/0001-02',
    situacao: 'ATIVA',
    dataAbertura: '22/06/2005',
    naturezaJuridica: '204-6 - Sociedade Anônima Fechada',
    cnaePrincipal: '42.21-9-02 - Construção de estações e redes de telecomunicações',
    cnaesSecundarios: [
      '42.11-1-01 - Construção de rodovias e ferrovias',
      '43.30-4-01 - Obras de fundações',
    ],
    endereco: 'Rua dos Mundurucus, 1200 - Batista Campos',
    municipio: 'Belém',
    uf: 'PA',
    porte: 'EMPRESA DE GRANDE PORTE',
    capitalSocial: 'R$ 15.000.000,00',
    email: 'licitacao@engepara.com.br',
    telefone: '(91) 3344-7777',
    sintegraStatus: 'HABILITADO',
    inscricaoEstadual: '15-987654-3',
  },
};

export default function ConsultaCNPJ() {
  const [cnpjInput, setCnpjInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<DadosCNPJ | null>(null);
  const [erro, setErro] = useState('');
  const [fonte, setFonte] = useState<'receita' | 'sintegra'>('receita');

  const limparCNPJ = (v: string) => v.replace(/\D/g, '');

  const handleConsultar = () => {
    const cnpjLimpo = limparCNPJ(cnpjInput);
    if (cnpjLimpo.length !== 14) {
      setErro('CNPJ deve conter 14 dígitos');
      return;
    }
    setErro('');
    setLoading(true);
    setResultado(null);

    // Simula consulta (em produção chamaria edge function)
    setTimeout(() => {
      const dados = mockConsulta[cnpjLimpo];
      if (dados) {
        setResultado(dados);
      } else {
        setErro('CNPJ não encontrado na base de dados');
      }
      setLoading(false);
    }, 1500);
  };

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
          <Search className="w-4 h-4 text-accent" />
          Consulta de CNPJ – Receita Federal / SINTEGRA
        </h3>

        <div className="flex items-center gap-2 mb-3">
          <Button
            size="sm"
            variant={fonte === 'receita' ? 'default' : 'outline'}
            onClick={() => setFonte('receita')}
            className={fonte === 'receita' ? 'bg-accent text-accent-foreground' : ''}
          >
            <Building2 className="w-3 h-3 mr-1" /> Receita Federal
          </Button>
          <Button
            size="sm"
            variant={fonte === 'sintegra' ? 'default' : 'outline'}
            onClick={() => setFonte('sintegra')}
            className={fonte === 'sintegra' ? 'bg-accent text-accent-foreground' : ''}
          >
            <Globe className="w-3 h-3 mr-1" /> SINTEGRA
          </Button>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Digite o CNPJ (ex: 12.345.678/0001-01)"
            value={cnpjInput}
            onChange={(e) => setCnpjInput(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleConsultar()}
          />
          <Button
            onClick={handleConsultar}
            disabled={loading}
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
          >
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
          <a href="https://servicos.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-accent transition-colors">
            <ExternalLink className="w-3 h-3" /> Receita Federal
          </a>
          <a href="http://www.sintegra.gov.br/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-accent transition-colors">
            <ExternalLink className="w-3 h-3" /> SINTEGRA
          </a>
        </div>
      </div>

      {/* Resultado */}
      {resultado && (
        <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm animate-fade-in space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-accent" />
              Resultado da Consulta – {fonte === 'receita' ? 'Receita Federal' : 'SINTEGRA'}
            </h3>
            <Badge
              variant="outline"
              className={
                resultado.situacao === 'ATIVA'
                  ? 'bg-success/15 text-success border-success/30'
                  : 'bg-destructive/15 text-destructive border-destructive/30'
              }
            >
              <CheckCircle2 className="w-3 h-3 mr-1" /> {resultado.situacao}
            </Badge>
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

          {/* SINTEGRA data */}
          {fonte === 'sintegra' && (
            <div className="border-t border-border/30 pt-4">
              <h4 className="text-xs font-semibold text-muted-foreground mb-3">Dados SINTEGRA</h4>
              <div className="grid grid-cols-2 gap-4">
                <InfoField label="Inscrição Estadual" value={resultado.inscricaoEstadual} />
                <InfoField label="Situação SINTEGRA" value={resultado.sintegraStatus} highlight />
              </div>
            </div>
          )}

          {/* CNAEs Secundários */}
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
        </div>
      )}
    </div>
  );
}

function InfoField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-sm ${highlight ? 'font-semibold text-accent' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}
