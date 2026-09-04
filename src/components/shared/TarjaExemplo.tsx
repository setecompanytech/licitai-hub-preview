import { FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Marca um bloco cujos números NÃO vêm do banco.
 *
 * Existe porque gráfico bonito com número inventado é pior que gráfico feio
 * com número inventado: a paleta nova, a sombra e a tipografia caprichada
 * emprestam credibilidade que o dado por trás não tem. Se a tela vai ficar
 * mais convincente, o aviso precisa ficar mais visível junto.
 *
 * Regra de uso: **todo bloco com dado fixo no código leva esta tarja.** Sem
 * exceção para "é só um exemplo" ou "todo mundo sabe" — quem abre a tela pela
 * primeira vez não sabe, e é justamente quem toma decisão errada.
 *
 * Quando o bloco passar a ler o banco, a tarja sai junto. Ela sobrando numa
 * tela real é ruído; faltando numa tela falsa é o problema que ela evita.
 */
export default function TarjaExemplo({
  titulo = 'Dados de exemplo',
  detalhe,
  className,
}: {
  titulo?: string;
  /** O que falta para virar real, quando já se sabe. */
  detalhe?: string;
  className?: string;
}) {
  return (
    <span
      role="note"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-warning-line bg-warning-tint',
        'px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-warning-ink',
        className,
      )}
      title={detalhe ?? 'Números ilustrativos — esta seção ainda não lê o banco.'}
    >
      <FlaskConical className="w-3 h-3 shrink-0" aria-hidden="true" />
      {titulo}
    </span>
  );
}
