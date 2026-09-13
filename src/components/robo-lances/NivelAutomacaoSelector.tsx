import { Eye, ShieldCheck, Zap, Lock, AlertTriangle, CheckCircle2 } from 'lucide-react';

export type NivelAutomacao = 1 | 2 | 3;

const NIVEIS = [
  {
    nivel: 1 as NivelAutomacao,
    titulo: 'Assistente de Disputa',
    subtitulo: 'Leitura + Cálculo + Alerta',
    icon: Eye,
    cor: 'border-border bg-card',
    corAtivo: 'border-primary bg-primary-tint ring-2 ring-primary/30',
    badge: 'border-border bg-muted text-foreground',
    descricao: 'O sistema lê a sessão, calcula a faixa ideal, avisa o operador e mostra posição e risco. Nenhum lance é enviado automaticamente.',
    requisitos: ['Sem envio automático', 'Cálculo de faixa ideal', 'Indicador de posição', 'Alertas de risco'],
  },
  {
    nivel: 2 as NivelAutomacao,
    titulo: 'Semiautomático',
    subtitulo: 'Operador autoriza → sistema executa',
    icon: ShieldCheck,
    cor: 'border-border bg-card',
    corAtivo: 'border-warning-line bg-warning-tint ring-2 ring-warning/30',
    badge: 'border-warning-line bg-warning-tint text-warning-ink',
    descricao: 'O operador define e autoriza a estratégia. O sistema executa dentro de limites rígidos, com trava e log completo.',
    requisitos: ['Aceite expresso', 'Limite financeiro', 'Log de cada lance', 'Trava automática'],
  },
  {
    nivel: 3 as NivelAutomacao,
    titulo: 'Automação Controlada',
    subtitulo: 'Requer base contratual + técnica + jurídica',
    icon: Zap,
    cor: 'border-border bg-card',
    corAtivo: 'border-destructive-line bg-destructive-tint ring-2 ring-destructive/30',
    badge: 'border-destructive-line bg-destructive-tint text-destructive-ink',
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
        <Lock className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-lg font-semibold">Nível de Automação</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        {NIVEIS.map((n) => {
          const isActive = nivel === n.nivel;
          const Icon = n.icon;

          return (
            <button
              key={n.nivel}
              type="button"
              onClick={() => !disabled && onChange(n.nivel)}
              disabled={disabled}
              aria-pressed={isActive}
              className={`text-left rounded-lg border p-4 transition-colors min-w-0 flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                isActive ? n.corAtivo : `${n.cor} hover:bg-muted`
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                  isActive ? 'bg-card shadow-sm' : 'bg-muted'
                }`}>
                  <Icon className="w-4 h-4" aria-hidden="true" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">Nível {n.nivel}</span>
                    {isActive && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-success-ink">
                        <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> ativo
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold">{n.titulo}</p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-2">{n.descricao}</p>

              <div className="space-y-1">
                {n.requisitos.map((req, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                    {n.nivel >= 3 ? (
                      <AlertTriangle className="w-3 h-3 text-destructive shrink-0" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="w-3 h-3 text-success shrink-0" aria-hidden="true" />
                    )}
                    {req}
                  </div>
                ))}
              </div>

              {/* Não é um Badge: são frases de até 45 caracteres ("Requer base
                  contratual + técnica + jurídica"), e o Badge é pílula de
                  rótulo curto que não quebra linha — o texto vazava do cartão.
                  Aqui a moldura acompanha a largura e quebra quando precisa. */}
              <div className="mt-auto pt-3">
                <span
                  className={`block w-full rounded-md border px-3 py-1 text-xs font-semibold ${n.badge}`}
                >
                  {n.subtitulo}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
