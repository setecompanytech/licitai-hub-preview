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
import { faixaDe, normalizarStatus, STATUS_DECIDIDOS } from '@/lib/licitacao/status';
import { identidadeDoProcesso } from '@/lib/licitacao/identidade-do-processo';
import { pendenciaDoEspelho } from '@/lib/licitacao/espelho-pncp';
import { diaDaValidade, diasAteVencer, ROTULO_DA_SITUACAO } from '@/lib/documentos/situacao';
import { useVencimentosDeDocumentos, ROTA_DA_ORIGEM } from '@/hooks/useVencimentosDeDocumentos';
import { useSituacaoDoEspelhoPNCP } from '@/hooks/useSituacaoDoEspelhoPNCP';

/**
 * Agenda e pendências — o que tem data, ordenado pelo que aperta primeiro.
 *
 * ── AS SITUAÇÕES DE PRAZO — POR FASE, NÃO SÓ POR DATA ─────────────────────
 *
 * A data de encerramento é o fim do RECEBIMENTO DE PROPOSTAS, não o fim do
 * processo: depois dela vêm disputa, habilitação, recursos, homologação. O
 * painel dizia "Atrasado" para todo encerramento passado — e acusava de
 * atraso quem estava operando a disputa (dono, 19/09). O que a data passada
 * significa depende da FASE, que o status do processo declara
 * (`faixaDe`, em `lib/licitacao/status`):
 *
 *   hoje          acontece HOJE — a única faixa em que ainda dá para agir a tempo
 *   futuro        tem prazo, entra no planejamento ("Programado")
 *   andamento     a data passou e o processo está EM JOGO (Proposta Enviada,
 *                 Em Disputa): não é atraso, é o processo seguindo — neutro
 *   sem_situacao  a data passou e o processo segue no RADAR (Monitorando, Em
 *                 Análise): ninguém disse o que aconteceu — a ação é atualizar
 *                 a situação no Kanban (ou arquivar), e o selo pede isso
 *   vencido       documento com validade passada — atraso de verdade
 *
 * A distinção é feita por DIA de calendário, não por instante: uma sessão às
 * 9h continua sendo "hoje" às 11h, e um documento que vale o dia inteiro não
 * pode aparecer como vencido na primeira hora da manhã.
 *
 * Os processos vêm por prop, das linhas que `useAnalyticsData` já baixou para
 * os indicadores — uma consulta a menos. Os vencimentos vêm do hook
 * compartilhado com a faixa de pendências e com o calendário.
 *
 * Processo já decidido ou arquivado não entra: o prazo dele passou porque ele
 * terminou.
 */

export interface ProcessoDaAgenda {
  id: string;
  numero: string | null;
  /** Compõe a identidade do card ("PE nº 86/2026") junto com número e ano. */
  modalidade?: string | null;
  ano_compra?: string | null;
  orgao: string | null;
  status: string | null;
  data_abertura: string | null;
  data_encerramento: string | null;
  arquivado_em?: string | null;
  /** Chave do espelho PNCP — a situação da compra (revogada, anulada, suspensa) vem de lá. */
  numero_controle_pncp?: string | null;
}

interface Props {
  processos: ProcessoDaAgenda[];
  carregandoProcessos: boolean;
  erroProcessos?: string | null;
  aoRecarregarProcessos?: () => void;
}

type Urgencia = 'vencido' | 'espelho' | 'sem_situacao' | 'hoje' | 'futuro' | 'andamento';

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

