import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, FolderOpen, FileText, Calculator, Sparkles, Scale, Briefcase,
  ClipboardList, History, ExternalLink, Building2, Calendar, DollarSign, MapPin, Loader2, Archive,
  TrendingUp, Clock, Package, AlertTriangle, RefreshCw
} from 'lucide-react';
import HistoricoProcesso from '@/components/workspace/HistoricoProcesso';
import AnexosManager from '@/components/workspace/AnexosManager';
import DocumentosManager from '@/components/workspace/DocumentosManager';
import EditalOriginalCard from '@/components/workspace/EditalOriginalCard';
import EditalViewer from '@/components/workspace/EditalViewer';
import { useProcessoWorkspace } from '@/hooks/useProcessoWorkspace';
import { exportarPastaZip } from '@/components/workspace/exportarPasta';

interface Licitacao {
  id: string; numero: string | null; orgao: string | null; objeto: string | null;
  modalidade: string | null; status: string | null; valor_estimado: number | null;
  data_encerramento: string | null; uf: string | null; municipio: string | null;
  data_abertura: string | null; portal: string | null; url_edital: string | null;
  observacoes: string | null; resultado: string | null; valor_adjudicado: number | null;
  data_homologacao: string | null; vencedor: boolean | null;
  numero_controle_pncp: string | null; cnpj_orgao: string | null;
  ano_compra: string | null; sequencial_compra: string | null;
}

const ATALHOS = [
  { label: 'Edital / Itens', path: '/precificacao?tab=extracao-itens', icon: FileText, descricao: 'Visualizar itens extraídos do edital' },
  { label: 'Precificação', path: '/precificacao', icon: Calculator, descricao: 'Calcular preços e composição de custos' },
  { label: 'Proposta Comercial', path: '/proposta-tecnica', icon: FileText, descricao: 'Editar proposta técnica e gerar PDF' },
  { label: 'AURÉLIA (IA)', path: '/aurelia', icon: Sparkles, descricao: 'Análise jurídica/contábil com IA' },
  { label: 'Apoio Jurídico', path: '/apoio-juridico', icon: Scale, descricao: 'Recursos, impugnações, esclarecimentos' },
  { label: 'Documentos', path: '/documentos', icon: Briefcase, descricao: 'Documentos de habilitação' },
  { label: 'Gestão Kanban', path: '/kanban', icon: ClipboardList, descricao: 'Status do processo no funil' },
];

type PrecificacaoItem = {
  id: string; descricao: string; quantidade: number | null; unidade: string | null;
  custo_unitario: number | null; preco_unitario: number | null; preco_total: number | null;
  margem_lucro: number | null; created_at: string;
};

