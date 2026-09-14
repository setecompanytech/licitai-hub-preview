import { useId } from 'react';
import { ListChecks, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import EstadoVazio from '@/components/shared/EstadoVazio';
import LicitacaoChat from '@/components/licitacoes/LicitacaoChat';
import type { LanceConfig } from '@/components/robo-lances/ConfigurarLanceDialog';
import { dataHoraDeBrasilia } from '@/components/workspace/robo/formatos';
import { useOperacoesDaDisputa, type OperacaoDaDisputa } from './useOperacoesDaDisputa';

export type AbaDosEventos = 'mural' | 'operacoes';

const ROTULO_DO_RESULTADO: Record<OperacaoDaDisputa['resultado'], string> = {
  sucesso: 'Sucesso',
  erro: 'Erro',
  info: 'Info',
};

const TOM_DO_RESULTADO: Record<OperacaoDaDisputa['resultado'], 'success' | 'danger' | 'info'> = {
  sucesso: 'success',
  erro: 'danger',
  info: 'info',
};

/**
 * Eventos da disputa — "o que já aconteceu?": o mural do processo e o que o
 * robô executou (sessões e lances).
 *
 * Largura inteira de propósito. Na tela antiga os eventos moravam na coluna
 * estreita da disputa selecionada, com 256 px de altura, e eram leitura
 * demorada espremida. Simulação e Auditoria saíram em 14/09/2026 — ferramentas
 * da operação Praefectus, hoje no Admin › Robô de Lances.
 *
 * A aba é controlada por quem monta: encerrar a disputa leva ao mural, onde o
 * resultado acabou de ser publicado.
 */
export default function EventosDaDisputa({
  lance,
  aba,
  aoMudarAba,
  gatilho,
}: {
  lance: LanceConfig;
  aba: AbaDosEventos;
  aoMudarAba: (aba: AbaDosEventos) => void;
  /** Muda quando algo novo pode ter acontecido — as operações releem. */
  gatilho: number;
}) {
  const idTitulo = useId();
  const { operacoes, carregando } = useOperacoesDaDisputa(lance.id, gatilho);

  return (
    <section aria-labelledby={idTitulo} className="g-cartao flex min-w-0 flex-col">
      <Tabs value={aba} onValueChange={(v) => aoMudarAba(v as AbaDosEventos)}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 id={idTitulo} className="g-titulo-secao text-foreground">
            Eventos
          </h2>
          <TabsList>
            <TabsTrigger value="mural">
              <MessageSquare className="mr-1.5 h-4 w-4" aria-hidden="true" /> Mural
            </TabsTrigger>
            <TabsTrigger value="operacoes">
              <ListChecks className="mr-1.5 h-4 w-4" aria-hidden="true" /> Operações
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="mural" className="m-0 h-80 p-4">
          {lance.licitacaoId ? (
            <LicitacaoChat licitacaoId={lance.licitacaoId} licitacaoNumero={lance.edital} />
          ) : (
            <EstadoVazio
              icone={<MessageSquare />}
              titulo="Esta disputa não está vinculada a um processo"
              descricao="O mural é o do processo. Vincule a disputa a um processo ao editá-la para acompanhar o mural aqui."
              tamanho="compacto"
              className="h-full"
            />
          )}
        </TabsContent>

        <TabsContent value="operacoes" className="m-0 max-h-96 space-y-2 overflow-y-auto p-4">
          {carregando ? (
            <p className="g-corpo text-muted-foreground" role="status">
              Consultando as sessões e os lances desta disputa…
            </p>
          ) : operacoes.length === 0 ? (
            <EstadoVazio
              icone={<ListChecks />}
              titulo="O robô ainda não operou nesta disputa"
              descricao='Use "Enviar ao robô" para abrir uma sessão. Cada sessão e cada lance aparecem aqui.'
              tamanho="compacto"
            />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {operacoes.map((op) => (
                <li key={op.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                  <span className="g-meta shrink-0 tabular-nums text-muted-foreground">
                    {dataHoraDeBrasilia(op.timestamp, { segundos: true })}
                  </span>
                  <Badge variant={TOM_DO_RESULTADO[op.resultado]}>{ROTULO_DO_RESULTADO[op.resultado]}</Badge>
                  <span className="g-corpo font-medium text-foreground">{op.acao}</span>
                  <span className="g-corpo min-w-0 basis-full text-muted-foreground sm:basis-auto">{op.detalhes}</span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}
