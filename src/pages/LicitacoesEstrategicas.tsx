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
import {
  Target, TrendingUp, Star, AlertTriangle, CheckCircle2,
  Brain, Zap, Eye, BookmarkPlus, Filter, ArrowUpDown, Landmark, Search, MapPin
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

type LicitacaoEstrategica = {
  id: string;
  numero: string;
  orgao: string;
  objeto: string;
  valor: number;
  dataAbertura: string;
  scoreRelevancia: number;
  scoreViabilidade: number;
  scoreConcorrencia: number;
  scoreGeral: number;
  fatoresPositivos: string[];
  fatoresRisco: string[];
  recomendacao: 'alta' | 'media' | 'baixa';
  salva: boolean;
};

const mockEstrategicas: LicitacaoEstrategica[] = [];

const recomendacaoConfig = {
  alta: { label: 'Recomendada', color: 'bg-success/15 text-success border-success/30', icon: Star },
  media: { label: 'Moderada', color: 'bg-warning/15 text-warning border-warning/30', icon: AlertTriangle },
  baixa: { label: 'Baixa chance', color: 'bg-destructive/15 text-destructive border-destructive/30', icon: AlertTriangle },
};

const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function LicitacoesEstrategicas() {
  const [filtro, setFiltro] = useState<'todas' | 'alta' | 'media' | 'baixa'>('todas');
  const [expandido, setExpandido] = useState<string | null>(null);
  const [capagUf, setCapagUf] = useState('');
  const [capagMunicipio, setCapagMunicipio] = useState('');
  const [capagOrgaoInput, setCapagOrgaoInput] = useState('');
  const [capagOrgao, setCapagOrgao] = useState<{ orgao: string; uf?: string; municipio?: string } | null>(null);

  const iniciarCapag = () => {
    if (!capagOrgaoInput.trim()) return;
    setCapagOrgao({
      orgao: capagOrgaoInput.trim(),
      uf: capagUf || undefined,
      municipio: capagMunicipio || undefined,
    });
  };

  const filtradas = mockEstrategicas.filter(l => filtro === 'todas' || l.recomendacao === filtro);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Target className="w-6 h-6 text-accent" />
              Licitações Estratégicas
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Análise inteligente das oportunidades com maior chance de sucesso
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-accent/15 text-accent border-accent/30">
              <Brain className="w-3 h-3 mr-1" /> Análise por IA
            </Badge>
          </div>
        </div>

        <Tabs defaultValue="oportunidades" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="oportunidades">
              <Target className="w-4 h-4 mr-1" /> Oportunidades
            </TabsTrigger>
            <TabsTrigger value="capag">
              <Landmark className="w-4 h-4 mr-1" /> Análise CAPAG
            </TabsTrigger>
          </TabsList>

          <TabsContent value="oportunidades" className="space-y-4 mt-4">
            {/* Filtros */}
            <div className="flex gap-2">
              {(['todas', 'alta', 'media', 'baixa'] as const).map(f => (
                <Button key={f} variant={filtro === f ? 'default' : 'outline'} size="sm" onClick={() => setFiltro(f)}
                  className={filtro === f ? 'bg-accent hover:bg-accent/90 text-accent-foreground' : ''}>
                  {f === 'todas' ? 'Todas' : f === 'alta' ? '⭐ Alta' : f === 'media' ? '⚠️ Média' : '🔻 Baixa'}
                </Button>
              ))}
            </div>

            {/* Lista */}
            <div className="space-y-4">
              {filtradas.length === 0 && (
                <Card className="border-dashed border-2 border-muted-foreground/20">
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Target className="w-10 h-10 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">Nenhuma licitação estratégica encontrada</p>
                    <p className="text-xs text-muted-foreground">As oportunidades aparecerão aqui conforme o monitoramento identificar licitações compatíveis com seu perfil.</p>
                  </div>
                </Card>
              )}
              {filtradas.map(lic => {
                const cfg = recomendacaoConfig[lic.recomendacao];
                const isExpanded = expandido === lic.id;
                return (
                  <Card key={lic.id} className="p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-sm">{lic.numero}</span>
                          <Badge variant="outline" className={cfg.color + ' text-[10px]'}>
                            <cfg.icon className="w-3 h-3 mr-1" /> {cfg.label}
                          </Badge>
                          {lic.salva && <Star className="w-4 h-4 text-warning fill-warning" />}
                        </div>
                        <p className="text-sm text-foreground">{lic.objeto}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{lic.orgao}</span>
                          <span>•</span>
                          <span>{new Date(lic.dataAbertura).toLocaleDateString('pt-BR')}</span>
                          <span>•</span>
                          <span className="font-medium text-foreground">{formatCurrency(lic.valor)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-accent">{lic.scoreGeral}%</div>
                          <p className="text-[10px] text-muted-foreground">Score Geral</p>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Button size="sm" variant="outline" onClick={() => setExpandido(isExpanded ? null : lic.id)}>
                            <Eye className="w-3 h-3 mr-1" /> {isExpanded ? 'Recolher' : 'Detalhes'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setCapagOrgaoInput(lic.orgao); setCapagOrgao({ orgao: lic.orgao }); }}>
                            <Landmark className="w-3 h-3 mr-1" /> CAPAG
                          </Button>
                          <Button size="sm" variant="outline">
                            <BookmarkPlus className="w-3 h-3 mr-1" /> Salvar
                          </Button>
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
                                <li key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Zap className="w-3 h-3 text-success" /> {f}
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
                                <li key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 text-destructive" /> {f}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="capag" className="mt-4 space-y-4">
            {/* Filtros CAPAG */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-semibold">Consulta CAPAG por Ente Federativo</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Select value={capagUf} onValueChange={(v) => { setCapagUf(v); setCapagMunicipio(''); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a UF" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="federal">🏛️ Federal (União)</SelectItem>
                    {UFS_BRASIL.map(uf => (
                      <SelectItem key={uf.sigla} value={uf.sigla}>{uf.sigla} – {uf.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Município (opcional)"
                  value={capagMunicipio}
                  onChange={e => setCapagMunicipio(e.target.value)}
                  disabled={!capagUf || capagUf === 'federal'}
                />
                <Input
                  placeholder="Nome do órgão / ente"
                  value={capagOrgaoInput}
                  onChange={e => setCapagOrgaoInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && iniciarCapag()}
                />
                <Button onClick={iniciarCapag} disabled={!capagOrgaoInput.trim()} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  <Search className="w-4 h-4 mr-2" /> Analisar CAPAG
                </Button>
              </div>
              {/* Atalhos rápidos */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                <span className="text-[10px] text-muted-foreground mr-1 self-center">Atalhos:</span>
                {[...new Set(mockEstrategicas.map(l => l.orgao))].map(org => (
                  <Button key={org} variant="ghost" size="sm" className="h-6 text-[10px] px-2"
                    onClick={() => { setCapagOrgaoInput(org); setCapagOrgao({ orgao: org, uf: capagUf || undefined, municipio: capagMunicipio || undefined }); }}>
                    {org}
                  </Button>
                ))}
              </div>
            </Card>

            {/* Resultado */}
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
                  <p className="text-sm text-muted-foreground">
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
