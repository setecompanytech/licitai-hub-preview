import type { ElementType, ReactNode } from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  Clock,
  HelpCircle,
  RotateCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * SeloSituacao — o status do módulo Gestão, em texto, ícone e cor.
 *
 * As três coisas juntas por exigência do comando de 13/09, e a ordem importa:
 * o TEXTO é o que informa; o ícone e a cor apenas aceleram a varredura. Quem
 * enxerga o verde e o vermelho iguais continua lendo "Atendido" e "Cancelado";
 * quem lê a tela por leitor de tela também, porque o ícone é decorativo e o
 * rótulo é conteúdo de verdade.
 *
 * O tom `indisponivel` existe para uma regra específica do comando: informação
 * que o sistema não apurou aparece como indisponível, nunca como zero. Ele é
 * cinza e tracejado de propósito — não é um estado do registro, é a ausência
 * de apuração sobre ele.
 */
export type TomSituacao =
  | 'neutro'
  | 'ativo'
  | 'sucesso'
  | 'atencao'
  | 'critico'
  | 'indisponivel';

const TOM: Record<TomSituacao, { classe: string; icone: ElementType }> = {
  neutro: { classe: 'bg-muted text-muted-foreground border-border', icone: CircleDot },
  ativo: { classe: 'bg-primary-tint text-primary border-success-line', icone: CircleDot },
  sucesso: { classe: 'bg-success-tint text-success-ink border-success-line', icone: CheckCircle2 },
  atencao: { classe: 'bg-warning-tint text-warning-ink border-warning-line', icone: Clock },
  critico: { classe: 'bg-destructive-tint text-destructive-ink border-destructive-line', icone: Ban },
  indisponivel: {
    classe: 'bg-muted/60 text-muted-foreground border-dashed border-border',
    icone: CircleDashed,
  },
};

interface SeloSituacaoProps {
  children: ReactNode;
  tom?: TomSituacao;
  /** Substitui o ícone do tom. */
  icone?: ElementType;
  /** Explicação curta do critério — vira `title` e rótulo acessível. */
  explicacao?: string;
  className?: string;
}

export default function SeloSituacao({
  children,
  tom = 'neutro',
  icone,
  explicacao,
  className,
}: SeloSituacaoProps) {
  const { classe, icone: IconePadrao } = TOM[tom];
  const Icone = icone ?? IconePadrao;
  return (
    <span
      className={cn(
        'g-meta inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium',
        classe,
        className,
      )}
      title={explicacao}
    >
      <Icone aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{children}</span>
    </span>
  );
}

/**
 * O caso mais comum do tom `indisponivel`, pronto: "—" com a razão ao lado.
 *
 * Existe porque a tentação, quando o número não veio, é escrever `0`. Zero é
 * uma afirmação sobre o registro ("não houve custo"); a ausência de apuração é
 * uma afirmação sobre o sistema ("ainda não conferimos"). Confundir as duas
 * fez o comando pedir a distinção por escrito.
 */
export function ValorIndisponivel({
  razao = 'Apuração a validar',
  className,
}: {
  razao?: string;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span aria-hidden="true" className="text-muted-foreground">
        —
      </span>
      <span className="sr-only">Indisponível.</span>
      <span className="g-meta inline-flex items-center gap-1 text-warning-ink">
        <HelpCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        {razao}
      </span>
    </span>
  );
}

/**
 * A falha de carga, com a mensagem real e o caminho de volta.
 *
 * Existe porque a correção de 13/09 — que tirou o `error` descartado de sete
 * telas — produziu sete variações do mesmo bloco, e todas quebravam igual no
 * celular: mensagem e botão na mesma linha, o texto encolhendo até uma palavra
 * por linha enquanto o botão não cedia um pixel.
 *
 * Duas regras que o princípio 3 do CLAUDE.md exige e que é fácil perder:
 * mostrar a mensagem REAL do banco (não "erro ao carregar"), e oferecer o
 * retry no mesmo lugar. Quem lê "No suitable key or wrong key type" pode
 * procurar ajuda; quem lê "verifique sua conexão" vai reiniciar o roteador.
 */
export function AvisoDeFalha({
  children,
  aoTentarNovamente,
  rotulo = 'Tentar novamente',
  className,
}: {
  children: ReactNode;
  aoTentarNovamente?: () => void;
  rotulo?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-start gap-3 rounded-[var(--g-raio)] border border-destructive-line bg-destructive-tint px-4 py-3',
        'sm:flex-row sm:items-center',
        className,
      )}
    >
      <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0 text-destructive-ink" />
      <p className="g-corpo min-w-0 flex-1 text-destructive-ink">{children}</p>
      {aoTentarNovamente && (
        <button
          type="button"
          onClick={aoTentarNovamente}
          className="g-corpo g-controle inline-flex shrink-0 items-center gap-1.5 rounded-[var(--g-raio)] border border-destructive-line bg-card px-3 font-medium text-destructive-ink transition-colors hover:bg-destructive-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:w-full max-sm:justify-center"
        >
          <RotateCw aria-hidden="true" className="h-4 w-4" />
          {rotulo}
        </button>
      )}
    </div>
  );
}

/** Alerta curto de linha, para pendência que precisa de ação no contexto. */
export function AvisoDeContexto({
  titulo,
  children,
  acao,
  className,
}: {
  titulo: ReactNode;
  children?: ReactNode;
  acao?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        // Empilha no celular: com o botão ao lado, a mensagem ficava com uma
        // palavra por linha e o aviso virava uma coluna de texto.
        'flex flex-col items-start gap-3 rounded-[var(--g-raio)] border border-warning-line bg-warning-tint px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center',
        className,
      )}
    >
      <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0 text-warning-ink" />
      <div className="min-w-0 flex-1">
        <p className="g-corpo font-semibold text-warning-ink">{titulo}</p>
        {children && <p className="g-corpo text-warning-ink/90">{children}</p>}
      </div>
      {acao && <div className="shrink-0 max-sm:w-full [&>*]:max-sm:w-full">{acao}</div>}
    </div>
  );
}
