import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { registrarRota } from '@/lib/navegacao/historico';

/**
 * Anota cada rota visitada no histórico do aplicativo.
 *
 * Fica no roteador, e não no botão Voltar, porque nem toda tela usa o layout
 * padrão — a pasta do processo é a mais importante delas. Se o registro
 * morasse no botão, quem saísse da pasta para a Precificação não teria como
 * voltar para a pasta: ela nunca teria sido anotada.
 *
 * Não renderiza nada.
 */
export default function RegistroDeRota() {
  const location = useLocation();
  useEffect(() => {
    registrarRota(location.pathname + location.search);
  }, [location.pathname, location.search]);
  return null;
}
