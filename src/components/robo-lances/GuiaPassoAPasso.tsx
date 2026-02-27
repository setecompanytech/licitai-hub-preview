import { useState } from 'react';
import { CheckCircle2, Circle, Key, Settings, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STEPS = [
  {
    id: 1,
    title: 'Cadastre suas credenciais',
    icon: Key,
    description: 'Na aba "Portais Conectados", adicione login/senha e certificado digital dos portais onde sua empresa já possui conta.',
    details: [
      'Clique em "Adicionar Credencial"',
      'Selecione o portal de licitação',
      'Informe login e senha da sua conta no portal',
      'Opcionalmente, faça upload do certificado digital (e-CPF ou e-CNPJ)',
      'Informe a validade do certificado para receber alertas de renovação',
    ],
  },
  {
    id: 2,
    title: 'Configure uma sessão de lance',
    icon: Settings,
    description: 'Clique em "Nova Sessão", defina o edital, valor de referência, lance inicial, valor mínimo e regras de decremento.',
    details: [
      'Clique no botão "Nova Sessão de Lance"',
      'Informe o número do edital e selecione o portal',
      'Defina o valor de referência (valor estimado pelo órgão)',
      'Configure o lance inicial (seu primeiro lance)',
      'Estabeleça o valor mínimo (piso — seu limite de preço)',
      'Ajuste o decremento (fixo em R$ ou percentual)',
      'Defina intervalo entre lances e número máximo',
    ],
  },
  {
    id: 3,
    title: 'Acompanhe a simulação',
    icon: BarChart3,
    description: 'O sistema registra e simula os lances internamente, exibindo o histórico e a evolução da disputa para planejamento estratégico.',
    details: [
      'Inicie a simulação clicando em "Iniciar" no card da sessão',
      'Acompanhe os decrementos automáticos em tempo real',
      'Visualize o histórico de lances e o valor atual',
      'Pare a simulação a qualquer momento clicando em "Pausar"',
      'Use os resultados para definir sua estratégia no portal real',
    ],
  },
];

export default function GuiaPassoAPasso() {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bg-card rounded-xl border border-accent/20 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-accent" />
          Como usar o Robô de Lances
        </h3>
        <Button
          size="sm"
          variant="ghost"
          className="text-xs text-muted-foreground"
          onClick={() => setDismissed(true)}
        >
          Ocultar guia
        </Button>
      </div>

      <div className="space-y-3">
        {STEPS.map((step) => {
          const isExpanded = expanded === step.id;
          const StepIcon = step.icon;

          return (
            <div
              key={step.id}
              className="border border-border/50 rounded-lg overflow-hidden"
            >
              <button
                onClick={() => setExpanded(isExpanded ? null : step.id)}
                className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-accent/10 text-accent shrink-0">
                  <span className="text-xs font-bold">{step.id}</span>
                </div>
                <StepIcon className="w-4 h-4 text-accent shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{step.description}</p>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
              </button>

              {isExpanded && (
                <div className="px-4 pb-3 pt-1 border-t border-border/30">
                  <ul className="space-y-1.5">
                    {step.details.map((detail, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Circle className="w-2 h-2 mt-1 shrink-0 text-accent" />
                        {detail}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
