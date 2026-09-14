import { Link } from 'react-router-dom';
import { Clock, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMembroPermissoes } from '@/hooks/useMembroPermissoes';
import { usePreferenciasDeNavegacao } from '@/hooks/usePreferenciasDeNavegacao';
import { funcoesDoSistema, type FuncaoDoSistema } from '@/lib/navegacao/registro';

/**
 * Favoritos e recentes do painel.
 *
 * POR QUE ISTO EXISTE AQUI, e não só no menu global: o painel é onde a pessoa
 * MARCA a estrela ("Personalizar atalhos"). Se marcar não muda nada no painel,
 * a estrela vira um botão que não faz nada visível — e ninguém usa duas vezes.
 * O menu global continua sendo o diretório completo; esta faixa é a resposta
 * curta de "o que eu uso todo dia".
 *
 * Nada aqui tem lista própria: nome, ícone e permissão vêm do registro único
 * (`lib/navegacao/registro`). Rota que saiu do sistema, ou que a pessoa não
 * pode abrir, simplesmente não aparece — atalho que leva a 403 é pior que
 * atalho nenhum.
 */

interface Props {
  /** Quando ligado, a dica muda de tom: é a hora de marcar as estrelas. */
  personalizando: boolean;
}

export default function AtalhosPessoais({ personalizando }: Props) {
  const { favoritos, recentes } = usePreferenciasDeNavegacao();
  const { canAccessRoute, isAdmin } = useMembroPermissoes();

  const porId = new Map(funcoesDoSistema.map((f) => [f.id, f]));
  const permitida = (f: FuncaoDoSistema) =>
    (!f.adminOnly || isAdmin) && canAccessRoute(f.rota.split('?')[0]);

  const resolver = (ids: string[]) =>
    ids.map((id) => porId.get(id)).filter((f): f is FuncaoDoSistema => !!f && permitida(f));

  const listas = [
    {
      chave: 'favoritos',
      titulo: 'Favoritos',
      icone: Star,
      funcoes: resolver(favoritos),
      vazio: personalizando
        ? 'Clique na estrela de um atalho para fixá-lo aqui.'
        : 'Nenhum favorito ainda. Use "Personalizar atalhos" e marque os que usa todo dia.',
    },
    {
      chave: 'recentes',
      titulo: 'Acessados recentemente',
      icone: Clock,
      funcoes: resolver(recentes),
      vazio: 'Nada acessado ainda nesta empresa — os últimos cinco aparecem aqui.',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
      {listas.map((lista) => (
        <section
          key={lista.chave}
          className="rounded-xl border border-border bg-card p-4 shadow-sm"
          aria-label={lista.titulo}
        >
          <h3 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase leading-4 tracking-wide text-muted-foreground">
            <lista.icone className="h-4 w-4 shrink-0" aria-hidden="true" />
            {lista.titulo}
          </h3>
          {lista.funcoes.length === 0 ? (
            <p className="text-sm leading-5 text-muted-foreground">{lista.vazio}</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {lista.funcoes.map((f) => (
                <li key={f.id}>
                  <Link
                    to={f.rota}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2',
                      'text-sm font-medium leading-5 text-foreground transition-colors',
                      'hover:border-primary/40 hover:bg-muted/40',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    )}
                  >
                    <f.icone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    {f.nome}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
