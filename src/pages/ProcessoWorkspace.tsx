import { useEffect, useState } from 'react';
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
import { useProcessoWorkspace } from '@/hooks/useProcessoWorkspace';
import { exportarPastaZip } from '@/components/workspace/exportarPasta';

interface Licitacao {
  id: string; numero: string | null; orgao: string | null; objeto: string | null;
  modalidade: string | null; status: string | null; valor_estimado: number | null;
  data_encerramento: string | null; uf: string | null; municipio: string | null;
}

const ATALHOS = [
  { label: 'Edital / Itens', path: '/precificacao', icon: FileText, descricao: 'Visualizar itens extraídos do edital' },
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
      .select('id, numero, orgao, objeto, modalidade, status, valor_estimado, data_encerramento, uf, municipio')
      .eq('id', id).eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { setLic(data as Licitacao); setLoading(false); });
  }, [id, user]);

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
              <p className="text-xs text-muted-foreground truncate">{lic.objeto}</p>
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
          <TabsList className="grid grid-cols-3 sm:grid-cols-7 lg:grid-cols-7 mb-6 h-auto">
            <TabsTrigger value="visao">Visão Geral</TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
            <TabsTrigger value="anexos">Anexos</TabsTrigger>
            <TabsTrigger value="precificacao">Precificação</TabsTrigger>
            <TabsTrigger value="modulos">Módulos</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="info">Informações</TabsTrigger>
          </TabsList>

          {/* Visão Geral */}
          <TabsContent value="visao" className="space-y-4">
            <EditalOriginalCard licitacaoId={lic.id} />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ATALHOS.map(a => (
                <Link key={a.label} to={`${a.path}?lid=${lic.id}`}>
                  <Card className="p-4 hover:border-accent transition cursor-pointer h-full">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-md bg-accent/10 flex items-center justify-center shrink-0">
                        <a.icon className="w-5 h-5 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm flex items-center gap-1">
                          {a.label} <ExternalLink className="w-3 h-3 opacity-60" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{a.descricao}</p>
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
                <p className="text-xs text-muted-foreground mt-0.5">Planilha de custos e itens precificados para este processo</p>
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
                    <p className="text-sm text-muted-foreground">Nenhuma planilha de custos salva ainda.</p>
                    <p className="text-xs text-muted-foreground mt-1">Acesse a Precificação e preencha os valores para que apareçam aqui.</p>
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
                    <Link to={`${a.path}?lid=${lic.id}`}>
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
              <p className="text-sm text-muted-foreground">O histórico completo de movimentações será exibido aqui (próxima fase).</p>
            </Card>
          </TabsContent>

          {/* Informações */}
          <TabsContent value="info">
            <Card className="p-6 space-y-3">
              <div><span className="text-xs text-muted-foreground">Número:</span> <span className="font-medium">{lic.numero || '-'}</span></div>
              <div><span className="text-xs text-muted-foreground">Órgão:</span> <span className="font-medium">{lic.orgao || '-'}</span></div>
              <div><span className="text-xs text-muted-foreground">Modalidade:</span> <span className="font-medium">{lic.modalidade || '-'}</span></div>
              <div><span className="text-xs text-muted-foreground">Local:</span> <span className="font-medium">{lic.municipio}/{lic.uf}</span></div>
              <div><span className="text-xs text-muted-foreground">Status:</span> <span className="font-medium">{lic.status || '-'}</span></div>
              <div><span className="text-xs text-muted-foreground">Valor estimado:</span> <span className="font-medium">{lic.valor_estimado != null ? `R$ ${Number(lic.valor_estimado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}</span></div>
              <div className="pt-3 border-t">
                <span className="text-xs text-muted-foreground">Objeto:</span>
                <p className="text-sm mt-1">{lic.objeto || '-'}</p>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
