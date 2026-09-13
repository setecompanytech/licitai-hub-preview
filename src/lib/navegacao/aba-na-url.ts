import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Aba guardada na URL — o que faz o "voltar" do navegador funcionar.
 *
 * O comando de 13/09 exige preservar contexto ao abrir e retornar de um
 * registro. Com a aba em `useState`, abrir o contrato a partir de "Pedidos" e
 * voltar devolve a pessoa ao "Resumo", porque o componente remontou e o estado
 * nasceu no padrão. Na barra de endereço, o retorno cai onde saiu, o link é
 * compartilhável e o F5 não perde o lugar.
 *
 * Os dois comportamentos já existiam no repo, em telas diferentes: Contratos
 * guardava em `?aba=`, Compras em `useState` — e era Compras que perdia a aba
 * no F5. Este hook é a versão de Contratos, extraída para as duas usarem.
 *
 * `replace: true` porque trocar de aba não é navegar: senão o botão Voltar
 * teria que desfazer uma aba de cada vez antes de sair da tela.
 *
 * O valor padrão é OMITIDO da URL. `?aba=dashboard` e a URL limpa significam a
 * mesma coisa, e duas escritas para o mesmo estado sujam o histórico.
 */
export function useAbaNaUrl(padrao: string, parametro = 'aba') {
  const [params, setParams] = useSearchParams();
  const aba = params.get(parametro) ?? padrao;

  const definirAba = useCallback(
    (nova: string) => {
      setParams(
        (anterior) => {
          const proximo = new URLSearchParams(anterior);
          if (nova === padrao) proximo.delete(parametro);
          else proximo.set(parametro, nova);
          return proximo;
        },
        { replace: true },
      );
    },
    [setParams, padrao, parametro],
  );

  return [aba, definirAba] as const;
}
