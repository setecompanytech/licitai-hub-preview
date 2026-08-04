import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useProcessoAtivo, type ProcessoResumo } from '@/hooks/useProcessoAtivo';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FolderOpen, X } from 'lucide-react';

const HIDDEN_ROUTES = ['/dashboard', '/configuracoes', '/empresas', '/equipe', '/admin'];

const statusColor = (s: string | null) => {
  switch (s) {
    case 'proposta': return 'bg-accent/15 text-accent border-accent/30';
    case 'vencida': case 'homologada': return 'bg-green-500/15 text-green-600 border-green-500/30';
    case 'perdida': return 'bg-destructive/15 text-destructive border-destructive/30';
    case 'em_disputa': return 'bg-warning/15 text-warning border-warning/30';
    default: return 'bg-muted text-muted-foreground border-border';
  }
};

export default function GlobalProcessoBar() {
  const { processoId, processo, setProcessoId, fetchProcessos } = useProcessoAtivo();
  const [processos, setProcessos] = useState<ProcessoResumo[]>([]);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => { fetchProcessos().then(setProcessos); }, [fetchProcessos, processoId]);

  if (HIDDEN_ROUTES.some(r => location.pathname.startsWith(r))) return null;

  return (
    <div className="sticky top-0 z-30 bg-card/95 backdrop-blur-sm border-b border-border/60 shadow-sm">
      <div className="max-w-[1440px] mx-auto px-3 sm:px-6 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          <FolderOpen className="w-4 h-4 text-accent shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden sm:inline">
            Processo Ativo
          </span>

          <Select value={processoId || '__none__'} onValueChange={(v) => setProcessoId(v === '__none__' ? null : v)}>
            <SelectTrigger className="h-8 text-xs w-[300px] sm:w-[380px] max-w-full">
              <SelectValue placeholder="Selecionar processo..." />
            </SelectTrigger>
            <SelectContent className="max-h-[320px]">
              <SelectItem value="__none__">
                <span className="text-muted-foreground">Nenhum processo selecionado</span>
              </SelectItem>
              {processos.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.numero || 'S/N'}</span>
                    <span className="text-muted-foreground truncate max-w-[180px]">
                      {p.orgao ? `— ${p.orgao}` : ''}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {processo && (
            <>
              <Badge variant="outline" className={`text-xs ${statusColor(processo.status)}`}>
                {processo.status || 'sem status'}
              </Badge>
              {processo.valor_estimado != null && (
                <Badge variant="outline" className="text-xs">
                  R$ {Number(processo.valor_estimado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </Badge>
              )}
            </>
          )}

          <div className="flex-1" />

          {processoId && (
            <>
              <Button variant="default" size="sm" className="h-7 px-3 text-xs gap-1" onClick={() => navigate(`/processo/${processoId}`)}>
                <FolderOpen className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Abrir Pasta</span>
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setProcessoId(null)} title="Limpar processo ativo">
                <X className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