const PELE: Record<Urgencia, { linha: string; selo: 'danger' | 'warning' | 'muted' | 'info'; rotulo: string }> = {
  vencido: { linha: 'border-destructive-line bg-destructive-tint', selo: 'danger', rotulo: 'Vencido' },
  /* O órgão tirou a compra do ar (espelho PNCP): a pessoa precisa registrar o
     desfecho ou conferir a suspensão. O selo da linha diz qual dos três. */
  espelho: { linha: 'border-warning-line bg-warning-tint', selo: 'warning', rotulo: 'Situação no PNCP' },
  sem_situacao: { linha: 'border-warning-line bg-warning-tint', selo: 'warning', rotulo: 'Situação a atualizar' },
  hoje: { linha: 'border-warning-line bg-warning-tint', selo: 'warning', rotulo: 'Hoje' },
  futuro: { linha: 'border-border bg-card hover:bg-muted', selo: 'muted', rotulo: 'Programado' },
  andamento: { linha: 'border-border bg-card hover:bg-muted', selo: 'info', rotulo: 'Em andamento' },
};

/** O que a data passada quer dizer, pela fase do processo. */
function urgenciaDoProcesso(dias: number, faixa: ReturnType<typeof faixaDe>): Urgencia {
  if (dias > 0) return 'futuro';
  if (dias === 0) return 'hoje';
  return faixa === 'em_jogo' ? 'andamento' : 'sem_situacao';
}

/** Como nomear a data quando ela já passou: "Encerramento" vira fato, não prazo. */
const NATUREZA_PASSADA: Record<'Sessão' | 'Encerramento', string> = {
  Sessão: 'Sessão realizada',
  Encerramento: 'Propostas encerradas',
};

/** Dia de calendário de uma data com hora — é o que decide atraso/hoje/futuro. */
function diasDeCalendario(iso: string): number {
  const d = new Date(iso);
  const alvo = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const agora = new Date();
  const base = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();
  return Math.round((alvo - base) / 86400000);
}

/** Documentos: validade passada é vencimento de verdade. */
const urgenciaDoDocumento = (dias: number): Urgencia => (dias < 0 ? 'vencido' : dias === 0 ? 'hoje' : 'futuro');

