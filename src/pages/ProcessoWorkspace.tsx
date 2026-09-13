import SkeletonPagina from '@/components/shared/SkeletonPagina';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import { useEffect, useRef, useState } from 'react';
import BotaoVoltar from '@/components/layout/BotaoVoltar';
import DesfechoDaDisputa from '@/components/workspace/DesfechoDaDisputa';
import ContratoDoProcesso from '@/components/workspace/ContratoDoProcesso';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  FolderOpen, FileText, Calculator, Sparkles, Scale, Briefcase,
  ClipboardList, ExternalLink, Building2, Calendar, DollarSign, MapPin, Loader2, Archive,
  TrendingUp, Clock, Package, AlertTriangle, RefreshCw, Crosshair,
} from 'lucide-react';
import HistoricoProcesso from '@/components/workspace/HistoricoProcesso';
import ItensEditalPrecificacao from '@/components/workspace/ItensEditalPrecificacao';
import PropostaTecnica from '@/pages/PropostaTecnica';
import HabilitacaoChecklist from '@/components/workspace/HabilitacaoChecklist';
import AnexosManager from '@/components/workspace/AnexosManager';
import DocumentosManager from '@/components/workspace/DocumentosManager';
import EditalOriginalCard from '@/components/workspace/EditalOriginalCard';
import EditalViewer from '@/components/workspace/EditalViewer';
import { useProcessoWorkspace } from '@/hooks/useProcessoWorkspace';
import { exportarPastaZip } from '@/components/workspace/exportarPasta';
import AureliaPrecificacaoChat from '@/components/precificacao/AureliaPrecificacaoChat';
import { normalizarStatus } from '@/lib/licitacao/status';

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
  { label: 'Robô de Lances', path: '/robo-lances', icon: Crosshair, descricao: 'Disputar a sessão com o agente de lances' },
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

/** Cor do selo de status no cabeçalho — só apresentação; o texto continua o
 *  status bruto do processo. */
const varianteStatus = (status: string): 'success' | 'danger' | 'muted' | 'info' => {
  const n = normalizarStatus(status);
  if (n === 'Vencida' || n === 'Homologada') return 'success';
  if (n === 'Perdida') return 'danger';
  if (n === 'Arquivada') return 'muted';
  return 'info';
};

