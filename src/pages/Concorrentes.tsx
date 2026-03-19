import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ConsultaCNPJ from '@/components/concorrentes/ConsultaCNPJ';
import ConsultaSintegra from '@/components/concorrentes/ConsultaSintegra';
import CertidoesNegativas from '@/components/concorrentes/CertidoesNegativas';
import AnaliseDocsConcorrente from '@/components/documentos/AnaliseDocsConcorrente';
import VerificacaoIdoneidade from '@/components/concorrentes/VerificacaoIdoneidade';

export default function Concorrentes() {

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Análise de Concorrentes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Inteligência competitiva baseada em dados do SICAF e portais públicos
        </p>
      </div>

      <Tabs defaultValue="analise-docs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="analise-docs">Análise de Documentos</TabsTrigger>
          <TabsTrigger value="consulta-cnpj">Consulta CNPJ</TabsTrigger>
          <TabsTrigger value="sintegra">SINTEGRA</TabsTrigger>
          <TabsTrigger value="certidoes">Certidões Negativas</TabsTrigger>
        </TabsList>

        <TabsContent value="analise-docs">
          <AnaliseDocsConcorrente />
        </TabsContent>

        <TabsContent value="consulta-cnpj">
          <ConsultaCNPJ />
        </TabsContent>

        <TabsContent value="sintegra">
          <ConsultaSintegra />
        </TabsContent>

        <TabsContent value="certidoes">
          <CertidoesNegativas />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