export default function AgendaPendencias({
  processos, carregandoProcessos, erroProcessos, aoRecarregarProcessos,
}: Props) {
  const { documentos, carregando: carregandoDocs, erro: erroDocs, recarregar: recarregarDocs } =
    useVencimentosDeDocumentos();

  /* Só o espelho dos processos abertos interessa: decidido e arquivado já não
     têm o que a agenda cobrar. Uma consulta em lote, não uma por processo. */
  const numerosAbertos = useMemo(
    () => processos
      .filter((p) => {
        const faixa = faixaDe(p.status ?? '', p.arquivado_em);
        return faixa === 'radar' || faixa === 'em_jogo';
      })
      .map((p) => p.numero_controle_pncp),
    [processos],
  );
  const { situacoes: espelho, erro: erroEspelho, recarregar: recarregarEspelho } =
    useSituacaoDoEspelhoPNCP(numerosAbertos);

  const itens = useMemo(() => {
    const lista: ItemDaAgenda[] = [];

    processos.forEach((p) => {
      const situacao = normalizarStatus(p.status);
      /* Arquivado saiu da mesa de trabalho: o prazo dele não é atraso nem
         compromisso. A regra está escrita no topo deste arquivo desde sempre,
         mas `arquivado_em` não vinha na consulta do painel — e a agenda
         cobrava "Atrasado" de processo que a própria empresa já encerrou. */
      const faixa = faixaDe(p.status ?? '', p.arquivado_em);
      if (faixa === 'arquivo') return;
      const decidido = STATUS_DECIDIDOS.includes(situacao);

      /* O espelho PNCP manda: compra revogada, anulada ou suspensa pelo órgão
         não tem prazo a cumprir nem andamento — tem um desfecho a registrar
         (ou uma suspensão a conferir). Entra no lugar das datas. Processo já
         decidido não precisa do aviso: o desfecho foi registrado. */
      const doEspelho = p.numero_controle_pncp ? espelho[p.numero_controle_pncp] : undefined;
      const pendencia = decidido ? null : pendenciaDoEspelho(doEspelho?.situacao);
      if (pendencia) {
        const quando = doEspelho?.atualizadoEm ? new Date(doEspelho.atualizadoEm) : new Date();
        lista.push({
          chave: `${p.id}-espelho`,
          titulo: identidadeDoProcesso(p),
          contexto: p.orgao || 'Órgão não informado',
          quando,
          natureza: pendencia.natureza,
          urgencia: 'espelho',
          dias: diasDeCalendario(quando.toISOString()),
          para: `/processo/${p.id}`,
          icone: Gavel,
          selo: pendencia.selo,
        });
        return;
      }

      ([
        { campo: p.data_abertura, natureza: 'Sessão' },
        { campo: p.data_encerramento, natureza: 'Encerramento' },
      ] as const).forEach(({ campo, natureza }) => {
        if (!campo) return;
        const dias = diasDeCalendario(campo);
        if (dias > DIAS_A_FRENTE || dias < -DIAS_ATRAS) return;
        // Processo decidido não tem prazo pendente — o dele passou porque
        // terminou. Marcá-lo como atraso encheria a agenda de falso alarme.
        if (decidido && dias < 0) return;
        const urgencia = urgenciaDoProcesso(dias, faixa);
        lista.push({
          chave: `${p.id}-${natureza}`,
          /* "86" não identifica nada: é o sequencial do PNCP, sem modalidade e
             sem ano. A autoridade de nomeação é a mesma do Kanban e do
             workspace — o painel escrevia o campo cru. */
          titulo: identidadeDoProcesso(p),
          contexto: p.orgao || 'Órgão não informado',
          quando: new Date(campo),
          natureza: dias < 0 ? NATUREZA_PASSADA[natureza] : natureza,
          urgencia,
          dias,
          para: `/processo/${p.id}`,
          icone: Gavel,
          selo: PELE[urgencia].rotulo,
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
        urgencia: urgenciaDoDocumento(dias),
        dias,
        para: ROTA_DA_ORIGEM[d.origem],
        icone: FileText,
        selo: ROTULO_DA_SITUACAO[d.situacao],
      });
    });

    // O que pede ação primeiro: documento vencido, compra que o órgão tirou do
    // ar, processo com situação a atualizar, depois hoje e o futuro em ordem
    // de chegada; o que está em andamento fecha a lista — é informação, não
    // pendência.
    const ordem: Record<Urgencia, number> = {
      vencido: 0, espelho: 1, sem_situacao: 2, hoje: 3, futuro: 4, andamento: 5,
    };
    return lista.sort(
      (a, b) => ordem[a.urgencia] - ordem[b.urgencia] || a.quando.getTime() - b.quando.getTime(),
    );
  }, [processos, documentos, espelho]);

  const carregando = carregandoProcessos || carregandoDocs;

  /* O que não coube na lista, contado por situação. O rodapé dizia "+26 com
     data nos próximos 30 dias" somando também o que já venceu — e o que venceu
     é passado, não próximo. */
  const naoListados = itens.slice(LIMITE);
  const contar = (u: Urgencia) => naoListados.filter((i) => i.urgencia === u).length;
  const partesDoRodape = [
    contar('vencido') > 0 && `${contar('vencido')} vencido(s)`,
    contar('espelho') > 0 && `${contar('espelho')} com situação no PNCP a tratar`,
    contar('sem_situacao') > 0 && `${contar('sem_situacao')} com situação a atualizar`,
    contar('hoje') + contar('futuro') > 0 && `${contar('hoje') + contar('futuro')} nos próximos 30 dias`,
    contar('andamento') > 0 && `${contar('andamento')} em andamento`,
  ].filter(Boolean) as string[];

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
    erroEspelho ? { rotulo: 'Espelho PNCP', mensagem: erroEspelho.message, recarregar: recarregarEspelho } : null,
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
        {naoListados.length > 0 && (
          <p className="text-sm leading-5 text-muted-foreground">
            +{naoListados.length} com prazo{partesDoRodape.map((p) => ` · ${p}`).join('')}
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
