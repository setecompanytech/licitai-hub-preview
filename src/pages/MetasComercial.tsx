import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { useMetasEmTempoReal } from '@/hooks/useMetasComercial';
import { useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayoutDashboard, Lock, FileText, Users } from 'lucide-react';
import { useMembroPermissoes } from '@/hooks/useMembroPermissoes';
import EquipeMetas from '@/components/metas/EquipeMetas';
import PainelMetas from '@/components/metas/PainelMetas';
import RelatoriosMetas from '@/components/metas/RelatoriosMetas';

/**
 * Metas do Comercial.
 *
 * Painel de acompanhamento (meta × realizado, projeção e alertas) e
 * parametrização (valores-alvo, limiares e motivos de perda, restrita a admin).
 */
export default function MetasComercial() {
  const { isAdmin, loading } = useMembroPermissoes();
  // Meta alterada pelo administrador chega a quem está olhando, sem recarregar.
  // Ver useMetasEmTempoReal: antes só a sessão de quem salvou era atualizada.
  useMetasEmTempoReal();
  const [searchParams, setSearchParams] = useSearchParams();
  /* Parametrização saiu daqui. Por decisão do dono do produto, Gestão é
     leitura — acompanhar e levantar relatórios —, e o alvo se escreve em
     Ferramentas → Definir Metas. Uma tela com duas entradas de menu passava
     por duas funções, e era isso que confundia. */
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
          que já está padronizado. */}
      <CabecalhoPagina />

      {/* ?tab= permite entrar direto na parametrização — é por onde o
          administrador chega, vindo do cartão Administração do Painel. */}
      <Tabs value={aba} onValueChange={trocarAba} className="space-y-4">
        <TabsList>
          <TabsTrigger value="painel" className="gap-2">
            <LayoutDashboard className="w-4 h-4" aria-hidden="true" /> Painel
          </TabsTrigger>
          {/* Leitura de gestão: a equipe inteira lado a lado. Painel e
              Relatórios continuam servindo ao acompanhamento individual. */}
          {isAdmin && (
            <TabsTrigger value="equipe" className="gap-2">
              <Users className="w-4 h-4" aria-hidden="true" /> Equipe
            </TabsTrigger>
          )}
          <TabsTrigger value="relatorios" className="gap-2">
            <FileText className="w-4 h-4" aria-hidden="true" /> Relatórios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="painel">
          <PainelMetas />
        </TabsContent>

        <TabsContent value="equipe">
          {loading ? null : isAdmin ? (
            <EquipeMetas />
          ) : (
            <Card>
              <EstadoVazio
                icone={<Lock />}
                titulo="Acesso restrito"
                descricao="O cumprimento de meta da equipe é visão do administrador. Seu próprio acompanhamento está na aba Painel."
              />
            </Card>
          )}
        </TabsContent>

        <TabsContent value="relatorios">
          <RelatoriosMetas />
        </TabsContent>

      </Tabs>
    </AppLayout>
  );
}
