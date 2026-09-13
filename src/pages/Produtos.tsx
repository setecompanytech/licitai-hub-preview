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
 * O portão era mais fraco que o da outra porta, e deixou de ser. Até 13/09:
 *
 *     /produtos        → <ProtectedPages>  (só autenticação)
 *     /gestao-compras  → <PlanPages>       (autenticação + plano)
 *
 * Duas fechaduras diferentes para a mesma sala: quem batia em `/gestao-compras`
 * por falta de plano alcançava o cadastro inteiro digitando `/produtos`. A
 * assimetria é anterior à unificação — e passou despercebida porque esta rota
 * é órfã: não está em `menu.ts`, `paginas.ts` nem `route-permissions.ts`, e
 * nenhum link do app aponta para ela. Agora as duas pedem o mesmo plano
 * (`plan-features.ts`), e `src/data/plan-features.test.ts` trava a igualdade.
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
