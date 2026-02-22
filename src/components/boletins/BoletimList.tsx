import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  CheckCircle2, AlertTriangle, FileText, CalendarDays, Clock
} from 'lucide-react';

type Boletim = {
  id: string;
  titulo: string;
  tipo: 'novas' | 'alteracoes' | 'resultados';
  data: string;
  hora: string;
  totalItens: number;
  lido: boolean;
  itens: { titulo: string; orgao: string; valor: string }[];
};

const mockBoletins: Boletim[] = [
  {
    id: '1', titulo: 'Novas licitações – Manhã', tipo: 'novas', data: '2026-02-22', hora: '08:00',
    totalItens: 12, lido: false,
    itens: [
      { titulo: 'PE-201/2026 – Pavimentação em Ananindeua', orgao: 'Pref. Ananindeua', valor: 'R$ 4.500.000' },
      { titulo: 'CC-015/2026 – Construção de escola', orgao: 'SEDUC/PA', valor: 'R$ 12.000.000' },
      { titulo: 'PE-089/2026 – Reforma de UBS', orgao: 'SESPA', valor: 'R$ 2.300.000' },
    ]
  },
  {
    id: '2', titulo: 'Alterações e avisos – Meio-dia', tipo: 'alteracoes', data: '2026-02-22', hora: '12:00',
    totalItens: 5, lido: false,
    itens: [
      { titulo: 'Suspensão – PE-012/2026', orgao: 'SEMAS/PA', valor: 'R$ 3.200.000' },
      { titulo: 'Adiamento – PE-078/2026', orgao: 'SETRAN/PA', valor: 'R$ 1.800.000' },
    ]
  },
  {
    id: '3', titulo: 'Resultados do dia – Tarde', tipo: 'resultados', data: '2026-02-21', hora: '17:00',
    totalItens: 8, lido: true,
    itens: [
      { titulo: 'Adjudicado – PE-099/2025', orgao: 'COSANPA', valor: 'R$ 7.400.000' },
      { titulo: 'Homologado – CC-001/2026', orgao: 'Governo do Pará', valor: 'R$ 45.000.000' },
    ]
  },
];

const tipoConfig = {
  novas: { label: 'Novas Licitações', color: 'bg-success/15 text-success border-success/30', icon: FileText },
  alteracoes: { label: 'Alterações', color: 'bg-warning/15 text-warning border-warning/30', icon: AlertTriangle },
  resultados: { label: 'Resultados', color: 'bg-info/15 text-info border-info/30', icon: CheckCircle2 },
};

export default function BoletimList() {
  const [boletimAberto, setBoletimAberto] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {mockBoletins.map(boletim => {
        const cfg = tipoConfig[boletim.tipo];
        const Icon = cfg.icon;
        const isOpen = boletimAberto === boletim.id;
        return (
          <Card key={boletim.id} className={`p-4 transition-shadow hover:shadow-md ${!boletim.lido ? 'border-accent/30 bg-accent/5' : ''}`}>
            <button className="w-full text-left" onClick={() => setBoletimAberto(isOpen ? null : boletim.id)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${cfg.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{boletim.titulo}</span>
                      {!boletim.lido && <span className="w-2 h-2 rounded-full bg-accent" />}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <CalendarDays className="w-3 h-3" />
                      <span>{new Date(boletim.data).toLocaleDateString('pt-BR')}</span>
                      <Clock className="w-3 h-3" />
                      <span>{boletim.hora}</span>
                      <span>• {boletim.totalItens} itens</span>
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className={cfg.color + ' text-[10px]'}>{cfg.label}</Badge>
              </div>
            </button>

            {isOpen && (
              <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                {boletim.itens.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg text-sm">
                    <div>
                      <p className="font-medium text-xs">{item.titulo}</p>
                      <p className="text-[10px] text-muted-foreground">{item.orgao}</p>
                    </div>
                    <span className="text-xs font-medium">{item.valor}</span>
                  </div>
                ))}
                {boletim.totalItens > boletim.itens.length && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    +{boletim.totalItens - boletim.itens.length} itens adicionais
                  </p>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
