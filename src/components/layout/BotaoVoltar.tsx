import { useCallback, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  avancar, destinoDoAvancar, destinoDoVoltar, subscribeHistorico, voltar,
} from '@/lib/navegacao/historico';

/**
 * Voltar e avançar, como no explorador de arquivos.
 *
 * Antes havia só o voltar, e ele DESTRUÍA o passo — por isso não existia
 * avançar, e por isso o percurso girava. Com lista e cursor (ver
 * `lib/navegacao/historico.ts`), os dois nascem do mesmo mecanismo: um anda
 * para a esquerda, o outro para a direita.
 *
 * As setas ficam visíveis e DESABILITADAS quando não há para onde ir, em vez de
 * sumir. É o comportamento do sistema operacional, e é o que torna evidente que
 * existe caminho à frente depois de voltar. Somem juntas só na primeira tela da
 * sessão, onde nenhuma das duas serve.
 */
export default function BotaoVoltar({
  somenteIcone = false,
  padrao,
}: {
  somenteIcone?: boolean;
  /**
   * Destino quando não há de onde voltar — entrada direta por link ou após
   * recarregar a página. Vale como navegação normal: vira um passo, e o avançar
   * segue funcionando a partir dali.
   */
  padrao?: string;
}) {
  const navigate = useNavigate();

  const assinar = useCallback((cb: () => void) => subscribeHistorico(cb), []);
  const atras = useSyncExternalStore(assinar, useCallback(() => destinoDoVoltar(), []));
  const frente = useSyncExternalStore(assinar, useCallback(() => destinoDoAvancar(), []));

  const alvoAtras = atras ?? padrao ?? null;
  if (!alvoAtras && !frente) return null;

  const irAtras = () => {
    const doPercurso = voltar();
    if (doPercurso) { navigate(doPercurso); return; }
    if (padrao) navigate(padrao);   // entrada direta: origem declarada da tela
  };

  const irFrente = () => {
    const destino = avancar();
    if (destino) navigate(destino);
  };

  return (
    <div className={`flex items-center gap-0.5 ${somenteIcone ? '' : 'mb-3 -ml-2'}`}>
      <Button
        variant="ghost"
        size="sm"
        disabled={!alvoAtras}
        title={alvoAtras ? 'Voltar' : 'Não há para onde voltar'}
        className="text-muted-foreground hover:text-foreground disabled:opacity-30"
        onClick={irAtras}
      >
        <ArrowLeft className={somenteIcone ? 'w-4 h-4' : 'w-4 h-4 mr-1.5'} />
        {!somenteIcone && 'Voltar'}
      </Button>

      <Button
        variant="ghost"
        size="sm"
        disabled={!frente}
        title={frente ? 'Avançar' : 'Não há para onde avançar'}
        className="text-muted-foreground hover:text-foreground disabled:opacity-30 px-2"
        onClick={irFrente}
      >
        <ArrowRight className="w-4 h-4" />
        <span className="sr-only">Avançar</span>
      </Button>
    </div>
  );
}
