import AppLayout from '@/components/layout/AppLayout';
import { useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Target, SlidersHorizontal, LayoutDashboard, Lock, FileText , Users } from 'lucide-react';
import { useMembroPermissoes } from '@/hooks/useMembroPermissoes';
import ParametrizacaoMetas from '@/components/metas/ParametrizacaoMetas';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const ABAS = ['painel', 'equipe', 'relatorios', 'parametros'];
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
      <div className="mb-4">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
          <Target className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />
          Metas do Comercial
        </h1>
        <p className="text-base text-muted-foreground mt-1">
          Metas mensais por colaborador, com valores-alvo e alertas configuráveis
        </p>
      </div>

      {/* ?tab= permite entrar direto na parametrização — é por onde o
          administrador chega, vindo do cartão Administração do Painel. */}
      <Tabs value={aba} onValueChange={trocarAba} className="space-y-4">
        <TabsList>
          <TabsTrigger value="painel" className="gap-1.5">
            <LayoutDashboard className="w-3.5 h-3.5" /> Painel
          </TabsTrigger>
          {/* Leitura de gestão: a equipe inteira lado a lado. Painel e
              Relatórios continuam servindo ao acompanhamento individual. */}
          {isAdmin && (
            <TabsTrigger value="equipe" className="gap-1.5">
              <Users className="w-3.5 h-3.5" /> Equipe
            </TabsTrigger>
          )}
          <TabsTrigger value="relatorios" className="gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Relatórios
          </TabsTrigger>
          <TabsTrigger value="parametros" className="gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5" /> Parametrização
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
              <Lock className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-base font-medium text-muted-foreground">Acesso restrito</p>
              <p className="text-base text-muted-foreground mt-1">
                O cumprimento de meta da equipe é visão do administrador. Seu próprio
                acompanhamento está na aba Painel.
              </p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="relatorios">
          <RelatoriosMetas />
        </TabsContent>

        <TabsContent value="parametros">
          {loading ? null : isAdmin ? (
            <ParametrizacaoMetas />
          ) : (
            <Card className="p-12 text-center">
              <Lock className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-base font-medium text-muted-foreground">Acesso restrito</p>
              <p className="text-base text-muted-foreground mt-1">
                Apenas administradores da empresa podem alterar os valores-alvo e os limiares de alerta.
              </p>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
