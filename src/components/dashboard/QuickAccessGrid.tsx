import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMembroPermissoes } from '@/hooks/useMembroPermissoes';
import { usePreferenciasDeNavegacao } from '@/hooks/usePreferenciasDeNavegacao';
import { funcoesDoSistema, type FuncaoDoSistema } from '@/lib/navegacao/registro';
// `Map` do lucide sombreia o `Map` nativo do JavaScript — e o erro aparece
// longe daqui, num `new Map(...)` que passa a ser lido como construtor de um
// componente React. Renomeado na importação.
import {
  Target, Brain, Map as IconeMapa, Zap, Scale, Users,
} from 'lucide-react';
import type { ElementType } from 'react';

/**
 * Os atalhos do painel — uma curadoria, não a classificação oficial.
 *
 * Estes seis grupos existem para a primeira tela do dia, e por isso NÃO
 * espelham o menu: "Automação" junta Workflow, Robô, Assistente e API, que no
 * diretório moram em três categorias diferentes. O comando de 13/09 diz isso
 * com todas as letras — "esses grupos são atalhos do painel; preserve a
 * classificação oficial de cada função no menu global".
 *
 * O que mudou é de onde vêm nome, ícone e permissão: do registro único, e não
 * mais de uma lista escrita à mão aqui. A lista antiga tinha divergido em três
 * pontos que ninguém enxergava lendo este arquivo — chamava
 * `/monitoramento-editais` de "Encontrar Editais" (um terceiro nome para a
 * mesma tela), inventava um grupo "Automação" que o menu não tinha, e o
 * atalho "Definir Metas" apontava para `/metas-comercial?tab=parametros`
 * enquanto o item de mesmo nome no menu levava a `/definir-metas`. Duas telas
 * diferentes, um nome só.
 *
 * Aqui ficam apenas ROTAS. O resto o registro responde.
 */
const GRUPOS: { titulo: string; icone: ElementType; rotas: string[] }[] = [
  {
    titulo: 'Oportunidades de negócio',
    icone: Target,
    rotas: ['/monitoramento-editais', '/boletins', '/licitacoes-estrategicas', '/monitoramento-chat'],
  },
  {
    titulo: 'Inteligência',
    icone: Brain,
    rotas: ['/precificacao', '/proposta-tecnica', '/analise-mercado', '/concorrentes'],
  },
  {
    titulo: 'Gestão',
    icone: IconeMapa,
    rotas: ['/meus-compromissos', '/calendario', '/kanban', '/gestao-contratos'],
  },
  {
    titulo: 'Automação',
    icone: Zap,
    rotas: ['/workflow-ia', '/robo-lances', '/assistente', '/api-integracao'],
  },
  {
    titulo: 'Jurídico e documentos',
    icone: Scale,
    rotas: ['/documentos', '/apoio-juridico', '/apoio-contabil', '/assessoria-cadastral'],
  },
  {
    titulo: 'Administração',
    icone: Users,
    rotas: ['/empresas', '/equipe', '/definir-metas', '/configuracoes'],
  },
];

interface QuickAccessGridProps {
  /** Liga a estrela de favoritar em cada atalho. */
  personalizando?: boolean;
}

export default function QuickAccessGrid({ personalizando = false }: QuickAccessGridProps) {
  const { canAccessRoute, isAdmin } = useMembroPermissoes();
  const { ehFavorito, alternarFavorito, registrarAcesso } = usePreferenciasDeNavegacao();

  const porRota = new Map(funcoesDoSistema.map((f) => [f.rota, f]));

  const permitida = (f: FuncaoDoSistema) =>
    (!f.adminOnly || isAdmin) && canAccessRoute(f.rota.split('?')[0]);

  const grupos = GRUPOS.map((g) => ({
    ...g,
    // Atalho para rota que não existe mais no registro some, em vez de virar
    // um ladrilho morto. E o comando proíbe reservar espaço vazio para função
    // indisponível — a grade fecha em torno do que sobrou.
    funcoes: g.rotas.map((r) => porRota.get(r)).filter((f): f is FuncaoDoSistema => !!f && permitida(f)),
  })).filter((g) => g.funcoes.length > 0);

  if (grupos.length === 0) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {grupos.map((grupo) => (
        <section
          key={grupo.titulo}
          className="rounded-xl border border-border bg-card p-5 shadow-sm"
        >
          <h3 className="mb-4 flex items-center gap-2 text-base font-semibold leading-6 text-foreground">
            <grupo.icone className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            {grupo.titulo}
          </h3>

          {/* 2×2 como pede a referência. No celular, duas colunas enquanto os
              rótulos couberem — `min-w-0` com `truncate` decide isso sozinho,
              sem ponto de quebra declarado. */}
          <div className="grid grid-cols-2 gap-3">
            {grupo.funcoes.map((f) => (
              <div key={f.id} className="relative">
                <Link
                  to={f.rota}
                  onClick={() => registrarAcesso(f.id)}
                  className={cn(
                    'flex h-full min-h-[88px] flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-4 text-center transition-colors',
                    'hover:border-primary/40 hover:bg-muted/40',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  )}
                >
                  <f.icone className="h-6 w-6 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 text-sm font-medium leading-5 text-foreground">
                    {f.nome}
                  </span>
                </Link>

                {personalizando && (
                  // Fora do `Link`, e não dentro: âncora dentro de âncora não é
                  // HTML válido, e um `stopPropagation` resolveria o clique mas
                  // não o leitor de tela, que anunciaria um link só.
                  <button
                    type="button"
                    onClick={() => alternarFavorito(f.id)}
                    aria-pressed={ehFavorito(f.id)}
                    aria-label={
                      ehFavorito(f.id)
                        ? `Remover ${f.nome} dos favoritos`
                        : `Adicionar ${f.nome} aos favoritos`
                    }
                    className="absolute right-1 top-1 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Star
                      className={cn('h-4 w-4', ehFavorito(f.id) && 'fill-primary text-primary')}
                      aria-hidden="true"
                    />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
