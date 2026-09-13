import { useAlertas } from '@/hooks/useAlertas';
import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
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
        <button type="button" aria-label={naoLidos > 0 ? `Avisos: ${naoLidos} não lidos` : 'Avisos'} className="relative rounded-md p-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Bell className="w-4 h-4 text-muted-foreground" />
          {naoLidos > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground">
              {naoLidos > 9 ? '9+' : naoLidos}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="border-b border-border p-3">
          <p className="text-sm font-semibold">Avisos recentes</p>
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {recentes.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-sm text-muted-foreground">Nenhum aviso recente</p>
            </div>
          ) : (
            recentes.map(a => (
              <Link key={a.id} to="/avisos" className="block">
                <div className={`border-b border-border px-3 py-2 hover:bg-muted ${!a.lido ? 'bg-primary-tint' : ''}`}>
                  <div className="flex items-center gap-1.5">
                    {a.urgente && <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />}
                    <p className={`truncate text-sm ${!a.lido ? 'font-semibold' : ''}`}>{a.titulo}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>
        <Link to="/avisos" className="block border-t border-border p-2 text-center">
          <p className="text-sm font-medium text-primary hover:underline">Ver todos os avisos</p>
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
