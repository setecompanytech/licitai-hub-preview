import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock, FileWarning, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useVencimentosDeDocumentos } from '@/hooks/useVencimentosDeDocumentos';
import type { SituacaoValidade } from '@/lib/documentos/situacao';

/**
 * Faixa de pendências do topo do painel.
 *
 * REGRA QUE ESTE COMPONENTE OBEDECE: nenhum alerta inventado. O que aparece
 * aqui são vencimentos REAIS de documento e certificado — as três fontes que o
 * calendário já lia (documentos de habilitação, certificado digital da empresa
 * e certificado dos portais), agora pelo hook compartilhado, com a mesma
 * contagem dos dois lados.
 *
 * Sem fonte disponível, a faixa não inventa: ou some, ou diz que não conseguiu
 * ler — nunca mostra "0 pendências", que afirmaria que está tudo em dia.
 *
 * As três situações são separadas de propósito, porque a ação é diferente:
 * vencido bloqueia habilitação AGORA; vence hoje ainda dá para usar e é o
 * último dia para renovar; vencendo é planejamento da semana.
 */

const FAIXAS: {
  situacao: SituacaoValidade;
  rotulo: (n: number) => string;
  descricao: string;
  icone: typeof AlertTriangle;
  pele: string;
}[] = [
  {
    situacao: 'vencido',
    rotulo: (n) => `${n} documento${n > 1 ? 's' : ''} vencido${n > 1 ? 's' : ''}`,
    descricao: 'Impede habilitação — renove antes da próxima sessão',
    icone: AlertTriangle,
    pele: 'border-destructive-line bg-destructive-tint text-destructive-ink',
  },
  {
    situacao: 'vence_hoje',
    rotulo: (n) => `${n} vence${n > 1 ? 'm' : ''} hoje`,
    descricao: 'Último dia de validade',
    icone: Clock,
    pele: 'border-destructive-line bg-destructive-tint text-destructive-ink',
  },
  {
    situacao: 'vencendo',
    rotulo: (n) => `${n} vence${n > 1 ? 'm' : ''} em até 30 dias`,
    descricao: 'Renovação a programar',
    icone: FileWarning,
    pele: 'border-warning-line bg-warning-tint text-warning-ink',
  },
];

export default function PendenciasPrioritarias() {
  const { documentos, carregando, erro, recarregar } = useVencimentosDeDocumentos();

  if (carregando) {
    return (
      <div role="status" aria-busy="true" className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <span className="sr-only">Carregando pendências</span>
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-10 w-56" />
        </div>
      </div>
    );
  }

  if (erro) {
    /* Princípio 3 do CLAUDE.md: falha silenciosa é proibida. Some com a faixa
       seria dizer "sem pendências" — e a pessoa concluiria que as certidões
       estão em dia. Isto aqui NÃO é um alerta fictício: é o aviso de que a
       leitura falhou, com a mensagem real e a retentativa. */
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <AlertTriangle className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-sm leading-5 text-muted-foreground">
          Não foi possível ler os vencimentos: {erro.message} Nada aqui significa que está tudo em dia.
        </p>
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={recarregar}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  const contagem = FAIXAS.map((f) => ({
    ...f,
    total: documentos.filter((d) => d.situacao === f.situacao).length,
  })).filter((f) => f.total > 0);

  if (contagem.length === 0) {
    // Uma linha só: a boa notícia não pode ocupar o melhor espaço da tela,
    // mas sumir sem dizer nada deixaria a dúvida de se foi apurado.
    return (
      <p className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm leading-5 text-muted-foreground shadow-sm">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
        Nenhum documento vencido ou a vencer nos próximos 30 dias.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-stretch">
      {contagem.map((f) => (
        <div
          key={f.situacao}
          className={cn('flex min-w-0 flex-1 items-center gap-3 rounded-xl border p-4 shadow-sm', f.pele)}
        >
          <f.icone className="h-5 w-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold leading-6">{f.rotulo(f.total)}</p>
            <p className="text-sm leading-5 opacity-90">{f.descricao}</p>
          </div>
          {/* O acesso à listagem: a agenda tem a aba Documentos com todos os
              vencimentos e o link para o registro de cada um. */}
          <Link
            to="/calendario"
            className="shrink-0 rounded-sm text-sm font-medium underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Ver
          </Link>
        </div>
      ))}
    </div>
  );
}
