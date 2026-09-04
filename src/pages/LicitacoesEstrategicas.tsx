import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AnaliseCapag from '@/components/licitacoes/AnaliseCapag';
import AureliaEditalPanel from '@/components/aurelia/AureliaEditalPanel';
import { useLicitacoesEstrategicas } from '@/hooks/useLicitacoesEstrategicas';
import LinhaKpis from '@/components/shared/LinhaKpis';
import {
  Target, Star, AlertTriangle, CheckCircle2,
  Brain, Zap, Eye, BookmarkPlus, Landmark, Search, MapPin,
  Loader2, RefreshCw, ExternalLink, BarChart3, Trophy, DollarSign
} from 'lucide-react';

const UFS_BRASIL = [
  { sigla: 'AC', nome: 'Acre' }, { sigla: 'AL', nome: 'Alagoas' }, { sigla: 'AP', nome: 'Amapá' },
  { sigla: 'AM', nome: 'Amazonas' }, { sigla: 'BA', nome: 'Bahia' }, { sigla: 'CE', nome: 'Ceará' },
  { sigla: 'DF', nome: 'Distrito Federal' }, { sigla: 'ES', nome: 'Espírito Santo' }, { sigla: 'GO', nome: 'Goiás' },
  { sigla: 'MA', nome: 'Maranhão' }, { sigla: 'MT', nome: 'Mato Grosso' }, { sigla: 'MS', nome: 'Mato Grosso do Sul' },
  { sigla: 'MG', nome: 'Minas Gerais' }, { sigla: 'PA', nome: 'Pará' }, { sigla: 'PB', nome: 'Paraíba' },
  { sigla: 'PR', nome: 'Paraná' }, { sigla: 'PE', nome: 'Pernambuco' }, { sigla: 'PI', nome: 'Piauí' },
  { sigla: 'RJ', nome: 'Rio de Janeiro' }, { sigla: 'RN', nome: 'Rio Grande do Norte' },
  { sigla: 'RS', nome: 'Rio Grande do Sul' }, { sigla: 'RO', nome: 'Rondônia' }, { sigla: 'RR', nome: 'Roraima' },
  { sigla: 'SC', nome: 'Santa Catarina' }, { sigla: 'SP', nome: 'São Paulo' }, { sigla: 'SE', nome: 'Sergipe' },
  { sigla: 'TO', nome: 'Tocantins' },
];

/**
 * `tarja` é a faixa de 3px na borda esquerda do cartão — o padrão do protótipo
 * para dizer o estado antes de a pessoa ler qualquer palavra. Numa grade de
 * dois por fileira, é o que deixa varrer a lista com o olho: sem ela, todos os
 * cartões são retângulos brancos iguais e a recomendação só aparece na etiqueta.
 */
const recomendacaoConfig = {
  alta: { label: 'Recomendada', color: 'bg-success-tint text-success-ink border-success-line', tarja: 'border-l-success', icon: Star },
  media: { label: 'Moderada', color: 'bg-warning-tint text-warning-ink border-warning-line', tarja: 'border-l-warning', icon: AlertTriangle },
  baixa: { label: 'Baixa chance', color: 'bg-destructive-tint text-destructive-ink border-destructive-line', tarja: 'border-l-destructive', icon: AlertTriangle },
};

