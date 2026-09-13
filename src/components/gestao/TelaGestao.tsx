import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * TelaGestao — o cabeçalho e a moldura de toda tela do módulo Gestão.
 *
 * Anatomia fixada pelo comando de 13/09, de cima para baixo:
 *
 *   título 26/34 em 700  ·  selos de situação  ·  ações à direita
 *   descrição curta (uma linha)
 *   linha de contexto (origem, órgão, vigência — o que identifica o registro)
 *   abas
 *   ─────────────────────────────────────────────
 *   conteúdo
 *
 * Duas escolhas que o comando torna obrigatórias e que é fácil desfazer sem
 * perceber:
 *
 *  - A descrição é CURTA. Objeto de licitação com sete linhas no cabeçalho
 *    empurra a tabela para fora da primeira tela; ele pertence ao Resumo, com
 *    `TextoExpansivel`.
 *  - Uma ação principal por contexto. `acaoPrincipal` é uma só, à direita das
 *    secundárias — as referências nunca mostram dois botões verdes disputando
 *    a mesma atenção.
 *
 * Este componente não é `CabecalhoPagina`: aquele serve às telas de menu, puxa
 * título e trilha do registro `paginas.ts` e trabalha na escala de leitura do
 * app. Aqui a escala é a de sistema (`g-*`), o título costuma ser o
 * IDENTIFICADOR de um registro — "Contrato 068/2025" —, e a trilha mora na
 * faixa superior, não na tela.
 */
interface TelaGestaoProps {
  titulo: ReactNode;
  /** Uma linha. Objeto extenso vai para o Resumo, não para cá. */
  descricao?: ReactNode;
  /** Selos ao lado do título: situação do registro, vínculo de origem. */
  selos?: ReactNode;
  /** Identificação do registro abaixo do título: origem, órgão, vigência. */
  contexto?: ReactNode;
  /** Botões discretos — vêm antes da ação principal. */
  acoesSecundarias?: ReactNode;
  /** A única ação destacada do contexto. */
  acaoPrincipal?: ReactNode;
  /** Abas, logo abaixo do cabeçalho. */
  abas?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function TelaGestao({
  titulo,
  descricao,
  selos,
  contexto,
  acoesSecundarias,
  acaoPrincipal,
  abas,
  children,
  className,
}: TelaGestaoProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-4', className)}>
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="g-titulo-pagina min-w-0 text-foreground">{titulo}</h1>
              {selos}
            </div>
            {descricao && <p className="g-corpo text-muted-foreground">{descricao}</p>}
            {contexto && (
              <div className="g-corpo flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                {contexto}
              </div>
            )}
          </div>

          {(acoesSecundarias || acaoPrincipal) && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {acoesSecundarias}
              {acaoPrincipal}
            </div>
          )}
        </div>
      </header>

      {abas}

      {children}
    </div>
  );
}

/**
 * Seção nomeada dentro de uma tela — o "Contratos derivados (2)" das
 * referências, com a ação da seção na mesma linha do título.
 */
export function SecaoGestao({
  titulo,
  contagem,
  acoes,
  children,
  className,
}: {
  titulo: ReactNode;
  /** Vai entre parênteses ao lado do título, como nas referências. */
  contagem?: number;
  acoes?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('flex min-w-0 flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="g-titulo-secao text-foreground">
          {titulo}
          {typeof contagem === 'number' && (
            <span className="ml-1.5 font-normal text-muted-foreground tabular-nums">
              ({contagem})
            </span>
          )}
        </h2>
        {acoes && <div className="flex shrink-0 items-center gap-2">{acoes}</div>}
      </div>
      {children}
    </section>
  );
}
