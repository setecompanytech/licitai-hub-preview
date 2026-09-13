import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { DegrauDaTrilha } from './TrilhaDoTopo';

/**
 * Onde a página diz à faixa superior onde ela está.
 *
 * Existe por um defeito que a mudança de 13/09 criou: a trilha subiu para a
 * faixa branca, mas `CabecalhoPagina` continuava desenhando a dele dentro da
 * página. Toda tela interna passou a ter DUAS trilhas, uma acima da outra,
 * dizendo a mesma coisa — a navegação duplicada que o próprio comando proíbe.
 *
 * A faixa sabe a rota, então resolve sozinha as telas que são item de menu. O
 * que ela não sabe é o degrau final das telas de DETALHE: "Contrato 068/2025",
 * "Pedido 736", "Editar produto". Quem sabe é a página. Daí o contexto — a
 * página registra, a faixa renderiza, e nenhuma das onze telas que já passavam
 * `trilha={...}` precisou ser tocada.
 *
 * A alternativa seria mover a trilha de cada uma dessas telas para uma prop do
 * `AppLayout`, o que exigiria editar as onze e acertar cada uma; com o
 * contexto, elas continuam declarando a trilha onde sempre declararam.
 */
interface ContextoTrilha {
  /** Trilha completa da página; `null` = a faixa deriva da rota. */
  trilhaDaPagina: DegrauDaTrilha[] | null;
  registrar: (degraus: DegrauDaTrilha[] | null) => void;
}

const Contexto = createContext<ContextoTrilha | null>(null);

export function ProvedorDeTrilha({ children }: { children: ReactNode }) {
  const [trilhaDaPagina, setTrilha] = useState<DegrauDaTrilha[] | null>(null);

  const registrar = useCallback((degraus: DegrauDaTrilha[] | null) => {
    // Compara pelo CONTEÚDO, não pela identidade do array: o cabeçalho monta a
    // trilha a cada render, e um `setState` com array novo a cada vez faria
    // provedor e consumidor se re-renderizarem em laço.
    setTrilha((anterior) => {
      const mesma =
        anterior === degraus ||
        (anterior != null &&
          degraus != null &&
          anterior.length === degraus.length &&
          anterior.every((d, i) => d.rotulo === degraus[i].rotulo && d.para === degraus[i].para));
      return mesma ? anterior : degraus;
    });
  }, []);

  const valor = useMemo(() => ({ trilhaDaPagina, registrar }), [trilhaDaPagina, registrar]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/** A faixa lê daqui. Fora do provedor, devolve `null` e cai na rota. */
export function useTrilhaDaPagina(): DegrauDaTrilha[] | null {
  return useContext(Contexto)?.trilhaDaPagina ?? null;
}

/**
 * A página declara a sua trilha. Passar `null` devolve a decisão à rota.
 *
 * Sem provedor por perto (tela fora do `AppLayout`, teste isolado) o hook não
 * faz nada em vez de estourar: a trilha é enfeite de navegação, não é o que
 * sustenta a tela de pé.
 */
export function useRegistrarTrilha(degraus: DegrauDaTrilha[] | null | undefined) {
  const ctx = useContext(Contexto);
  const registrar = ctx?.registrar;
  // A dependência é o conteúdo serializado — ver a nota em `registrar`.
  const chave = degraus ? JSON.stringify(degraus) : '';

  useEffect(() => {
    if (!registrar) return;
    registrar(degraus ?? null);
    return () => registrar(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registrar, chave]);
}