export default function ProcessoWorkspace() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ABAS_VALIDAS = ['visao', 'documentos', 'anexos', 'precificacao', 'proposta', 'modulos', 'historico'];
  const abaPedida = searchParams.get('aba') || '';
  const abaInicial = ABAS_VALIDAS.includes(abaPedida) ? abaPedida : 'visao';
  const [aba, setAba] = useState(abaInicial);

  // A aba também muda por URL depois da montagem (links entre pastas e abas
  // do próprio processo) — sem isto, ?aba= só valia no primeiro carregamento.
  useEffect(() => {
    if (abaInicial !== aba) setAba(abaInicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abaInicial]);
  // Contagem dos arquivos do PNCP (Edital em tela) — soma no chip da pasta Edital
  const [pncpArquivosCount, setPncpArquivosCount] = useState<number | null>(null);
  // O processo tem coordenadas PNCP? Decide quem materializa os itens: o
  // espelho (fonte boa) ou o pipeline do servidor (fallback p/ fora do PNCP).
  const [temFontePncp, setTemFontePncp] = useState(false);
  const materializouRef = useRef(false);
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
  // Fallback do espelho de itens: licitacao_itens são os MESMOS itens do PNCP,
  // materializados pela preparação automática — camada cache do padrão nº 4
  // (consulta ao vivo como complemento). Sem eles a tabela sumia sempre que o
  // portal oscilava.
  const [itensMaterializados, setItensMaterializados] = useState<Array<{
    numero: number; descricao: string; quantidade: number; unidade: string; valor_unitario: number;
  }>>([]);
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
    setTemFontePncp(true);
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

  useEffect(() => {
    if (!lic?.id) return;
    supabase
      .from('licitacao_itens')
      .select('numero, descricao, quantidade, unidade, valor_unitario')
      .eq('licitacao_id', lic.id)
      .order('numero')
      .then(({ data }) => setItensMaterializados((data as typeof itensMaterializados) || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lic?.id]);

  type ItemPncpLive = {
    numero?: number; numeroItem?: number;
    descricao?: string; descricaoItem?: string;
    quantidade?: number; quantidadeItens?: number;
    unidade_medida?: string; unidadeMedida?: string;
    valor_unitario_estimado?: number; valorUnitarioEstimado?: number; valorUnitario?: number;
    valor_total?: number; valorTotal?: number;
    marca?: string | null; marcaFabricante?: string | null;
  };

  // A INVERSÃO da preparação automática: quando o espelho traz os itens ao
  // vivo do PNCP e licitacao_itens está vazia, materializa DAQUI — dado já
  // fiel, sem IA, sem repetir do servidor a rota sujeita a rate-limit. O
  // pipeline edital-auto-ingest vira fallback para processos fora do PNCP.
  useEffect(() => {
    if (materializouRef.current || !user || !lic?.id) return;
    if (!pncpItens.length || itensMaterializados.length > 0) return;
    materializouRef.current = true;
    const rows = (pncpItens as ItemPncpLive[])
      .map((item, i) => {
        const qtd = Number(item.quantidade ?? item.quantidadeItens ?? 1) || 1;
        const vUnit = Number(item.valor_unitario_estimado ?? item.valorUnitarioEstimado ?? item.valorUnitario ?? 0) || 0;
        return {
          licitacao_id: lic.id,
          user_id: user.id,
          numero: Number(item.numero ?? item.numeroItem ?? i + 1),
          descricao: String(item.descricao ?? item.descricaoItem ?? '').trim().slice(0, 4000),
          quantidade: qtd,
          unidade: String(item.unidade_medida ?? item.unidadeMedida ?? 'UN').slice(0, 20),
          valor_unitario: vUnit,
          valor_total: (Number(item.valor_total ?? item.valorTotal ?? 0) || qtd * vUnit),
          lote: 'Único',
          marca: item.marca ?? item.marcaFabricante ?? null,
          origem: 'espelho:PNCP_ITENS',
        };
      })
      .filter((r) => r.descricao && r.numero > 0);
    if (!rows.length) return;
    supabase
      .from('licitacao_itens')
      .insert(rows)
      .then(({ error }) => {
        if (error) { console.error('[materializar-itens]', error.message); return; }
        setItensMaterializados(rows.map((r) => ({
          numero: r.numero, descricao: r.descricao, quantidade: r.quantidade,
          unidade: r.unidade, valor_unitario: r.valor_unitario,
        })));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pncpItens, itensMaterializados.length, user, lic?.id]);

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

  // Espelho de ITENS — mesma prioridade do espelho de campos: ao vivo > materializado.
  const itensEspelho: ItemPncpLive[] = pncpItens.length > 0
    ? pncpItens
    : itensMaterializados.map((r) => ({
        numero: r.numero,
        descricao: r.descricao,
        quantidade: r.quantidade,
        unidade_medida: r.unidade,
        valor_unitario_estimado: r.valor_unitario,
      }));

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

  /* Esta tela desenha a própria moldura (não passa pelo AppLayout), então na
     espera não sobrava nada: `h-screen` em branco com um ponto girando. O
     esqueleto com moldura devolve a barra navy e a coluna lateral enquanto o
     processo carrega. */
  if (loading) return <SkeletonPagina />;
  if (!lic) return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-tint text-primary">
          <FolderOpen className="w-6 h-6" aria-hidden="true" />
        </div>
        <h1 className="text-lg font-semibold">Processo não encontrado.</h1>
        <p className="mt-1 text-sm text-muted-foreground">O processo pode ter sido excluído ou o endereço está incompleto.</p>
        <Button className="mt-4" onClick={() => navigate('/kanban')}>Voltar ao Kanban</Button>
      </div>
    </div>
  );

  const temMeta = !!(lic.modalidade || lic.uf || lic.data_encerramento || lic.valor_estimado != null);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-6">
        {/* Mesmo Voltar do resto do sistema. Ter um botão próprio aqui,
            saltando para uma origem fixa, era o que fazia o percurso girar:
            o salto entrava na pilha como avanço, e o Voltar da tela
            seguinte trazia de volta para a pasta. */}
        <div className="mb-2">
          <BotaoVoltar somenteIcone padrao="/kanban" />
        </div>

        {/* Cabeçalho da pasta */}
        <CabecalhoPagina
          icone={<FolderOpen />}
          titulo={`${lic.numero || 'Processo'}${lic.orgao ? ` — ${lic.orgao}` : ''}`}
          descricao={lic.objeto ? <span className="line-clamp-3">{lic.objeto}</span> : undefined}
          acoes={
            <>
              {lic.status && <Badge variant={varianteStatus(lic.status)}>{lic.status}</Badge>}
              <Button variant="outline" onClick={handleExportarZip} disabled={exportando}>
                {exportando
                  ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  : <Archive className="w-4 h-4" aria-hidden="true" />}
                {exportando ? 'Compactando...' : 'Exportar ZIP'}
              </Button>
            </>
          }
        >
          {temMeta && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              {lic.modalidade && (
                <span className="inline-flex items-center gap-1">
                  <Building2 className="w-4 h-4" aria-hidden="true" /> {lic.modalidade}
                </span>
              )}
              {lic.uf && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-4 h-4" aria-hidden="true" /> {lic.municipio}/{lic.uf}
                </span>
              )}
              {lic.data_encerramento && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-4 h-4" aria-hidden="true" /> Encerra: {dataSo(lic.data_encerramento)}
                </span>
              )}
              {lic.valor_estimado != null && (
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <DollarSign className="w-4 h-4" aria-hidden="true" /> R$ {Number(lic.valor_estimado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              )}
            </div>
          )}
        </CabecalhoPagina>

        {/* `?aba=` deixa o painel abrir direto na aba certa — é o que faz o
            ícone de Precificação da linha levar o processo junto, em vez de
            despejar o usuário numa tela em branco. */}
        <Tabs value={aba} className="w-full" onValueChange={v => { setAba(v); if (v === 'precificacao') loadPrecificacao(); }}>
          <TabsList className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 mb-6 h-auto">
            <TabsTrigger value="visao">Visão Geral</TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
            <TabsTrigger value="anexos">Anexos</TabsTrigger>
            <TabsTrigger value="precificacao">Precificação</TabsTrigger>
            <TabsTrigger value="proposta">Proposta</TabsTrigger>
            <TabsTrigger value="modulos">Módulos</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          {/* Visão Geral */}
          <TabsContent value="visao" className="space-y-4">
            {/* O desfecho abre a Visão Geral: encerrada a disputa, é a primeira
                coisa que a pessoa precisa resolver. Só aparece quando há
                desfecho — antes disso não há o que tratar. */}
            <DesfechoDaDisputa
              licitacaoId={lic.id}
              numero={lic.numero}
              orgao={lic.orgao}
              modalidade={lic.modalidade ?? null}
              valorEstimado={lic.valor_estimado ?? null}
              status={lic.status}
              irParaAba={(a) => { setAba(a); if (a === 'precificacao') loadPrecificacao(); }}
              aoMudarStatus={(novo) => setLic(atual => (atual ? { ...atual, status: novo } : atual))}
            />
            {/* O contrato que nasceu daqui — só aparece quando existe elo. */}
            <ContratoDoProcesso licitacaoId={lic.id} />
            <Card className="p-6 space-y-3 text-base">
              <div className="flex flex-wrap gap-x-6 gap-y-2 pb-3 border-b border-border">
                <span><span className="font-semibold">Local:</span> <span>{lic.municipio && lic.uf ? `${lic.municipio}/${lic.uf}` : lic.municipio || lic.uf || '—'}</span></span>
                <span className="text-border select-none" aria-hidden="true">|</span>
                <span><span className="font-semibold">Órgão:</span> <span>{lic.orgao || '—'}</span></span>
                <span className="text-border select-none" aria-hidden="true">|</span>
                <span><span className="font-semibold">Status:</span> <span>{lic.status || '—'}</span></span>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2 pb-3 border-b border-border">
                <span><span className="font-semibold">Modalidade:</span> <span>{lic.modalidade || '—'}</span></span>
                <span className="text-border select-none" aria-hidden="true">|</span>
                <span><span className="font-semibold">Valor estimado:</span> <span className="tabular-nums">{lic.valor_estimado != null ? fmt(lic.valor_estimado) : '—'}</span></span>
                {lic.data_abertura && (
                  <>
                    <span className="text-border select-none" aria-hidden="true">|</span>
                    <span><span className="font-semibold">Abertura:</span> <span>{dataHora(lic.data_abertura)}</span></span>
                  </>
                )}
              </div>
              {(lic.data_encerramento || lic.portal) && (
                <div className="flex flex-wrap gap-x-6 gap-y-2 pb-3 border-b border-border">
                  {lic.data_encerramento && (
                    <span><span className="font-semibold">Encerramento:</span> <span>{dataHora(lic.data_encerramento)}</span></span>
                  )}
                  {lic.portal && (
                    <>
                      {lic.data_encerramento && <span className="text-border select-none" aria-hidden="true">|</span>}
                      <span>
                        <span className="font-semibold">Portal:</span>{' '}
                        {lic.url_edital ? (
                          <a href={lic.url_edital} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                            {lic.portal} <ExternalLink className="w-4 h-4" aria-hidden="true" />
                          </a>
                        ) : (
                          <span>{lic.portal}</span>
                        )}
                      </span>
                    </>
                  )}
                </div>
              )}
              {lic.resultado && (
                <div className="flex flex-wrap gap-x-6 gap-y-2 pb-3 border-b border-border">
                  <span className="inline-flex items-center gap-2">
                    {lic.vencedor && <span className="w-2 h-2 rounded-full bg-success shrink-0" title="Empresa vencedora" aria-hidden="true" />}
                    <span className="font-semibold">Resultado:</span>
                    <span className={lic.vencedor ? 'font-semibold text-success' : ''}>{lic.resultado}</span>
                  </span>
                  {lic.valor_adjudicado != null && (
                    <>
                      <span className="text-border select-none" aria-hidden="true">|</span>
                      <span><span className="font-semibold">Valor adjudicado:</span> <span className="tabular-nums">{fmt(lic.valor_adjudicado)}</span></span>
                    </>
                  )}
                  {lic.data_homologacao && (
                    <>
                      <span className="text-border select-none" aria-hidden="true">|</span>
                      <span><span className="font-semibold">Homologação:</span> <span>{new Date(lic.data_homologacao).toLocaleDateString('pt-BR')}</span></span>
                    </>
                  )}
                </div>
              )}
              {temEspelho && (
                <div className="flex flex-wrap gap-x-6 gap-y-2 pb-3 border-b border-border">
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
                <div className="flex flex-wrap gap-x-6 gap-y-2 pb-3 border-b border-border">
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
                <p className="pt-3 border-t border-border text-base text-muted-foreground italic">{lic.observacoes}</p>
              )}
            </Card>

            {/* ── Dados completos do PNCP ── */}
            {pncpErro && !pncpDetalhe && !pncpCarregando && !temEspelho && (
              <Alert variant="warning">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                <AlertTitle>Espelho PNCP — indisponível no momento</AlertTitle>
                <AlertDescription className="flex flex-wrap items-center gap-3">
                  <span>O PNCP não respondeu — costuma ser instabilidade passageira do portal.</span>
                  <Button
                    size="sm" variant="outline"
                    onClick={() => { pncpFetchedRef.current = false; setPncpNonce((n) => n + 1); }}
                  >
                    <RefreshCw className="w-4 h-4" aria-hidden="true" /> Tentar novamente
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {((pncpCarregando && !temEspelho) || pncpDetalhe || itensEspelho.length > 0 || pncpArquivos.length > 0) && (
              <Card className="p-6">
                {pncpCarregando && !itensEspelho.length ? (
                  <div role="status" aria-busy="true" className="space-y-3">
                    <span className="sr-only">Carregando dados completos do PNCP…</span>
                    <Skeleton className="h-5 w-64" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h2 className="text-lg font-semibold">Complementos do PNCP — itens e arquivos</h2>

                    {/* Informação complementar */}
                    {pncpDetalhe?.informacao_complementar && (
                      <div className="pt-3 border-t border-border">
                        <h3 className="mb-1 text-base font-semibold">Informação complementar</h3>
                        <p className="text-base text-foreground leading-relaxed">{pncpDetalhe.informacao_complementar}</p>
                      </div>
                    )}

                    {/* Ausência não pode ser silêncio: sem este bloco, a seção
                        de itens simplesmente não existia e ninguém sabia se era
                        instabilidade, contratação sem itens ou extração pendente. */}
                    {!pncpCarregando && itensEspelho.length === 0 && (
                      <div className="pt-3 border-t border-border">
                        <h3 className="mb-1 text-base font-semibold">Itens</h3>
                        <p className="text-sm text-muted-foreground">
                          Nenhum item veio do PNCP nesta consulta — pode ser instabilidade do portal
                          ou contratação sem itens publicados.{' '}
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-sm"
                            onClick={() => { pncpFetchedRef.current = false; setPncpNonce((n) => n + 1); }}
                          >
                            Consultar novamente
                          </Button>
                        </p>
                      </div>
                    )}

                    {/* Itens da contratação — espelho fiel da aba Itens do PNCP:
                        mesmos rótulos de coluna, descrição integral, cabeçalho em
                        negrito como no portal. */}
                    {itensEspelho.length > 0 && (
                      <div className="pt-3 border-t border-border">
                        <h3 className="mb-2 text-base font-semibold">
                          Itens ({itensEspelho.length})
                        </h3>
                        <div className="overflow-x-auto rounded-md border border-border">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-muted border-b border-border">
                                <th className="text-left px-3 py-2 text-sm font-semibold w-16">Número</th>
                                <th className="text-left px-3 py-2 text-sm font-semibold">Descrição</th>
                                <th className="text-right px-3 py-2 text-sm font-semibold w-28">Quantidade</th>
                                <th className="text-right px-3 py-2 text-sm font-semibold w-36">Valor unitário estimado</th>
                                <th className="text-right px-3 py-2 text-sm font-semibold w-36">Valor total estimado</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {itensEspelho.map((item: any, i: number) => {
                                const qtd = item.quantidade ?? item.quantidadeItens;
                                const vUnit = item.valor_unitario_estimado ?? item.valorUnitarioEstimado ?? item.valorUnitario;
                                const vTotal = item.valor_total ?? item.valorTotal ?? item.valorTotalEstimado
                                  ?? (vUnit != null && qtd != null ? vUnit * qtd : null);
                                return (
                                  <tr key={item.numero ?? item.numeroItem ?? i} className="hover:bg-muted/50 transition-colors">
                                    <td className="px-3 py-2 text-muted-foreground tabular-nums">{item.numero ?? item.numeroItem ?? i + 1}</td>
                                    <td className="px-3 py-2 text-foreground">
                                      {item.descricao || item.descricaoItem || '—'}
                                      {(item.unidade_medida || item.unidadeMedida) && (
                                        <span className="ml-2 rounded border border-border px-1 text-xs text-muted-foreground">
                                          {item.unidade_medida || item.unidadeMedida}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">{qtd?.toLocaleString('pt-BR') ?? '—'}</td>
                                    <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap tabular-nums">{vUnit != null ? fmt(vUnit) : '—'}</td>
                                    <td className="px-3 py-2 text-right font-medium text-success whitespace-nowrap tabular-nums">{vTotal != null ? fmt(vTotal) : '—'}</td>
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
                      <div className="pt-3 border-t border-border">
                        <h3 className="mb-2 text-base font-semibold">
                          Arquivos ({pncpArquivos.length})
                        </h3>
                        <div className="space-y-2">
                          {pncpArquivos.map((arq: any, i: number) => (
                            <div key={arq.sequencialDocumento ?? i}
                              className="flex items-center justify-between gap-3 rounded-md border border-border p-3 transition-colors hover:bg-muted/50">
                              <div className="flex min-w-0 items-center gap-2">
                                <FileText className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">{arq.titulo || arq.nomeArquivo || `Arquivo ${i + 1}`}</p>
                                  {arq.dataPublicacao && (
                                    <p className="text-xs text-muted-foreground">
                                      {new Date(arq.dataPublicacao).toLocaleDateString('pt-BR')}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {arq.url && (
                                <Button asChild size="sm" variant="ghost" className="shrink-0">
                                  <a href={arq.url} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="w-4 h-4" aria-hidden="true" /> Abrir
                                  </a>
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )}

            <EditalOriginalCard
              licitacaoId={lic.id}
              urlEdital={lic.url_edital ?? null}
              onVerItens={() => { setAba('precificacao'); loadPrecificacao(); }}
              itensProntos={itensMaterializados.length}
              pncpDisponivel={temFontePncp}
            />
            {/* O Edital em tela mora em Anexos → pasta Edital (Fase 1 do
                prontuário integrado): a Visão Geral é a ficha, e os arquivos
                do processo — inclusive os oficiais do PNCP — vivem juntos. */}
          </TabsContent>

          {/* Documentos editáveis */}
          <TabsContent value="documentos" className="space-y-4">
            {/* Fase 3: o checklist de habilitação abre a aba — exigências do
                edital casadas com o cofre da empresa, com validade e aceite. */}
            <HabilitacaoChecklist licitacaoId={lic.id} />
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
            <AnexosManager
              pncpEditalCount={pncpArquivosCount ?? undefined}
              licitacaoId={lic.id}
              editalViewer={<EditalViewer licitacaoId={lic.id} urlEdital={lic.url_edital ?? undefined} onArquivosPncp={setPncpArquivosCount} />}
            />
          </TabsContent>

          {/* Precificação */}
          <TabsContent value="precificacao">
            <Tabs defaultValue="prec-historico" className="space-y-4">
              <TabsList className="h-auto">
                <TabsTrigger value="prec-historico" className="gap-2">
                  <Calculator className="w-4 h-4" aria-hidden="true" /> Precificação
                </TabsTrigger>
                <TabsTrigger value="prec-aurelia" className="gap-2">
                  <Sparkles className="w-4 h-4" aria-hidden="true" /> Nova Precificação
                </TabsTrigger>
              </TabsList>

              {/* sub-aba: conteúdo original */}
              <TabsContent value="prec-historico" className="space-y-4">
                {/* Fase 2: precificação in-context — os itens do edital ganham
                    preço aqui e vão para o catálogo, de onde a Proposta importa. */}
                <ItensEditalPrecificacao
                  licitacaoId={lic.id}
                  onSaved={loadPrecificacao}
                  onIrParaProposta={() => setAba('proposta')}
                  objetoProcesso={lic.objeto ?? ''}
                  pncpCoords={(() => {
                    const m = (lic.url_edital || '').match(/editais\/(\d{14})\/(\d{4})\/(\d+)/);
                    if (m) return { cnpj: m[1], ano: m[2], seq: m[3] };
                    if (lic.cnpj_orgao && lic.ano_compra && lic.sequencial_compra)
                      return { cnpj: lic.cnpj_orgao, ano: lic.ano_compra, seq: lic.sequencial_compra };
                    const n = (lic.numero_controle_pncp || '').match(/(\d{14})-\d+-(\d+)\/(\d{4})/);
                    if (n) return { cnpj: n[1], ano: n[3], seq: String(Number(n[2])) };
                    return null;
                  })()}
                />
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">Histórico de Precificação</h2>
                    <p className="text-sm text-muted-foreground">Planilha de custos e itens precificados para este processo</p>
                  </div>
                  <Button asChild>
                    <Link to={`/precificacao?lid=${lic.id}`}>
                      <Calculator className="w-4 h-4" aria-hidden="true" /> Abrir Precificação
                    </Link>
                  </Button>
                </div>

                {loadingPrec ? (
                  <div role="status" aria-busy="true" className="space-y-3">
                    <span className="sr-only">Carregando precificação…</span>
                    <Skeleton className="h-24 w-full rounded-lg" />
                    <Skeleton className="h-40 w-full rounded-lg" />
                  </div>
                ) : (
                  <>
                    {/* Rascunho da planilha de custos */}
                    {rascunhoPlanilha ? (() => {
                      const itens = rascunhoPlanilha.dados?.itens?.filter(i => i.valorUnitario && i.valorUnitario > 0) || [];
                      const total = itens.reduce((s, i) => s + ((i.valorTotal ?? 0) || (i.valorUnitario ?? 0) * (i.quantidade ?? 1)), 0);
                      const updated = new Date(rascunhoPlanilha.updated_at);
                      return (
                        <Card className="p-6">
                          <div className="flex items-start gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-tint text-primary">
                              <TrendingUp className="w-5 h-5" aria-hidden="true" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="text-lg font-semibold">Planilha de Custos</h3>
                              <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1"><Package className="w-4 h-4" aria-hidden="true" /> {itens.length} {itens.length === 1 ? 'item' : 'itens'} preenchidos</span>
                                {total > 0 && <span className="inline-flex items-center gap-1"><DollarSign className="w-4 h-4" aria-hidden="true" /> Total: <strong className="text-foreground tabular-nums">{fmt(total)}</strong></span>}
                                <span className="inline-flex items-center gap-1"><Clock className="w-4 h-4" aria-hidden="true" /> Atualizado em {updated.toLocaleDateString('pt-BR')} às {updated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              {itens.length > 0 && (
                                <div className="mt-3 overflow-x-auto rounded-md border border-border">
                                  <table className="w-full text-sm">
                                    <thead className="bg-muted">
                                      <tr>
                                        <th className="text-left px-3 py-2 text-sm font-semibold">Descrição</th>
                                        <th className="text-right px-3 py-2 text-sm font-semibold w-16">Qtde</th>
                                        <th className="text-right px-3 py-2 text-sm font-semibold w-28 whitespace-nowrap">Vl. Unit.</th>
                                        <th className="text-right px-3 py-2 text-sm font-semibold w-28 whitespace-nowrap">Total</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                      {itens.slice(0, 10).map((it, i) => (
                                        <tr key={i} className="hover:bg-muted/50">
                                          <td className="px-3 py-2 truncate max-w-[200px]">{it.descricao}</td>
                                          <td className="px-3 py-2 text-right tabular-nums">{it.quantidade}</td>
                                          <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">{it.valorUnitario ? fmt(it.valorUnitario) : '—'}</td>
                                          <td className="px-3 py-2 text-right font-medium whitespace-nowrap tabular-nums">{it.valorTotal ? fmt(it.valorTotal) : '—'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                  {itens.length > 10 && (
                                    <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
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
                      <Card className="p-6 text-center">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-tint text-primary">
                          <TrendingUp className="w-6 h-6" aria-hidden="true" />
                        </div>
                        <p className="text-lg font-semibold">Nenhuma planilha de custos salva ainda.</p>
                        <p className="mt-1 text-sm text-muted-foreground">Acesse a Precificação e preencha os valores para que apareçam aqui.</p>
                        <Button asChild variant="outline" className="mt-4">
                          <Link to={`/precificacao?lid=${lic.id}`}>
                            <Calculator className="w-4 h-4" aria-hidden="true" /> Abrir Precificação
                          </Link>
                        </Button>
                      </Card>
                    )}

                    {/* Itens do catálogo */}
                    {precItems.length > 0 && (
                      <div>
                        <h3 className="mb-2 text-lg font-semibold">Itens precificados no catálogo ({precItems.length})</h3>
                        <div className="overflow-x-auto rounded-md border border-border">
                          <table className="w-full text-sm">
                            <thead className="bg-muted">
                              <tr>
                                <th className="text-left px-3 py-2 text-sm font-semibold">Descrição</th>
                                <th className="text-right px-3 py-2 text-sm font-semibold w-28 whitespace-nowrap">Custo</th>
                                <th className="text-right px-3 py-2 text-sm font-semibold w-28 whitespace-nowrap">Preço</th>
                                <th className="text-right px-3 py-2 text-sm font-semibold w-20 whitespace-nowrap">Margem</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {precItems.slice(0, 15).map(it => (
                                <tr key={it.id} className="hover:bg-muted/50">
                                  <td className="px-3 py-2 truncate max-w-[220px]">{it.descricao}</td>
                                  <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap tabular-nums">{it.custo_unitario ? fmt(it.custo_unitario) : '—'}</td>
                                  <td className="px-3 py-2 text-right font-medium whitespace-nowrap tabular-nums">{it.preco_unitario ? fmt(it.preco_unitario) : '—'}</td>
                                  <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">{it.margem_lucro != null ? `${it.margem_lucro}%` : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {precItems.length > 15 && (
                            <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                              + {precItems.length - 15} itens adicionais
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              {/* sub-aba: AURÉLIA conversacional */}
              <TabsContent value="prec-aurelia">
                <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm" style={{ height: 'calc(100vh - 280px)', minHeight: 480 }}>
                  <AureliaPrecificacaoChat />
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Proposta — Fase 2: trabalhada dentro do processo */}
          <TabsContent value="proposta">
            {/* O MESMO formato do módulo Proposta Comercial, embutido no
                prontuário (wizard completo: edital, empresa, representante,
                planilha, declarações, layout, preview) — mesmo rascunho, sem
                sair do processo. */}
            <PropostaTecnica embedded licitacaoIdEmbed={lic.id} />
          </TabsContent>

          {/* Módulos */}
          <TabsContent value="modulos">
            <Card className="p-6">
              <h2 className="mb-4 text-lg font-semibold">Abrir em módulos completos</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {ATALHOS.map(a => (
                  <Button key={a.label} variant="outline" className="justify-start gap-2" asChild>
                    <Link to={`${a.path}${a.path.includes('?') ? '&' : '?'}lid=${lic.id}`}>
                      <a.icon className="w-4 h-4" aria-hidden="true" /> {a.label}
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
