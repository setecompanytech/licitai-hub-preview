import { useEmpresa } from '@/contexts/EmpresaContext';
import { Building2, ChevronDown, Check, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function EmpresaSelector() {
  const { empresas, empresaAtiva, todasSelecionadas, setEmpresaAtiva } = useEmpresa();
  const navigate = useNavigate();

  const label = empresas.length === 0
    ? 'Nenhuma empresa'
    : todasSelecionadas
      ? 'Todas as Empresas'
      : empresaAtiva?.nome_fantasia || empresaAtiva?.razao_social || 'Selecionar empresa';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm font-medium max-w-[280px]">
          <Building2 className="w-4 h-4 text-accent flex-shrink-0" />
          <span className="truncate">{label}</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {empresas.length === 0 ? (
          <DropdownMenuItem onClick={() => navigate('/empresas')} className="gap-2">
            <Building2 className="w-4 h-4" />
            <span className="text-sm">Cadastrar empresa</span>
          </DropdownMenuItem>
        ) : (
          <>
            {empresas.length > 1 && (
              <>
                <DropdownMenuItem onClick={() => setEmpresaAtiva('todas')} className="gap-2">
                  <Layers className="w-4 h-4" />
                  <span className="font-medium">Todas as Empresas</span>
                  {todasSelecionadas && <Check className="w-4 h-4 ml-auto text-accent" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {empresas.map((m) => (
              <DropdownMenuItem
                key={m.empresa_id}
                onClick={() => setEmpresaAtiva(m.empresa_id)}
                className="gap-2"
              >
                <Building2 className="w-4 h-4" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {m.empresa.nome_fantasia || m.empresa.razao_social}
                  </p>
                  <p className="text-xs text-muted-foreground">{m.empresa.cnpj} · {m.papel}</p>
                </div>
                {!todasSelecionadas && empresaAtiva?.id === m.empresa_id && (
                  <Check className="w-4 h-4 text-accent flex-shrink-0" />
                )}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}