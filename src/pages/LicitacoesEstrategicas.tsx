import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Target, TrendingUp, Star, AlertTriangle, CheckCircle2,
  Brain, Zap, Eye, BookmarkPlus, Filter, ArrowUpDown
} from 'lucide-react';

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

const mockEstrategicas: LicitacaoEstrategica[] = [
  {
    id: '1', numero: 'PE-001/2026', orgao: 'Prefeitura de Belém', objeto: 'Construção de ponte sobre o Rio Guamá – Lote 3',
    valor: 12500000, dataAbertura: '2026-03-05', scoreRelevancia: 95, scoreViabilidade: 88, scoreConcorrencia: 72, scoreGeral: 85,
    fatoresPositivos: ['CNAE compatível', 'Histórico de vitórias no órgão', 'Valor dentro da faixa ideal', 'Poucos concorrentes identificados'],
    fatoresRisco: ['Prazo de execução apertado', 'Exige certificação específica'],
    recomendacao: 'alta', salva: true,
  },
  {
    id: '2', numero: 'PE-045/2026', orgao: 'SEDOP/PA', objeto: 'Pavimentação asfáltica BR-316 – Trecho Marituba',
    valor: 8900000, dataAbertura: '2026-03-10', scoreRelevancia: 90, scoreViabilidade: 82, scoreConcorrencia: 65, scoreGeral: 79,
    fatoresPositivos: ['CNAE principal', 'Região de atuação', 'Histórico positivo'],
    fatoresRisco: ['Alta concorrência esperada', 'Requer garantia bancária'],
    recomendacao: 'alta', salva: false,
  },
  {
    id: '3', numero: 'CC-003/2026', orgao: 'DNIT', objeto: 'Obra de contenção e drenagem na PA-150',
    valor: 5600000, dataAbertura: '2026-03-15', scoreRelevancia: 75, scoreViabilidade: 70, scoreConcorrencia: 80, scoreGeral: 75,
    fatoresPositivos: ['Baixa concorrência', 'CNAE secundário compatível'],
    fatoresRisco: ['Órgão federal (burocracia)', 'Localização remota', 'Exige atestado técnico acima de 50%'],
    recomendacao: 'media', salva: false,
  },
  {
    id: '4', numero: 'PE-155/2026', orgao: 'TCM-PA', objeto: 'Reforma e adequação do prédio do tribunal',
    valor: 6300000, dataAbertura: '2026-03-20', scoreRelevancia: 60, scoreViabilidade: 55, scoreConcorrencia: 45, scoreGeral: 53,
    fatoresPositivos: ['Valor adequado'],
    fatoresRisco: ['Muitos concorrentes', 'CNAE não é principal', 'Exigências técnicas complexas', 'Histórico de impugnações'],
    recomendacao: 'baixa', salva: false,
  },
];

const recomendacaoConfig = {
  alta: { label: 'Recomendada', color: 'bg-success/15 text-success border-success/30', icon: Star },
  media: { label: 'Moderada', color: 'bg-warning/15 text-warning border-warning/30', icon: AlertTriangle },
  baixa: { label: 'Baixa chance', color: 'bg-destructive/15 text-destructive border-destructive/30', icon: AlertTriangle },
};

const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function LicitacoesEstrategicas() {
  const [filtro, setFiltro] = useState<'todas' | 'alta' | 'media' | 'baixa'>('todas');
  const [expandido, setExpandido] = useState<string | null>(null);

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
      </div>
    </AppLayout>
  );
}
