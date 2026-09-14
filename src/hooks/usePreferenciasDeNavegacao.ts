import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';

/**
 * Favoritos e acessos recentes das funções do sistema.
 *
 * Mora em `localStorage`, por decisão do comando de 13/09/2026 ("se não houver
 * persistência de preferências, use armazenamento local por usuário e empresa,
 * sem dados sensíveis; não crie tabelas apenas para esta etapa"). O Financeiro
 * já fazia assim para as próprias pastas, e aqui a mecânica é a mesma, um
 * nível acima.
 *
 * A CHAVE inclui usuário E empresa, e isso não é zelo excessivo: o mesmo
 * navegador atende o contador que administra três empresas. Sem a empresa na
 * chave, os atalhos da construtora apareceriam ao abrir a transportadora — e
 * "recentes" passaria a listar telas que a pessoa não visitou naquele
 * contexto, que é pior que não ter recentes.
 *
 * O que NÃO entra aqui: nada além de rota. Nome de cliente, número de processo
 * e valor ficam de fora — `localStorage` não é lugar de dado de negócio, e o
 * comando pede "sem dados sensíveis" por escrito.
 */

const LIMITE_RECENTES = 5;

function chave(tipo: 'favoritos' | 'recentes', userId?: string, empresaId?: string): string {
  return `praefectus:nav:${tipo}:${userId ?? 'anon'}:${empresaId ?? 'sem-empresa'}`;
}

function ler(k: string): string[] {
  try {
    const bruto = window.localStorage.getItem(k);
    const lista = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(lista) ? lista.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    // Modo anônimo, cota estourada, JSON corrompido por versão anterior. Em
    // todos, a resposta é a mesma: começa vazio. Preferência de navegação não
    // pode derrubar a navegação.
    return [];
  }
}

function gravar(k: string, lista: string[]): void {
  try {
    window.localStorage.setItem(k, JSON.stringify(lista));
  } catch {
    /* idem — a lista continua valendo em memória nesta sessão. */
  }
}

export function usePreferenciasDeNavegacao() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const chaveFavoritos = chave('favoritos', user?.id, empresaAtiva?.id);
  const chaveRecentes = chave('recentes', user?.id, empresaAtiva?.id);

  const [favoritos, setFavoritos] = useState<string[]>([]);
  const [recentes, setRecentes] = useState<string[]>([]);

  // Relê ao trocar de empresa ou de usuário — é o momento em que as listas
  // deixam de ser as certas.
  useEffect(() => {
    setFavoritos(ler(chaveFavoritos));
    setRecentes(ler(chaveRecentes));
  }, [chaveFavoritos, chaveRecentes]);

  const alternarFavorito = useCallback(
    (id: string) => {
      setFavoritos((atual) => {
        const proximo = atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id];
        gravar(chaveFavoritos, proximo);
        return proximo;
      });
    },
    [chaveFavoritos],
  );

  /**
   * Registra um acesso. O mais recente vai para o topo e não duplica: quem
   * visita a mesma tela cinco vezes não quer cinco linhas iguais ocupando a
   * lista inteira.
   */
  const registrarAcesso = useCallback(
    (id: string) => {
      setRecentes((atual) => {
        const proximo = [id, ...atual.filter((x) => x !== id)].slice(0, LIMITE_RECENTES);
        gravar(chaveRecentes, proximo);
        return proximo;
      });
    },
    [chaveRecentes],
  );

  const ehFavorito = useCallback((id: string) => favoritos.includes(id), [favoritos]);

  return { favoritos, recentes, alternarFavorito, registrarAcesso, ehFavorito };
}
