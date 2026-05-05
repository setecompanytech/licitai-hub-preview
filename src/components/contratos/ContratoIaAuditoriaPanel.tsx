import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { Sparkles, FileText, RefreshCw, Loader2, AlertTriangle, Calculator, ScrollText, Eye, Wand2 } from 'lucide-react';
import EventoAuditoriaDetalheDialog from './EventoAuditoriaDetalheDialog';
import { toast } from 'sonner';
import { useUserRole } from '@/hooks/useUserRole';

const CAMPO_LABELS: Record<string, string> = {
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

const formatVal = (campo: string, v: string | null) => {
  if (v == null || v === '') return '—';
  if (campo.startsWith('valor') && !campo.startsWith('valor_consumido')) {
    const n = Number(v);
    if (Number.isFinite(n)) return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
  }
  if (campo.startsWith('data_')) {
    try { return new Date(v + 'T00:00:00').toLocaleDateString('pt-BR'); } catch { return v; }
  }
  return v.length > 200 ? v.slice(0, 200) + '…' : v;
};

interface AuditoriaRow {
  id: string;
  contrato_id: string;
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
    const meta = ORIGEM_META[r.origem] || { label: r.origem, variant: 'outline' as const, icon: ScrollText };
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
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <FileText className="h-3 w-3" />
                {r.arquivo_nome}
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
            <div className="font-mono break-words">{formatVal(r.campo, r.valor_anterior)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">{isAlerta ? 'Situação detectada' : 'Valor preenchido'}</div>
            <div className={`font-mono break-words ${isAlerta ? 'text-destructive font-semibold' : 'text-primary'}`}>
              {formatVal(r.campo, r.valor_novo)}
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
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <h3 className="font-semibold text-sm">Auditoria & Recálculos Automáticos</h3>
          <Badge variant="secondary">{rows.length}</Badge>
          {counts.alertas > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {counts.alertas} alerta{counts.alertas > 1 ? 's' : ''} legal{counts.alertas > 1 ? 'is' : ''}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="shrink-0">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

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

      <EventoAuditoriaDetalheDialog
        evento={eventoSelecionado}
        open={!!eventoSelecionado}
        onOpenChange={(o) => !o && setEventoSelecionado(null)}
      />
    </Card>
  );
}
