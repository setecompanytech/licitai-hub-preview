import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2, Search, Zap } from 'lucide-react';
import { generateOrganogramaPDF } from '@/lib/organograma-pdf';
import { toast } from 'sonner';
import { useMembroPermissoes } from '@/hooks/useMembroPermissoes';
import {
  categoriasDoSistema,
  funcoesDoSistema,
  type FuncaoDoSistema,
} from '@/lib/navegacao/registro';

/**
 * "Nossas ferramentas" — o mapa do sistema como página, por categoria
 * (Design System v3, 19/09/2026).
 *
 * A lista deixou de ser escrita aqui. Ela vinha à mão, com 22 entradas e
 * nomes próprios ("Encontrar Editais", "Consultor Jurídico", "Blog Jurídico
 * IA") para telas que o menu chama de outro jeito — a mesma divergência que
 * `lib/navegacao/registro` existe para eliminar. Agora nome, descrição,
 * ícone, categoria e rota vêm do registro, na ordem do menu, e só aparece o
 * que a pessoa pode abrir — o mesmo critério dos atalhos do painel
 * (`QuickAccessGrid`) e do diretório (`MenuDeFerramentas`).
 *
 * A busca por ferramenta já existe, com nome, categoria e sinônimos, no
 * diretório aberto por Ctrl+Shift+K; o botão do cabeçalho leva até ela em
 * vez de nascer uma segunda busca aqui.
 */
function CartaoFerramenta({ f, navigate }: { f: FuncaoDoSistema; navigate: (p: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => navigate(f.rota)}
      className="group flex h-full min-h-[72px] items-start gap-3 rounded-lg border border-border bg-card p-4 text-left shadow-sm transition-[border-color,box-shadow] duration-150 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-tint text-primary"
      >
        <f.icone className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-semibold leading-6 text-foreground">{f.nome}</span>
        {f.descricao && (
          <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">{f.descricao}</span>
        )}
      </span>
    </button>
  );
}

export default function Ferramentas() {
  const navigate = useNavigate();
  const [gerando, setGerando] = useState(false);
  const { canAccessRoute, isAdmin } = useMembroPermissoes();

  const handleOrganograma = async () => {
    setGerando(true);
    try {
      generateOrganogramaPDF();
      toast.success('Organograma PDF gerado com sucesso!');
    } catch {
      toast.error('Erro ao gerar o organograma.');
    } finally {
      setGerando(false);
    }
  };

  /* O MESMO diretório do cabeçalho (evento que `MenuDeFerramentas` escuta),
     não uma segunda busca. */
  const abrirBuscaDeFerramentas = () =>
    window.dispatchEvent(new CustomEvent('praefectus:abrir-ferramentas'));

  /** Só o que a pessoa pode abrir — critério idêntico ao dos atalhos do painel. */
  const permitida = (f: FuncaoDoSistema) =>
    (!f.adminOnly || isAdmin) && canAccessRoute(f.rota.split('?')[0]);

  return (
    <AppLayout>
      {/* `/ferramentas` não é item de menu — não está em `paginas.ts` —, então o
          título e a descrição vêm à mão, e a trilha também. */}
      <CabecalhoPagina
        titulo="Nossas ferramentas"
        descricao="Todas as funcionalidades da plataforma reunidas num só lugar"
        icone={<Zap />}
        trilha={[{ rotulo: 'Painel', para: '/dashboard' }, { rotulo: 'Nossas ferramentas' }]}
        acoes={
          <>
            <Button type="button" variant="outline" onClick={abrirBuscaDeFerramentas}>
              <Search aria-hidden="true" />
              Buscar ferramenta
            </Button>
            <Button onClick={handleOrganograma} disabled={gerando} variant="outline">
              {gerando ? <Loader2 className="animate-spin" aria-hidden="true" /> : <FileDown aria-hidden="true" />}
              {gerando ? 'Gerando...' : 'Organograma PDF'}
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-8">
        {categoriasDoSistema.map((categoria) => {
          const itens = funcoesDoSistema.filter((f) => f.categoria === categoria && permitida(f));
          // Categoria cujas rotas a pessoa não pode abrir some inteira — o
          // comando proíbe reservar espaço para o que está indisponível.
          if (itens.length === 0) return null;
          return (
            <section key={categoria} aria-label={categoria}>
              <h2 className="mb-3 text-xl font-semibold leading-6 text-foreground">{categoria}</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 [&>*]:min-w-0">
                {itens.map((f) => (
                  <CartaoFerramenta key={f.id} f={f} navigate={navigate} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </AppLayout>
  );
}
