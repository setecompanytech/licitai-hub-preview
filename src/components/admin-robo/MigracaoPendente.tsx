import { AvisoDeContexto } from '@/components/gestao/SeloSituacao';
import { MIGRATION_DA_SEPARACAO } from './leitura';

/**
 * O estado "migração pendente", dito com o que falta e onde está o SQL.
 *
 * Quem vê esta tela é quem opera a plataforma — a pessoa que pode colar o SQL.
 * Então a mensagem nomeia o arquivo e mostra a resposta do banco, em vez de
 * um "tente mais tarde" que não levaria a lugar nenhum.
 */
export default function MigracaoPendente({
  assunto,
  detalhe,
}: {
  /** O que ainda não existe, com a tabela entre parênteses. */
  assunto: string;
  detalhe?: string | null;
}) {
  return (
    <AvisoDeContexto titulo="Migração pendente">
      {assunto} ainda não existe neste banco. Cole{' '}
      <code className="font-mono">{MIGRATION_DA_SEPARACAO}</code> no SQL Editor do Supabase e
      recarregue a tela.
      {detalhe && <span className="g-meta mt-1 block break-words">Resposta do banco: {detalhe}</span>}
    </AvisoDeContexto>
  );
}