type RascunhoPlanilha = {
  id: string; updated_at: string;
  dados: { itens: Array<{ descricao: string; quantidade: number; unidade: string; valorUnitario: number | null; valorTotal: number | null }> };
};

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function ProcessoWorkspace() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ABAS_VALIDAS = ['visao', 'documentos', 'anexos', 'precificacao', 'modulos', 'historico'];
  const abaPedida = searchParams.get('aba') || '';
  const abaInicial = ABAS_VALIDAS.includes(abaPedida) ? abaPedida : 'visao';
  const [aba, setAba] = useState(abaInicial);
  const [lic, setLic] = useState<Licitacao | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportando, setExportando] = useState(false);
  const { anexos, documentos } = useProcessoWorkspace(id || null);
  const [precItems, setPrecItems] = useState<PrecificacaoItem[]>([]);
  const [rascunhoPlanilha, setRascunhoPlanilha] = useState<RascunhoPlanilha | null>(null);
  const [loadingPrec, setLoadingPrec] = useState(false);

  // Dados complementares do PNCP
  const [pncpDetalhe, setPncpDetalhe] = useState<any>(null);
  const [pncpItens, setPncpItens] = useState<any[]>([]);
  const [pncpArquivos, setPncpArquivos] = useState<any[]>([]);
  const [pncpCarregando, setPncpCarregando] = useState(false);
  // Falha no espelho PNCP era invisível: o card simplesmente não aparecia.
  const [pncpErro, setPncpErro] = useState(false);
  // Cache local do PNCP (pncp_editais_cache): a fonte OFFLINE dos campos do
  // espelho. O detalhe ao vivo só complementa/atualiza — com o PNCP fora do
  // ar, a Visão Geral continua completa a partir do nosso próprio banco.
  const [pncpCache, setPncpCache] = useState<Record<string, unknown> | null>(null);
  const [pncpNonce, setPncpNonce] = useState(0);
  const pncpFetchedRef = useRef(false);

  const handleExportarZip = async () => {
    if (!lic) return;
    setExportando(true);
    try {
      await exportarPastaZip(lic.id, anexos, documentos, {
        numeroProcesso: lic.numero,
        orgao: lic.orgao,
      });
    } finally {
      setExportando(false);
    }
  };

  useEffect(() => {
    if (!id || !user) return;
    supabase.from('licitacoes')
      .select('id, numero, orgao, objeto, modalidade, status, valor_estimado, data_encerramento, uf, municipio, data_abertura, portal, url_edital, observacoes, resultado, valor_adjudicado, data_homologacao, vencedor, numero_controle_pncp, cnpj_orgao, ano_compra, sequencial_compra')
      .eq('id', id).maybeSingle()  // sem user_id: a linha do painel abre processos de colegas (RLS protege)
      .then(({ data }) => { setLic(data as Licitacao); setLoading(false); });
  }, [id, user]);

  useEffect(() => {
    if (!lic) return;
    const COLS = 'situacao, tipo_instrumento, srp, lei_base, unidade_orgao, codigo_unidade, data_publicacao_pncp, data_abertura_proposta, data_encerramento_proposta, link_sistema_origem, numero_controle_pncp';
    let q = null;
    if (lic.numero_controle_pncp) {
      q = supabase.from('pncp_editais_cache').select(COLS).eq('numero_controle_pncp', lic.numero_controle_pncp);
    } else {
      // Fallback por coordenadas: processos antigos (ou de portais parceiros)
      // podem não ter o número de controle gravado — sem isto, o cache existia
      // e a Visão Geral ficava vazia mesmo assim (caso Rondon do Pará).
      const m = (lic.url_edital || '').match(/editais\/(\d{14})\/(\d{4})\/(\d+)/);
      const cnpj = m?.[1] || lic.cnpj_orgao;
      const ano = m?.[2] || lic.ano_compra;
      const seq = m?.[3] || lic.sequencial_compra;
      if (cnpj && ano && seq) {
        q = supabase.from('pncp_editais_cache').select(COLS)
          .eq('cnpj_orgao', cnpj).eq('ano_compra', String(ano)).eq('sequencial_compra', String(Number(seq)));
      }
    }
    if (!q) return;
    q.limit(1).maybeSingle().then(({ data }) => setPncpCache(data as Record<string, unknown> | null));
  }, [lic]);

  // Carrega detalhes completos do PNCP quando o processo tem url_edital do portal
  useEffect(() => {
    if (pncpFetchedRef.current || !lic) return;
    // Coordenadas da contratação: URL do PNCP, colunas gravadas no processo,
    // ou o número de controle — sem isso o espelho PNCP não tinha como abrir
    // para editais vindos de portais parceiros (url_edital fora do padrão).
    let cnpj: string | undefined, ano: string | undefined, seq: string | undefined;
    const m = (lic.url_edital || '').match(/editais\/(\d{14})\/(\d{4})\/(\d+)/);
    if (m) { cnpj = m[1]; ano = m[2]; seq = m[3]; }
    else if (lic.cnpj_orgao && lic.ano_compra && lic.sequencial_compra) {
      cnpj = lic.cnpj_orgao; ano = lic.ano_compra; seq = lic.sequencial_compra;
    } else {
      const n = (lic.numero_controle_pncp || '').match(/(\d{14})-\d+-(\d+)\/(\d{4})/);
      if (n) { cnpj = n[1]; seq = String(Number(n[2])); ano = n[3]; }
    }
    if (!cnpj || !ano || !seq) return;
    pncpFetchedRef.current = true;
    setPncpErro(false);
    setPncpCarregando(true);
    // Via edge function detalhe-licitacao-pncp: o fetch direto do navegador ao
    // PNCP falhava SEMPRE por CORS — por isso Amparo/Modo de disputa/Fonte
    // nunca apareciam e o card dizia "Indisponível" com o portal no ar.
    // Teto de 15s do lado do cliente: sem ele, uma resposta presa no gateway
    // segurava o spinner por até 2,5 minutos. Estourou → erro com retry.
    Promise.race([
      supabase.functions.invoke('detalhe-licitacao-pncp', {
        body: { cnpjOrgao: cnpj, anoCompra: ano, sequencialCompra: seq },
      }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 15_000)),
    ])
      .then(({ data, error }: { data?: Record<string, unknown> | null; error?: unknown }) => {
        if (error || !data?.success) { setPncpErro(true); return; }
        setPncpDetalhe(data);
        setPncpItens(Array.isArray(data.itens) ? (data.itens as unknown[]) : []);
      })
      .catch(() => setPncpErro(true))
      .finally(() => setPncpCarregando(false));
  }, [lic, pncpNonce]);

  const loadPrecificacao = async () => {
    if (!id || !user) return;
    setLoadingPrec(true);
    const [catRes, rascRes] = await Promise.all([
      supabase.from('catalogo_itens_precificados')
        .select('id, descricao, quantidade, unidade, custo_unitario, preco_unitario, preco_total, margem_lucro, created_at')
        .eq('licitacao_id', id).eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('rascunhos')
        .select('id, updated_at, dados')
        .eq('licitacao_id', id).eq('user_id', user.id).eq('modulo', 'precificacao_planilha')
        .maybeSingle(),
    ]);
    setPrecItems((catRes.data as PrecificacaoItem[]) || []);
    setRascunhoPlanilha(rascRes.data as RascunhoPlanilha | null);
    setLoadingPrec(false);
  };

  // Abrir direto em ?aba=precificacao não passa por onValueChange, então a
  // carga precisa ser disparada aqui — senão a aba abre vazia.
  useEffect(() => {
    if (abaInicial === 'precificacao' && id && user) loadPrecificacao();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abaInicial, id, user]);

  // Espelho PNCP mesclado — prioridade: consulta ao vivo > cache local > processo.
  const det = pncpDetalhe as Record<string, any> | null;
  const cc = pncpCache;
  // "Hora de parede": o PNCP envia horário de Brasília SEM fuso; o banco
  // armazena como UTC e o new Date() desconta 3h de novo — todo horário de
  // edital aparecia errado (PNCP: 10:00 → tela: 07:00). Lê direto da string.
  const dataHora = (v: unknown) => {
    const m = String(v ?? '').match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}, ${m[4]}:${m[5]}` : null;
  };
  const dataSo = (v: unknown) => {
    const m = String(v ?? '').match(/(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
  };
  // Amparo do cache legado pode conter a descrição didática longa (o sync
  // antigo gravava descricao); só exibe do cache o que parece citação legal.
  const pareceCitacao = (t: string | null) => !!t && /^(lei|lc|decreto|mp|emenda|art)\b/i.test(t.trim()) && t.length <= 90;
  const espelho = {
    unidadeCompradora: det?.unidade_orgao
      || [cc?.codigo_unidade, cc?.unidade_orgao].filter(Boolean).join(' — ') || null,
    amparoLegal: det?.amparo_legal || (pareceCitacao(cc?.lei_base as string | null) ? (cc?.lei_base as string) : null),
    tipo: det?.tipo_instrumento_convocatorio || (cc?.tipo_instrumento as string | null),
    modoDisputa: det?.modo_disputa || null,
    srp: (det?.srp ?? cc?.srp) as boolean | null | undefined,
    fonteOrcamentaria: det?.fonte_orcamentaria || null,
    divulgacaoPncp: det?.data_publicacao_pncp || (cc?.data_publicacao_pncp as string | null),
    situacao: det?.situacao || (cc?.situacao as string | null),
    inicioPropostas: det?.data_abertura_proposta || (cc?.data_abertura_proposta as string | null),
    fimPropostas: det?.data_encerramento_proposta || (cc?.data_encerramento_proposta as string | null),
    idPncp: det?.numero_controle_pncp || lic?.numero_controle_pncp || (cc?.numero_controle_pncp as string | null) || null,
    fonte: det?.fonte_sistema || null,
  };
  const temEspelho = Object.values(espelho).some((v) => v !== null && v !== undefined && v !== '');

  if (loading) return <div className="flex items-center justify-center h-screen"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!lic) return (
    <div className="p-8 text-center">
      <p className="text-muted-foreground mb-4">Processo não encontrado.</p>
      <Button onClick={() => navigate('/kanban')}>Voltar ao Kanban</Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header da Pasta */}
      <div className="border-b border-border bg-card sticky top-0 z-20">
        <div className="max-w-[1440px] mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4" /></Button>
            <FolderOpen className="w-6 h-6 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold truncate">{lic.numero || 'Processo'} {lic.orgao && `— ${lic.orgao}`}</h1>
              <p className="text-base text-muted-foreground truncate">{lic.objeto}</p>
            </div>
            {lic.status && <Badge variant="outline">{lic.status}</Badge>}
            <Button size="sm" variant="outline" className="gap-2" onClick={handleExportarZip} disabled={exportando}>
              {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
              {exportando ? 'Compactando...' : 'Exportar ZIP'}
            </Button>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
            {lic.modalidade && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {lic.modalidade}</span>}
            {lic.uf && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {lic.municipio}/{lic.uf}</span>}
            {lic.data_encerramento && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Encerra: {dataSo(lic.data_encerramento)}</span>}
            {lic.valor_estimado != null && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> R$ {Number(lic.valor_estimado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>}
          </div>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-4 py-6">
        {/* `?aba=` deixa o painel abrir direto na aba certa — é o que faz o
            ícone de Precificação da linha levar o processo junto, em vez de
            despejar o usuário numa tela em branco. */}
        <Tabs value={aba} className="w-full" onValueChange={v => { setAba(v); if (v === 'precificacao') loadPrecificacao(); }}>
          <TabsList className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-6 mb-6 h-auto">
            <TabsTrigger value="visao">Visão Geral</TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
            <TabsTrigger value="anexos">Anexos</TabsTrigger>
            <TabsTrigger value="precificacao">Precificação</TabsTrigger>
            <TabsTrigger value="modulos">Módulos</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          {/* Visão Geral */}
          <TabsContent value="visao" className="space-y-4">
            <Card className="p-5 space-y-3 text-base">
              <div className="flex flex-wrap gap-x-6 gap-y-1.5 pb-3 border-b border-border/40">
                <span><span className="font-semibold">Local:</span> <span>{lic.municipio && lic.uf ? `${lic.municipio}/${lic.uf}` : lic.municipio || lic.uf || '—'}</span></span>
                <span className="text-border select-none">|</span>
                <span><span className="font-semibold">Órgão:</span> <span>{lic.orgao || '—'}</span></span>
                <span className="text-border select-none">|</span>
                <span><span className="font-semibold">Status:</span> <span>{lic.status || '—'}</span></span>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1.5 pb-3 border-b border-border/40">
                <span><span className="font-semibold">Modalidade:</span> <span>{lic.modalidade || '—'}</span></span>
                <span className="text-border select-none">|</span>
                <span><span className="font-semibold">Valor estimado:</span> <span>{lic.valor_estimado != null ? fmt(lic.valor_estimado) : '—'}</span></span>
                {lic.data_abertura && (
                  <>
                    <span className="text-border select-none">|</span>
                    <span><span className="font-semibold">Abertura:</span> <span>{dataHora(lic.data_abertura)}</span></span>
                  </>
                )}
              </div>
              {(lic.data_encerramento || lic.portal) && (
                <div className="flex flex-wrap gap-x-6 gap-y-1.5 pb-3 border-b border-border/40">
                  {lic.data_encerramento && (
                    <span><span className="font-semibold">Encerramento:</span> <span>{dataHora(lic.data_encerramento)}</span></span>
                  )}
                  {lic.portal && (
                    <>
                      {lic.data_encerramento && <span className="text-border select-none">|</span>}
                      <span>
                        <span className="text-xs text-muted-foreground">Portal:</span>{' '}
                        {lic.url_edital ? (
                          <a href={lic.url_edital} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline inline-flex items-center gap-0.5">
                            {lic.portal} <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="font-semibold">{lic.portal}</span>
                        )}
                      </span>
                    </>
                  )}
                </div>
              )}
              {lic.resultado && (
                <div className="flex flex-wrap gap-x-6 gap-y-1.5 pb-3 border-b border-border/40">
                  <span className="flex items-center gap-1.5">
                    {lic.vencedor && <span className="w-2 h-2 rounded-full bg-success shrink-0" title="Empresa vencedora" />}
                    <span className="text-xs text-muted-foreground">Resultado:</span>
                    <span className={`font-semibold ${lic.vencedor ? 'text-success' : ''}`}>{lic.resultado}</span>
                  </span>
                  {lic.valor_adjudicado != null && (
                    <>
                      <span className="text-border select-none">|</span>
                      <span><span className="font-semibold">Valor adjudicado:</span> <span>{fmt(lic.valor_adjudicado)}</span></span>
                    </>
                  )}
                  {lic.data_homologacao && (
                    <>
                      <span className="text-border select-none">|</span>
                      <span><span className="font-semibold">Homologação:</span> <span>{new Date(lic.data_homologacao).toLocaleDateString('pt-BR')}</span></span>
                    </>
                  )}
                </div>
              )}
              {temEspelho && (
                <div className="flex flex-wrap gap-x-6 gap-y-1.5 pb-3 border-b border-border/40">
                  {espelho.unidadeCompradora && (
                    <span><span className="font-semibold">Unidade compradora:</span> <span>{espelho.unidadeCompradora}</span></span>
                  )}
                  {espelho.amparoLegal && (
                    <span><span className="font-semibold">Amparo legal:</span> <span>{espelho.amparoLegal}</span></span>
                  )}
                  {espelho.tipo && (
                    <span><span className="font-semibold">Tipo:</span> <span>{espelho.tipo}</span></span>
                  )}
                  {espelho.modoDisputa && (
                    <span><span className="font-semibold">Modo de disputa:</span> <span>{espelho.modoDisputa}</span></span>
                  )}
                  {espelho.srp != null && (
                    <span><span className="font-semibold">Registro de preço:</span> <span>{espelho.srp ? 'Sim' : 'Não'}</span></span>
                  )}
                  <span><span className="font-semibold">Fonte orçamentária:</span> <span>{espelho.fonteOrcamentaria || 'Não informada'}</span></span>
                </div>
              )}
              {temEspelho && (
                <div className="flex flex-wrap gap-x-6 gap-y-1.5 pb-3 border-b border-border/40">
                  {espelho.divulgacaoPncp && (
                    <span><span className="font-semibold">Divulgação no PNCP:</span> <span>{dataSo(espelho.divulgacaoPncp)}</span></span>
                  )}
                  {espelho.situacao && (
                    <span><span className="font-semibold">Situação:</span> <span>{espelho.situacao}</span></span>
                  )}
                  {espelho.inicioPropostas && (
                    <span><span className="font-semibold">Início das propostas:</span> <span>{dataHora(espelho.inicioPropostas)}</span></span>
                  )}
                  {espelho.fimPropostas && (
                    <span><span className="font-semibold">Fim das propostas:</span> <span>{dataHora(espelho.fimPropostas)}</span></span>
                  )}
                  {espelho.idPncp && (
                    <span><span className="font-semibold">Id contratação PNCP:</span> <span className="tabular-nums">{espelho.idPncp}</span></span>
                  )}
                  {espelho.fonte && (
                    <span><span className="font-semibold">Fonte:</span> <span>{espelho.fonte}</span></span>
                  )}
                </div>
              )}
              <div>
                <span className="font-semibold">Objeto:</span>
                <p className="mt-1 leading-relaxed">{lic.objeto || '—'}</p>
              </div>
              {lic.observacoes && (
                <p className="pt-2 border-t border-border/40 text-base text-muted-foreground italic">{lic.observacoes}</p>
              )}
            </Card>
            {/* ── Dados completos do PNCP ── */}
            {pncpErro && !pncpDetalhe && !pncpCarregando && !temEspelho && (
              <Card className="px-4 py-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-semibold">Espelho PNCP</span>
                  <Badge variant="outline" className="gap-1 text-xs">
                    <AlertTriangle className="w-3 h-3 text-warning" /> Indisponível no momento
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    O PNCP não respondeu — costuma ser instabilidade passageira do portal.
                  </span>
                  <Button
                    size="sm" variant="ghost" className="h-7 ml-auto"
                    onClick={() => { pncpFetchedRef.current = false; setPncpNonce((n) => n + 1); }}
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Tentar novamente
                  </Button>
                </div>
              </Card>
            )}

            {((pncpCarregando && !temEspelho) || pncpDetalhe || pncpItens.length > 0 || pncpArquivos.length > 0) && (
              <Card className="p-5">
                {pncpCarregando ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Carregando dados completos do PNCP…
                  </div>
                ) : pncpDetalhe ? (
                  <div className="space-y-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Complementos do PNCP — itens e arquivos
                    </p>

                    {/* Informação complementar */}
                    {pncpDetalhe.informacao_complementar && (
                      <div className="pt-3 border-t border-border/40">
                        <p className="text-xs text-muted-foreground mb-1">Informação complementar</p>
                        <p className="text-base text-foreground leading-relaxed">{pncpDetalhe.informacao_complementar}</p>
                      </div>
                    )}

                    {/* Itens da contratação */}
                    {pncpItens.length > 0 && (
                      <div className="pt-3 border-t border-border/40">
                        <p className="text-xs text-muted-foreground mb-2 font-medium">
                          Itens da contratação ({pncpItens.length})
                        </p>
                        <div className="overflow-x-auto rounded border border-border/60">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-muted/40 border-b border-border text-muted-foreground">
                                <th className="text-left px-3 py-2 font-medium w-10">Nº</th>
                                <th className="text-left px-3 py-2 font-medium">Descrição</th>
                                <th className="text-right px-3 py-2 font-medium w-24">Quantidade</th>
                                <th className="text-right px-3 py-2 font-medium w-32">Vlr. unit. est.</th>
                                <th className="text-right px-3 py-2 font-medium w-32">Vlr. total est.</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                              {pncpItens.map((item: any, i: number) => {
                                const qtd = item.quantidade ?? item.quantidadeItens;
                                const vUnit = item.valor_unitario_estimado ?? item.valorUnitarioEstimado ?? item.valorUnitario;
                                const vTotal = item.valor_total ?? item.valorTotal ?? item.valorTotalEstimado
                                  ?? (vUnit != null && qtd != null ? vUnit * qtd : null);
                                return (
                                  <tr key={item.numero ?? item.numeroItem ?? i} className="hover:bg-muted/20 transition-colors">
                                    <td className="px-3 py-2 text-muted-foreground">{item.numero ?? item.numeroItem ?? i + 1}</td>
                                    <td className="px-3 py-2 text-foreground">
                                      {item.descricao || item.descricaoItem || '—'}
                                      {(item.unidade_medida || item.unidadeMedida) && (
                                        <span className="ml-1.5 text-xs text-muted-foreground border border-border/60 px-1 rounded">
                                          {item.unidade_medida || item.unidadeMedida}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-right">{qtd?.toLocaleString('pt-BR') ?? '—'}</td>
                                    <td className="px-3 py-2 text-right text-muted-foreground">{vUnit != null ? fmt(vUnit) : '—'}</td>
                                    <td className="px-3 py-2 text-right font-medium text-success">{vTotal != null ? fmt(vTotal) : '—'}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Arquivos */}
                    {pncpArquivos.length > 0 && (
                      <div className="pt-3 border-t border-border/40">
                        <p className="text-xs text-muted-foreground mb-2 font-medium">
                          Arquivos ({pncpArquivos.length})
                        </p>
                        <div className="space-y-2">
                          {pncpArquivos.map((arq: any, i: number) => (
                            <div key={arq.sequencialDocumento ?? i}
                              className="flex items-center justify-between p-2.5 rounded border border-border bg-muted/20 hover:bg-muted/40 transition-colors">
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs font-medium truncate">{arq.titulo || arq.nomeArquivo || `Arquivo ${i + 1}`}</p>
                                  {arq.dataPublicacao && (
                                    <p className="text-xs text-muted-foreground">
                                      {new Date(arq.dataPublicacao).toLocaleDateString('pt-BR')}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {arq.url && (
                                <a href={arq.url} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-xs text-accent hover:underline shrink-0 ml-3">
                                  <ExternalLink className="w-3 h-3" />Abrir
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </Card>
            )}

            <EditalOriginalCard
              licitacaoId={lic.id}
              urlEdital={lic.url_edital ?? null}
              onVerItens={() => { setAba('precificacao'); loadPrecificacao(); }}
            />
            <EditalViewer licitacaoId={lic.id} urlEdital={lic.url_edital ?? undefined} />
            {/* Atalhos de módulos vivem na aba "Módulos" — mantê-los também
                aqui duplicava a mesma lista na mesma página. */}
          </TabsContent>

          {/* Documentos editáveis */}
          <TabsContent value="documentos">
            <DocumentosManager
              licitacaoId={lic.id}
              numeroProcesso={lic.numero}
              orgao={lic.orgao}
              objeto={lic.objeto}
              cidade={lic.municipio}
            />
          </TabsContent>

          {/* Anexos */}
          <TabsContent value="anexos">
            <AnexosManager licitacaoId={lic.id} />
          </TabsContent>

          {/* Precificação */}
          <TabsContent value="precificacao" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Histórico de Precificação</h3>
                <p className="text-base text-muted-foreground mt-0.5">Planilha de custos e itens precificados para este processo</p>
              </div>
              <Button size="sm" asChild>
                <Link to={`/precificacao?lid=${lic.id}`}>
                  <Calculator className="w-4 h-4 mr-2" /> Abrir Precificação
                </Link>
              </Button>
            </div>

            {loadingPrec ? (
              <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <>
                {/* Rascunho da planilha de custos */}
                {rascunhoPlanilha ? (() => {
                  const itens = rascunhoPlanilha.dados?.itens?.filter(i => i.valorUnitario && i.valorUnitario > 0) || [];
                  const total = itens.reduce((s, i) => s + ((i.valorTotal ?? 0) || (i.valorUnitario ?? 0) * (i.quantidade ?? 1)), 0);
                  const updated = new Date(rascunhoPlanilha.updated_at);
                  return (
                    <Card className="p-4 border-primary/20 bg-primary/5">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                          <TrendingUp className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">Planilha de Custos</p>
                          <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {itens.length} {itens.length === 1 ? 'item' : 'itens'} preenchidos</span>
                            {total > 0 && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> Total: <strong className="text-foreground">{fmt(total)}</strong></span>}
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Atualizado em {updated.toLocaleDateString('pt-BR')} às {updated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          {itens.length > 0 && (
                            <div className="mt-3 border rounded-md overflow-hidden">
                              <table className="w-full text-xs">
                                <thead className="bg-muted/50">
                                  <tr>
                                    <th className="text-left px-3 py-1.5 font-medium">Descrição</th>
                                    <th className="text-right px-3 py-1.5 font-medium w-16">Qtde</th>
                                    <th className="text-right px-3 py-1.5 font-medium w-24">Vl. Unit.</th>
                                    <th className="text-right px-3 py-1.5 font-medium w-24">Total</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y">
                                  {itens.slice(0, 10).map((it, i) => (
                                    <tr key={i} className="hover:bg-muted/30">
                                      <td className="px-3 py-1.5 truncate max-w-[200px]">{it.descricao}</td>
                                      <td className="px-3 py-1.5 text-right">{it.quantidade}</td>
                                      <td className="px-3 py-1.5 text-right">{it.valorUnitario ? fmt(it.valorUnitario) : '—'}</td>
                                      <td className="px-3 py-1.5 text-right font-medium">{it.valorTotal ? fmt(it.valorTotal) : '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {itens.length > 10 && (
                                <p className="text-xs text-muted-foreground px-3 py-1.5 border-t">
                                  + {itens.length - 10} itens adicionais — abra a Precificação para ver todos
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })() : (
                  <Card className="p-5 border-dashed text-center">
                    <TrendingUp className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-base text-muted-foreground">Nenhuma planilha de custos salva ainda.</p>
                    <p className="text-base text-muted-foreground mt-1">Acesse a Precificação e preencha os valores para que apareçam aqui.</p>
                  </Card>
                )}

                {/* Itens do catálogo */}
                {precItems.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-2">Itens precificados no catálogo ({precItems.length})</p>
                    <div className="border rounded-md overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left px-3 py-1.5 font-medium">Descrição</th>
                            <th className="text-right px-3 py-1.5 font-medium w-20">Custo</th>
                            <th className="text-right px-3 py-1.5 font-medium w-20">Preço</th>
                            <th className="text-right px-3 py-1.5 font-medium w-16">Margem</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {precItems.slice(0, 15).map(it => (
                            <tr key={it.id} className="hover:bg-muted/30">
                              <td className="px-3 py-1.5 truncate max-w-[220px]">{it.descricao}</td>
                              <td className="px-3 py-1.5 text-right text-muted-foreground">{it.custo_unitario ? fmt(it.custo_unitario) : '—'}</td>
                              <td className="px-3 py-1.5 text-right font-medium">{it.preco_unitario ? fmt(it.preco_unitario) : '—'}</td>
                              <td className="px-3 py-1.5 text-right">{it.margem_lucro != null ? `${it.margem_lucro}%` : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {precItems.length > 15 && (
                        <p className="text-xs text-muted-foreground px-3 py-1.5 border-t">
                          + {precItems.length - 15} itens adicionais
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Módulos */}
          <TabsContent value="modulos">
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Abrir em módulos completos</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ATALHOS.map(a => (
                  <Button key={a.label} variant="outline" className="justify-start gap-2" asChild>
                    <Link to={`${a.path}${a.path.includes('?') ? '&' : '?'}lid=${lic.id}`}>
                      <a.icon className="w-4 h-4" /> {a.label}
                    </Link>
                  </Button>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* Histórico */}
          <TabsContent value="historico">
            <HistoricoProcesso licitacaoId={lic.id} />
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}
