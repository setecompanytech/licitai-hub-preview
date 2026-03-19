import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search, Shield, ShieldAlert, ShieldCheck, Loader2,
  AlertTriangle, CheckCircle2, XCircle, ExternalLink, FileText,
  Download, Info
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { downloadPDF, downloadCSV } from '@/lib/download-utils';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type IdonelidadeResult = {
  ceis: { nome: string; status: string; registros: any[]; total: number; erro?: string };
  cnep: { nome: string; status: string; registros: any[]; total: number; erro?: string };
  cepim: { nome: string; status: string; registros: any[]; total: number; erro?: string };
  cnpj: string;
  idonea: boolean;
  consultadoEm: string;
};

export default function VerificacaoIdoneidade() {
  const [cnpjInput, setCnpjInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<IdonelidadeResult | null>(null);
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
      const { data, error } = await supabase.functions.invoke('consulta-transparencia', {
        body: { tipo: 'idoneidade', cnpj: cnpjLimpo },
      });
      if (error) throw error;
      if (data.error) {
        setErro(data.error);
      } else {
        setResultado(data);
        if (data.idonea) {
          toast.success('Empresa sem restrições encontradas!');
        } else {
          toast.warning('Atenção: foram encontradas restrições para esta empresa.');
        }
      }
    } catch (e: any) {
      setErro(e.message || 'Erro ao consultar');
    } finally {
      setLoading(false);
    }
  };

  const formatCnpj = (cnpj: string) => {
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  };

  const cadastros = resultado ? [resultado.ceis, resultado.cnep, resultado.cepim] : [];

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-1">
          <Shield className="w-4 h-4 text-accent" />
          Verificação de Idoneidade – Portal da Transparência
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Consulta automática nos cadastros CEIS, CNEP e CEPIM do Governo Federal
        </p>

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
            <span className="ml-1">{loading ? 'Verificando...' : 'Verificar'}</span>
          </Button>
        </div>

        {erro && (
          <div className="flex items-center gap-2 mt-3 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4" /> {erro}
          </div>
        )}

        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <a href="https://portaldatransparencia.gov.br" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-accent transition-colors">
            <ExternalLink className="w-3 h-3" /> Portal da Transparência
          </a>
          <span className="flex items-center gap-1">
            <Info className="w-3 h-3" /> Dados oficiais do Governo Federal
          </span>
        </div>
      </div>

      {resultado && (
        <div className="space-y-4 animate-fade-in">
          {/* Status geral */}
          <div className={`rounded-xl border p-5 shadow-sm ${
            resultado.idonea
              ? 'bg-success/5 border-success/30'
              : 'bg-destructive/5 border-destructive/30'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {resultado.idonea ? (
                  <ShieldCheck className="w-8 h-8 text-success" />
                ) : (
                  <ShieldAlert className="w-8 h-8 text-destructive" />
                )}
                <div>
                  <h3 className="font-bold text-base">
                    {resultado.idonea ? 'Empresa Idônea' : 'Restrições Encontradas'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    CNPJ: {formatCnpj(resultado.cnpj)} • Consultado em {new Date(resultado.consultadoEm).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={
                  resultado.idonea
                    ? 'bg-success/15 text-success border-success/30'
                    : 'bg-destructive/15 text-destructive border-destructive/30'
                }>
                  {resultado.idonea ? 'APTA A LICITAR' : 'IMPEDIDA'}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Download className="w-3.5 h-3.5 mr-1" /> Exportar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => {
                      downloadPDF(
                        `idoneidade-${resultado.cnpj}`,
                        `Verificação de Idoneidade – CNPJ ${formatCnpj(resultado.cnpj)}`,
                        ['Cadastro', 'Status', 'Registros'],
                        cadastros.map(c => [c.nome, c.status === 'limpo' ? 'Limpo' : 'Encontrado', String(c.total)])
                      );
                      toast.success('PDF exportado!');
                    }}>
                      <FileText className="w-4 h-4 mr-2" /> Exportar PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      downloadCSV(
                        `idoneidade-${resultado.cnpj}`,
                        ['Cadastro', 'Status', 'Total Registros'],
                        cadastros.map(c => [c.nome, c.status, String(c.total)])
                      );
                      toast.success('CSV exportado!');
                    }}>
                      <FileText className="w-4 h-4 mr-2" /> Exportar CSV
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {/* Detalhes por cadastro */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {cadastros.map((cadastro) => (
              <div key={cadastro.nome} className="bg-card rounded-xl border border-border/50 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold">{cadastro.nome}</h4>
                  {cadastro.erro ? (
                    <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30 text-[10px]">
                      Erro
                    </Badge>
                  ) : cadastro.status === 'limpo' ? (
                    <Badge variant="outline" className="bg-success/15 text-success border-success/30 text-[10px]">
                      <CheckCircle2 className="w-3 h-3 mr-0.5" /> Limpo
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30 text-[10px]">
                      <XCircle className="w-3 h-3 mr-0.5" /> {cadastro.total} registro(s)
                    </Badge>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mb-2">
                  {cadastro.nome === 'CEIS' && 'Cadastro de Empresas Inidôneas e Suspensas'}
                  {cadastro.nome === 'CNEP' && 'Cadastro Nacional de Empresas Punidas'}
                  {cadastro.nome === 'CEPIM' && 'Entidades Privadas sem Fins Lucrativos Impedidas'}
                </p>

                {cadastro.erro && (
                  <p className="text-xs text-warning">{cadastro.erro}</p>
                )}

                {cadastro.registros.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {cadastro.registros.slice(0, 3).map((reg: any, i: number) => (
                      <div key={i} className="bg-muted/50 p-2 rounded text-xs space-y-1">
                        {reg.orgaoSancionador?.nome && (
                          <p><span className="text-muted-foreground">Órgão:</span> {reg.orgaoSancionador.nome}</p>
                        )}
                        {reg.fundamentacao?.descricaoFundamentacao && (
                          <p><span className="text-muted-foreground">Fundamentação:</span> {reg.fundamentacao.descricaoFundamentacao}</p>
                        )}
                        {reg.dataInicioSancao && (
                          <p><span className="text-muted-foreground">Vigência:</span> {reg.dataInicioSancao} a {reg.dataFimSancao || 'Indeterminado'}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Legenda */}
          <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground">
            <p className="font-semibold mb-1">Sobre os cadastros:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li><strong>CEIS:</strong> Empresas impedidas de participar de licitações e celebrar contratos com a Administração Pública</li>
              <li><strong>CNEP:</strong> Empresas punidas com base na Lei Anticorrupção (Lei nº 12.846/2013)</li>
              <li><strong>CEPIM:</strong> Entidades privadas sem fins lucrativos impedidas de receber transferências voluntárias</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
