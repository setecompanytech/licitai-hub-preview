import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { dataHoraDeBrasilia } from '@/components/workspace/robo/formatos';
import type { SessaoCarregada } from '@/hooks/useParticipacoesDoRobo';
import {
  concorrentesNoQuadro,
  itensDoQuadro,
  posicaoNoQuadro,
  tempoRestanteAgora,
  urgenciaDoItem,
  type EstadoNoQuadro,
} from '@/lib/robo/quadro-da-sala';

/**
 * A SALA, AO VIVO, DENTRO DO PRAEFECTUS.
 *
 * Diretriz do Ian (02/10/2026): a tela remota existe para **passar pelo bloqueio
 * da plataforma** — o captcha, o clique no certificado —, e não para ser o lugar
 * onde se acompanha a disputa. Se para saber como o pregão vai for preciso
 * olhar o VNC, o robô não resolveu o problema de quem opera: mudou a tela em
 * que a pessoa passa a manhã.
 *
 * O que esta tabela mostra é o que a operação olha no portal, e foi descrito na
 * reunião de 01/10: o cronômetro de cada item correndo, o melhor valor mudando,
 * a nossa colocação, quantos concorrentes de fato lançaram, e o que o robô está
 * fazendo em cada item.
 *
 * DUAS HONESTIDADES QUE A TELA PRECISA TER, e que são o grosso deste arquivo:
 *
 * 1. **O cronômetro é estimado.** O número chega do robô com alguns segundos de
 *    atraso; aqui ele é recalculado a cada segundo a partir da hora da leitura.
 *    Passada a idade máxima, para de descontar e aparece em cinza com a hora ao
 *    lado — um cronômetro estimado sobre leitura velha é pior que nenhum.
 * 2. **A ordem é a de quem disputa**: perdendo com o relógio acabando primeiro,
 *    encerrados no fim. Com 182 itens, mostrar tudo com o mesmo peso é o mesmo
 *    que não mostrar nada.
 */

const STATUS_DE_SESSAO_VIVA = ['ativo', 'enviando', 'pausado'];

const moeda = (v: number | null | undefined) =>
  typeof v === 'number' && Number.isFinite(v)
    ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 })
    : '—';

const ROTULO_DA_FASE: Record<string, string> = {
  aguardando: 'Aguardando abrir',
  aberta: 'Etapa aberta',
  encerramento_aleatorio: 'Encerramento aleatório',
  fechada: 'Lance final fechado',
  desempate_me_epp: 'Desempate ME/EPP',
  suspensa: 'Suspensa',
  encerrada: 'Encerrada',
};

export default function SalaAoVivo({ sessao }: { sessao: SessaoCarregada | null }) {
  // O relógio local: um tique por segundo, só enquanto há o que mostrar.
  const [agora, setAgora] = useState(() => new Date());

  const bruto = sessao as (SessaoCarregada & {
    estado_sala?: EstadoNoQuadro | null;
    estado_sala_em?: string | null;
    status?: string | null;
  }) | null;

  const viva = !!bruto && STATUS_DE_SESSAO_VIVA.includes(String(bruto.status));
  const temEstado = !!bruto?.estado_sala;

  useEffect(() => {
    if (!viva || !temEstado) return;
    const id = window.setInterval(() => setAgora(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [viva, temEstado]);

  const linhas = useMemo(() => {
    if (!bruto?.estado_sala) return [];
    return itensDoQuadro(bruto.estado_sala)
      .map((estado) => {
        const tempo = tempoRestanteAgora(estado.segundos_restantes, bruto.estado_sala_em, agora);
        return { estado, tempo, urgencia: urgenciaDoItem(estado, tempo) };
      })
      .sort((a, b) => b.urgencia - a.urgencia || (Number(a.estado.item) || 0) - (Number(b.estado.item) || 0));
  }, [bruto?.estado_sala, bruto?.estado_sala_em, agora]);

  if (!bruto || !temEstado) return null;

  const quando = dataHoraDeBrasilia(bruto.estado_sala_em, { segundos: true });
  const algumEstimado = linhas.some((l) => l.tempo.segundos !== null && !l.tempo.confiavel);

  return (
    <section aria-label="A sala, ao vivo" className="g-cartao flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="g-titulo-secao text-foreground">
          {viva ? 'A sala, agora' : 'A sala na última leitura'}
        </h3>
        {quando && (
          <span className="g-meta text-muted-foreground">
            lido às {quando} • Brasília
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-center">Item</TableHead>
              <TableHead className="w-28">Etapa</TableHead>
              <TableHead className="w-24 text-right">Tempo</TableHead>
              <TableHead className="text-right">Melhor</TableHead>
              <TableHead className="text-right">Nosso</TableHead>
              <TableHead className="w-44">Posição</TableHead>
              <TableHead>O que o robô está fazendo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map(({ estado, tempo }) => {
              const encerrado = estado.fase === 'encerrada';
              const perdendo = estado.sou_lider === false;
              const apertado = tempo.confiavel && tempo.segundos !== null && tempo.segundos <= 30 && !encerrado;
              const posicao = posicaoNoQuadro(estado);
              const concorrentes = concorrentesNoQuadro(estado);

              return (
                <TableRow key={String(estado.item ?? 'unico')} className={encerrado ? 'opacity-60' : undefined}>
                  <TableCell className="text-center tabular-nums font-medium">{estado.item ?? '—'}</TableCell>

                  <TableCell className="text-sm text-muted-foreground">
                    {estado.fase ? ROTULO_DA_FASE[estado.fase] ?? estado.fase : '—'}
                  </TableCell>

                  <TableCell className="text-right">
                    {tempo.texto ? (
                      <span
                        className={[
                          'inline-flex items-center gap-1 tabular-nums',
                          apertado ? 'font-semibold text-destructive-ink' : '',
                          !tempo.confiavel ? 'text-muted-foreground' : '',
                        ].join(' ')}
                        title={
                          tempo.confiavel
                            ? 'Estimado a partir da última leitura do robô'
                            : `Leitura de ${tempo.idadeDaLeitura ?? '?'}s atrás — tempo real pode ser menor`
                        }
                      >
                        <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                        {tempo.texto}
                        {!tempo.confiavel && <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell className="text-right tabular-nums text-sm">{moeda(estado.melhor_lance)}</TableCell>

                  <TableCell className="text-right tabular-nums text-sm">
                    <span className={perdendo ? 'text-destructive-ink' : undefined}>{moeda(estado.nosso_lance)}</span>
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="inline-flex items-center gap-1 text-sm">
                        {estado.sou_lider === true && <ThumbsUp className="w-3.5 h-3.5 text-success-ink" aria-hidden="true" />}
                        {perdendo && <ThumbsDown className="w-3.5 h-3.5 text-destructive-ink" aria-hidden="true" />}
                        {posicao ?? <span className="text-muted-foreground">—</span>}
                      </span>
                      {concorrentes && <span className="g-meta text-muted-foreground">{concorrentes}</span>}
                    </div>
                  </TableCell>

                  <TableCell className="text-sm text-muted-foreground">
                    {estado.decisao?.motivo_legivel || estado.decisao?.motivo || '—'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!viva && <Badge variant="muted">Sessão encerrada — esta é a última leitura</Badge>}
        {bruto.status === 'pausado' && <Badge variant="muted">Robô pausado nesta disputa</Badge>}
        {algumEstimado && (
          <span className="g-meta text-muted-foreground">
            ⚠️ O robô não lê a sala há mais de 2 minutos: os tempos em cinza são da última leitura, não de agora.
          </span>
        )}
      </div>
    </section>
  );
}
