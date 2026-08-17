import { useCallback, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { destinoDoVoltar, prepararVolta, subscribeHistorico } from '@/lib/navegacao/historico';

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
export default function BotaoVoltar() {
  const navigate = useNavigate();

  const destino = useSyncExternalStore(
    useCallback((cb) => subscribeHistorico(cb), []),
    useCallback(() => destinoDoVoltar(), []),
  );

  // Quem anota as rotas é o RegistroDeRota, no roteador — telas fora deste
  // layout (a pasta do processo) também precisam entrar na pilha.

  if (!destino) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      className="mb-3 -ml-2 text-muted-foreground hover:text-foreground"
      onClick={() => {
        const alvo = prepararVolta();
        if (alvo) navigate(alvo);
      }}
    >
      <ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar
    </Button>
  );
}
