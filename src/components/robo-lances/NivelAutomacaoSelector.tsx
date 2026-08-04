import { Badge } from '@/components/ui/badge';
import { Eye, ShieldCheck, Zap, Lock, AlertTriangle, CheckCircle2 } from 'lucide-react';

export type NivelAutomacao = 1 | 2 | 3;

const NIVEIS = [
  {
    nivel: 1 as NivelAutomacao,
    titulo: 'Assistente de Disputa',
    subtitulo: 'Leitura + Cálculo + Alerta',
    icon: Eye,
    cor: 'border-info/40 bg-info/5',
    corAtivo: 'border-info bg-info/15 ring-2 ring-info/30',
    badge: 'bg-info/15 text-info border-info/30',
    descricao: 'O sistema lê a sessão, calcula a faixa ideal, avisa o operador e mostra posição e risco. Nenhum lance é enviado automaticamente.',
    requisitos: ['Sem envio automático', 'Cálculo de faixa ideal', 'Indicador de posição', 'Alertas de risco'],
  },
  {
    nivel: 2 as NivelAutomacao,
    titulo: 'Semiautomático',
    subtitulo: 'Operador autoriza → sistema executa',
    icon: ShieldCheck,
    cor: 'border-warning/40 bg-warning/5',
    corAtivo: 'border-warning bg-warning/15 ring-2 ring-warning/30',
    badge: 'bg-warning/15 text-warning border-warning/30',
    descricao: 'O operador define e autoriza a estratégia. O sistema executa dentro de limites rígidos, com trava e log completo.',
    requisitos: ['Aceite expresso', 'Limite financeiro', 'Log de cada lance', 'Trava automática'],
  },
  {
    nivel: 3 as NivelAutomacao,
    titulo: 'Automação Controlada',
    subtitulo: 'Requer base contratual + técnica + jurídica',
    icon: Zap,
    cor: 'border-destructive/40 bg-destructive/5',
    corAtivo: 'border-destructive bg-destructive/15 ring-2 ring-destructive/30',
    badge: 'bg-destructive/15 text-destructive border-destructive/30',
    descricao: 'Automação total só quando houver base contratual, técnica e jurídica suficiente. Exige dupla autenticação.',
    requisitos: ['Dupla autenticação (2FA)', 'Aceite de política de uso', 'Limite financeiro estrito', 'Trilha imutável', 'Replay de eventos', 'Botão de parada emergencial'],
  },
];

type Props = {
  nivel: NivelAutomacao;
  onChange: (nivel: NivelAutomacao) => void;
  disabled?: boolean;
};

export default function NivelAutomacaoSelector({ nivel, onChange, disabled }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Lock className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-semibold">Nível de Automação</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {NIVEIS.map((n) => {
          const isActive = nivel === n.nivel;
          const Icon = n.icon;

          return (
            <button
              key={n.nivel}
              onClick={() => !disabled && onChange(n.nivel)}
              disabled={disabled}
              className={`text-left rounded-xl border p-4 transition-all ${
                isActive ? n.corAtivo : `${n.cor} hover:shadow-sm`
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  isActive ? 'bg-background shadow-sm' : 'bg-background/50'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold">Nível {n.nivel}</span>
                    {isActive && <CheckCircle2 className="w-3.5 h-3.5 text-success" />}
                  </div>
                  <p className="text-xs font-semibold">{n.titulo}</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground mb-2">{n.descricao}</p>

              <div className="space-y-1">
                {n.requisitos.map((req, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {n.nivel >= 3 ? (
                      <AlertTriangle className="w-2.5 h-2.5 text-destructive shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-2.5 h-2.5 text-success shrink-0" />
                    )}
                    {req}
                  </div>
                ))}
              </div>

              <Badge variant="outline" className={`mt-3 text-xs ${n.badge}`}>
                {n.subtitulo}
              </Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}
