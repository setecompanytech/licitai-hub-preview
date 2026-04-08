import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FolderOpen, Plus, Loader2 } from 'lucide-react';
import { type ProcessoResumo, useProcessoAtivo } from '@/hooks/useProcessoAtivo';
import { toast } from 'sonner';

interface Props {
  onProcessoChange?: (id: string | null) => void;
}

export default function ProcessoSelector({ onProcessoChange }: Props) {
  const { processoId, setProcessoId, fetchProcessos } = useProcessoAtivo();
  const [processos, setProcessos] = useState<ProcessoResumo[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const data = await fetchProcessos();
    setProcessos(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const handleChange = (value: string) => {
    const id = value === '__none__' ? null : value;
    setProcessoId(id);
    onProcessoChange?.(id);
  };

  const statusColor = (s: string | null) => {
    switch (s) {
      case 'proposta': return 'bg-accent/15 text-accent';
      case 'vencida': case 'homologada': return 'bg-green-500/15 text-green-600';
      case 'perdida': return 'bg-destructive/15 text-destructive';
      case 'em_disputa': return 'bg-warning/15 text-warning';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando processos...
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <FolderOpen className="w-4 h-4 text-accent shrink-0" />
      <Select value={processoId || '__none__'} onValueChange={handleChange}>
        <SelectTrigger className="h-9 text-xs w-[380px] max-w-full">
          <SelectValue placeholder="Selecione o processo licitatório..." />
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          <SelectItem value="__none__">
            <span className="text-muted-foreground">Nova proposta (sem processo vinculado)</span>
          </SelectItem>
          {processos.map(p => (
            <SelectItem key={p.id} value={p.id}>
              <div className="flex items-center gap-2">
                <span className="font-medium">{p.numero || 'S/N'}</span>
                <span className="text-muted-foreground truncate max-w-[180px]">
                  {p.orgao ? `— ${p.orgao}` : ''}
                </span>
                {p.status && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${statusColor(p.status)}`}>
                    {p.status}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {processoId && (
        <Badge variant="outline" className="text-[10px] shrink-0">
          Processo vinculado
        </Badge>
      )}
    </div>
  );
}
