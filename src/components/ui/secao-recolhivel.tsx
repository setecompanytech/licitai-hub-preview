import { useCallback, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Seção que se recolhe, e lembra que foi recolhida.
 *
 * Um painel de avisos é útil na primeira leitura e vira parede depois dela:
 * quem já sabe que faltam cinco documentos não precisa da lista ocupando meia
 * tela em toda visita. Recolher devolve o espaço ao que a pessoa veio fazer.
 *
 * O estado fica no navegador porque fechar é preferência de quem lê, não dado
 * do negócio — e, sem lembrar, a seção reabriria a cada navegação e o gesto não
 * teria servido para nada.
 */

/**
 * Triângulo sobre linha (recolher) e linha sobre triângulo (expandir): o
 * desenho mostra para onde o conteúdo vai, não uma direção abstrata.
 */
export function IconeRecolher({ aberto, className }: { aberto: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {aberto ? (
        <>
          <path d="M12 6.5 19 15H5z" />
          <path d="M5 19h14" />
        </>
      ) : (
        <>
          <path d="M5 5h14" />
          <path d="M12 17.5 5 9h14z" />
        </>
      )}
    </svg>
  );
}

const chaveDoArmazem = (id: string) => `praefectus:secao-recolhida:${id}`;

export function lerRecolhida(id: string, padrao: boolean): boolean {
  try {
    const v = localStorage.getItem(chaveDoArmazem(id));
    return v === null ? padrao : v === '1';
  } catch {
    // Navegador sem localStorage não pode derrubar a tela: sem memória, a
    // seção apenas volta ao padrão a cada visita.
    return padrao;
  }
}

type Props = {
  /** Identidade estável da seção — é a chave da memória. */
  id: string;
  titulo: ReactNode;
  children: ReactNode;
  /** Nasce recolhida? Útil para aviso longo que já foi lido antes. */
  recolhidaPorPadrao?: boolean;
  className?: string;
  classNameTitulo?: string;
  /** Cor do ícone, para acompanhar a gravidade do aviso. */
  classNameIcone?: string;
  icone?: ReactNode;
};

export default function SecaoRecolhivel({
  id,
  titulo,
  children,
  recolhidaPorPadrao = false,
  className,
  classNameTitulo,
  classNameIcone,
  icone,
}: Props) {
  const [aberta, setAberta] = useState(() => !lerRecolhida(id, recolhidaPorPadrao));

  const alternar = useCallback(() => {
    setAberta((atual) => {
      const nova = !atual;
      try {
        localStorage.setItem(chaveDoArmazem(id), nova ? '0' : '1');
      } catch {
        /* ver lerRecolhida */
      }
      return nova;
    });
  }, [id]);

  return (
    <div className={className}>
      <div className="flex items-start gap-3">
        {icone}
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={alternar}
            aria-expanded={aberta}
            title={aberta ? 'Recolher a lista' : 'Abrir a lista'}
            className={cn(
              'flex w-full items-center gap-2 text-left transition-opacity hover:opacity-80',
              classNameTitulo,
            )}
          >
            <span className="min-w-0 flex-1">{titulo}</span>
            <IconeRecolher aberto={aberta} className={cn('h-4 w-4 shrink-0', classNameIcone)} />
          </button>
          {aberta && <div className="animate-fade-in">{children}</div>}
        </div>
      </div>
    </div>
  );
}

/** Grava a preferência de quem lê. Falha de armazenamento não derruba a tela. */
export function gravarRecolhida(id: string, recolhida: boolean): void {
  try {
    localStorage.setItem(chaveDoArmazem(id), recolhida ? '1' : '0');
  } catch {
    /* ver lerRecolhida */
  }
}
