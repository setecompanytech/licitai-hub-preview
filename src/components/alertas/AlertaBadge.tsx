import { useAlertas } from '@/hooks/useAlertas';
import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AlertaBadge() {
  const { alertas, naoLidos } = useAlertas();
  const recentes = alertas.filter(a => !a.arquivado).slice(0, 5);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative p-2 rounded-lg hover:bg-muted/50 transition-colors">
          <Bell className="w-4 h-4 text-muted-foreground" />
          {naoLidos > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-destructive text-[9px] font-bold text-white">
              {naoLidos > 9 ? '9+' : naoLidos}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="p-3 border-b border-border/50">
          <p className="text-sm font-semibold">Avisos Recentes</p>
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {recentes.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Nenhum aviso recente</p>
            </div>
          ) : (
            recentes.map(a => (
              <Link key={a.id} to="/avisos" className="block">
                <div className={`px-3 py-2 hover:bg-muted/30 border-b border-border/20 ${!a.lido ? 'bg-accent/5' : ''}`}>
                  <div className="flex items-center gap-1.5">
                    {a.urgente && <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />}
                    <p className={`text-xs truncate ${!a.lido ? 'font-bold' : ''}`}>{a.titulo}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>
        <Link to="/avisos" className="block p-2 text-center border-t border-border/50">
          <p className="text-xs text-accent font-medium hover:underline">Ver todos os avisos</p>
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
