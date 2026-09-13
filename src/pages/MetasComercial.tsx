import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import { useMetasEmTempoReal } from '@/hooks/useMetasComercial';
import { useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Target, LayoutDashboard, Lock, FileText, Users } from 'lucide-react';
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
      <CabecalhoPagina
        icone={<Target />}
        titulo="Metas do Comercial"
        descricao="Metas mensais por colaborador, com valores-alvo e alertas configuráveis"
      />

      {/* ?tab= permite entrar direto na parametrização — é por onde o
          administrador chega, vindo do cartão Administração do Painel. */}
      <Tabs value={aba} onValueChange={trocarAba} className="space-y-4">
        <TabsList>
          <TabsTrigger value="painel" className="gap-2">
            <LayoutDashboard className="w-4 h-4" /> Painel
          </TabsTrigger>
          {/* Leitura de gestão: a equipe inteira lado a lado. Painel e
              Relatórios continuam servindo ao acompanhamento individual. */}
          {isAdmin && (
            <TabsTrigger value="equipe" className="gap-2">
              <Users className="w-4 h-4" /> Equipe
            </TabsTrigger>
          )}
          <TabsTrigger value="relatorios" className="gap-2">
            <FileText className="w-4 h-4" /> Relatórios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="painel">
          <PainelMetas />
        </TabsContent>

        <TabsContent value="equipe">
          {loading ? null : isAdmin ? (
            <EquipeMetas />
          ) : (
            <Card className="p-12 text-center">
              <div aria-hidden="true" className="w-12 h-12 mx-auto rounded-full bg-muted text-muted-foreground flex items-center justify-center mb-4">
                <Lock className="w-6 h-6" />
              </div>
              <p className="text-lg font-semibold text-foreground">Acesso restrito</p>
              <p className="text-base text-muted-foreground mt-1 max-w-md mx-auto">
                O cumprimento de meta da equipe é visão do administrador. Seu próprio
                acompanhamento está na aba Painel.
              </p>
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
