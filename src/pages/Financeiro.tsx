import AppLayout from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, ListOrdered, Wallet, Users, Tags } from "lucide-react";
import FinDashboard from "@/components/financeiro/FinDashboard";
import FinLancamentos from "@/components/financeiro/FinLancamentos";
import FinContas from "@/components/financeiro/FinContas";
import FinPessoas from "@/components/financeiro/FinPessoas";
import FinCategorias from "@/components/financeiro/FinCategorias";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Card, CardContent } from "@/components/ui/card";

export default function Financeiro() {
  const { empresaAtiva, loading } = useEmpresa();

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
          <p className="text-sm text-muted-foreground">
            Gestão completa de contas a pagar, receber, fluxo de caixa e DRE.
          </p>
        </header>

        {!loading && !empresaAtiva ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Selecione uma empresa ativa no menu superior para acessar o módulo financeiro.
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="dashboard" className="space-y-4">
            <TabsList className="grid grid-cols-5 w-full max-w-3xl">
              <TabsTrigger value="dashboard"><LayoutDashboard className="w-4 h-4 mr-1.5" />Dashboard</TabsTrigger>
              <TabsTrigger value="lancamentos"><ListOrdered className="w-4 h-4 mr-1.5" />Lançamentos</TabsTrigger>
              <TabsTrigger value="contas"><Wallet className="w-4 h-4 mr-1.5" />Contas</TabsTrigger>
              <TabsTrigger value="pessoas"><Users className="w-4 h-4 mr-1.5" />Pessoas</TabsTrigger>
              <TabsTrigger value="categorias"><Tags className="w-4 h-4 mr-1.5" />Categorias</TabsTrigger>
            </TabsList>
            <TabsContent value="dashboard"><FinDashboard /></TabsContent>
            <TabsContent value="lancamentos"><FinLancamentos /></TabsContent>
            <TabsContent value="contas"><FinContas /></TabsContent>
            <TabsContent value="pessoas"><FinPessoas /></TabsContent>
            <TabsContent value="categorias"><FinCategorias /></TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}
