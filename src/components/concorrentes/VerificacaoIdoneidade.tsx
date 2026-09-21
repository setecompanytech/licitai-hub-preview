import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
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

/**
 * Verificação de idoneidade — componente interno da aba "Idoneidade" da tela
 * Concorrentes: começa direto no conteúdo, sem cabeçalho de página.
 */
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
      <Card className="p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold leading-6 text-foreground">
          <Shield className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          Verificação de idoneidade — Portal da Transparência
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Consulta automática nos cadastros CEIS, CNEP e CEPIM do Governo Federal
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-md">
            <Label htmlFor="idoneidade-cnpj">CNPJ</Label>
            <Input
              id="idoneidade-cnpj"
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
            {loading ? 'Verificando…' : 'Verificar'}
          </Button>
        </div>

        {erro && (
          <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <a href="https://portaldatransparencia.gov.br" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-primary hover:underline">
            <ExternalLink className="h-3 w-3" aria-hidden="true" /> Portal da Transparência
          </a>
          <span className="flex items-center gap-1">
            <Info className="h-3 w-3" aria-hidden="true" /> Dados oficiais do Governo Federal
          </span>
        </div>
      </Card>

      {resultado && (
        <div className="space-y-4 animate-fade-in">
          {/* Status geral — o veredito na tinta da família (sucesso ou
              crítico), ícone num ladrilho de 40px, TEXTO sempre junto. */}
          <div className={`rounded-lg border p-5 shadow-sm ${
            resultado.idonea
              ? 'border-success-line bg-success-tint'
              : 'border-destructive-line bg-destructive-tint'
          }`}>
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                {resultado.idonea ? (
                  <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-card text-success-ink">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                ) : (
                  <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-card text-destructive-ink">
                    <ShieldAlert className="h-5 w-5" />
                  </span>
                )}
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold leading-6 text-foreground">
                    {resultado.idonea ? 'Empresa idônea' : 'Restrições encontradas'}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    CNPJ: {formatCnpj(resultado.cnpj)} · Consultado em {new Date(resultado.consultadoEm).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={resultado.idonea ? 'success' : 'danger'}>
                  {resultado.idonea ? 'Apta a licitar' : 'Impedida'}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Download className="h-4 w-4" /> Exportar
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
                      <FileText aria-hidden="true" /> Exportar PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      downloadCSV(
                        `idoneidade-${resultado.cnpj}`,
                        ['Cadastro', 'Status', 'Total Registros'],
                        cadastros.map(c => [c.nome, c.status, String(c.total)])
                      );
                      toast.success('CSV exportado!');
                    }}>
                      <FileText aria-hidden="true" /> Exportar CSV
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {/* Detalhes por cadastro */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {cadastros.map((cadastro) => (
              <Card key={cadastro.nome} className="p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold leading-6 text-foreground">{cadastro.nome}</h3>
                  {cadastro.erro ? (
                    <Badge variant="warning">Erro na consulta</Badge>
                  ) : cadastro.status === 'limpo' ? (
                    <Badge variant="success">
                      <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden="true" /> Limpo
                    </Badge>
                  ) : (
                    <Badge variant="danger">
                      <XCircle className="mr-1 h-3 w-3" aria-hidden="true" /> {cadastro.total} registro(s)
                    </Badge>
                  )}
                </div>

                <p className="text-sm text-muted-foreground">
                  {cadastro.nome === 'CEIS' && 'Cadastro de Empresas Inidôneas e Suspensas'}
                  {cadastro.nome === 'CNEP' && 'Cadastro Nacional de Empresas Punidas'}
                  {cadastro.nome === 'CEPIM' && 'Entidades Privadas sem Fins Lucrativos Impedidas'}
                </p>

                {cadastro.erro && (
                  <p className="mt-2 text-sm text-warning-ink">{cadastro.erro}</p>
                )}

                {cadastro.registros.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {cadastro.registros.slice(0, 3).map((reg: any, i: number) => (
                      <div key={i} className="space-y-1 rounded-md border border-border bg-muted p-3 text-sm">
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
              </Card>
            ))}
          </div>

          {/* Legenda */}
          <div className="rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Sobre os cadastros:</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
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
