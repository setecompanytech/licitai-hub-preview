import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertTriangle, ArrowRight, CalendarDays, ChevronRight, FileText, Gavel, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { badgeVariants } from '@/components/ui/badge';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { cn } from '@/lib/utils';
import { normalizarStatus, STATUS_DECIDIDOS } from '@/lib/licitacao/status';
import { diaDaValidade, diasAteVencer, ROTULO_DA_SITUACAO } from '@/lib/documentos/situacao';
import { useVencimentosDeDocumentos, ROTA_DA_ORIGEM } from '@/hooks/useVencimentosDeDocumentos';

/**
 * Agenda e pendências — o que tem data, ordenado pelo que aperta primeiro.
 *
 * ── AS TRÊS SITUAÇÕES DE PRAZO, QUE O PAINEL ANTIGO NÃO SEPARAVA ─────────
 *
 *   atrasado   a data efetiva já passou e o processo continua em aberto
 *   hoje       acontece HOJE — a única faixa em que ainda dá para agir a tempo
 *   futuro     tem prazo, entra no planejamento
 *
 * A distinção é feita por DIA de calendário, não por instante: uma sessão às
 * 9h continua sendo "hoje" às 11h, e um documento que vale o dia inteiro não
 * pode aparecer como vencido na primeira hora da manhã.
 *
 * Os processos vêm por prop, das linhas que `useAnalyticsData` já baixou para
 * os indicadores — uma consulta a menos. Os vencimentos vêm do hook
 * compartilhado com a faixa de pendências e com o calendário.
 *
 * Processo já decidido ou arquivado não vira atraso: o prazo dele passou
 * porque ele terminou.
 */

export interface ProcessoDaAgenda {
  id: string;
  numero: string | null;
  orgao: string | null;
  status: string | null;
  data_abertura: string | null;
  data_encerramento: string | null;
}

interface Props {
  processos: ProcessoDaAgenda[];
  carregandoProcessos: boolean;
  erroProcessos?: string | null;
  aoRecarregarProcessos?: () => void;
}

type Urgencia = 'atrasado' | 'hoje' | 'futuro';

interface ItemDaAgenda {
  chave: string;
  titulo: string;
  contexto: string;
  quando: Date;
  /** O que a data significa: "Sessão", "Encerramento", "Validade". */
  natureza: string;
  urgencia: Urgencia;
  /** Dias até a data — negativo = atraso. */
  dias: number;
  para: string;
  icone: typeof Gavel;
  selo: string;
}

/** Quantos itens a agenda do painel mostra antes de mandar para a agenda cheia. */
const LIMITE = 6;

/** Janelas: 30 dias para frente (planejamento) e 30 para trás (o que ficou). */
const DIAS_A_FRENTE = 30;
const DIAS_ATRAS = 30;

const PELE: Record<Urgencia, { linha: string; selo: 'danger' | 'warning' | 'muted'; rotulo: string }> = {
  atrasado: { linha: 'border-destructive-line bg-destructive-tint', selo: 'danger', rotulo: 'Atrasado' },
  hoje: { linha: 'border-warning-line bg-warning-tint', selo: 'warning', rotulo: 'Hoje' },
  futuro: { linha: 'border-border bg-card hover:bg-muted', selo: 'muted', rotulo: 'Programado' },
};

/** Dia de calendário de uma data com hora — é o que decide atraso/hoje/futuro. */
function diasDeCalendario(iso: string): number {
  const d = new Date(iso);
  const alvo = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const agora = new Date();
  const base = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();
  return Math.round((alvo - base) / 86400000);
}

const urgenciaDe = (dias: number): Urgencia => (dias < 0 ? 'atrasado' : dias === 0 ? 'hoje' : 'futuro');

