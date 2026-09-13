import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { Sparkles, FileText, FileX, RefreshCw, Loader2, AlertTriangle, Calculator, ScrollText, Eye, Wand2, Bot, Cog, Scale } from 'lucide-react';
import EventoAuditoriaDetalheDialog from './EventoAuditoriaDetalheDialog';
import { toast } from 'sonner';
import { useAuthorization } from '@/hooks/useAuthorization';
import { abrasileirar, motivoDaRejeicao, resumoDaVinculacao } from '@/lib/contratos/auditoriaTexto';
import { IconeRecolher, lerRecolhida, gravarRecolhida } from '@/components/ui/secao-recolhivel';
import AbasGestao from '@/components/gestao/AbasGestao';
import AreaComPainel from '@/components/gestao/AreaComPainel';
import SeloSituacao, { ValorIndisponivel } from '@/components/gestao/SeloSituacao';
import { BlocoDoPainel } from '@/components/gestao/ListaDeCampos';

const CAMPO_LABELS: Record<string, string> = {
  auto_vinculacao_ata: 'Vínculo automático com a ATA',
  alerta_ata_classificar: 'ATA — classificar aditivos',
  alerta_ata_acrescimo_vedado: 'ATA — acréscimo vedado',
  alerta_ata_adesao: 'ATA — teto de adesões',
  numero_contrato: 'Nº do Contrato',
  numero_ata: 'Nº da ATA',
  objeto: 'Objeto',
  orgao_contratante: 'Órgão Contratante',
  modalidade: 'Modalidade',
  valor_global: 'Valor Global',
  valor_global_original: 'Valor Global (Original)',
  data_assinatura: 'Data de Assinatura',
  data_inicio: 'Data de Início',
  data_fim: 'Data de Fim',
  vigencia_meses: 'Vigência (meses)',
  validade_ata_meses: 'Validade da ATA (meses)',
  saldo_item_ata: 'Saldo de Item da ATA',
  valor_consumido_ata: 'Consumo da ATA',
  alerta_aditivo_valor: 'Alerta — Aditivo de Valor',
  alerta_aditivo_quantidade: 'Alerta — Aditivo de Quantidade',
};

const ORIGEM_META: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
  ia_extracao: { label: 'IA — Extração', variant: 'secondary', icon: Sparkles },
  recalculo_saldo: { label: 'Recálculo automático', variant: 'outline', icon: Calculator },
  recalculo_consumo_ata: { label: 'Consumo da ATA', variant: 'outline', icon: Calculator },
  alerta_limite_legal: { label: 'Alerta legal (Lei 14.133/21)', variant: 'destructive', icon: AlertTriangle },
};

/**
 * Quem produziu o evento.
 *
 * A coluna "Responsável" da referência é respondida pela ORIGEM, não por um
 * nome de pessoa: cada linha desta tabela nasce de uma rotina — a leitura do
 * documento, o gatilho de recálculo, a regra legal. A tabela guarda um
 * `user_id` (quem estava logado quando a rotina disparou), mas exibi-lo como
 * "responsável" atribuiria a uma pessoa uma decisão que ela não tomou, e
 * resolver o nome exigiria uma consulta nova só para dizer algo errado.
 */
const RESPONSAVEL_POR_ORIGEM: Record<string, { rotulo: string; icone: any }> = {
  ia_extracao: { rotulo: 'IA de leitura de documentos', icone: Bot },
  ia_rejeicao: { rotulo: 'IA de leitura de documentos', icone: Bot },
  recalculo_saldo: { rotulo: 'Rotina de recálculo', icone: Cog },
  recalculo_consumo_ata: { rotulo: 'Rotina de recálculo', icone: Cog },
  alerta_limite_legal: { rotulo: 'Regra legal do sistema', icone: Scale },
};

