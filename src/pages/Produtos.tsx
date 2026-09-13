import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import EstadoVazio from '@/components/shared/EstadoVazio';
import CadastroProdutos from '@/components/gestao-compras/CadastroProdutos';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { Building2, Package } from 'lucide-react';

/**
 * /produtos — a rota própria do cadastro de produtos.
 *
 * Esta página era uma cópia integral de `ProdutosOmie.tsx`: as mesmas 7
 * subabas com as mesmas strings, o mesmo `defaultForm` de 40 campos, a mesma
 * geração de `PRDnnnnn`, os mesmos diálogos de NCM e CEST. A camada de dados
 * das duas era idêntica; o que diferia era só a moldura. Sobrou a moldura.
 *
 * ⚠️ O portão de acesso NÃO mudou e não deve mudar aqui. Em `src/App.tsx`:
 *
 *     /produtos        → <ProtectedPages>  (só autenticação)
 *     /gestao-compras  → <PlanPages>       (autenticação + plano)
 *
 * São gates diferentes para o mesmo cadastro, e essa assimetria é anterior a
 * esta unificação. Unificar o miolo não a criou nem a corrigiu — quem entrava
 * em cada rota continua entrando exatamente como entrava. Mexer no gate é
 * decisão de produto, não efeito colateral de refatoração, então fica
 * registrado no relatório em vez de ser resolvido de surpresa aqui.
 *
 * A ação principal ("Incluir produto") vive dentro de `CadastroProdutos`,
 * junto dos filtros — não se repete no cabeçalho, para não haver dois botões
 * verdes disputando a mesma atenção na mesma tela.
 */
export default function Produtos() {
  const { empresaAtiva } = useEmpresa();

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <CabecalhoPagina
          denso
          icone={<Package />}
          titulo="Produtos"
          descricao="Cadastro de produtos da empresa — código, unidade, NCM, CEST, EAN e preço de venda."
        />

        {empresaAtiva ? (
          <CadastroProdutos />
        ) : (
          <div className="g-cartao p-6">
            <EstadoVazio
              icone={<Building2 />}
              titulo="Nenhuma empresa ativa"
              descricao="Selecione uma empresa ativa para acessar o cadastro de produtos."
            />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
