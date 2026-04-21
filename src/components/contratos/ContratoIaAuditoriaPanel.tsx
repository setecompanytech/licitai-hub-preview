import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { Sparkles, FileText, RefreshCw, Loader2 } from 'lucide-react';

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
};

const formatVal = (campo: string, v: string | null) => {
  if (v == null || v === '') return '—';
  if (campo.startsWith('valor')) {
    const n = Number(v);
    return Number.isFinite(n) ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n) : v;
  }
  if (campo.startsWith('data_')) {
    try { return new Date(v + 'T00:00:00').toLocaleDateString('pt-BR'); } catch { return v; }
  }
  return v.length > 80 ? v.slice(0, 80) + '…' : v;
};

interface AuditoriaRow {
  id: string;
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

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('contrato_ia_auditoria')
      .select('*')
      .eq('contrato_id', contratoId)
      .order('created_at', { ascending: false })
      .limit(200);
    setRows((data as AuditoriaRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [contratoId]);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Auditoria de Preenchimento Automático (IA)</h3>
          <Badge variant="secondary">{rows.length}</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-6 text-center">Carregando…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">
          Nenhum preenchimento automático registrado para este registro.
        </div>
      ) : (
        <ScrollArea className="h-[320px] pr-2">
          <ul className="space-y-2">
            {rows.map(r => (
              <li key={r.id} className="border rounded-md p-3 bg-muted/30">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 flex-wrap">
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
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString('pt-BR')}
                  </span>
                </div>
                <div className="text-xs grid grid-cols-2 gap-2 mt-1">
                  <div>
                    <div className="text-muted-foreground">Valor anterior</div>
                    <div className="font-mono break-words">{formatVal(r.campo, r.valor_anterior)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Valor preenchido</div>
                    <div className="font-mono text-primary break-words">{formatVal(r.campo, r.valor_novo)}</div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </Card>
  );
}
