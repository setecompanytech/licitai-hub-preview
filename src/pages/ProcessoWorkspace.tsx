import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, FolderOpen, FileText, Calculator, Sparkles, Scale, Briefcase,
  ClipboardList, History, ExternalLink, Building2, Calendar, DollarSign, MapPin, Loader2, Archive,
  TrendingUp, Clock, Package
} from 'lucide-react';
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
      .select('id, numero, orgao, objeto, modalidade, status, valor_estimado, data_encerramento, uf, municipio, data_abertura, portal, url_edital, observacoes, resultado, valor_adjudicado, data_homologacao, vencedor')
      .eq('id', id).eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { setLic(data as Licitacao); setLoading(false); });
  }, [id, user]);

  // Carrega detalhes completos do PNCP quando o processo tem url_edital do portal
  useEffect(() => {
    if (pncpFetchedRef.current || !lic?.url_edital) return;
    const m = lic.url_edital.match(/editais\/(\d{14})\/(\d{4})\/(\d+)/);
    if (!m) return;
    pncpFetchedRef.current = true;
    const [, cnpj, ano, seq] = m;
    const base = `https://pncp.gov.br/api/consulta/v1/orgaos/${cnpj}/compras/${ano}/${seq}`;
    const hdrs = { Accept: 'application/json' };
    setPncpCarregando(true);
    Promise.allSettled([
      fetch(base, { headers: hdrs }),
      fetch(`${base}/itens?pagina=1&tamanhoPagina=500`, { headers: hdrs }),
      fetch(`${base}/arquivos?pagina=1&tamanhoPagina=100`, { headers: hdrs }),
    ]).then(async ([rDet, rItens, rArqs]) => {
      if (rDet.status === 'fulfilled' && rDet.value.ok) setPncpDetalhe(await rDet.value.json());
      if (rItens.status === 'fulfilled' && rItens.value.ok) {
        const j = await rItens.value.json();
        setPncpItens(Array.isArray(j) ? j : (j?.data ?? []));
      }
      if (rArqs.status === 'fulfilled' && rArqs.value.ok) {
        const j = await rArqs.value.json();
        setPncpArquivos(Array.isArray(j) ? j : (j?.data ?? []));
      }
    }).finally(() => setPncpCarregando(false));
  }, [lic?.url_edital]);

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
            <FolderOpen className="w-6 h-6 text-accent" />
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
            {lic.data_encerramento && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Encerra: {new Date(lic.data_encerramento).toLocaleDateString('pt-BR')}</span>}
            {lic.valor_estimado != null && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> R$ {Number(lic.valor_estimado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>}
          </div>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-4 py-6">
        <Tabs defaultValue="visao" className="w-full" onValueChange={v => { if (v === 'precificacao') loadPrecificacao(); }}>
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
                <span><span className="text-xs text-muted-foreground">Local:</span> <span className="font-semibold">{lic.municipio && lic.uf ? `${lic.municipio}/${lic.uf}` : lic.municipio || lic.uf || '—'}</span></span>
                <span className="text-border select-none">|</span>
                <span><span className="text-xs text-muted-foreground">Órgão:</span> <span className="font-semibold">{lic.orgao || '—'}</span></span>
                <span className="text-border select-none">|</span>
                <span><span className="text-xs text-muted-foreground">Status:</span> <span className="font-semibold">{lic.status || '—'}</span></span>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1.5 pb-3 border-b border-border/40">
                <span><span className="text-xs text-muted-foreground">Modalidade:</span> <span className="font-semibold">{lic.modalidade || '—'}</span></span>
                <span className="text-border select-none">|</span>
                <span><span className="text-xs text-muted-foreground">Valor estimado:</span> <span className="font-semibold">{lic.valor_estimado != null ? fmt(lic.valor_estimado) : '—'}</span></span>
                {lic.data_abertura && (
                  <>
                    <span className="text-border select-none">|</span>
                    <span><span className="text-xs text-muted-foreground">Abertura:</span> <span className="font-semibold">{new Date(lic.data_abertura).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></span>
                  </>
                )}
              </div>
              {(lic.data_encerramento || lic.portal) && (
                <div className="flex flex-wrap gap-x-6 gap-y-1.5 pb-3 border-b border-border/40">
                  {lic.data_encerramento && (
                    <span><span className="text-xs text-muted-foreground">Encerramento:</span> <span className="font-semibold">{new Date(lic.data_encerramento).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></span>
                  )}
                  {lic.portal && (
                    <>
                      {lic.data_encerramento && <span className="text-border select-none">|</span>}
                      <span>
                        <span className="text-xs text-muted-foreground">Portal:</span>{' '}
                        {lic.url_edital ? (
                          <a href={lic.url_edital} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline inline-flex items-center gap-0.5">
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
                    {lic.vencedor && <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" title="Empresa vencedora" />}
                    <span className="text-xs text-muted-foreground">Resultado:</span>
                    <span className={`font-semibold ${lic.vencedor ? 'text-green-600' : ''}`}>{lic.resultado}</span>
                  </span>
                  {lic.valor_adjudicado != null && (
                    <>
                      <span className="text-border select-none">|</span>
                      <span><span className="text-xs text-muted-foreground">Valor adjudicado:</span> <span className="font-semibold">{fmt(lic.valor_adjudicado)}</span></span>
                    </>
                  )}
                  {lic.data_homologacao && (
                    <>
                      <span className="text-border select-none">|</span>
                      <span><span className="text-xs text-muted-foreground">Homologação:</span> <span className="font-semibold">{new Date(lic.data_homologacao).toLocaleDateString('pt-BR')}</span></span>
                    </>
                  )}
                </div>
              )}
              <div>
                <span className="text-xs text-muted-foreground font-medium">Objeto:</span>
                <p className="mt-1 leading-relaxed">{lic.objeto || '—'}</p>
              </div>
              {lic.observacoes && (
                <p className="pt-2 border-t border-border/40 text-base text-muted-foreground italic">{lic.observacoes}</p>
              )}
            </Card>
            {/* ── Dados completos do PNCP ── */}
            {(pncpCarregando || pncpDetalhe || pncpItens.length > 0 || pncpArquivos.length > 0) && (
              <Card className="p-5">
                {pncpCarregando ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Carregando dados completos do PNCP…
                  </div>
                ) : pncpDetalhe ? (
                  <div className="space-y-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Informações detalhadas — PNCP
                    </p>

                    {/* Grade de campos */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3 text-sm">
                      {pncpDetalhe.numeroControlePncp && (
                        <div><p className="text-xs text-muted-foreground">ID PNCP</p>
                          <p className="font-medium font-mono text-xs break-all">{pncpDetalhe.numeroControlePncp}</p></div>
                      )}
                      {pncpDetalhe.situacaoCompraNome && (
                        <div><p className="text-xs text-muted-foreground">Situação PNCP</p>
                          <p className="font-medium">{pncpDetalhe.situacaoCompraNome}</p></div>
                      )}
                      {pncpDetalhe.cnpjOrgao && (
                        <div><p className="text-xs text-muted-foreground">CNPJ do órgão</p>
                          <p className="font-medium font-mono text-xs">{pncpDetalhe.cnpjOrgao}</p></div>
                      )}
                      {(pncpDetalhe.codigoUnidadeOrgao || pncpDetalhe.nomeUnidadeOrgao) && (
                        <div><p className="text-xs text-muted-foreground">Unidade compradora</p>
                          <p className="font-medium text-xs leading-snug">
                            {pncpDetalhe.codigoUnidadeOrgao && `${pncpDetalhe.codigoUnidadeOrgao} — `}
                            {pncpDetalhe.nomeUnidadeOrgao}
                          </p></div>
                      )}
                      {pncpDetalhe.esferaNome && (
                        <div><p className="text-xs text-muted-foreground">Esfera</p>
                          <p className="font-medium">{pncpDetalhe.esferaNome}</p></div>
                      )}
                      {pncpDetalhe.poderNome && (
                        <div><p className="text-xs text-muted-foreground">Poder</p>
                          <p className="font-medium">{pncpDetalhe.poderNome}</p></div>
                      )}
                      {pncpDetalhe.tipoInstrumentoConvocatorioNome && (
                        <div><p className="text-xs text-muted-foreground">Tipo de instrumento</p>
                          <p className="font-medium">{pncpDetalhe.tipoInstrumentoConvocatorioNome}</p></div>
                      )}
                      {pncpDetalhe.modoDisputaNome && (
                        <div><p className="text-xs text-muted-foreground">Modo de disputa</p>
                          <p className="font-medium">{pncpDetalhe.modoDisputaNome}</p></div>
                      )}
                      <div><p className="text-xs text-muted-foreground">Registro de preços</p>
                        <p className="font-medium">{pncpDetalhe.srp ? 'Sim' : 'Não'}</p></div>
                      {(pncpDetalhe.amparoLegal?.descricao || pncpDetalhe.amparoLegalDescricao) && (
                        <div><p className="text-xs text-muted-foreground">Amparo legal</p>
                          <p className="font-medium text-xs">{pncpDetalhe.amparoLegal?.descricao || pncpDetalhe.amparoLegalDescricao}</p></div>
                      )}
                      {(pncpDetalhe.fonteOrcamentaria || pncpDetalhe.fonteOrcamentariaNome) && (
                        <div><p className="text-xs text-muted-foreground">Fonte orçamentária</p>
                          <p className="font-medium">{pncpDetalhe.fonteOrcamentaria || pncpDetalhe.fonteOrcamentariaNome}</p></div>
                      )}
                      {pncpDetalhe.sistemaOrigem && (
                        <div><p className="text-xs text-muted-foreground">Sistema de origem</p>
                          <p className="font-medium">{pncpDetalhe.sistemaOrigem}</p></div>
                      )}
                      {pncpDetalhe.dataPublicacaoPncp && (
                        <div><p className="text-xs text-muted-foreground">Publicação PNCP</p>
                          <p className="font-medium">{new Date(pncpDetalhe.dataPublicacaoPncp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p></div>
                      )}
                      {pncpDetalhe.dataAtualizacao && (
                        <div><p className="text-xs text-muted-foreground">Última atualização</p>
                          <p className="font-medium">{new Date(pncpDetalhe.dataAtualizacao).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p></div>
                      )}
                      {pncpDetalhe.valorTotalHomologado != null && (
                        <div><p className="text-xs text-muted-foreground">Valor homologado</p>
                          <p className="font-medium text-green-600">{fmt(pncpDetalhe.valorTotalHomologado)}</p></div>
                      )}
                    </div>

                    {/* Informação complementar */}
                    {pncpDetalhe.informacaoComplementar && (
                      <div className="pt-3 border-t border-border/40">
                        <p className="text-xs text-muted-foreground mb-1">Informação complementar</p>
                        <p className="text-base text-foreground/80 leading-relaxed">{pncpDetalhe.informacaoComplementar}</p>
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
                                const vUnit = item.valorUnitarioEstimado ?? item.valorUnitario;
                                const vTotal = item.valorTotal ?? item.valorTotalEstimado
                                  ?? (vUnit != null && qtd != null ? vUnit * qtd : null);
                                return (
                                  <tr key={item.numeroItem ?? i} className="hover:bg-muted/20 transition-colors">
                                    <td className="px-3 py-2 text-muted-foreground">{item.numeroItem ?? i + 1}</td>
                                    <td className="px-3 py-2 text-foreground/80">
                                      {item.descricao || item.descricaoItem || '—'}
                                      {item.unidadeMedida && (
                                        <span className="ml-1.5 text-[10px] text-muted-foreground border border-border/60 px-1 rounded">
                                          {item.unidadeMedida}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-right">{qtd?.toLocaleString('pt-BR') ?? '—'}</td>
                                    <td className="px-3 py-2 text-right text-muted-foreground">{vUnit != null ? fmt(vUnit) : '—'}</td>
                                    <td className="px-3 py-2 text-right font-medium text-green-600">{vTotal != null ? fmt(vTotal) : '—'}</td>
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
                                <FileText className="w-4 h-4 text-accent shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs font-medium truncate">{arq.titulo || arq.nomeArquivo || `Arquivo ${i + 1}`}</p>
                                  {arq.dataPublicacao && (
                                    <p className="text-[10px] text-muted-foreground">
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

            <EditalOriginalCard licitacaoId={lic.id} urlEdital={lic.url_edital ?? undefined} />
            <EditalViewer licitacaoId={lic.id} urlEdital={lic.url_edital ?? undefined} />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ATALHOS.map(a => (
                <Link key={a.label} to={`${a.path}${a.path.includes('?') ? '&' : '?'}lid=${lic.id}`}>
                  <Card className="p-4 hover:border-accent transition cursor-pointer h-full">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-md bg-accent/10 flex items-center justify-center shrink-0">
                        <a.icon className="w-5 h-5 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm flex items-center gap-1">
                          {a.label} <ExternalLink className="w-3 h-3 opacity-60" />
                        </div>
                        <p className="text-base text-muted-foreground mt-0.5">{a.descricao}</p>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
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
                          <TrendingUp className="w-4 h-4 text-primary" />
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
                                <p className="text-[10px] text-muted-foreground px-3 py-1.5 border-t">
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
                        <p className="text-[10px] text-muted-foreground px-3 py-1.5 border-t">
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
            <Card className="p-8 text-center">
              <History className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-base text-muted-foreground">O histórico completo de movimentações será exibido aqui (próxima fase).</p>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}