const formatVal = (campo: string, v: string | null, origem?: string | null) => {
  if (v == null || v === '') return '—';
  if (campo === 'auto_vinculacao_ata') return resumoDaVinculacao(v) ?? v;
  if (origem === 'ia_rejeicao') return motivoDaRejeicao(v) ?? v;
  if (campo.startsWith('valor') && !campo.startsWith('valor_consumido')) {
    const n = Number(v);
    if (Number.isFinite(n)) return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
  }
  if (campo.startsWith('data_')) {
    // `toLocaleDateString` de uma data inválida devolve a string "Invalid Date"
    // em vez de lançar — o try/catch nunca disparava, e o painel exibia isso.
    // O nome do campo tampouco prova que há data: `data_assinatura_posterior_a_inicio`
    // é um MOTIVO de rejeição, não um valor.
    const d = new Date(v + 'T00:00:00');
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('pt-BR');
  }
  const legivel = abrasileirar(v);
  return legivel.length > 200 ? legivel.slice(0, 200) + '…' : legivel;
};

interface AuditoriaRow {
  id: string;
  contrato_id: string;
  /**
   * Nulo com `arquivo_nome` preenchido significa que o arquivo FOI EXCLUÍDO —
   * a coluna é `ON DELETE SET NULL`, e o nome é texto que sobrevive de
   * propósito. Trilha que some junto com o documento não é trilha: bastaria
   * apagar o PDF para apagar o registro do que ele mudou.
   */
  arquivo_id: string | null;
  arquivo_nome: string | null;
  campo: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  origem: string;
  created_at: string;
}

