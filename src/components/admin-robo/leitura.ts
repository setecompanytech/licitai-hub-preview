/**
 * Leitura de uma tabela da plataforma, com os quatro estados que a tela
 * precisa distinguir: carregando, pronta, migração pendente e erro.
 *
 * Migração pendente não é erro comum — mesma decisão de
 * `workspace/robo/consultas.ts`, de onde vem o reconhecimento. O SQL deste
 * corte é colado à mão no editor, e publicar a tela antes dele devolve
 * 42P01 / PGRST205. "Tentar novamente" não resolve isso; aplicar a migration
 * resolve, e é o que a tela diz. Tratar como vazio seria pior: "nenhum aviso"
 * quando a verdade é "ainda não existe onde guardar avisos".
 */
import { useCallback, useEffect, useState } from 'react';
import { ehMigracaoPendente } from '@/components/workspace/robo/consultas';

export { ehMigracaoPendente };

export type EstadoDaLeitura = 'carregando' | 'pronta' | 'migracao_pendente' | 'erro';

export interface RespostaDoBanco {
  data: unknown;
  error: unknown;
}

export interface LeituraDaPlataforma<T> {
  dados: T | null;
  estado: EstadoDaLeitura;
  /** Mensagem REAL do banco (princípio 3), quando houve falha. */
  erro: string | null;
  recarregar: () => void;
}

export const MIGRATION_DA_SEPARACAO =
  'supabase/migrations/20260914000004_robo_separacao_plataforma.sql';

export function mensagemDoErro(erro: unknown): string {
  if (!erro) return 'O banco recusou sem mensagem.';
  if (typeof erro === 'string') return erro;
  const e = erro as { message?: string; details?: string; code?: string };
  const texto = [e.message, e.details].filter(Boolean).join(' — ') || String(erro);
  return e.code ? `${texto} (${e.code})` : texto;
}

/**
 * `ler` precisa ter identidade estável — função de módulo ou `useCallback`.
 * Ela está na lista de dependências do efeito: uma função nova a cada render
 * leria o banco em laço.
 */
export function useLeituraDaPlataforma<T>(
  ler: () => PromiseLike<RespostaDoBanco>,
): LeituraDaPlataforma<T> {
  const [versao, setVersao] = useState(0);
  const [estado, setEstado] = useState<EstadoDaLeitura>('carregando');
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelada = false;
    setEstado('carregando');

    const falhar = (e: unknown) => {
      if (cancelada) return;
      // Linha velha ao lado de um aviso de falha parece dado atual. Some.
      setDados(null);
      setErro(mensagemDoErro(e));
      setEstado(ehMigracaoPendente(e) ? 'migracao_pendente' : 'erro');
    };

    Promise.resolve()
      .then(() => ler())
      .then(({ data, error }) => {
        if (error) return falhar(error);
        if (cancelada) return;
        setDados((data ?? null) as T | null);
        setErro(null);
        setEstado('pronta');
      })
      .catch(falhar);

    return () => {
      cancelada = true;
    };
  }, [ler, versao]);

  const recarregar = useCallback(() => setVersao((v) => v + 1), []);

  return { dados, estado, erro, recarregar };
}
