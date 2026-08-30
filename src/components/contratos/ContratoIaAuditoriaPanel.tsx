import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { Sparkles, FileText, FileX, RefreshCw, Loader2, AlertTriangle, Calculator, ScrollText, Eye, Wand2 } from 'lucide-react';
import EventoAuditoriaDetalheDialog from './EventoAuditoriaDetalheDialog';
import { toast } from 'sonner';
import { useAuthorization } from '@/hooks/useAuthorization';
import { abrasileirar, motivoDaRejeicao, resumoDaVinculacao } from '@/lib/contratos/auditoriaTexto';
import { IconeRecolher, lerRecolhida, gravarRecolhida } from '@/components/ui/secao-recolhivel';

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

export default function ContratoIaAuditoriaPanel({ contratoId }: { contratoId: string }) {
  const [rows, setRows] = useState<AuditoriaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('todos');
  const [eventoSelecionado, setEventoSelecionado] = useState<AuditoriaRow | null>(null);
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

  const renderRow = (r: AuditoriaRow) => {
    // O selo dizia "Lei 14.133/21" para todo alerta legal — inclusive os de ATA,
    // que seguem o Decreto 11.462/2023. Anunciar a lei errada no rótulo desfaz
    // a distinção que o próprio alerta acabou de fazer.
    const meta = r.campo?.startsWith('alerta_ata_')
      ? { label: 'Alerta legal (Decreto 11.462/23)', variant: 'destructive' as const, icon: AlertTriangle }
      : ORIGEM_META[r.origem] || { label: r.origem, variant: 'outline' as const, icon: ScrollText };
    const Icon = meta.icon;
    const isAlerta = r.origem === 'alerta_limite_legal';
    return (
      <li
        key={r.id}
        onClick={() => setEventoSelecionado(r)}
        className={`border rounded-md p-3 cursor-pointer transition-colors hover:bg-accent/50 ${isAlerta ? 'bg-destructive/10 border-destructive/40 hover:bg-destructive/15' : 'bg-muted/30'}`}
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={meta.variant} className="text-xs gap-1 shrink-0">
              <Icon className="h-3 w-3" />
              {meta.label}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {CAMPO_LABELS[r.campo] || r.campo}
            </Badge>
            {r.arquivo_nome && (
              /* Sem o aviso, a linha exibe o nome de um PDF que já não está
                 na aba e manda a pessoa procurar o que não existe. O registro
                 continua valendo — o documento é que saiu. */
              <span
                className={`inline-flex items-center gap-1 text-xs ${
                  r.arquivo_id ? 'text-muted-foreground' : 'text-warning'
                }`}
                title={r.arquivo_id ? undefined : 'O arquivo de origem foi excluído do contrato. O registro permanece.'}
              >
                {r.arquivo_id
                  ? <FileText className="h-3 w-3" />
                  : <FileX className="h-3 w-3" />}
                <span className={r.arquivo_id ? '' : 'line-through opacity-80'}>{r.arquivo_nome}</span>
                {!r.arquivo_id && <span className="not-italic">· arquivo excluído</span>}
              </span>
            )}
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
            {new Date(r.created_at).toLocaleString('pt-BR')}
            <Eye className="h-3 w-3 opacity-60" />
          </span>
        </div>
        <div className="text-xs grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
          <div>
            <div className="text-muted-foreground">{isAlerta ? 'Limite legal' : 'Valor anterior'}</div>
            {/* Fonte comum: o diário é texto para gente ler, não trecho de
                código — a monoespaçada gritava "técnico" e cansava a leitura. */}
            <div className="break-words">{formatVal(r.campo, r.valor_anterior)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">{isAlerta ? 'Situação detectada' : 'Valor preenchido'}</div>
            <div className={`break-words ${isAlerta ? 'text-destructive font-semibold' : 'text-foreground font-medium'}`}>
              {formatVal(r.campo, r.valor_novo, r.origem)}
            </div>
          </div>
        </div>
      </li>
    );
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground shrink-0" />
          <h3 className="font-semibold text-sm">Auditoria & Recálculos Automáticos</h3>
          <Badge variant="secondary">{rows.length}</Badge>
          {counts.alertas > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {counts.alertas} alerta{counts.alertas > 1 ? 's' : ''} legal{counts.alertas > 1 ? 'is' : ''}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isSystemAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReprocessarTodos}
              disabled={reprocessando}
              className="gap-1 shrink-0"
              title="Reprocessar todos os contratos: limpa alertas indevidos de aditivos de prazo/vigência e recalcula conforme Lei 14.133/21"
            >
              {reprocessando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              <span className="hidden sm:inline whitespace-nowrap">Reprocessar aditivos</span>
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="shrink-0">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={alternarRecolhido} className="shrink-0"
            title={recolhido ? 'Abrir a lista' : 'Recolher a lista'} aria-expanded={!recolhido}>
            <IconeRecolher aberto={!recolhido} className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!recolhido && (
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-3">
          <TabsTrigger value="todos" className="text-xs">Todos ({counts.todos})</TabsTrigger>
          <TabsTrigger value="ia" className="text-xs">IA ({counts.ia})</TabsTrigger>
          <TabsTrigger value="recalc" className="text-xs">Recálculos ({counts.recalc})</TabsTrigger>
          <TabsTrigger value="alertas" className="text-xs">
            Alertas legais ({counts.alertas})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-0">
          {loading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Nenhum evento registrado nesta categoria.
            </div>
          ) : (
            <ScrollArea className="h-[360px] pr-2">
              <ul className="space-y-2">{filtered.map(renderRow)}</ul>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
      )}

      <EventoAuditoriaDetalheDialog
        evento={eventoSelecionado}
        open={!!eventoSelecionado}
        onOpenChange={(o) => !o && setEventoSelecionado(null)}
      />
    </Card>
  );
}
