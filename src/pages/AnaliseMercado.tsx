import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart3, TrendingUp, DollarSign, Package,
  Building2, PieChart, Activity, Landmark, FileText, Shield, ExternalLink, Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import TransparenciaPA from '@/components/analise-mercado/TransparenciaPA';
import ContratosGov from '@/components/analise-mercado/ContratosGov';
import ContratosTransparencia from '@/components/analise-mercado/ContratosTransparencia';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RPieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { transparenciaPortais, estadosPortais, capitaisPortais, type TransparenciaPortal } from '@/data/transparencia-portais';

/**
 * Análise de Mercado — agora sobre o ACERVO REAL (08/09/2026).
 *
 * A versão anterior exibia KPIs literais escritos no código ("4.657",
 * "R$ 3,2 bi") e gráficos de arrays fixos — número inventado com cara de
 * análise. Tudo aqui passa a vir do RPC `analise_mercado_acervo`, que agrega
 * o pncp_editais_cache: editais verdadeiros, com órgão, modalidade, valor
 * estimado e link para o PNCP.
 *
 * Honestidade da cobertura, sempre à vista: o acervo acumula o que passou
 * pelas buscas e pela semeadura (PA completo desde 2023; demais UFs conforme
 * o uso). Ausência aqui não prova inexistência no PNCP.
 */

type Resumo = {
  totais: { editais: number; orgaos: number; volume: number | null; valor_medio: number | null; valor_mediano?: number | null; com_valor: number };
  por_mes: Array<{ mes: string; editais: number; volume: number | null; valor_medio: number | null }>;
  por_modalidade: Array<{ modalidade: string; editais: number; volume: number | null }>;
  top_orgaos: Array<{ orgao: string; editais: number; volume: number | null }>;
  maiores: Array<{ objeto: string; orgao: string; municipio: string | null; uf: string | null; valor: number; data: string; url: string | null }>;
};

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

const COLORS = ['hsl(var(--accent))', 'hsl(var(--info))', 'hsl(var(--warning))', 'hsl(var(--success))', 'hsl(var(--destructive))', 'hsl(var(--muted-foreground))'];