export default function ContratoIaAuditoriaPanel({
  contratoId,
  aoVerDocumento,
}: {
  contratoId: string;
  /**
   * Abre o documento que originou o evento. Vem de fora porque quem guarda os
   * arquivos do contrato — e sabe assinar a URL do bucket — é a aba de
   * Arquivos; este painel só tem o `arquivo_id`. Sem a função, o botão "Ver
   * documento" simplesmente não aparece, em vez de virar link morto.
   */
  aoVerDocumento?: (arquivoId: string) => void;
}) {
  const [rows, setRows] = useState<AuditoriaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('todos');
  /** Linha marcada na tabela — abre o painel "Comparar alteração" ao lado. */
  const [eventoSelecionado, setEventoSelecionado] = useState<AuditoriaRow | null>(null);
  /** O mesmo evento, aberto no diálogo de conferência (contexto completo). */
  const [eventoEmConferencia, setEventoEmConferencia] = useState<AuditoriaRow | null>(null);
  const [reprocessando, setReprocessando] = useState(false);
  // O diário é consulta, não leitura diária: aberto, ocupa meia tela antes do
  // conteúdo da aba. Recolhido, sobra o cabeçalho com a contagem (e o alerta
  // legal, quando houver) — e a preferência fica lembrada por quem fechou.
  const [recolhido, setRecolhido] = useState(() => lerRecolhida('auditoria-contratos', false));
  const alternarRecolhido = () => {
    setRecolhido((atual) => { gravarRecolhida('auditoria-contratos', !atual); return !atual; });
  };
  // `isAdmin` do useUserRole inclui ADMIN DE EMPRESA. Este botão dispara um job
  // GLOBAL — reprocessa contratos de todas as empresas —, e a função no banco
  // exige has_role(uid,'admin'), que é só o admin do SISTEMA. A tela oferecia a
  // ação a quem o banco recusaria, e a pessoa só descobria pelo erro.
  const { isSystemAdmin } = useAuthorization();

  const handleReprocessarTodos = async () => {
    if (!confirm('Reprocessar TODOS os contratos com aditivos?\n\nEsta ação irá:\n• Remover alertas indevidos de aditivos de prazo/vigência\n• Recalcular alertas legais conforme art. 125 da Lei 14.133/21\n\nDeseja continuar?')) return;
    setReprocessando(true);
    try {
      const { data, error } = await supabase.rpc('reprocessar_alertas_aditivos_todos_contratos' as any);
      if (error) throw error;
      const r = data as any;
      toast.success(
        `Reprocessamento concluído: ${r?.contratos_processados ?? 0} contrato(s). ` +
        `${r?.alertas_removidos_prazo_vigencia ?? 0} alerta(s) indevido(s) de prazo/vigência removido(s).`
      );
      load();
    } catch (e: any) {
      toast.error(`Falha no reprocessamento: ${e?.message ?? 'erro desconhecido'}`);
    } finally {
      setReprocessando(false);
    }
  };

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('contrato_ia_auditoria')
      .select('*')
      .eq('contrato_id', contratoId)
      .order('created_at', { ascending: false })
      .limit(300);
    setRows((data as AuditoriaRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`contrato-auditoria-${contratoId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contrato_ia_auditoria', filter: `contrato_id=eq.${contratoId}` },
        () => { load(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [contratoId]);

  const counts = {
    todos: rows.length,
    ia: rows.filter(r => r.origem === 'ia_extracao').length,
    recalc: rows.filter(r => r.origem === 'recalculo_saldo' || r.origem === 'recalculo_consumo_ata').length,
    alertas: rows.filter(r => r.origem === 'alerta_limite_legal').length,
  };

  const filtered = rows.filter(r => {
    if (tab === 'todos') return true;
    if (tab === 'ia') return r.origem === 'ia_extracao';
    if (tab === 'recalc') return r.origem === 'recalculo_saldo' || r.origem === 'recalculo_consumo_ata';
    if (tab === 'alertas') return r.origem === 'alerta_limite_legal';
    return true;
  });

  /**
   * O selo dizia "Lei 14.133/21" para todo alerta legal — inclusive os de ATA,
   * que seguem o Decreto 11.462/2023. Anunciar a lei errada no rótulo desfaz a
   * distinção que o próprio alerta acabou de fazer.
   */
  const metaDaOrigem = (r: AuditoriaRow) =>
    r.campo?.startsWith('alerta_ata_')
      ? { label: 'Alerta legal (Decreto 11.462/23)', variant: 'destructive' as const, icon: AlertTriangle }
      : ORIGEM_META[r.origem] || { label: r.origem, variant: 'outline' as const, icon: ScrollText };

  /** Situação em texto + ícone + cor — nunca só cor. */
  const situacaoDoEvento = (r: AuditoriaRow) =>
    r.origem === 'alerta_limite_legal'
      ? { rotulo: 'Alerta legal', tom: 'critico' as const, explicacao: 'Limite legal ultrapassado ou em risco — exige providência' }
      : r.origem === 'ia_extracao'
        ? { rotulo: 'Preenchido pela IA', tom: 'ativo' as const, explicacao: 'Valor lido do documento e gravado no contrato — confira antes de usar' }
        : { rotulo: 'Recalculado', tom: 'neutro' as const, explicacao: 'Saldo ou consumo recalculado por rotina do sistema' };

  /**
   * O painel "Comparar alteração" da referência: o que o contrato dizia antes,
   * o que o documento propõe, campo a campo — com o documento fonte à mão.
   *
   * Os rótulos das duas colunas mudam quando a linha é ALERTA: ali não há
   * proposta de aditivo nenhuma, há um limite legal de um lado e a situação
   * detectada do outro. Chamar um teto do art. 125 de "proposto (novo aditivo)"
   * seria inverter o sentido do alerta.
   */
  const painelDeComparacao = (() => {
    const r = eventoSelecionado;
    if (!r) return null;
    const isAlerta = r.origem === 'alerta_limite_legal';
    const meta = metaDaOrigem(r);
    const situacao = situacaoDoEvento(r);
    const arquivoDisponivel = !!r.arquivo_id;
    return (
      <div className="flex flex-col gap-4">
        <BlocoDoPainel
          titulo="Comparar alteração"
          acao={<SeloSituacao tom={situacao.tom} explicacao={situacao.explicacao}>{situacao.rotulo}</SeloSituacao>}
        >
          <p className="g-corpo font-medium text-foreground">{CAMPO_LABELS[r.campo] || r.campo}</p>
          <p className="g-meta text-muted-foreground">
            {meta.label} · {new Date(r.created_at).toLocaleString('pt-BR')}
          </p>
        </BlocoDoPainel>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="g-cartao p-3">
            <p className="g-meta text-muted-foreground">
              {isAlerta ? 'Limite legal' : 'Antes (contrato atual)'}
            </p>
            <p className="g-corpo mt-1 break-words">{formatVal(r.campo, r.valor_anterior)}</p>
          </div>
          <div className={`g-cartao p-3 ${isAlerta ? 'border-destructive-line bg-destructive-tint' : 'border-primary/40'}`}>
            <p className="g-meta text-muted-foreground">
              {isAlerta ? 'Situação detectada' : 'Proposto (novo aditivo)'}
            </p>
            <p className={`g-corpo mt-1 break-words font-medium ${isAlerta ? 'text-destructive-ink' : 'text-foreground'}`}>
              {formatVal(r.campo, r.valor_novo, r.origem)}
            </p>
          </div>
        </div>

        <BlocoDoPainel titulo="Documento fonte">
          {r.arquivo_nome ? (
            <p className={`g-corpo inline-flex items-center gap-1.5 ${arquivoDisponivel ? '' : 'text-warning-ink'}`}>
              {arquivoDisponivel ? <FileText className="h-4 w-4 shrink-0" /> : <FileX className="h-4 w-4 shrink-0" />}
              <span className={arquivoDisponivel ? '' : 'line-through opacity-80'}>{r.arquivo_nome}</span>
              {!arquivoDisponivel && (
                // Sem o aviso, a linha exibe o nome de um PDF que já não está
                // na aba e manda a pessoa procurar o que não existe. O registro
                // continua valendo — o documento é que saiu.
                <span>· arquivo excluído do contrato</span>
              )}
            </p>
          ) : (
            <ValorIndisponivel razao="Evento sem documento de origem" />
          )}
        </BlocoDoPainel>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="g-controle" onClick={() => setEventoEmConferencia(r)}>
            <Eye className="mr-1.5 h-3.5 w-3.5" /> Conferir alteração
          </Button>
          {aoVerDocumento && arquivoDisponivel && (
            <Button size="sm" variant="outline" className="g-controle" onClick={() => aoVerDocumento(r.arquivo_id!)}>
              <FileText className="mr-1.5 h-3.5 w-3.5" /> Ver documento
            </Button>
          )}
        </div>
      </div>
    );
  })();

  return (
    <Card className="g-cartao p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <h3 className="g-titulo-secao text-foreground">Auditoria &amp; Recálculos Automáticos</h3>
          <Badge variant="secondary">{rows.length}</Badge>
          {counts.alertas > 0 && (
            <SeloSituacao tom="critico">
              {counts.alertas} alerta{counts.alertas > 1 ? 's' : ''} legal{counts.alertas > 1 ? 'is' : ''}
            </SeloSituacao>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isSystemAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReprocessarTodos}
              disabled={reprocessando}
              className="shrink-0 gap-1"
              title="Reprocessar todos os contratos: limpa alertas indevidos de aditivos de prazo/vigência e recalcula conforme Lei 14.133/21"
            >
              {reprocessando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              <span className="hidden whitespace-nowrap sm:inline">Reprocessar aditivos</span>
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="shrink-0" aria-label="Atualizar lista" title="Atualizar lista">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={alternarRecolhido} className="shrink-0"
            title={recolhido ? 'Abrir a lista' : 'Recolher a lista'} aria-expanded={!recolhido}>
            <IconeRecolher aberto={!recolhido} className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!recolhido && (
        <div className="flex flex-col gap-3">
          <AbasGestao
            abas={[
              { valor: 'todos', rotulo: 'Todos', contagem: counts.todos },
              { valor: 'ia', rotulo: 'IA', contagem: counts.ia },
              { valor: 'recalc', rotulo: 'Recálculos', contagem: counts.recalc },
              { valor: 'alertas', rotulo: 'Alertas legais', contagem: counts.alertas },
            ]}
            valor={tab}
            aoMudar={(v) => { setTab(v); setEventoSelecionado(null); }}
          />

          {loading ? (
            <div className="space-y-2" aria-busy="true" aria-label="Carregando eventos">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="g-corpo py-6 text-center text-muted-foreground">
              Nenhum evento registrado nesta categoria.
            </div>
          ) : (
            // A tabela da referência — Data · Evento · Origem · Responsável ·
            // Situação —, com o comparativo no painel ao lado. Antes eram
            // cartões de 4 linhas numa rolagem própria de 360px: cada evento
            // custava meia tela, e a comparação antes/depois vinha espremida
            // dentro do cartão.
            <AreaComPainel
              painel={painelDeComparacao}
              tituloPainel="Comparar alteração"
              aoFechar={() => setEventoSelecionado(null)}
            >
              <div className="max-h-[28rem] overflow-y-auto rounded-[var(--g-raio)] border">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="g-meta whitespace-nowrap">Data</TableHead>
                        <TableHead className="g-meta whitespace-nowrap">Evento</TableHead>
                        <TableHead className="g-meta whitespace-nowrap">Origem</TableHead>
                        <TableHead className="g-meta whitespace-nowrap">Responsável</TableHead>
                        <TableHead className="g-meta whitespace-nowrap">Situação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((r) => {
                        const meta = metaDaOrigem(r);
                        const situacao = situacaoDoEvento(r);
                        const responsavel = RESPONSAVEL_POR_ORIGEM[r.origem];
                        const IconeResponsavel = responsavel?.icone ?? ScrollText;
                        const selecionado = eventoSelecionado?.id === r.id;
                        return (
                          <TableRow
                            key={r.id}
                            data-state={selecionado ? 'selected' : undefined}
                            onClick={() => setEventoSelecionado(r)}
                            className={`cursor-pointer ${selecionado ? 'border-l-2 border-l-primary' : ''}`}
                          >
                            <TableCell className="g-meta whitespace-nowrap tabular-nums text-muted-foreground">
                              {new Date(r.created_at).toLocaleString('pt-BR')}
                            </TableCell>
                            <TableCell className="g-corpo max-w-[18rem]">
                              <span className="block truncate font-medium text-foreground">
                                {CAMPO_LABELS[r.campo] || r.campo}
                              </span>
                              {r.arquivo_nome && (
                                <span
                                  className={`g-meta inline-flex max-w-full items-center gap-1 ${
                                    r.arquivo_id ? 'text-muted-foreground' : 'text-warning-ink'
                                  }`}
                                  title={r.arquivo_id ? undefined : 'O arquivo de origem foi excluído do contrato. O registro permanece.'}
                                >
                                  {r.arquivo_id ? <FileText className="h-3 w-3 shrink-0" /> : <FileX className="h-3 w-3 shrink-0" />}
                                  <span className={`truncate ${r.arquivo_id ? '' : 'line-through opacity-80'}`}>{r.arquivo_nome}</span>
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="g-meta whitespace-nowrap">
                              <Badge variant={meta.variant} className="g-meta gap-1">
                                <meta.icon className="h-3 w-3" aria-hidden="true" />
                                {meta.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="g-meta whitespace-nowrap text-muted-foreground">
                              {responsavel ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <IconeResponsavel className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                  {responsavel.rotulo}
                                </span>
                              ) : (
                                <ValorIndisponivel razao="Origem não catalogada" />
                              )}
                            </TableCell>
                            <TableCell className="g-meta whitespace-nowrap">
                              <SeloSituacao tom={situacao.tom} explicacao={situacao.explicacao}>
                                {situacao.rotulo}
                              </SeloSituacao>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </AreaComPainel>
          )}
        </div>
      )}

      <EventoAuditoriaDetalheDialog
        evento={eventoEmConferencia}
        open={!!eventoEmConferencia}
        onOpenChange={(o) => !o && setEventoEmConferencia(null)}
      />
    </Card>
  );
}
