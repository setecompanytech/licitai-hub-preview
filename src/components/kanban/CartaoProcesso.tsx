import { forwardRef, type PointerEvent as ReactPointerEvent } from 'react';
import { AlertTriangle, Calendar, ChevronRight, GripVertical, MapPin, Pencil, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { identidadeDoProcesso, objetoLegivel } from '@/lib/licitacao/identidade-do-processo';
import { normalizarStatus, STATUS_DECIDIDOS, type StatusProcesso } from '@/lib/licitacao/status';
import {
  COLUNAS,
  colunaDe,
  diasAtePrazo,
  formatarValor,
  pendenciasDoProcesso,
  type ProcessoDoQuadro,
} from './colunas';

/**
 * O cartão do quadro — compacto por padrão, completo a um clique.
 *
 * A composição exigida pelo comando de 13/09 é "processo, órgão, prazo,
 * responsável e pendências". Todos cabem em três linhas de ~70px porque as
 * pontas direitas trabalham: valor e prazo são critérios de VARREDURA ("qual
 * vale a pena? qual vence antes?") e ficam alinhados à direita, não escondidos
 * no estado aberto.
 *
 * Aberto, o cartão acrescenta o objeto inteiro, o local, o desfecho de um
 * processo arquivado e as duas ações — entre elas o menu "Mover", que é a
 * alternativa ao arrasto e por isso nunca é opcional.
 */
export interface CartaoProcessoProps {
  lic: ProcessoDoQuadro;
  aberto: boolean;
  /** Este cartão é o que está sendo arrastado agora. */
  arrastando: boolean;
  /** Veio de `?focus=<id>` — recebe anel e rolagem até ele. */
  focado: boolean;
  /** Nome de quem responde pelo processo; `null` enquanto os perfis não chegam. */
  responsavel: string | null;
  /**
   * Em tela estreita o arrasto não existe (uma coluna por vez não tem destino),
   * e é preciso devolver o gesto de rolar: com `touch-none` no cartão, arrastar
   * o dedo sobre ele não move a lista.
   */
  podeArrastar: boolean;
  onPointerDown: (e: ReactPointerEvent) => void;
  onAlternar: () => void;
  onEditar: () => void;
  onMover: (destino: StatusProcesso) => void;
}

/** Rótulo do prazo: data curta e, quando aperta, quantos dias faltam. */
function textoDoPrazo(iso: string | null): { texto: string; urgente: boolean; vencido: boolean } | null {
  if (!iso) return null;
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return null;
  const curta = data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const dias = diasAtePrazo(iso);
  if (dias === null) return { texto: curta, urgente: false, vencido: false };
  if (dias < 0) return { texto: curta, urgente: false, vencido: true };
  // A contagem em dias entra como TEXTO, não como cor: quem não distingue o
  // vermelho do cinza continua lendo "hoje" e "2d".
  if (dias <= 3) return { texto: `${curta} · ${dias === 0 ? 'hoje' : `${dias}d`}`, urgente: true, vencido: false };
  return { texto: curta, urgente: false, vencido: false };
}

const CartaoProcesso = forwardRef<HTMLDivElement, CartaoProcessoProps>(function CartaoProcesso(
  { lic, aberto, arrastando, focado, responsavel, podeArrastar, onPointerDown, onAlternar, onEditar, onMover },
  ref,
) {
  const etapa = colunaDe(lic);
  const prazo = textoDoPrazo(lic.data_encerramento);
  const pendencias = pendenciasDoProcesso(lic);
  const arquivadoComDesfecho =
    lic.arquivado_em && STATUS_DECIDIDOS.includes(normalizarStatus(lic.status));

  /** Botões e itens de menu não alternam o cartão — o React faz o evento de
   *  dentro do portal do dropdown borbulhar até aqui. */
  const dentroDeControle = (alvo: EventTarget | null) =>
    Boolean((alvo as HTMLElement | null)?.closest('button, a, input, [role="menuitem"], [role="menu"]'));

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-expanded={aberto}
      className={cn(
        'g-cartao bg-card p-3 transition-[box-shadow,opacity] hover:shadow-md select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        podeArrastar && 'touch-none',
        arrastando ? 'opacity-30 cursor-grabbing' : 'cursor-pointer',
        aberto && 'border-primary/40',
        focado && 'ring-2 ring-ring border-primary/50',
      )}
      onPointerDown={onPointerDown}
      /* Três gestos no mesmo cartão, sem conflito:
         - clique (em qualquer ponto) abre/recolhe;
         - duplo clique abre o processo — `detail > 1` deixa o segundo clique
           passar em branco, senão ele desfaria o primeiro e o cartão piscaria;
         - arrasto move, e o `click` que o navegador dispara ao soltar é
           ignorado pelo `arrastouRef` de quem monta o quadro. */
      onClick={(e) => {
        if (e.detail > 1) return;
        if (dentroDeControle(e.target)) return;
        onAlternar();
      }}
      onDoubleClick={(e) => {
        if (dentroDeControle(e.target)) return;
        onEditar();
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter') { e.preventDefault(); onEditar(); }
        if (e.key === ' ') { e.preventDefault(); onAlternar(); }
      }}
      title={aberto ? 'Clique para recolher · duplo clique abre o processo' : 'Clique para ver mais · duplo clique abre o processo'}
    >
      <div className="flex items-start gap-2">
        {podeArrastar && (
          <GripVertical className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground/40" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          {/* Linha 1 — processo à esquerda, VALOR à direita. */}
          <div className="flex min-w-0 items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold tabular-nums" title={lic.modalidade ?? undefined}>
              {identidadeDoProcesso(lic)}
            </span>
            {lic.valor_estimado ? (
              <span className="shrink-0 text-sm font-semibold tabular-nums">{formatarValor(lic.valor_estimado)}</span>
            ) : null}
          </div>

          {/* Linha 2 — ÓRGÃO à esquerda, PRAZO à direita. */}
          <div className="flex min-w-0 items-center justify-between gap-2">
            <p className="truncate g-meta text-muted-foreground" title={lic.orgao ?? undefined}>
              {lic.orgao || '—'}
            </p>
            {prazo && (
              <span
                className={cn(
                  'g-meta shrink-0 tabular-nums',
                  prazo.urgente ? 'font-semibold text-destructive-ink'
                    : prazo.vencido ? 'text-muted-foreground line-through'
                    : 'text-muted-foreground',
                )}
                title={`Encerramento: ${new Date(lic.data_encerramento as string).toLocaleDateString('pt-BR')}`}
              >
                {prazo.texto}
              </span>
            )}
          </div>

          {/* Linha 3 — RESPONSÁVEL e PENDÊNCIAS, a informação que diz de quem é
              a próxima ação. Some quando não há nada a dizer, para o cartão de
              um processo em dia continuar com duas linhas. */}
          {(responsavel || pendencias.length > 0) && (
            <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              {responsavel && (
                <span className="g-meta inline-flex min-w-0 items-center gap-1 text-muted-foreground">
                  <User className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{responsavel}</span>
                </span>
              )}
              {pendencias.map((p) => (
                <Badge
                  key={p.chave}
                  variant={p.tom === 'critico' ? 'danger' : 'warning'}
                  className="gap-1 px-1.5 py-0"
                  title={p.explicacao}
                >
                  <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                  {p.rotulo}
                </Badge>
              ))}
            </div>
          )}

          {aberto && (
            <>
              {/* Aberto, o objeto vem INTEIRO — o cartão já está expandido;
                  truncar aqui seria esconder de quem acabou de pedir. */}
              <p className="mt-2 text-sm font-medium [overflow-wrap:anywhere]">{objetoLegivel(lic.objeto)}</p>
              {arquivadoComDesfecho && (
                <span className="mt-1 inline-block g-meta text-muted-foreground">
                  desfecho: <span className="font-medium text-foreground">{normalizarStatus(lic.status)}</span>
                </span>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-3 g-meta text-muted-foreground">
                {lic.municipio && lic.uf && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                    {lic.municipio}/{lic.uf}
                  </span>
                )}
                {lic.data_encerramento && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" aria-hidden="true" />
                    {new Date(lic.data_encerramento).toLocaleDateString('pt-BR')}
                  </span>
                )}
              </div>

              {/* Ações do cartão aberto. O menu "Mover" é a alternativa
                  acessível ao arrasto — ela não some em nenhuma largura de
                  tela, e no celular é o único caminho. */}
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <Button
                  type="button"
                  size="sm"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onEditar(); }}
                >
                  <Pencil aria-hidden="true" />
                  Abrir processo
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      title="Mover para outra etapa"
                    >
                      Mover
                      <ChevronRight aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-44">
                    {COLUNAS.filter((c) => c.id !== etapa).map((c) => (
                      <DropdownMenuItem key={c.id} onClick={() => onMover(c.id)}>
                        <span className={cn('mr-2 h-2 w-2 shrink-0 rounded-full', c.cor.ponto)} aria-hidden="true" />
                        {c.title}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

export default CartaoProcesso;