const brlCompacto = (v: number | null | undefined) => {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v >= 1e9) return `R$ ${(v / 1e9).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} bi`;
  if (v >= 1e6) return `R$ ${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (v >= 1e3) return `R$ ${(v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`;
  return `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
};

const mesCurto = (yyyymm: string) => {
  const [a, m] = yyyymm.split('-');
  return `${['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][Number(m) - 1]}/${a.slice(2)}`;
};

export default function AnaliseMercado() {
  const [portalSelecionado, setPortalSelecionado] = useState<string>('estado-PA');
  const [uf, setUf] = useState<string>('PA');
  // '7d'/'30d' = dias corridos (o pedido de 08/09: janela menor que 3 meses);
  // números puros = meses. O RPC recebe p_dias OU p_meses.
  const [periodo, setPeriodo] = useState<string>('12');
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [indisponivel, setIndisponivel] = useState(false);

  const emDias = periodo.endsWith('d');
  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    (supabase.rpc as any)('analise_mercado_acervo', {
      p_uf: uf === 'todos' ? null : uf,
      p_meses: emDias ? 12 : Number(periodo),
      p_dias: emDias ? parseInt(periodo) : null,
    }).then(({ data, error }: { data: unknown; error: unknown }) => {
      if (!vivo) return;
      setCarregando(false);
      // RPC da 20260908000005. Sem ela, a página diz o que falta em vez de
      // mostrar zero fingindo dado.
      if (error || !data) { setIndisponivel(true); return; }
      setIndisponivel(false);
      setResumo(data as Resumo);
    });
    return () => { vivo = false; };
  }, [uf, periodo, emDias]);

  const portalAtual: TransparenciaPortal = transparenciaPortais.find(p => `${p.tipo}-${p.sigla}-${p.nome}` === portalSelecionado)
    || transparenciaPortais.find(p => p.tipo === 'estado' && p.sigla === 'PA')!;

  const t = resumo?.totais;
  const mediaMes = t && resumo!.por_mes.length > 0 ? Math.round(t.editais / resumo!.por_mes.length) : null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
              <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground flex-shrink-0" />
              Análise de Mercado
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Panorama do acervo PNCP local — editais reais, com órgão, modalidade e valor estimado
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={uf} onValueChange={setUf}>
              <SelectTrigger className="w-32 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-[320px]">
                <SelectItem value="todos">Todas UFs</SelectItem>
                {UFS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-40 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Última semana</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="3">Últimos 3 meses</SelectItem>
                <SelectItem value="6">Últimos 6 meses</SelectItem>
                <SelectItem value="12">Últimos 12 meses</SelectItem>
                <SelectItem value="24">Últimos 24 meses</SelectItem>
                <SelectItem value="36">Últimos 36 meses</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {indisponivel ? (
          <Card className="p-6 text-sm text-muted-foreground">
            O agregador do acervo ainda não está instalado neste ambiente (migration 20260908000005).
            As abas de Transparência e da API Federal continuam funcionais abaixo.
          </Card>
        ) : (
          <>
            {/* KPIs REAIS do acervo — a competência e a régua ditas no rótulo. */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="stat-card">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Editais no período</span>
                </div>
                <p className="text-2xl font-bold tabular-nums">{carregando ? '…' : t?.editais.toLocaleString('pt-BR') ?? '—'}</p>
                <span className="text-xs text-muted-foreground">
                  {emDias ? 'na janela escolhida' : mediaMes != null ? `${mediaMes.toLocaleString('pt-BR')}/mês em média` : ''}
                </span>
              </div>
              <div className="stat-card">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Volume estimado</span>
                </div>
                <p className="text-2xl font-bold tabular-nums">{carregando ? '…' : brlCompacto(t?.volume)}</p>
                <span className="text-xs text-muted-foreground">declarado pelos órgãos</span>
              </div>
              <div className="stat-card">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Órgãos contratando</span>
                </div>
                <p className="text-2xl font-bold tabular-nums">{carregando ? '…' : t?.orgaos.toLocaleString('pt-BR') ?? '—'}</p>
                <span className="text-xs text-muted-foreground">{uf === 'todos' ? 'no acervo' : `em ${uf}`}</span>
              </div>
              <div className="stat-card">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Valor médio por edital</span>
                </div>
                <p className="text-2xl font-bold tabular-nums">{carregando ? '…' : brlCompacto(t?.valor_medio)}</p>
                <span className="text-xs text-muted-foreground">
                  {t?.valor_mediano != null
                    ? `mediana ${brlCompacto(t.valor_mediano)} · ${t.com_valor.toLocaleString('pt-BR')} com valor`
                    : t ? `${t.com_valor.toLocaleString('pt-BR')} com valor informado` : ''}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground -mt-3">
              Fonte: acervo PNCP local — acumula o que passou pelas buscas e pela semeadura (PA completo desde 2023;
              demais UFs conforme o uso). Ausência aqui não prova inexistência no PNCP.
            </p>
          </>
        )}

        <Tabs defaultValue="panorama" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="panorama"><PieChart className="w-4 h-4 mr-1" /> Panorama</TabsTrigger>
              <TabsTrigger value="precos"><TrendingUp className="w-4 h-4 mr-1" /> Preços Praticados</TabsTrigger>
              <TabsTrigger value="maiores"><Package className="w-4 h-4 mr-1" /> Maiores Contratações</TabsTrigger>
              <TabsTrigger value="transparencia"><Landmark className="w-4 h-4 mr-1" /> Transparência</TabsTrigger>
              <TabsTrigger value="contratos-gov"><FileText className="w-4 h-4 mr-1" /> Contratos Gov</TabsTrigger>
              <TabsTrigger value="transparencia-federal"><Shield className="w-4 h-4 mr-1" /> Federal (API)</TabsTrigger>
            </TabsList>

            <Select value={portalSelecionado} onValueChange={setPortalSelecionado}>
              <SelectTrigger className="w-64 h-9 text-sm">
                <Landmark className="w-4 h-4 mr-1 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Selecione o portal" />
              </SelectTrigger>
              <SelectContent className="max-h-[400px]">
                <SelectGroup>
                  <SelectLabel>Estados e Distrito Federal</SelectLabel>
                  {estadosPortais.map(p => (
                    <SelectItem key={`estado-${p.sigla}-${p.nome}`} value={`estado-${p.sigla}-${p.nome}`}>
                      {p.nome} ({p.sigla})
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Capitais</SelectLabel>
                  {capitaisPortais.map(p => (
                    <SelectItem key={`capital-${p.sigla}-${p.nome}`} value={`capital-${p.sigla}-${p.nome}`}>
                      {p.nome} ({p.sigla})
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <TabsContent value="panorama" className="space-y-4">
            {carregando ? (
              <Card className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></Card>
            ) : !resumo || resumo.por_modalidade.length === 0 ? (
              <Card className="p-8 text-center text-sm text-muted-foreground">
                Sem editais no acervo para este recorte — amplie o período ou troque a UF.
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="p-5">
                  <h3 className="text-sm font-semibold mb-4">Editais por mês</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={resumo.por_mes.map(m => ({ ...m, rotulo: mesCurto(m.mes) }))}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="rotulo" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number, nome: string) => nome === 'editais' ? [v.toLocaleString('pt-BR'), 'Editais'] : [brlCompacto(v), 'Volume']} />
                      <Bar dataKey="editais" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
                <Card className="p-5">
                  <h3 className="text-sm font-semibold mb-4">Distribuição por modalidade</h3>
                  {/* Sem rótulo DENTRO do gráfico: fatia de 0–1% não comporta
                      texto apontado e as linhas se empilhavam ilegíveis
                      (print de 08/09). O percentual vive na legenda. */}
                  {(() => {
                    const total = resumo.por_modalidade.reduce((s, m) => s + m.editais, 0) || 1;
                    const fatias = resumo.por_modalidade.map((m) => ({
                      ...m,
                      rotulo: `${m.modalidade.length > 26 ? m.modalidade.slice(0, 24) + '…' : m.modalidade} — ${((m.editais / total) * 100).toFixed(m.editais / total < 0.01 ? 1 : 0)}%`,
                    }));
                    return (
                      <ResponsiveContainer width="100%" height={300}>
                        <RPieChart>
                          <Pie data={fatias} cx="40%" cy="50%" outerRadius={100} dataKey="editais" nameKey="rotulo">
                            {fatias.map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number) => [`${v.toLocaleString('pt-BR')} editais`, '']} />
                          <Legend layout="vertical" align="right" verticalAlign="middle"
                            wrapperStyle={{ fontSize: 12, maxWidth: 220 }} />
                        </RPieChart>
                      </ResponsiveContainer>
                    );
                  })()}
                </Card>
                <Card className="p-5 lg:col-span-2">
                  <h3 className="text-sm font-semibold mb-3">Órgãos que mais publicaram</h3>
                  <div className="space-y-1.5">
                    {resumo.top_orgaos.map((o, i) => (
                      <div key={o.orgao} className="flex items-center justify-between gap-3 p-2 bg-muted/30 rounded-lg text-sm">
                        <span className="min-w-0 truncate"><b className="mr-2 text-muted-foreground">{i + 1}º</b>{o.orgao}</span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {o.editais.toLocaleString('pt-BR')} editais{o.volume ? ` · ${brlCompacto(o.volume)}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="precos">
            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-4">Valor médio por edital, mês a mês</h3>
              {carregando ? (
                <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : !resumo || resumo.por_mes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sem dados para este recorte.</p>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={resumo.por_mes.map(m => ({ ...m, rotulo: mesCurto(m.mes) }))}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v: number) => brlCompacto(v)} tick={{ fontSize: 11 }} width={80} />
                    <Tooltip formatter={(v: number, nome: string) => [brlCompacto(v), nome === 'valor_medio' ? 'Valor médio' : 'Volume']} />
                    <Legend formatter={(v) => v === 'valor_medio' ? 'Valor médio do edital' : v} />
                    <Line type="monotone" dataKey="valor_medio" stroke="hsl(var(--accent))" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
              <p className="text-[11px] text-muted-foreground mt-2">
                Régua: valor total ESTIMADO declarado pelo órgão em cada edital (outliers acima de R$ 10 bi ficam fora).
              </p>
            </Card>
          </TabsContent>

          <TabsContent value="maiores">
            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-3">Maiores contratações do período</h3>
              {carregando ? (
                <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : !resumo || resumo.maiores.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sem dados para este recorte.</p>
              ) : (
                <div className="space-y-2">
                  {resumo.maiores.map((m, i) => (
                    <div key={`${m.url}-${i}`} className="flex items-start justify-between gap-3 p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="text-lg font-bold text-foreground w-8 text-center shrink-0">{i + 1}º</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium line-clamp-2">{m.objeto}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {[m.orgao, m.municipio && m.uf ? `${m.municipio}/${m.uf}` : m.uf].filter(Boolean).join(' · ')}
                            {m.data && ` · ${new Date(m.data + 'T12:00:00').toLocaleDateString('pt-BR')}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold tabular-nums">{brlCompacto(m.valor)}</p>
                        {m.url && (
                          <a href={m.url} target="_blank" rel="noreferrer"
                            className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
                            PNCP <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="transparencia">
            <TransparenciaPA key={portalSelecionado} portal={portalAtual} />
          </TabsContent>

          <TabsContent value="contratos-gov">
            <ContratosGov />
          </TabsContent>

          <TabsContent value="transparencia-federal">
            <ContratosTransparencia />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