const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function LicitacoesEstrategicas() {
  const [filtro, setFiltro] = useState<'todas' | 'alta' | 'media' | 'baixa'>('todas');
  const [expandido, setExpandido] = useState<string | null>(null);
  const [capagUf, setCapagUf] = useState('');
  const [capagMunicipio, setCapagMunicipio] = useState('');
  const [capagOrgaoInput, setCapagOrgaoInput] = useState('');
  const [capagOrgao, setCapagOrgao] = useState<{ orgao: string; uf?: string; municipio?: string } | null>(null);
  const [filtroUf, setFiltroUf] = useState('');

  const { licitacoes, loading, fonteClassificacao, recarregar } = useLicitacoesEstrategicas();

  const iniciarCapag = () => {
    if (!capagOrgaoInput.trim()) return;
    setCapagOrgao({
      orgao: capagOrgaoInput.trim(),
      uf: capagUf || undefined,
      municipio: capagMunicipio || undefined,
    });
  };

  const filtradas = licitacoes.filter(l => filtro === 'todas' || l.recomendacao === filtro);

  const contadores = {
    todas: licitacoes.length,
    alta: licitacoes.filter(l => l.recomendacao === 'alta').length,
    media: licitacoes.filter(l => l.recomendacao === 'media').length,
    baixa: licitacoes.filter(l => l.recomendacao === 'baixa').length,
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2.5">
              <Target className="w-6 h-6 text-muted-foreground flex-shrink-0" aria-hidden="true" />
              Licitações Estratégicas
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Análise inteligente das oportunidades com maior chance de sucesso
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {fonteClassificacao && (
              <Badge variant="outline" className={fonteClassificacao === 'ia' ? 'bg-muted text-muted-foreground border-border' : 'bg-muted text-muted-foreground'}>
                <Brain className="w-3 h-3 mr-1" /> {fonteClassificacao === 'ia' ? 'Classificada por IA' : 'Sem IA'}
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => recarregar(filtroUf || undefined)} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </Button>
          </div>
        </div>

        <Tabs defaultValue="oportunidades" className="w-full">
          {/* Segmented control, não duas metades de uma barra: as abas ocupam a
              largura do próprio texto, como no protótipo. Esticadas até a
              margem, elas competiam com o título por peso visual. */}
          <TabsList>
            <TabsTrigger value="oportunidades">
              <Target className="w-4 h-4 mr-1.5" aria-hidden="true" /> Oportunidades
            </TabsTrigger>
            <TabsTrigger value="capag">
              <Landmark className="w-4 h-4 mr-1.5" aria-hidden="true" /> Análise CAPAG
            </TabsTrigger>
          </TabsList>

          <TabsContent value="oportunidades" className="space-y-4 mt-5">
            {/* Régua de números — os quatro do protótipo, todos derivados da
                lista que já está em mãos. Nenhuma consulta nova. */}
            <LinhaKpis
              itens={[
                {
                  rotulo: 'Oportunidades analisadas',
                  valor: filtradas.length.toLocaleString('pt-BR'),
                  icone: BarChart3,
                  tom: 'info',
                },
                {
                  rotulo: 'Score médio',
                  valor: filtradas.length
                    ? `${Math.round(filtradas.reduce((n, o) => n + o.scoreGeral, 0) / filtradas.length)}%`
                    : '—',
                  icone: Target,
                },
                {
                  rotulo: 'Alta chance de sucesso',
                  valor: contadores.alta.toLocaleString('pt-BR'),
                  icone: Trophy,
                  tom: 'ok',
                  aoClicar: () => setFiltro(filtro === 'alta' ? 'todas' : 'alta'),
                  ativo: filtro === 'alta',
                },
                {
                  rotulo: 'Valor total estimado',
                  valor: formatCurrency(filtradas.reduce((n, o) => n + (o.valor || 0), 0)),
                  icone: DollarSign,
                  tom: 'info',
                },
              ]}
            />

            {/* Filtros */}
            {/* Pastilhas de filtro. O ponto colorido substitui os emojis
                ⭐ ⚠️ 🔻 que estavam aqui: emoji não existe em nenhuma tela do
                protótipo, muda de desenho conforme o sistema operacional e não
                acompanha a paleta — o ⭐ amarelo brigava com o âmbar do próprio
                âmbar ao lado. O ponto sai dos mesmos tokens da tarja do cartão,
                então a pastilha e o cartão que ela filtra dizem a mesma cor. */}
            <div className="flex flex-wrap gap-2 items-center">
              {(['todas', 'alta', 'media', 'baixa'] as const).map(f => {
                const ponto = { todas: null, alta: 'bg-success', media: 'bg-warning', baixa: 'bg-destructive' }[f];
                const rotulo = { todas: 'Todas', alta: 'Alta', media: 'Média', baixa: 'Baixa' }[f];
                const ativo = filtro === f;
                return (
                  <Button
                    key={f}
                    variant={ativo ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFiltro(f)}
                    aria-pressed={ativo}
                  >
                    {ponto && <span className={`w-2 h-2 rounded-full ${ponto}`} aria-hidden="true" />}
                    {rotulo}
                    <span className="tabular-nums opacity-70">({contadores[f]})</span>
                  </Button>
                );
              })}
              <div className="ml-auto">
                <Select value={filtroUf} onValueChange={(v) => { setFiltroUf(v === 'todas' ? '' : v); recarregar(v === 'todas' ? undefined : v); }}>
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue placeholder="Filtrar UF" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas UFs</SelectItem>
                    {UFS_BRASIL.map(uf => (
                      <SelectItem key={uf.sigla} value={uf.sigla}>{uf.sigla}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Loading */}
            {loading && (
              <Card className="border-dashed border-2 border-accent/30">
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
                  <p className="text-sm text-muted-foreground">Analisando licitações com IA...</p>
                  <p className="text-xs text-muted-foreground">Isso pode levar alguns segundos</p>
                </div>
              </Card>
            )}

            {/* Lista */}
            {!loading && (
              // Grade de `auto-fill` com mínimo em `min(430px, 100%)`: duas
              // colunas em tela larga, uma em tela estreita, sem breakpoint
              // declarado. É o padrão `.crt-grade` do protótipo.
              <div className="grid gap-4 items-start [grid-template-columns:repeat(auto-fill,minmax(min(430px,100%),1fr))] [&>*]:min-w-0">
                {filtradas.length === 0 && (
                  <Card className="col-span-full flex flex-col items-center text-center px-5 py-16">
                    <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-5">
                      <Target className="h-7 w-7" aria-hidden="true" />
                    </span>
                    <h3 className="text-lg font-semibold">Nenhuma licitação estratégica encontrada</h3>
                    <p className="text-sm text-muted-foreground max-w-[52ch] mt-2 leading-relaxed">
                      {licitacoes.length === 0
                        ? 'Não há licitações com abertura futura no momento. Tente atualizar.'
                        : 'Nenhuma licitação corresponde ao filtro selecionado.'}
                    </p>
                  </Card>
                )}
                {filtradas.map(lic => {
                  const cfg = recomendacaoConfig[lic.recomendacao];
                  const isExpanded = expandido === lic.id;
                  return (
                    // Aberto, o cartão ocupa a fileira inteira. Não é enfeite:
                    // dentro dele cabem três barras de score lado a lado, duas
                    // colunas de fatores e o painel da Aurélia com quatro
                    // caixas de texto. Em meia largura, cada uma dessas caixas
                    // vira uma coluna de ~20 caracteres, e o parecer jurídico
                    // fica ilegível. Fechado, volta para a grade de dois.
                    <Card
                      key={lic.id}
                      className={`p-5 border-l-[3px] hover:shadow-md transition-shadow ${cfg.tarja} ${
                        isExpanded ? 'col-span-full' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-bold text-sm truncate">{lic.numero}</span>
                            <Badge variant="outline" className={cfg.color + ' text-xs'}>
                              <cfg.icon className="w-3 h-3 mr-1" /> {cfg.label}
                            </Badge>
                            {lic.modalidade && (
                              <Badge variant="secondary" className="text-xs">{lic.modalidade}</Badge>
                            )}
                            {lic.salva && <Star className="w-4 h-4 text-warning fill-warning" />}
                          </div>
                          <p className="text-base text-foreground line-clamp-2">{lic.objeto}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                            <span>{lic.orgao}</span>
                            {lic.uf && <><span>•</span><span>{lic.uf}{lic.municipio ? ` - ${lic.municipio}` : ''}</span></>}
                            <span>•</span>
                            <span>{new Date(lic.dataAbertura).toLocaleDateString('pt-BR')}</span>
                            <span>•</span>
                            <span className="font-medium text-foreground">{formatCurrency(lic.valor)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 ml-2 flex-shrink-0">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-foreground">{lic.scoreGeral}%</div>
                            <p className="text-xs text-muted-foreground">Score</p>
                          </div>
                          <div className="flex flex-col gap-1">
                            <Button size="sm" variant="outline" onClick={() => setExpandido(isExpanded ? null : lic.id)}>
                              <Eye className="w-3 h-3 mr-1" /> {isExpanded ? 'Recolher' : 'Detalhes'}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setCapagOrgaoInput(lic.orgao); setCapagOrgao({ orgao: lic.orgao, uf: lic.uf || undefined }); }}>
                              <Landmark className="w-3 h-3 mr-1" /> CAPAG
                            </Button>
                            {lic.linkOrigem && (
                              <Button size="sm" variant="outline" asChild>
                                <a href={lic.linkOrigem} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="w-3 h-3 mr-1" /> Edital
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-border/50 space-y-4">
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Relevância</p>
                              <Progress value={lic.scoreRelevancia} className="h-2" />
                              <p className="text-xs font-medium mt-1">{lic.scoreRelevancia}%</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Viabilidade</p>
                              <Progress value={lic.scoreViabilidade} className="h-2" />
                              <p className="text-xs font-medium mt-1">{lic.scoreViabilidade}%</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Concorrência (favorável)</p>
                              <Progress value={lic.scoreConcorrencia} className="h-2" />
                              <p className="text-xs font-medium mt-1">{lic.scoreConcorrencia}%</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h4 className="text-xs font-semibold text-success mb-2 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Fatores Positivos
                              </h4>
                              <ul className="space-y-1">
                                {lic.fatoresPositivos.map((f, i) => (
                                  <li key={i} className="text-base text-muted-foreground flex items-center gap-1">
                                    <Zap className="w-3 h-3 text-success flex-shrink-0" /> {f}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <h4 className="text-xs font-semibold text-destructive mb-2 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> Fatores de Risco
                              </h4>
                              <ul className="space-y-1">
                                {lic.fatoresRisco.map((f, i) => (
                                  <li key={i} className="text-base text-muted-foreground flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 text-destructive flex-shrink-0" /> {f}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          <AureliaEditalPanel
                            edital={{
                              titulo: lic.numero,
                              objeto: lic.objeto,
                              orgao: lic.orgao,
                              valor: formatCurrency(lic.valor),
                              modalidade: lic.modalidade || 'Licitação',
                              dataAbertura: lic.dataAbertura,
                            }}
                          />
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="capag" className="mt-4 space-y-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Consulta CAPAG por Ente Federativo</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Select value={capagUf} onValueChange={(v) => { setCapagUf(v); setCapagMunicipio(''); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Sem emoji, como as demais opções da lista — e o
                        protótipo escreve exatamente "Federal (União)". */}
                    <SelectItem value="federal">Federal (União)</SelectItem>
                    {UFS_BRASIL.map(uf => (
                      <SelectItem key={uf.sigla} value={uf.sigla}>{uf.sigla} – {uf.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input placeholder="Município (opcional)" value={capagMunicipio} onChange={e => setCapagMunicipio(e.target.value)} disabled={!capagUf || capagUf === 'federal'} />
                <Input placeholder="Nome do órgão / ente" value={capagOrgaoInput} onChange={e => setCapagOrgaoInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && iniciarCapag()} />
                <Button onClick={iniciarCapag} disabled={!capagOrgaoInput.trim()} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  <Search className="w-4 h-4 mr-2" /> Analisar CAPAG
                </Button>
              </div>
              {licitacoes.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  <span className="text-xs text-muted-foreground mr-1 self-center">Atalhos:</span>
                  {[...new Set(licitacoes.map(l => l.orgao))].slice(0, 5).map(org => (
                    <Button key={org} variant="ghost" size="sm" className="h-6 text-xs px-2"
                      onClick={() => { setCapagOrgaoInput(org); setCapagOrgao({ orgao: org, uf: capagUf || undefined, municipio: capagMunicipio || undefined }); }}>
                      {org.length > 40 ? org.slice(0, 40) + '…' : org}
                    </Button>
                  ))}
                </div>
              )}
            </Card>

            {capagOrgao ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">
                    <Landmark className="w-3 h-3 mr-1" />
                    {capagOrgao.orgao}{capagOrgao.uf ? ` • ${capagOrgao.uf}` : ''}{capagOrgao.municipio ? ` • ${capagOrgao.municipio}` : ''}
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={() => setCapagOrgao(null)} className="text-xs">
                    Nova consulta
                  </Button>
                </div>
                <AnaliseCapag orgao={capagOrgao.orgao} uf={capagOrgao.uf} municipio={capagOrgao.municipio} />
              </div>
            ) : (
              <Card className="border-dashed border-2 border-muted-foreground/20">
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <Landmark className="w-8 h-8 text-muted-foreground/40" />
                  <p className="text-base text-muted-foreground">
                    Preencha os filtros acima e clique em <strong>Analisar CAPAG</strong> para consultar.
                  </p>
                </div>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
