import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Search, Shield, ShieldAlert, ShieldCheck, ShieldQuestion, Loader2,
  AlertTriangle, CheckCircle2, XCircle, ExternalLink, FileText,
  Download, Info,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { downloadPDF, downloadCSV } from '@/lib/download-utils';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { presencasDaFicha } from '@/lib/concorrentes/portal-federal';

/**
 * Verificação de idoneidade — componente interno da aba "Idoneidade" da tela
 * Concorrentes: começa direto no conteúdo, sem cabeçalho de página.
 *
 * Desde 22/09 a resposta traz quatro cadastros (CEIS, CNEP, CEPIM e acordos
 * de leniência), a ficha da pessoa jurídica no governo federal e o veredito
 * em três estados: idônea, com restrições ou INCONCLUSIVA — quando um
 * cadastro não respondeu ou a API não aplicou o filtro por CNPJ. Antes, erro
 * de consulta virava "impedida" e parâmetro ignorado viraria "encontrado".
 */
type Cadastro = {
  nome: string;
  cadastro?: 'ceis' | 'cnep' | 'cepim' | 'leniencia';
  status: string;
  registros: Array<Record<string, unknown>>;
  total: number;
  erro?: string;
  filtroIgnorado?: boolean;
  url?: string;
};

type Ficha = {
  favorecidoDespesas?: boolean;
  possuiContratacao?: boolean;
  convenios?: boolean;
  favorecidoTransferencias?: boolean;
  participanteLicitacao?: boolean;
  emitiuNFe?: boolean;
  sancionadoCEAF?: boolean;
};

type IdoneidadeResult = {
  ceis: Cadastro;
  cnep: Cadastro;
  cepim: Cadastro;
  leniencia?: Cadastro;
  ficha?: Ficha | null;
  fichaErro?: string;
  divergencias?: string[];
  cnpj: string;
  idonea: boolean;
  inconclusiva?: boolean;
  consultadoEm: string;
};

const DESCRICAO: Record<string, string> = {
  CEIS: 'Cadastro de Empresas Inidôneas e Suspensas',
  CNEP: 'Cadastro Nacional de Empresas Punidas',
  CEPIM: 'Entidades Privadas sem Fins Lucrativos Impedidas',
  Leniência: 'Acordos de leniência da Lei Anticorrupção',
};

const texto = (v: unknown): string => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');
const nomeDe = (v: unknown): string => {
  if (v && typeof v === 'object') return texto((v as Record<string, unknown>).nome ?? (v as Record<string, unknown>).descricao);
  return texto(v);
};

/** As linhas que resumem um registro, no vocabulário de cada cadastro. */
function linhasDoRegistro(reg: Record<string, unknown>): Array<[string, string]> {
  const linhas: Array<[string, string]> = [];
  const orgao = nomeDe(reg.orgaoSancionador) || nomeDe(reg.orgaoSuperior) || texto(reg.orgaoResponsavel);
  if (orgao) linhas.push(['Órgão', orgao]);
  const tipo = reg.tipoSancao && typeof reg.tipoSancao === 'object'
    ? texto((reg.tipoSancao as Record<string, unknown>).descricaoResumida ?? (reg.tipoSancao as Record<string, unknown>).descricaoPortal)
    : texto(reg.tipoSancao);
  if (tipo) linhas.push(['Sanção', tipo]);
  const fund = Array.isArray(reg.fundamentacao)
    ? reg.fundamentacao.map((f) => nomeDe(f)).filter(Boolean).join('; ')
    : nomeDe(reg.fundamentacao);
  if (fund) linhas.push(['Fundamentação', fund]);
  if (texto(reg.motivo)) linhas.push(['Motivo', texto(reg.motivo)]);
  if (texto(reg.situacaoAcordo)) linhas.push(['Situação do acordo', texto(reg.situacaoAcordo)]);
  const inicio = texto(reg.dataInicioSancao) || texto(reg.dataInicioAcordo);
  const fim = texto(reg.dataFimSancao) || texto(reg.dataFimAcordo);
  if (inicio) linhas.push(['Vigência', `${inicio} a ${fim || 'indeterminado'}`]);
  if (texto(reg.numeroProcesso)) linhas.push(['Processo', texto(reg.numeroProcesso)]);
  return linhas;
}