export default function AgendaPendencias({
  processos, carregandoProcessos, erroProcessos, aoRecarregarProcessos,
}: Props) {
  const { documentos, carregando: carregandoDocs, erro: erroDocs, recarregar: recarregarDocs } =
    useVencimentosDeDocumentos();

  const itens = useMemo(() => {
    const lista: ItemDaAgenda[] = [];

    processos.forEach((p) => {
      const situacao = normalizarStatus(p.status);
      const encerrado = STATUS_DECIDIDOS.includes(situacao) || situacao === 'Arquivada';

      ([
        { campo: p.data_abertura, natureza: 'Sessão' },
        { campo: p.data_encerramento, natureza: 'Encerramento' },
      ] as const).forEach(({ campo, natureza }) => {
        if (!campo) return;
        const dias = diasDeCalendario(campo);
        if (dias > DIAS_A_FRENTE || dias < -DIAS_ATRAS) return;
        // Processo decidido não tem prazo pendente — o dele passou porque
        // terminou. Marcá-lo como atraso encheria a agenda de falso alarme.
        if (encerrado && dias < 0) return;
        lista.push({
          chave: `${p.id}-${natureza}`,
          titulo: p.numero || 'Processo sem número',
          contexto: p.orgao || 'Órgão não informado',
          quando: new Date(campo),
          natureza,
          urgencia: urgenciaDe(dias),
          dias,
          para: `/processo/${p.id}`,
          icone: Gavel,
          selo: PELE[urgenciaDe(dias)].rotulo,
        });
      });
    });

    documentos.forEach((d) => {
      if (d.situacao === 'ok') return;
      const dias = diasAteVencer(d.validade) ?? 0;
      lista.push({
        chave: `doc-${d.id}`,
        titulo: d.nome,
        contexto: ROTULO_DA_SITUACAO[d.situacao],
        quando: diaDaValidade(d.validade),
        natureza: 'Validade',
        urgencia: urgenciaDe(dias),
        dias,
        para: ROTA_DA_ORIGEM[d.origem],
        icone: FileText,
        selo: ROTULO_DA_SITUACAO[d.situacao],
      });
    });

    // O que já estourou primeiro, do mais antigo para o mais recente; depois
    // hoje; depois o futuro em ordem de chegada.
    const ordem: Record<Urgencia, number> = { atrasado: 0, hoje: 1, futuro: 2 };
    return lista.sort(
      (a, b) => ordem[a.urgencia] - ordem[b.urgencia] || a.quando.getTime() - b.quando.getTime(),
    );
  }, [processos, documentos]);

  const carregando = carregandoProcessos || carregandoDocs;

  if (carregando) {
    return (
      <div role="status" aria-busy="true" className="space-y-2 rounded-xl border border-border bg-card p-5 shadow-sm">
        <span className="sr-only">Carregando a agenda</span>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  type Falha = { rotulo: string; mensagem: string; recarregar?: () => void };
  const falhas: Falha[] = ([
    erroProcessos ? { rotulo: 'Processos', mensagem: erroProcessos, recarregar: aoRecarregarProcessos } : null,
    erroDocs ? { rotulo: 'Vencimentos de documentos', mensagem: erroDocs.message, recarregar: recarregarDocs } : null,
  ] as (Falha | null)[]).filter((f): f is Falha => f !== null);

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      {/* Erro antes do conteúdo: o que está faltando precisa ser lido antes do
          que a tela conseguiu montar — senão a lista curta passa por completa. */}
      {falhas.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-destructive-line bg-destructive-tint p-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive-ink" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm leading-5 text-destructive-ink">
            Agenda incompleta —{' '}
            {falhas.map((f) => `${f.rotulo}: ${f.mensagem}`).join(' · ')}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => falhas.forEach((f) => f.recarregar?.())}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Tentar novamente
          </Button>
        </div>
      )}

      {itens.length === 0 ? (
        <EstadoVazio
          tamanho="compacto"
          icone={<CalendarDays />}
          titulo="Nenhum prazo nos próximos 30 dias"
          descricao="Sessões, encerramentos e validades aparecem aqui assim que tiverem data."
          acao={
            <Button variant="outline" asChild>
              <Link to="/calendario">Abrir a agenda</Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {itens.slice(0, LIMITE).map((item) => (
            <li key={item.chave}>
              {/* A linha inteira abre o REGISTRO. Agenda que só narra obriga a
                  procurar o mesmo processo de novo em outra tela. */}
              <Link
                to={item.para}
                className={cn(
                  'group flex items-center gap-3 rounded-lg border p-3 transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  PELE[item.urgencia].linha,
                )}
              >
                <item.icone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold leading-6 group-hover:underline">
                    {item.titulo}
                  </span>
                  <span className="block truncate text-sm leading-5 text-muted-foreground">
                    {item.natureza} · {format(item.quando, "dd 'de' MMM", { locale: ptBR })} · {item.contexto}
                  </span>
                </span>
                <span className={cn(badgeVariants({ variant: PELE[item.urgencia].selo }), 'shrink-0')}>
                  {item.selo}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        {itens.length > LIMITE && (
          <p className="text-sm leading-5 text-muted-foreground">
            +{itens.length - LIMITE} com data nos próximos 30 dias
          </p>
        )}
        <Link
          to="/calendario"
          className="ml-auto inline-flex items-center gap-1 rounded-sm text-sm font-medium leading-5 text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Ver agenda completa
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
