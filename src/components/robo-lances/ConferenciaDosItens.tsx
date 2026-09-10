import { AlertTriangle, CheckCircle2, HelpCircle, Loader2, ScanSearch } from 'lucide-react';
import type { ConferenciaDeItens } from './usePedidosDoRobo';

/**
 * O que o robô achou ao comparar os itens que recebeu com os que o portal
 * publicou no processo.
 *
 * ─── POR QUE ISTO PRECISA DE TELA ──────────────────────────────────────────
 *
 * A conferência já vira mensagem no processo e notificação — mas as duas
 * chegam DEPOIS, e quem está olhando o painel enquanto o robô entra é
 * justamente quem ainda pode corrigir o cadastro. Aqui ela aparece em segundos.
 *
 * ─── OS QUATRO ESTADOS, E POR QUE NENHUM PODE SER COLAPSADO ────────────────
 *
 * 1. Ainda não conferiu — o robô está navegando. Não é "está tudo certo".
 * 2. Não conseguiu ler a lista do portal. Também não é "está tudo certo", e
 *    muito menos "os itens não existem": seria acusar o cadastro do operador
 *    por uma falha nossa de leitura.
 * 3. Confere.
 * 4. Não confere — e aí importa QUAL item, porque é isso que se corrige.
 *
 * Colapsar 1 e 2 em "ok" é o defeito que esta tela existe para não cometer.
 */
export default function ConferenciaDosItens({
  conferencia,
  edital,
}: {
  conferencia: ConferenciaDeItens | null | undefined;
  edital: string;
}) {
  // Estado 1 — o robô entrou e ainda está lendo a lista do portal.
  if (!conferencia) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground border border-border/50 rounded-lg px-3 py-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
        <span>Conferindo os itens contra o edital no portal…</span>
      </div>
    );
  }

  // Estado 2 — sem leitura, nada a afirmar.
  if (!conferencia.leu) {
    return (
      <div className="flex items-start gap-2 text-xs border border-border/50 bg-muted/30 rounded-lg px-3 py-2">
        <HelpCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-muted-foreground" />
        <div className="text-muted-foreground">
          <span className="font-medium text-foreground">Não deu para conferir os itens.</span>{' '}
          O robô não conseguiu ler a lista do portal neste processo. Isso não impede a sessão — só
          significa que a comparação não aconteceu.
        </div>
      </div>
    );
  }

  // Estado 3 — confere. Discreto de propósito: aviso verde grande a cada
  // sessão vira paisagem, e aí o vermelho também para de ser visto.
  if (conferencia.ok) {
    return (
      <div className="flex items-center gap-2 text-xs border border-success/25 bg-success/5 rounded-lg px-3 py-2">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-success" />
        <span className="text-muted-foreground">
          <span className="font-medium text-foreground">Itens conferem com o edital.</span>{' '}
          {conferencia.sobrando_qtd > 0 && (
            <>
              {conferencia.sobrando_qtd} item(ns) do edital ficaram de fora — o que é normal quando
              se disputa parte dele.
            </>
          )}
        </span>
      </div>
    );
  }

  // Estado 4 — não confere. Aqui o número do item é o que importa: é o que a
  // pessoa vai procurar no cadastro para corrigir.
  return (
    <div className="border border-warning/40 bg-warning/5 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
        <p className="text-sm font-semibold">Os itens não conferem com o edital</p>
      </div>

      {conferencia.faltando.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <p>
            <strong className="text-foreground">
              {conferencia.faltando.length} item(ns) que você enviou não existem neste processo
            </strong>{' '}
            — o robô não teria o que acompanhar neles:
          </p>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {conferencia.faltando.slice(0, 20).map((n) => (
              <span
                key={n}
                className="font-mono text-[11px] px-1.5 py-0.5 rounded border border-warning/40 bg-warning/10"
              >
                nº {n}
              </span>
            ))}
            {conferencia.faltando.length > 20 && (
              <span className="text-[11px] self-center">
                e mais {conferencia.faltando.length - 20}
              </span>
            )}
          </div>
        </div>
      )}

      {conferencia.divergencias.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <p>
            <strong className="text-foreground">
              {conferencia.divergencias.length} item(ns) com valor de referência diferente
            </strong>{' '}
            do publicado:
          </p>
          <ul className="mt-1 space-y-0.5">
            {conferencia.divergencias.slice(0, 5).map((d) => (
              <li key={d.numero} className="font-mono text-[11px]">
                nº {d.numero}: nosso {formatarReal(d.nosso)} × portal {formatarReal(d.portal)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* A saída, dita em uma linha. Aviso que não diz o que fazer vira
          ansiedade, não ação. */}
      <p className="text-xs text-muted-foreground border-t border-warning/25 pt-2">
        <ScanSearch className="w-3 h-3 inline mr-1" />
        Confira a numeração dos itens da disputa <span className="font-mono">{edital}</span> contra
        o edital publicado. O robô continua acompanhando — nada foi enviado ao portal.
      </p>
    </div>
  );
}

const formatarReal = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
