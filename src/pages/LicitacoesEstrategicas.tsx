import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AnaliseCapag from '@/components/licitacoes/AnaliseCapag';
import AureliaEditalPanel from '@/components/aurelia/AureliaEditalPanel';
import { useLicitacoesEstrategicas } from '@/hooks/useLicitacoesEstrategicas';
import EstadoVazio from '@/components/shared/EstadoVazio';
import LinhaKpis from '@/components/shared/LinhaKpis';
import {
  Target, Star, AlertTriangle, CheckCircle2,
  Brain, Zap, Eye, Landmark, Search, MapPin,
  RefreshCw, ExternalLink, BarChart3, Trophy, DollarSign
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
 *
 * `variant` é a família semântica do <Badge> — o texto da etiqueta vai junto,
 * a cor é reforço, nunca a única pista.
 */
const recomendacaoConfig = {
  alta: { label: 'Recomendada', variant: 'success' as const, tarja: 'border-l-success', icon: Star },
  media: { label: 'Moderada', variant: 'warning' as const, tarja: 'border-l-warning', icon: AlertTriangle },
  baixa: { label: 'Baixa chance', variant: 'danger' as const, tarja: 'border-l-destructive', icon: AlertTriangle },
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
      {/* As abas moram DENTRO do cabeçalho (children), entre o título e o
          corpo — por isso o <Tabs> embrulha o cabeçalho: TabsList e
          TabsContent precisam do mesmo contexto. */}
      <Tabs defaultValue="oportunidades" className="w-full">
        {/* Sem `titulo`/`descricao`/`icone`: a rota é item de menu, então o
            cabeçalho tira tudo do registro `lib/navegacao/paginas.ts` — título,
            linha de descrição, ícone e trilha. */}
        <CabecalhoPagina
          acoes={
            <>
              {fonteClassificacao && (
                <Badge variant={fonteClassificacao === 'ia' ? 'success' : 'muted'}>
                  <Brain className="w-4 h-4 mr-1" aria-hidden="true" />
                  {fonteClassificacao === 'ia' ? 'Classificada por IA' : 'Sem IA'}
                </Badge>
              )}
              <Button
                variant="outline"
                onClick={() => recarregar(filtroUf || undefined)}
                disabled={loading}
              >
                <RefreshCw className={loading ? 'animate-spin' : ''} aria-hidden="true" /> Atualizar
              </Button>
            </>
          }
        >
          {/* Segmented control, não duas metades de uma barra: as abas ocupam a
              largura do próprio texto, como no protótipo. Esticadas até a
              margem, elas competiam com o título por peso visual. */}
          <TabsList>
            <TabsTrigger value="oportunidades">
              <Target className="w-4 h-4 mr-2" aria-hidden="true" /> Oportunidades
            </TabsTrigger>
            <TabsTrigger value="capag">
              <Landmark className="w-4 h-4 mr-2" aria-hidden="true" /> CAPAG
            </TabsTrigger>
          </TabsList>
        </CabecalhoPagina>

        <TabsContent value="oportunidades" className="space-y-6 mt-0">
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
              acompanha a paleta. O ponto sai dos mesmos tokens da tarja do
              cartão, então a pastilha e o cartão que ela filtra dizem a mesma
              cor. */}
          <div className="flex flex-wrap gap-2 items-center">
            {(['todas', 'alta', 'media', 'baixa'] as const).map(f => {
              const ponto = { todas: null, alta: 'bg-success', media: 'bg-warning', baixa: 'bg-destructive' }[f];
              const rotulo = { todas: 'Todas', alta: 'Alta', media: 'Média', baixa: 'Baixa' }[f];
              const ativo = filtro === f;
              return (
                <Button
                  key={f}
                  variant={ativo ? 'default' : 'outline'}
                  onClick={() => setFiltro(f)}
                  aria-pressed={ativo}
                >
                  {ponto && <span className={`w-2 h-2 rounded-full ${ponto}`} aria-hidden="true" />}
                  {rotulo}
                  <span className="tabular-nums opacity-70">({contadores[f]})</span>
                </Button>
              );
            })}
            {/* Rótulo visível (não sr-only): depois de escolher "SP", o
                controle sozinho não diz mais o que filtra. */}
            <div className="flex w-full items-center gap-2 sm:w-auto sm:ml-auto">
              <Label htmlFor="filtro-uf" className="text-sm text-muted-foreground whitespace-nowrap">UF</Label>
              <Select value={filtroUf} onValueChange={(v) => { setFiltroUf(v === 'todas' ? '' : v); recarregar(v === 'todas' ? undefined : v); }}>
                <SelectTrigger id="filtro-uf" className="w-full sm:w-40">
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

          {/* Carregando — esqueleto com a mesma anatomia da grade de cartões,
              e o aviso de que a IA está classificando (pode levar segundos). */}
          {loading && (
            <div role="status" aria-live="polite" className="space-y-4">
              <div className="flex flex-col items-center text-center gap-1 py-2">
                <p className="text-sm text-muted-foreground">Analisando licitações com IA...</p>
                <p className="text-xs text-muted-foreground">Isso pode levar alguns segundos</p>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 [&>*]:min-w-0" aria-hidden="true">
                {[0, 1, 2, 3].map(i => (
                  <Card key={i} className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-5 w-28 rounded-full" />
                    </div>
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-4/5" />
                    <div className="flex items-center justify-between gap-4">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-8 w-16" />
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Lista */}
          {!loading && (
            // Uma coluna até xl, duas em tela larga: abaixo disso o cartão
            // ficaria estreito demais para o rodapé de órgão/data/valor.
            //
            // items-stretch (padrão do grid): cada FILEIRA nivela seus
            // cartões pela mais alta — com items-start, títulos de uma e
            // duas linhas deixavam a grade serrilhada (10/09). O rodapé de
            // cada cartão (órgão/data/valor) ancora embaixo via flex-col +
            // mt-auto, então o nivelamento não deixa buraco.
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 [&>*]:min-w-0">
              {filtradas.length === 0 && (
                <Card className="col-span-full">
                  <EstadoVazio
                    icone={<Target />}
                    titulo="Nenhuma licitação estratégica encontrada"
                    descricao={
                      licitacoes.length === 0
                        ? 'Não há licitações com abertura futura no momento. Tente atualizar.'
                        : 'Nenhuma licitação corresponde ao filtro selecionado.'
                    }
                    acao={
                      licitacoes.length === 0 ? (
                        <Button variant="outline" onClick={() => recarregar(filtroUf || undefined)}>
                          <RefreshCw aria-hidden="true" /> Atualizar
                        </Button>
                      ) : (
                        <Button variant="outline" onClick={() => setFiltro('todas')}>
                          Limpar filtro
                        </Button>
                      )
                    }
                  />
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
                    className={`p-6 border-l-[3px] hover:shadow-md transition-shadow h-full flex flex-col ${cfg.tarja} ${
                      isExpanded ? 'col-span-full' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4 flex-1">
                      <div className="flex-1 min-w-0 flex flex-col">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-bold text-sm truncate">{lic.numero}</span>
                          <Badge variant={cfg.variant}>
                            <cfg.icon className="w-4 h-4 mr-1" aria-hidden="true" /> {cfg.label}
                          </Badge>
                          {lic.modalidade && (
                            <Badge variant="muted">{lic.modalidade}</Badge>
                          )}
                          {lic.salva && (
                            <Badge variant="warning">
                              <Star className="w-4 h-4 mr-1 fill-current" aria-hidden="true" /> Salva
                            </Badge>
                          )}
                        </div>
                        <p className="text-base text-foreground line-clamp-2">{lic.objeto}</p>
                        {/* mt-auto ancora a linha de órgão/data/valor no PÉ
                            do cartão — é ela que alinha entre vizinhos. */}
                        <div className="flex items-center gap-3 mt-auto pt-2 text-xs text-muted-foreground flex-wrap">
                          <span>{lic.orgao}</span>
                          {lic.uf && <><span aria-hidden="true">•</span><span>{lic.uf}{lic.municipio ? ` - ${lic.municipio}` : ''}</span></>}
                          <span aria-hidden="true">•</span>
                          <span>{new Date(lic.dataAbertura).toLocaleDateString('pt-BR')}</span>
                          <span aria-hidden="true">•</span>
                          <span className="font-medium text-foreground tabular-nums">{formatCurrency(lic.valor)}</span>
                        </div>
                      </div>
                      <div className="text-center flex-shrink-0">
                        <div className="text-2xl font-bold text-foreground tabular-nums">{lic.scoreGeral}%</div>
                        <p className="text-xs text-muted-foreground">Score</p>
                      </div>
                    </div>

                    {/* Ações do cartão em linha, no pé — embrulham em tela
                        estreita em vez de empilhar ao lado do score. */}
                    <div className="flex flex-wrap gap-2 mt-4">
                      <Button variant="outline" onClick={() => setExpandido(isExpanded ? null : lic.id)} aria-expanded={isExpanded}>
                        <Eye aria-hidden="true" /> {isExpanded ? 'Recolher' : 'Detalhes'}
                      </Button>
                      <Button variant="outline" onClick={() => { setCapagOrgaoInput(lic.orgao); setCapagOrgao({ orgao: lic.orgao, uf: lic.uf || undefined }); }}>
                        <Landmark aria-hidden="true" /> CAPAG
                      </Button>
                      {lic.linkOrigem && (
                        <Button variant="outline" asChild>
                          <a href={lic.linkOrigem} target="_blank" rel="noopener noreferrer">
                            <ExternalLink aria-hidden="true" /> Edital
                          </a>
                        </Button>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-border space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Relevância</p>
                            <Progress value={lic.scoreRelevancia} className="h-2" />
                            <p className="text-xs font-medium mt-1 tabular-nums">{lic.scoreRelevancia}%</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Viabilidade</p>
                            <Progress value={lic.scoreViabilidade} className="h-2" />
                            <p className="text-xs font-medium mt-1 tabular-nums">{lic.scoreViabilidade}%</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Concorrência (favorável)</p>
                            <Progress value={lic.scoreConcorrencia} className="h-2" />
                            <p className="text-xs font-medium mt-1 tabular-nums">{lic.scoreConcorrencia}%</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="text-sm font-semibold text-success mb-2 flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Fatores Positivos
                            </h4>
                            <ul className="space-y-1">
                              {lic.fatoresPositivos.map((f, i) => (
                                <li key={i} className="text-base text-muted-foreground flex items-center gap-2">
                                  <Zap className="w-4 h-4 text-success flex-shrink-0" aria-hidden="true" /> {f}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-destructive mb-2 flex items-center gap-1">
                              <AlertTriangle className="w-4 h-4" aria-hidden="true" /> Fatores de Risco
                            </h4>
                            <ul className="space-y-1">
                              {lic.fatoresRisco.map((f, i) => (
                                <li key={i} className="text-base text-muted-foreground flex items-center gap-2">
                                  <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" aria-hidden="true" /> {f}
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

        <TabsContent value="capag" className="mt-0 space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
              <h3 className="text-lg font-semibold">Consulta CAPAG por Ente Federativo</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="capag-uf">UF</Label>
                <Select value={capagUf} onValueChange={(v) => { setCapagUf(v); setCapagMunicipio(''); }}>
                  <SelectTrigger id="capag-uf">
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
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="capag-municipio">Município (opcional)</Label>
                <Input id="capag-municipio" placeholder="Município" value={capagMunicipio} onChange={e => setCapagMunicipio(e.target.value)} disabled={!capagUf || capagUf === 'federal'} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="capag-orgao">Órgão / ente</Label>
                <Input id="capag-orgao" placeholder="Nome do órgão / ente" value={capagOrgaoInput} onChange={e => setCapagOrgaoInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && iniciarCapag()} />
              </div>
              <div className="flex flex-col justify-end">
                <Button onClick={iniciarCapag} disabled={!capagOrgaoInput.trim()}>
                  <Search aria-hidden="true" /> Analisar CAPAG
                </Button>
              </div>
            </div>
            {licitacoes.length > 0 && (
              <div className="flex flex-wrap gap-2 items-center mt-4">
                <span className="text-xs text-muted-foreground">Atalhos:</span>
                {[...new Set(licitacoes.map(l => l.orgao))].slice(0, 5).map(org => (
                  <Button key={org} variant="ghost" size="sm" title={org}
                    onClick={() => { setCapagOrgaoInput(org); setCapagOrgao({ orgao: org, uf: capagUf || undefined, municipio: capagMunicipio || undefined }); }}>
                    {org.length > 40 ? org.slice(0, 40) + '…' : org}
                  </Button>
                ))}
              </div>
            )}
          </Card>

          {capagOrgao ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="info" truncate>
                  <Landmark className="w-4 h-4 mr-1" aria-hidden="true" />
                  {capagOrgao.orgao}{capagOrgao.uf ? ` • ${capagOrgao.uf}` : ''}{capagOrgao.municipio ? ` • ${capagOrgao.municipio}` : ''}
                </Badge>
                <Button variant="ghost" onClick={() => setCapagOrgao(null)}>
                  Nova consulta
                </Button>
              </div>
              <AnaliseCapag orgao={capagOrgao.orgao} uf={capagOrgao.uf} municipio={capagOrgao.municipio} />
            </div>
          ) : (
            <Card>
              <EstadoVazio
                icone={<Landmark />}
                titulo="Nenhuma consulta iniciada"
                descricao={<>Preencha os filtros acima e clique em <strong>Analisar CAPAG</strong> para consultar.</>}
              />
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
