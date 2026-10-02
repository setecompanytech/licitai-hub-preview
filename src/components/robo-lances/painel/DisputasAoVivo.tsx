import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, Hand, Pause, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { disputasAoVivo, type DisputaParaResumir, type ResumoDaDisputa } from '@/lib/robo/disputas-ao-vivo';

/**
 * AS DISPUTAS EM CURSO, LADO A LADO.
 *
 * Pedido do Ian em 02/10/2026: *"não sei como isso será quando o robô conseguir
 * entrar em vários pregões ao mesmo tempo futuramente, tudo isso tem que ser
 * pensado"*.
 *
 * O agente aguenta quatro simultâneas, e a operação descreve manhãs com mais de
 * um pregão como rotina. Com várias no ar, **quatro abas para alternar é o
 * desenho errado**: a pessoa precisaria adivinhar em qual olhar. Aqui elas
 * ficam juntas, ordenadas por quem precisa de atenção AGORA.
 *
 * Duas decisões que valem a pena:
 *
 * 1. **O cartão diz POR QUE está naquela posição** ("perdendo em 2 itens · o
 *    mais apertado fecha em 01:35"). Uma lista ordenada por um número invisível
 *    é uma lista em que ninguém confia — a pessoa precisa poder conferir se
 *    concorda com a ordem.
 * 2. **Esperar uma pessoa vem antes de qualquer cronômetro.** Aí o robô não
 *    está trabalhando: ele parou, e só um clique o destrava. Nenhum tempo
 *    restante é mais urgente que isso.
 */
export default function DisputasAoVivo({ disputas }: { disputas: DisputaParaResumir[] }) {
  const [agora, setAgora] = useState(() => new Date());

  const temAlgumaViva = disputas.some((d) => ['ativo', 'enviando', 'pausado'].includes(String(d.status)));

  useEffect(() => {
    if (!temAlgumaViva) return;
    const id = window.setInterval(() => setAgora(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [temAlgumaViva]);

  const resumos = useMemo(() => disputasAoVivo(disputas, agora), [disputas, agora]);
  const emCurso = resumos.filter((r) => r.viva);

  if (emCurso.length === 0) return null;

  return (
    <section aria-label="Disputas em curso" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="g-titulo-secao text-foreground">
          {emCurso.length === 1 ? '1 disputa em curso' : `${emCurso.length} disputas em curso`}
        </h3>
        {emCurso.length > 1 && (
          <span className="g-meta text-muted-foreground">em ordem de quem precisa de atenção agora</span>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {emCurso.map((r) => (
          <CartaoDaDisputa key={r.id} resumo={r} />
        ))}
      </div>
    </section>
  );
}

function CartaoDaDisputa({ resumo: r }: { resumo: ResumoDaDisputa }) {
  const apertado = r.menorTempo?.confiavel && (r.menorTempo.segundos ?? Infinity) <= 30;
  const destaque = r.esperandoPessoa
    ? 'border-destructive-line bg-destructive-surface'
    : apertado
      ? 'border-warning-line'
      : 'border-border';

  const conteudo = (
    <article className={`g-cartao flex flex-col gap-1.5 border p-3 ${destaque}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">{r.edital ?? 'Sem edital'}</span>
          {r.orgao && <span className="g-meta text-muted-foreground line-clamp-1">{r.orgao}</span>}
        </div>
        {r.esperandoPessoa ? (
          <Badge variant="destructive" className="shrink-0">
            <Hand className="w-3 h-3" aria-hidden="true" /> Precisa de você
          </Badge>
        ) : r.pausada ? (
          <Badge variant="muted" className="shrink-0">
            <Pause className="w-3 h-3" aria-hidden="true" /> Pausado
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {r.menorTempo?.texto && (
          <span
            className={`inline-flex items-center gap-1 tabular-nums ${apertado ? 'font-semibold text-destructive-ink' : 'text-muted-foreground'}`}
            title={r.menorTempo.confiavel ? 'O item que fecha primeiro' : 'Leitura antiga — o tempo real pode ser menor'}
          >
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            {r.menorTempo.texto}
            {!r.menorTempo.confiavel && <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />}
          </span>
        )}
        {r.emDisputa > 0 && (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            {r.perdendo > 0 ? (
              <><ThumbsDown className="w-3.5 h-3.5 text-destructive-ink" aria-hidden="true" />{r.perdendo} de {r.emDisputa}</>
            ) : (
              <><ThumbsUp className="w-3.5 h-3.5 text-success-ink" aria-hidden="true" />{r.emDisputa} item(ns)</>
            )}
          </span>
        )}
        {r.encerrados > 0 && (
          <span className="g-meta text-muted-foreground">{r.encerrados} encerrado(s)</span>
        )}
      </div>

      {/* A frase que explica a posição do cartão — ver o cabeçalho do arquivo. */}
      <p className="g-meta text-muted-foreground">{r.porque}</p>
    </article>
  );

  // Sem processo vinculado não há para onde ir; o cartão continua informando.
  return r.licitacaoId ? (
    <Link to={`/robo-lances/disputa/${r.id}`} className="g-foco rounded-lg">
      {conteudo}
    </Link>
  ) : (
    conteudo
  );
}
