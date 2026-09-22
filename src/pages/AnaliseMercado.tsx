import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import FaixaIndicadores from '@/components/gestao/FaixaIndicadores';
import {
  MODOS_DE_BUSCA, MODO_PADRAO, descricaoDaTentativa, ehModoDeBusca, proximosPassos, rotuloDoProvedor,
  type ModoDeBusca, type TentativaDeBusca,
} from '@/lib/mercado/busca-por-objeto';
import {
  TrendingUp, DollarSign, Package,
  Building2, PieChart, Activity, Landmark, FileText, Shield, ExternalLink, Loader2,
  Search, Calculator, Inbox, AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import TransparenciaPA from '@/components/analise-mercado/TransparenciaPA';
import ContratosGov from '@/components/analise-mercado/ContratosGov';
import ContratosTransparencia from '@/components/analise-mercado/ContratosTransparencia';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RPieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import {
  estadosPortais, capitaisPortais, chaveDoPortal, getPortalByKey, PORTAL_PADRAO, type TransparenciaPortal,
} from '@/data/transparencia-portais';

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
 *
 * Apresentação (identidade 12/09): título, descrição, ícone e trilha vêm do
 * registro `lib/navegacao/paginas.ts`; os dois recortes (UF e período) são os
 * filtros do cabeçalho, e as quatro abas são as declaradas no registro.
 */

type Resumo = {
  totais: { editais: number; orgaos: number; volume: number | null; valor_medio: number | null; valor_mediano?: number | null; com_valor: number };
  por_mes: Array<{ mes: string; editais: number; volume: number | null; valor_medio: number | null }>;
  por_modalidade: Array<{ modalidade: string; editais: number; volume: number | null }>;
  top_orgaos: Array<{ orgao: string; editais: number; volume: number | null }>;
  maiores: Array<{ objeto: string; orgao: string; municipio: string | null; uf: string | null; valor: number; data: string; url: string | null }>;
};

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

/** Séries de gráfico — a exceção contida à regra de cor: os tokens `--chart-*`
 *  existem para isto, e recharts pinta por valor de cor, não por classe. */
const CORES_SERIE = [
  'hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))',
  'hsl(var(--chart-5))', 'hsl(var(--chart-6))', 'hsl(var(--chart-7))', 'hsl(var(--chart-8))',
];

/* Recharts não aceita classe: grade, eixos e tooltip recebem estilo inline,
   mas só com tokens do tema — grade e eixos recessivos, legenda em 12px. */
const ESTILO_TOOLTIP = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  boxShadow: 'var(--shadow-lg)',
  fontSize: 12,
  color: 'hsl(var(--foreground))',
};
const TICK = { fill: 'hsl(var(--muted-foreground))', fontSize: 12 };
const EIXO = { stroke: 'hsl(var(--border))' };

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
  const [portalSelecionado, setPortalSelecionado] = useState<string>(PORTAL_PADRAO);
  const [abaAtiva, setAbaAtiva] = useState('panorama');
  const [fonteConsulta, setFonteConsulta] = useState<'estadual' | 'arp' | 'federal'>('estadual');
  // ── Preços Praticados por OBJETO (08/09): a média solta de editais
  // heterogêneos era decorativa. A busca semântica no acervo (o motor da
  // Recorrência) devolve os editais mais similares ao objeto digitado, e a
  // estatística honesta sai deles: mediana, faixa, quartis, lastro auditável.
  const [termoPreco, setTermoPreco] = useState('');
  // Filtros inteligentes (08/09): UF herda a da página; município parcial;
  // período em janelas ou ano exato. O "rigor" deixou de ser um piso de
  // similaridade (22/09): "CARNE MOIDA PATINHO" no Pará voltava vazio com
  // três editais de carne moída no acervo, porque três palavras contra a
  // descrição de um edital raramente passam de 45%. Agora é o MODO: palavras
  // decidem quem entra, o significado decide a ordem.
  const [ufPreco, setUfPreco] = useState<string>('herdar');
  const [municipioPreco, setMunicipioPreco] = useState('');
  const [periodoPreco, setPeriodoPreco] = useState('36m');
  const [rigorPreco, setRigorPreco] = useState<ModoDeBusca>(MODO_PADRAO);
  // O que a última busca tentou — para o vazio dizer o que foi tentado e
  // oferecer o próximo passo, em vez de afirmar "nenhum edital similar".
  const [tentativaPreco, setTentativaPreco] = useState<(TentativaDeBusca & { provedor: string }) | null>(null);
  const [buscandoPreco, setBuscandoPreco] = useState(false);
  const [buscouPreco, setBuscouPreco] = useState(false);
  const [erroPreco, setErroPreco] = useState('');
  const [editaisPreco, setEditaisPreco] = useState<Array<{
    id: string; orgao: string | null; objeto: string | null; uf: string | null;
    municipio: string | null; valor_total_estimado: number | null;
    data_publicacao_pncp: string | null; url_pncp: string | null; similaridade?: number;
  }>>([]);

  const buscarPrecos = async (opcoes?: { modo?: ModoDeBusca; uf?: string }) => {
    if (termoPreco.trim().length < 8) {
      setErroPreco('Descreva o objeto com pelo menos 8 caracteres (ex.: "carne bovina congelada").');
      setBuscouPreco(true);
      return;
    }
    // O próximo passo do vazio chega por aqui, e a tela acompanha a escolha.
    const modo = opcoes?.modo ?? rigorPreco;
    const ufEscolhida = opcoes?.uf ?? ufPreco;
    if (opcoes?.modo) setRigorPreco(opcoes.modo);
    if (opcoes?.uf) setUfPreco(opcoes.uf);
    setBuscandoPreco(true);
    setErroPreco('');
    try {
      const ufEfetiva = ufEscolhida === 'herdar' ? (uf === 'todos' ? null : uf) : ufEscolhida === 'todas' ? null : ufEscolhida;
      const anoExato = /^\d{4}$/.test(periodoPreco) ? Number(periodoPreco) : null;
      const anos = Math.max(anoExato ? 3 : Number(periodoPreco.replace('m', '')) / 12, 1);
      const { data, error } = await supabase.functions.invoke('historico-orgao-pncp', {
        body: {
          objeto: termoPreco.trim(),
          anos,
          limite: 30,
          uf: ufEfetiva ?? undefined,
          municipio: municipioPreco.trim() || undefined,
          anoExato: anoExato ?? undefined,
          modo,
        },
      });
      if (error || data?.error) {
        setErroPreco(String(data?.error || 'Não foi possível consultar o acervo.'));
        setEditaisPreco([]);
      } else {
        setEditaisPreco(data?.resultados ?? []);
        setTentativaPreco({
          modo, provedor: String(data?.provedor ?? ''), uf: ufEfetiva,
          municipio: municipioPreco.trim() || null, anos, anoExato,
        });
      }
    } catch (e) {
      setErroPreco(e instanceof Error ? e.message : 'Erro na consulta.');
      setEditaisPreco([]);
    } finally {
      setBuscandoPreco(false);
      setBuscouPreco(true);
    }
  };

  // Estatística honesta da amostra: mediana e quartis resistem ao megaedital
  // que arrasta a média; a faixa mostra a dispersão real.
  const valoresPreco = editaisPreco
    .map((e) => Number(e.valor_total_estimado))
    .filter((v) => Number.isFinite(v) && v > 0 && v < 1e10)
    .sort((a, b) => a - b);
  const quantil = (p: number) => {
    if (valoresPreco.length === 0) return null;
    const i = (valoresPreco.length - 1) * p;
    const lo = Math.floor(i); const hi = Math.ceil(i);
    return valoresPreco[lo] + (valoresPreco[hi] - valoresPreco[lo]) * (i - lo);
  };
  const brlExato = (v: number | null | undefined) =>
    v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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

  // A mesma chave que o seletor oferece (`chaveDoPortal`): com formatos
  // diferentes, o campo abria vazio e o selo dizia Pará por um caminho paralelo.
  const portalAtual: TransparenciaPortal = getPortalByKey(portalSelecionado) ?? getPortalByKey(PORTAL_PADRAO)!;

  const t = resumo?.totais;
  const mediaMes = t && resumo!.por_mes.length > 0 ? Math.round(t.editais / resumo!.por_mes.length) : null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <CabecalhoPagina
          filtros={
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="filtro-uf">UF</Label>
                <Select value={uf} onValueChange={setUf}>
                  <SelectTrigger id="filtro-uf" className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-80">
                    <SelectItem value="todos">Todas UFs</SelectItem>
                    {UFS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="filtro-periodo">Período</Label>
                <Select value={periodo} onValueChange={setPeriodo}>
                  <SelectTrigger id="filtro-periodo" className="w-48"><SelectValue /></SelectTrigger>
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
            </>
          }
        />

        {indisponivel ? (
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Agregador do acervo não instalado</AlertTitle>
            <AlertDescription>
              O agregador do acervo ainda não está instalado neste ambiente (migration 20260908000005).
              As abas de Transparência e da API Federal continuam funcionais abaixo.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-3">
            {/* KPIs REAIS do acervo — a competência e a régua ditas no rótulo.
                Cartão KPI do Design System v3 (FaixaIndicadores): rótulo em
                cima, valor 24/600 tabular, ícone num ladrilho neutro e a linha
                de contexto embaixo. */}
            <FaixaIndicadores
              itens={[
                {
                  rotulo: 'Editais no período',
                  icone: Activity,
                  valor: carregando ? '…' : t?.editais.toLocaleString('pt-BR') ?? '—',
                  detalhe: emDias ? 'na janela escolhida' : mediaMes != null ? `${mediaMes.toLocaleString('pt-BR')}/mês em média` : '',
                },
                {
                  rotulo: 'Volume estimado',
                  icone: DollarSign,
                  valor: carregando ? '…' : brlCompacto(t?.volume),
                  detalhe: 'declarado pelos órgãos',
                },
                {
                  rotulo: 'Órgãos contratando',
                  icone: Building2,
                  valor: carregando ? '…' : t?.orgaos.toLocaleString('pt-BR') ?? '—',
                  detalhe: uf === 'todos' ? 'no acervo' : `em ${uf}`,
                },
                {
                  rotulo: 'Valor médio por edital',
                  icone: Package,
                  valor: carregando ? '…' : brlCompacto(t?.valor_medio),
                  detalhe: t?.valor_mediano != null
                    ? `mediana ${brlCompacto(t.valor_mediano)} · ${t.com_valor.toLocaleString('pt-BR')} com valor`
                    : t ? `${t.com_valor.toLocaleString('pt-BR')} com valor informado` : '',
                },
              ]}
            />
            <p className="text-xs text-muted-foreground">
              Fonte: acervo PNCP local — acumula o que passou pelas buscas e pela semeadura (PA completo desde 2023;
              demais UFs conforme o uso). Ausência aqui não prova inexistência no PNCP.
            </p>
          </div>
        )}

        <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="space-y-4">
          <TabsList>
            <TabsTrigger value="panorama"><PieChart className="h-4 w-4" aria-hidden="true" /> Panorama</TabsTrigger>
            <TabsTrigger value="precos"><TrendingUp className="h-4 w-4" aria-hidden="true" /> Preços</TabsTrigger>
            <TabsTrigger value="maiores"><Package className="h-4 w-4" aria-hidden="true" /> Maiores contratos</TabsTrigger>
            <TabsTrigger value="consultas"><Landmark className="h-4 w-4" aria-hidden="true" /> Consultas</TabsTrigger>
          </TabsList>

          <TabsContent value="panorama" className="space-y-4">
            {carregando ? (
              /* Espera na forma do conteúdo — dois cartões de gráfico, sem
                 spinner grande no centro. */
              <div role="status" aria-busy="true" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <span className="sr-only">Carregando</span>
                <Card className="p-5">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="mt-4 h-[300px] w-full" />
                </Card>
                <Card className="p-5">
                  <Skeleton className="h-5 w-56" />
                  <Skeleton className="mt-4 h-[300px] w-full" />
                </Card>
              </div>
            ) : !resumo || resumo.por_modalidade.length === 0 ? (
              <Card>
                <EstadoVazio
                  icone={<Inbox />}
                  titulo="Sem editais no acervo para este recorte"
                  descricao="Amplie o período ou troque a UF nos filtros acima."
                />
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card className="p-5">
                  <h2 className="mb-4 text-lg font-semibold leading-6 text-foreground">Editais por mês</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={resumo.por_mes.map(m => ({ ...m, rotulo: mesCurto(m.mes) }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="rotulo" tick={TICK} axisLine={EIXO} tickLine={false} />
                      <YAxis tick={TICK} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={ESTILO_TOOLTIP} formatter={(v: number, nome: string) => nome === 'editais' ? [v.toLocaleString('pt-BR'), 'Editais'] : [brlCompacto(v), 'Volume']} />
                      <Bar dataKey="editais" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
                <Card className="p-5">
                  <h2 className="mb-4 text-lg font-semibold leading-6 text-foreground">Distribuição por modalidade</h2>
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
                              <Cell key={i} fill={CORES_SERIE[i % CORES_SERIE.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={ESTILO_TOOLTIP} formatter={(v: number) => [`${v.toLocaleString('pt-BR')} editais`, '']} />
                          <Legend layout="vertical" align="right" verticalAlign="middle"
                            wrapperStyle={{ fontSize: 12, maxWidth: 220 }} />
                        </RPieChart>
                      </ResponsiveContainer>
                    );
                  })()}
                </Card>
                <Card className="p-5 lg:col-span-2">
                  <h2 className="mb-3 text-lg font-semibold leading-6 text-foreground">Órgãos que mais publicaram</h2>
                  {/* Lista dividida por fios, linhas de 48px — não uma pilha
                      de caixas cinzas dentro do cartão. */}
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {resumo.top_orgaos.map((o, i) => (
                      <li key={o.orgao} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5 text-sm">
                        <span className="min-w-0 truncate text-foreground">
                          <b className="mr-2 font-semibold tabular-nums text-muted-foreground">{i + 1}º</b>{o.orgao}
                        </span>
                        <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                          {o.editais.toLocaleString('pt-BR')} editais{o.volume ? ` · ${brlCompacto(o.volume)}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="precos" className="space-y-4">
            {/* ── O balcão de preço por OBJETO ──────────────────────────────
                O comercial digita o que vende e sai com mediana, faixa e o
                lastro auditável. Busca semântica no acervo (motor da
                Recorrência); valores = total ESTIMADO declarado no edital.
                Preço homologado item a item é papel da Precificação — a
                ponte está no botão. */}
            <Card className="p-5">
              <h2 className="text-lg font-semibold leading-6 text-foreground">Preço praticado por objeto</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Digite o objeto que você fornece. A busca cruza as palavras com a descrição dos editais
                do acervo e ordena os mais parecidos primeiro (últimos 3 anos, até 30 editais).
              </p>

              <div className="mt-4 flex flex-wrap items-end gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-md">
                  <Label htmlFor="preco-objeto">Objeto</Label>
                  <Input id="preco-objeto" placeholder='Ex.: carne bovina congelada, notebook, material de expediente'
                    value={termoPreco} onChange={(e) => setTermoPreco(e.target.value)}
                    aria-invalid={erroPreco ? true : undefined}
                    onKeyDown={(e) => { if (e.key === 'Enter') buscarPrecos(); }} />
                </div>
                <Button onClick={() => buscarPrecos()} disabled={buscandoPreco}>
                  {buscandoPreco ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Buscar
                </Button>
                {/* O objeto digitado vai junto (22/09): chegar na Precificação
                    com o campo vazio era digitar duas vezes a mesma coisa. */}
                <Button asChild variant="outline">
                  <Link to={termoPreco.trim() ? `/precificacao?objeto=${encodeURIComponent(termoPreco.trim())}` : '/precificacao'}>
                    <Calculator className="h-4 w-4" /> Cotar na Precificação
                  </Link>
                </Button>
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="preco-uf">UF</Label>
                  <Select value={ufPreco} onValueChange={setUfPreco}>
                    <SelectTrigger id="preco-uf" className="w-56"><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-80">
                      <SelectItem value="herdar">UF da página ({uf === 'todos' ? 'todas' : uf})</SelectItem>
                      <SelectItem value="todas">Todas as UFs</SelectItem>
                      {UFS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="preco-municipio">Município</Label>
                  <Input id="preco-municipio" placeholder="Opcional" value={municipioPreco}
                    onChange={(e) => setMunicipioPreco(e.target.value)} className="w-48" />
                </div>
                {/* Sem sobreposição (08/09): "últimos 12 meses" e "ano de
                    2026" diziam quase o mesmo por dois nomes. Fica UM padrão
                    (a janela cheia de 3 anos) e os anos exatos. */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="preco-periodo">Período</Label>
                  <Select value={periodoPreco} onValueChange={setPeriodoPreco}>
                    <SelectTrigger id="preco-periodo" className="w-52"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="36m">Últimos 3 anos (padrão)</SelectItem>
                      {[0, 1, 2, 3].map((i) => {
                        const a = new Date().getFullYear() - i;
                        return <SelectItem key={a} value={String(a)}>Ano de {a}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </div>
                {/* Como comparar (22/09): as palavras decidem quem entra, o
                    significado decide a ordem. "Todas" = amostra menor e mais
                    fiel; "qualquer" = o padrão; "só significado" = vizinhos. */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="preco-rigor">Como comparar</Label>
                  <Select value={rigorPreco} onValueChange={(v) => { if (ehModoDeBusca(v)) setRigorPreco(v); }}>
                    <SelectTrigger id="preco-rigor" className="w-80 max-w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MODOS_DE_BUSCA.map((m) => (
                        <SelectItem key={m.valor} value={m.valor} title={m.explicacao}>{m.rotulo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {erroPreco && (
                <Alert variant="destructive" className="mt-4">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  <AlertDescription>{erroPreco}</AlertDescription>
                </Alert>
              )}
            </Card>

            {/* O vazio diz o que tentou e oferece o passo mais largo: "nenhum
                edital similar" era falso e não dava para onde ir (22/09). */}
            {buscouPreco && !buscandoPreco && !erroPreco && editaisPreco.length === 0 && (
              <Card>
                <EstadoVazio
                  icone={<Search />}
                  titulo="Nenhum edital com esse objeto no acervo"
                  descricao={tentativaPreco
                    ? `Tentei ${descricaoDaTentativa(tentativaPreco)}. O acervo cresce a cada busca e pela semeadura; ausência aqui não prova inexistência no PNCP.`
                    : 'O acervo cresce a cada busca e pela semeadura; ausência aqui não prova inexistência no PNCP.'}
                  acao={tentativaPreco && (
                    <div className="flex flex-wrap justify-center gap-2">
                      {proximosPassos(tentativaPreco.modo, tentativaPreco.uf).map((p) => (
                        <Button key={p.rotulo} variant="outline" size="sm" onClick={() => buscarPrecos({ modo: p.modo, uf: p.uf })}>
                          {p.rotulo}
                        </Button>
                      ))}
                    </div>
                  )}
                />
              </Card>
            )}

            {valoresPreco.length > 0 && (
              <>
                {/* A estatística da amostra nos cartões KPI do Design System
                    v3. Faixas (Q1–Q3 e mínimo–máximo) ocupam duas linhas do
                    valor, cada extremo na sua. */}
                <FaixaIndicadores
                  itens={[
                    { rotulo: 'Mediana do edital', valor: brlExato(quantil(0.5)), detalhe: 'o valor típico da amostra' },
                    {
                      rotulo: 'Miolo (Q1–Q3)',
                      valor: (
                        <>
                          <span className="block">{brlExato(quantil(0.25))}</span>
                          <span className="block">a {brlExato(quantil(0.75))}</span>
                        </>
                      ),
                    },
                    {
                      rotulo: 'Faixa completa',
                      valor: (
                        <>
                          <span className="block">{brlExato(valoresPreco[0])}</span>
                          <span className="block">a {brlExato(valoresPreco[valoresPreco.length - 1])}</span>
                        </>
                      ),
                    },
                    { rotulo: 'Amostra', valor: valoresPreco.length, detalhe: `editais com valor, de ${editaisPreco.length} encontrados` },
                  ]}
                />

                <Card className="p-5">
                  <h2 className="mb-3 text-lg font-semibold leading-6 text-foreground">Editais que sustentam o número</h2>
                  <ul className="max-h-[380px] divide-y divide-border overflow-y-auto rounded-md border border-border">
                    {editaisPreco.map((e) => (
                      <li key={e.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                        <div className="min-w-0">
                          <p className="line-clamp-2 font-medium text-foreground">{e.objeto ?? '—'}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {[e.orgao, e.municipio && e.uf ? `${e.municipio}/${e.uf}` : e.uf,
                              e.data_publicacao_pncp ? new Date(e.data_publicacao_pncp.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR') : null,
                            ].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <div className="shrink-0 space-y-1 text-right">
                          <p className="font-semibold tabular-nums text-foreground">{brlExato(e.valor_total_estimado)}</p>
                          {typeof e.similaridade === 'number' && (
                            <Badge variant="muted">{Math.round(e.similaridade * 100)}% similar</Badge>
                          )}
                          {e.url_pncp && (
                            <a href={e.url_pncp} target="_blank" rel="noreferrer"
                              className="flex items-center justify-end gap-1 text-xs text-primary hover:underline">
                              PNCP <ExternalLink className="h-3 w-3" aria-hidden="true" />
                            </a>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                  {tentativaPreco && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Busca por {descricaoDaTentativa(tentativaPreco)}; ordem: {rotuloDoProvedor(tentativaPreco.provedor)}.
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Valores = total ESTIMADO declarado pelo órgão no edital, não o preço do item. Para o
                    preço homologado item a item (quem ganhou e por quanto), use "Cotar na Precificação".
                  </p>
                </Card>
              </>
            )}

            {/* Sem objeto pesquisado: o panorama geral de antes, rotulado como tal. */}
            {!buscouPreco && (
              <Card className="p-5">
                <h2 className="mb-4 text-lg font-semibold leading-6 text-foreground">
                  Panorama geral — valor médio por edital, mês a mês (sem objeto pesquisado)
                </h2>
                {carregando ? (
                  <div role="status" aria-busy="true">
                    <span className="sr-only">Carregando</span>
                    <Skeleton className="h-[300px] w-full" />
                  </div>
                ) : !resumo || resumo.por_mes.length === 0 ? (
                  <EstadoVazio tamanho="compacto" titulo="Sem dados para este recorte" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={resumo.por_mes.map(m => ({ ...m, rotulo: mesCurto(m.mes) }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="rotulo" tick={TICK} axisLine={EIXO} tickLine={false} />
                      <YAxis tickFormatter={(v: number) => brlCompacto(v)} tick={TICK} axisLine={false} tickLine={false} width={80} />
                      <Tooltip contentStyle={ESTILO_TOOLTIP} formatter={(v: number, nome: string) => [brlCompacto(v), nome === 'valor_medio' ? 'Valor médio' : 'Volume']} />
                      <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => v === 'valor_medio' ? 'Valor médio do edital' : v} />
                      <Line type="monotone" dataKey="valor_medio" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  Média de editais heterogêneos — serve de contexto, não de preço. Pesquise um objeto
                  acima para a estatística que importa.
                </p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="maiores">
            <Card className="p-5">
              <h2 className="mb-3 text-lg font-semibold leading-6 text-foreground">Maiores contratações do período</h2>
              {carregando ? (
                <div role="status" aria-busy="true" className="divide-y divide-border rounded-md border border-border">
                  <span className="sr-only">Carregando</span>
                  {Array.from({ length: 5 }, (_, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      <Skeleton className="h-4 w-8" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="ml-auto h-4 w-20" />
                    </div>
                  ))}
                </div>
              ) : !resumo || resumo.maiores.length === 0 ? (
                <EstadoVazio
                  icone={<Package />}
                  titulo="Sem dados para este recorte"
                  descricao="Amplie o período ou troque a UF nos filtros acima."
                />
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {resumo.maiores.map((m, i) => (
                    <li key={`${m.url}-${i}`} className="flex items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/60">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="w-8 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">{i + 1}º</span>
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-sm font-medium text-foreground">{m.objeto}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {[m.orgao, m.municipio && m.uf ? `${m.municipio}/${m.uf}` : m.uf].filter(Boolean).join(' · ')}
                            {m.data && ` · ${new Date(m.data + 'T12:00:00').toLocaleDateString('pt-BR')}`}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold tabular-nums text-foreground">{brlCompacto(m.valor)}</p>
                        {m.url && (
                          <a href={m.url} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                            PNCP <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </TabsContent>

          {/* ── Consultas: as três fontes federativas numa aba só (pedido de
              08/09). Nada foi perdido: os três painéis são os mesmos; o que
              mudou é a porta — um seletor de fonte no lugar de três abas que
              pareciam a mesma coisa. Cada ente, sua fonte: estadual/municipal
              (portais de transparência), União-atas (Compras.gov.br) e
              União-contratos (Portal da Transparência).
              O seletor de portais só governa a fonte estadual — fora dela,
              parecia um filtro global que não filtrava nada (print de 08/09). */}
          <TabsContent value="consultas" className="space-y-4">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Fonte da consulta">
              <Button size="sm" variant={fonteConsulta === 'estadual' ? 'default' : 'outline'}
                aria-pressed={fonteConsulta === 'estadual'}
                onClick={() => setFonteConsulta('estadual')}>
                <Landmark className="h-4 w-4" /> Transparência estadual
              </Button>
              <Button size="sm" variant={fonteConsulta === 'arp' ? 'default' : 'outline'}
                aria-pressed={fonteConsulta === 'arp'}
                onClick={() => setFonteConsulta('arp')}>
                <FileText className="h-4 w-4" /> Atas de registro — federal
              </Button>
              <Button size="sm" variant={fonteConsulta === 'federal' ? 'default' : 'outline'}
                aria-pressed={fonteConsulta === 'federal'}
                onClick={() => setFonteConsulta('federal')}>
                <Shield className="h-4 w-4" /> Contratos e licitações — federal
              </Button>
            </div>

            {fonteConsulta === 'estadual' && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="portal-transparencia">Portal de transparência</Label>
                <Select value={portalSelecionado} onValueChange={setPortalSelecionado}>
                  <SelectTrigger id="portal-transparencia" className="w-full sm:w-80">
                    <Landmark className="mr-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <SelectValue placeholder="Selecione o portal" />
                  </SelectTrigger>
                  <SelectContent className="max-h-96">
                    <SelectGroup>
                      <SelectLabel>Estados e Distrito Federal</SelectLabel>
                      {estadosPortais.map(p => (
                        <SelectItem key={chaveDoPortal(p)} value={chaveDoPortal(p)}>
                          {p.nome} ({p.sigla})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>Capitais</SelectLabel>
                      {capitaisPortais.map(p => (
                        <SelectItem key={chaveDoPortal(p)} value={chaveDoPortal(p)}>
                          {p.nome} ({p.sigla})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            )}

            {fonteConsulta === 'estadual' && <TransparenciaPA key={portalSelecionado} portal={portalAtual} />}
            {fonteConsulta === 'arp' && <ContratosGov />}
            {fonteConsulta === 'federal' && <ContratosTransparencia />}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
