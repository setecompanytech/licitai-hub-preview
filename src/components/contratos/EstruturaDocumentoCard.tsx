import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
    <Card className="p-4 border border-accent/20 bg-accent/5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-accent mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            <p className="text-xs font-semibold flex items-center gap-2">
              Estrutura do documento
              <Badge variant="outline" className="text-[10px] font-normal">
                Atual: {c.tipo_estrutura === 'lotes' ? 'Lotes (agrupados)' : 'Itens (individuais)'}
              </Badge>
            </p>
            {c.tipo_estrutura_detectado_ia && (
              <p className="text-[11px] text-muted-foreground">
                IA detectou: <strong>{c.tipo_estrutura_detectado_ia === 'lotes' ? 'Lotes' : 'Itens'}</strong>
                {typeof c.tipo_estrutura_confianca === 'number' && (
                  <> · {Math.round((c.tipo_estrutura_confianca || 0) * 100)}% confiança</>
                )}
                {c.tipo_estrutura_detectado_ia !== c.tipo_estrutura && (
                  <span className="ml-2 text-warning font-medium">⚠ Diverge da estrutura atual</span>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-muted-foreground" />
          <Select
            value={(c.tipo_estrutura as string) || 'itens'}
            onValueChange={async (v: 'itens' | 'lotes') => {
              const { error } = await supabase.from('contratos').update({ tipo_estrutura: v } as any).eq('id', contratoId);
              if (error) { toast.error('Erro ao alterar estrutura'); return; }
              toast.success(`Estrutura alterada para ${v === 'lotes' ? 'Lotes' : 'Itens'}`);
              load();
            }}
          >
            <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
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