export default function VerificacaoIdoneidade() {
  const [cnpjInput, setCnpjInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<IdoneidadeResult | null>(null);
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
        if (data.inconclusiva) {
          toast.warning('Consulta inconclusiva: um dos cadastros não respondeu. Veja o detalhe.');
        } else if (data.idonea) {
          toast.success('Empresa sem restrições nos quatro cadastros.');
        } else {
          toast.warning('Atenção: foram encontradas restrições para esta empresa.');
        }
      }
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao consultar');
    } finally {
      setLoading(false);
    }
  };

  const formatCnpj = (cnpj: string) => cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

  const cadastros: Cadastro[] = resultado
    ? [resultado.ceis, resultado.cnep, resultado.cepim, ...(resultado.leniencia ? [resultado.leniencia] : [])]
    : [];
  const inconclusiva = Boolean(resultado?.inconclusiva);
  const presencas = presencasDaFicha(resultado?.ficha).presencas;
  const situacao = (c: Cadastro) => (c.status === 'erro' ? 'Sem resposta' : c.status === 'limpo' ? 'Limpo' : `${c.total} registro(s)`);

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold leading-6 text-foreground">
          <Shield className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          Verificação de idoneidade — Portal da Transparência
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Consulta pela API oficial aos cadastros CEIS, CNEP, CEPIM e acordos de leniência do Governo Federal,
          com a ficha do CNPJ no governo federal.
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
          <a href="https://portaldatransparencia.gov.br/sancoes" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-primary hover:underline">
            <ExternalLink className="h-3 w-3" aria-hidden="true" /> Portal da Transparência
          </a>
          <span className="flex items-center gap-1">
            <Info className="h-3 w-3" aria-hidden="true" /> Dados oficiais do Governo Federal, pela API do portal
          </span>
        </div>
      </Card>

      {resultado && (
        <div className="space-y-4 animate-fade-in">
          {/* Veredito em três estados. "Inconclusiva" existe porque cadastro
              sem resposta não é cadastro limpo — nem sujo. */}
          <div className={`rounded-lg border p-5 shadow-sm ${
            inconclusiva
              ? 'border-warning-line bg-warning-tint'
              : resultado.idonea
                ? 'border-success-line bg-success-tint'
                : 'border-destructive-line bg-destructive-tint'
          }`}>
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-card ${
                  inconclusiva ? 'text-warning-ink' : resultado.idonea ? 'text-success-ink' : 'text-destructive-ink'
                }`}>
                  {inconclusiva ? <ShieldQuestion className="h-5 w-5" /> : resultado.idonea ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
                </span>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold leading-6 text-foreground">
                    {inconclusiva ? 'Consulta inconclusiva' : resultado.idonea ? 'Empresa idônea' : 'Restrições encontradas'}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    CNPJ: {formatCnpj(resultado.cnpj)} · Consultado em {new Date(resultado.consultadoEm).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={inconclusiva ? 'warning' : resultado.idonea ? 'success' : 'danger'}>
                  {inconclusiva ? 'Confira no portal' : resultado.idonea ? 'Apta a licitar' : 'Impedida'}
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
                        ['Cadastro', 'Situação', 'Registros'],
                        cadastros.map((c) => [c.nome, situacao(c), String(c.total)]),
                      );
                      toast.success('PDF exportado!');
                    }}>
                      <FileText aria-hidden="true" /> Exportar PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      downloadCSV(
                        `idoneidade-${resultado.cnpj}`,
                        ['Cadastro', 'Situação', 'Total Registros'],
                        cadastros.map((c) => [c.nome, c.status, String(c.total)]),
                      );
                      toast.success('CSV exportado!');
                    }}>
                      <FileText aria-hidden="true" /> Exportar CSV
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            {inconclusiva && (
              <p className="mt-3 text-sm text-warning-ink">
                {cadastros.filter((c) => c.status === 'erro').map((c) => `${c.nome}: ${c.erro ?? 'sem resposta'}`).join(' · ')}
              </p>
            )}
          </div>

          {(resultado.divergencias?.length ?? 0) > 0 && (
            <Alert variant="warning">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>
                <ul className="list-inside list-disc space-y-1">
                  {resultado.divergencias!.map((d) => <li key={d}>{d}</li>)}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* A ficha da pessoa jurídica: presença do CNPJ no governo federal. */}
          {resultado.ficha !== undefined && (
            <Card className="p-5">
              <h3 className="text-base font-semibold leading-6 text-foreground">Presença no governo federal</h3>
              {resultado.ficha === null ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {resultado.fichaErro
                    ? `A ficha da pessoa jurídica não respondeu: ${resultado.fichaErro}`
                    : 'O Portal da Transparência não tem ficha para este CNPJ: sem contrato, pagamento, licitação ou sanção federal registrados.'}
                </p>
              ) : presencas.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">Sem contrato, pagamento, licitação, NF-e ou convênio federal na ficha.</p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {presencas.map((p) => <Badge key={p} variant="info">{p}</Badge>)}
                </div>
              )}
            </Card>
          )}

          {/* Detalhes por cadastro */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {cadastros.map((cadastro) => (
              <Card key={cadastro.nome} className="p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold leading-6 text-foreground">{cadastro.nome}</h3>
                  {cadastro.status === 'erro' ? (
                    <Badge variant="warning">Sem resposta</Badge>
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

                <p className="text-sm text-muted-foreground">{DESCRICAO[cadastro.nome] ?? ''}</p>

                {cadastro.erro && (
                  <p className="mt-2 text-sm text-warning-ink">{cadastro.erro}</p>
                )}

                {cadastro.registros.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {cadastro.registros.slice(0, 3).map((reg, i) => (
                      <div key={i} className="space-y-1 rounded-md border border-border bg-muted p-3 text-sm">
                        {linhasDoRegistro(reg).map(([rotulo, valor]) => (
                          <p key={rotulo}><span className="text-muted-foreground">{rotulo}:</span> {valor}</p>
                        ))}
                      </div>
                    ))}
                    {cadastro.registros.length > 3 && (
                      <p className="text-xs text-muted-foreground">e mais {cadastro.registros.length - 3} registro(s) no portal.</p>
                    )}
                  </div>
                )}

                {cadastro.url && (
                  <a href={cadastro.url} target="_blank" rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    <ExternalLink className="h-3 w-3" aria-hidden="true" /> Conferir no portal
                  </a>
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
              <li><strong>Leniência:</strong> Acordos de leniência firmados com a CGU e a AGU, com as sanções acordadas</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
