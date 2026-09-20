import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SeloPraefectusIA from '@/components/shared/SeloPraefectusIA';
import { Sparkles, Layers } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type ContratoEstrutura = {
  tipo_estrutura?: 'itens' | 'lotes' | string | null;
  tipo_estrutura_detectado_ia?: string | null;
  tipo_estrutura_confianca?: number | null;
};

export default function EstruturaDocumentoCard({ contratoId }: { contratoId: string }) {
  const [c, setC] = useState<ContratoEstrutura | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from('contratos')
      .select('tipo_estrutura, tipo_estrutura_detectado_ia, tipo_estrutura_confianca')
      .eq('id', contratoId)
      .single();
    if (data) setC(data as any);
  };

  useEffect(() => { load(); }, [contratoId]);

  if (!c || (!c.tipo_estrutura_detectado_ia && !c.tipo_estrutura)) return null;

  return (
    <Card className="border-primary-line bg-primary-tint p-4 shadow-none">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-start gap-2">
          <Sparkles aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
              Estrutura do documento
              <Badge variant="muted">
                Atual: {c.tipo_estrutura === 'lotes' ? 'Lotes (agrupados)' : 'Itens (individuais)'}
              </Badge>
              <SeloPraefectusIA />
            </div>
            {c.tipo_estrutura_detectado_ia && (
              <p className="text-xs text-muted-foreground">
                IA detectou: <strong>{c.tipo_estrutura_detectado_ia === 'lotes' ? 'Lotes' : 'Itens'}</strong>
                {typeof c.tipo_estrutura_confianca === 'number' && (
                  <> · {Math.round((c.tipo_estrutura_confianca || 0) * 100)}% confiança</>
                )}
                {c.tipo_estrutura_detectado_ia !== c.tipo_estrutura && (
                  <span className="ml-2 text-warning-ink font-medium">⚠ Diverge da estrutura atual</span>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Layers aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
          <Select
            value={(c.tipo_estrutura as string) || 'itens'}
            onValueChange={async (v: 'itens' | 'lotes') => {
              const { error } = await supabase.from('contratos').update({ tipo_estrutura: v } as any).eq('id', contratoId);
              if (error) { toast.error('Erro ao alterar estrutura'); return; }
              toast.success(`Estrutura alterada para ${v === 'lotes' ? 'Lotes' : 'Itens'}`);
              load();
            }}
          >
            <SelectTrigger className="w-[160px]" aria-label="Estrutura do documento"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="itens">Itens</SelectItem>
              <SelectItem value="lotes">Lotes</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </Card>
  );
}
