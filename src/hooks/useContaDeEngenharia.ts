import { useEmpresa } from '@/contexts/EmpresaContext';
import { useUserRole } from '@/hooks/useUserRole';
import { ehContaDeEngenharia } from '@/lib/conta-de-engenharia';

/**
 * A conta logada é a de engenharia da plataforma? Regra e motivo em
 * `lib/conta-de-engenharia.ts`.
 *
 * Enquanto papel ou empresas carregam, responde `false` e `carregando: true`:
 * quem decide abrir algo (o assistente de boas-vindas) espera o fim da carga,
 * para não piscar a tela de cadastro para a conta de engenharia.
 */
export function useContaDeEngenharia() {
  const { isSystemAdmin, loading: carregandoPapel } = useUserRole();
  const { empresas, loading: carregandoEmpresas } = useEmpresa();
  const carregando = carregandoPapel || carregandoEmpresas;
  return {
    ehContaDeEngenharia: !carregando && ehContaDeEngenharia({ isSystemAdmin, totalDeEmpresas: empresas.length }),
    carregando,
  };
}
