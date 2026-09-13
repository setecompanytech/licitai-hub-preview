import { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ConsultaCNPJ from '@/components/concorrentes/ConsultaCNPJ';
import ConsultaSintegra from '@/components/concorrentes/ConsultaSintegra';
import CertidoesNegativas from '@/components/concorrentes/CertidoesNegativas';
import AnaliseDocsConcorrente from '@/components/documentos/AnaliseDocsConcorrente';
import VerificacaoIdoneidade from '@/components/concorrentes/VerificacaoIdoneidade';

const ABA_INICIAL = 'analise-docs';

/**
 * Concorrentes — item de menu: título, descrição, ícone e trilha vêm do
 * registro `lib/navegacao/paginas.ts` via CabecalhoPagina. As cinco abas são
 * as declaradas lá, na mesma ordem; cada uma é um componente interno que
 * começa direto no conteúdo (sem cabeçalho próprio).
 *
 * A ação principal do registro é "Nova consulta". Como a consulta acontece
 * dentro de cada aba (cada uma com campo e botão próprios), "Nova consulta"
 * recomeça a aba aberta do zero: o contador `reinicios` muda a `key` do
 * componente da aba ativa, que remonta limpo — mesmo efeito de sair e voltar
 * para a aba (TabsContent desmonta o conteúdo inativo), só que explícito e
 * sem precisar alterar as abas, inclusive a de análise de documentos.
 */
export default function Concorrentes() {
  const [abaAtiva, setAbaAtiva] = useState(ABA_INICIAL);
  const [reinicios, setReinicios] = useState<Record<string, number>>({});

  const novaConsulta = () => {
    setReinicios((prev) => ({ ...prev, [abaAtiva]: (prev[abaAtiva] ?? 0) + 1 }));
    toast.success('Pronto para uma nova consulta.');
  };

  const chave = (aba: string) => `${aba}-${reinicios[aba] ?? 0}`;

  return (
    <AppLayout>
      <div className="space-y-6">
        <CabecalhoPagina
          acoes={
            <Button onClick={novaConsulta}>
              <Plus aria-hidden="true" />
              Nova consulta
            </Button>
          }
        />

        <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="space-y-4">
          <TabsList>
            <TabsTrigger value="analise-docs">Análise de documentos</TabsTrigger>
            <TabsTrigger value="consulta-cnpj">Consulta CNPJ</TabsTrigger>
            <TabsTrigger value="idoneidade">Idoneidade</TabsTrigger>
            <TabsTrigger value="sintegra">Sintegra</TabsTrigger>
            <TabsTrigger value="certidoes">Certidões</TabsTrigger>
          </TabsList>

          <TabsContent value="analise-docs">
            <AnaliseDocsConcorrente key={chave('analise-docs')} />
          </TabsContent>

          <TabsContent value="consulta-cnpj">
            <ConsultaCNPJ key={chave('consulta-cnpj')} />
          </TabsContent>

          <TabsContent value="idoneidade">
            <VerificacaoIdoneidade key={chave('idoneidade')} />
          </TabsContent>

          <TabsContent value="sintegra">
            <ConsultaSintegra key={chave('sintegra')} />
          </TabsContent>

          <TabsContent value="certidoes">
            <CertidoesNegativas key={chave('certidoes')} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
