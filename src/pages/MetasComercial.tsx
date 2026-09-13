import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import EstadoVazio from '@/components/shared/EstadoVazio';
import AbasGestao from '@/components/gestao/AbasGestao';
import { useMetasEmTempoReal } from '@/hooks/useMetasComercial';
import { useSearchParams } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAuthorization } from '@/hooks/useAuthorization';
import EquipeMetas from '@/components/metas/EquipeMetas';
import PainelMetas from '@/components/metas/PainelMetas';
import RelatoriosMetas from '@/components/metas/RelatoriosMetas';

/**
 * Metas do Comercial — a tela de LEITURA do módulo.
 *
 * Acompanhar (Painel), comparar a equipe (Equipe) e emitir relatório
 * (Relatórios). Quem ESCREVE o alvo vai a Ferramentas → Definir Metas: uma
 * tela com duas entradas de menu passava por duas funções, e era isso que
 * confundia.
 *
 * ── Nota de consistência: três autoridades de papel no mesmo módulo ──
 *
 * O repo tem três hooks que respondem "esta pessoa é admin?", e eles NÃO
 * respondem a mesma coisa:
 *
 *   • `usePapelEmpresa`  — `papel === 'admin'` na empresa ativa. Usado pelo Robô.
 *   • `useMembroPermissoes.isAdmin` — admin global OU admin da empresa ativa
 *     OU (aqui está a armadilha) admin de QUALQUER empresa: ele soma
 *     `useUserRole().isAdmin`, que já inclui "é admin de alguma empresa".
 *   • `useAuthorization.isAdmin` — admin do SISTEMA ou admin da empresa ATIVA,
 *     e só. É o middleware único de autorização do front.
 *
 * A divergência era visível: esta tela liberava a aba Equipe por
 * `useMembroPermissoes`, e o `PainelMetas` decidia pelo seletor de colaborador
 * por `useAuthorization`. Quem administra a empresa A e é apenas operador da
 * empresa B via, dentro de B, a aba Equipe com o cumprimento de meta de todo
 * mundo — e não via o seletor de colaborador no Painel. Duas telas do mesmo
 * módulo, duas respostas.
 *
 * O módulo inteiro passa a usar `useAuthorization`: é a única das três que
 * confina o admin de empresa à empresa ATIVA, e é a que a própria
 * documentação do repo declara como middleware único. A convergência NÃO
 * afrouxa nada — ela fecha um vazamento entre empresas.
 */
export default function MetasComercial() {
  const { isAdmin, loading } = useAuthorization();
  // Meta alterada pelo administrador chega a quem está olhando, sem recarregar.
  // Ver useMetasEmTempoReal: antes só a sessão de quem salvou era atualizada.
  useMetasEmTempoReal();
  const [searchParams, setSearchParams] = useSearchParams();

  /* A aba mora em `?tab=` para o voltar do navegador e o F5 caírem onde a
     pessoa estava — e é por onde o administrador chega de outras telas.
     O nome do parâmetro e os três valores são contrato de link: não mudam. */
  const ABAS = ['painel', 'equipe', 'relatorios'];
  const pedida = searchParams.get('tab') || '';
  const aba = ABAS.includes(pedida) ? pedida : 'painel';
  const trocarAba = (valor: string) =>
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', valor);
      return next;
    }, { replace: true });

  return (
    <AppLayout>
      {/* Título, descrição, ícone e trilha vêm do registro
          `lib/navegacao/paginas.ts` pela própria rota — a tela não repete o
          que já está padronizado.

          DIVERGÊNCIA REGISTRADA em relação ao padrão visual de Gestão: aqui o
          cabeçalho é o `CabecalhoPagina`, não o `TelaGestao`. O próprio
          `TelaGestao` documenta a fronteira — ele serve à tela cujo título é o
          IDENTIFICADOR de um registro ("Contrato 068/2025"); esta é uma tela de
          MENU, com verbete em `paginas.ts` (título, descrição, ícone, trilha e
          até a lista de abas). Trocar por `TelaGestao` obrigaria a reescrever à
          mão o que o registro já padroniza, e a trilha do topo perderia a
          origem. O restante da composição segue o kit de Gestão. */}
      <CabecalhoPagina denso>
        {/* Leitura de gestão: a aba Equipe põe a equipe inteira lado a lado, e
            é visão do administrador. Painel e Relatórios servem ao
            acompanhamento individual. */}
        <AbasGestao
          valor={aba}
          aoMudar={trocarAba}
          abas={[
            { valor: 'painel', rotulo: 'Painel' },
            ...(isAdmin ? [{ valor: 'equipe', rotulo: 'Equipe' }] : []),
            { valor: 'relatorios', rotulo: 'Relatórios' },
          ]}
        />
      </CabecalhoPagina>

      {aba === 'painel' && <PainelMetas />}

      {/* A aba Equipe existe SEMPRE como destino: quem chega por link
          `?tab=equipe` sem ser admin recebe uma explicação e o caminho de
          volta, não uma tela em branco. Enquanto o papel carrega não se afirma
          nada — negar acesso antes de saber quem é seria acusar à toa. */}
      {aba === 'equipe' && (loading ? null : isAdmin ? (
        <EquipeMetas />
      ) : (
        <div className="g-cartao">
          <EstadoVazio
            icone={<Lock />}
            titulo="Acesso restrito"
            descricao="O cumprimento de meta da equipe é visão do administrador desta empresa. Seu próprio acompanhamento está na aba Painel."
          />
        </div>
      ))}

      {aba === 'relatorios' && <RelatoriosMetas />}
    </AppLayout>
  );
}
