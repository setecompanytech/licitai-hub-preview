import { useCallback, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { destinoDoVoltar, prepararVolta, redefinirPara, subscribeHistorico } from '@/lib/navegacao/historico';

/**
 * Voltar de verdade — para a tela anterior, não para uma rota fixa.
 *
 * Fica no AppLayout, então vale para todas as telas de uma vez: das 83 páginas
 * do sistema, apenas 9 tinham botão, e a maioria apontava para `/painel` ou
 * `/kanban` fixos. Era isso que fazia o sistema parecer levar a uma página
 * aleatória — ele levava sempre à mesma, qualquer que fosse a origem.
 *
 * Não aparece quando não há de onde voltar (entrada direta, aba nova, Painel):
 * botão que não leva a lugar nenhum é pior que botão ausente.
 */
export default function BotaoVoltar({
  somenteIcone = false,
  padrao,
}: {
  somenteIcone?: boolean;
  /**
   * Destino quando não há percurso — recarregar a página zera o histórico do
   * aplicativo, e a tela ficava sem saída visível. Só as telas que têm um
   * "lugar de origem" óbvio passam este valor; onde não há, o botão continua
   * sumindo, porque botão que não leva a lugar nenhum é pior que ausente.
   */
  padrao?: string;
}) {
  const navigate = useNavigate();

  const destino = useSyncExternalStore(
    useCallback((cb) => subscribeHistorico(cb), []),
    useCallback(() => destinoDoVoltar(), []),
  );

  // Quem anota as rotas é o RegistroDeRota, no roteador — telas fora deste
  // layout (a pasta do processo) também precisam entrar na pilha.

  const alvoFinal = destino ?? padrao ?? null;
  if (!alvoFinal) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      title="Voltar para a tela anterior"
      className={somenteIcone
        ? 'text-muted-foreground hover:text-foreground'
        : 'mb-3 -ml-2 text-muted-foreground hover:text-foreground'}
      onClick={() => {
        const doPercurso = prepararVolta();
        if (doPercurso) { navigate(doPercurso); return; }
        // Sem percurso: o salto para a origem RECOMEÇA a pilha ali. Empilhá-lo
        // fazia a origem "voltar" para esta tela, e esta para a origem.
        if (padrao) { redefinirPara(padrao); navigate(padrao); }
      }}
    >
      <ArrowLeft className={somenteIcone ? 'w-4 h-4' : 'w-4 h-4 mr-1.5'} />
      {!somenteIcone && 'Voltar'}
    </Button>
  );
}
