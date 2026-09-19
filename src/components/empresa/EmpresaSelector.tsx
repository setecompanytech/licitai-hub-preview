import { useEmpresa } from '@/contexts/EmpresaContext';
import { useContaDeEngenharia } from '@/hooks/useContaDeEngenharia';
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
  const { ehContaDeEngenharia } = useContaDeEngenharia();
  const navigate = useNavigate();

  // A conta de engenharia não tem empresa por decisão, não por falta de
  // cadastro: o seletor diz o que ela é e não oferece "Cadastrar empresa".
  const label = ehContaDeEngenharia
    ? 'Conta de engenharia'
    : empresas.length === 0
    ? 'Nenhuma empresa'
    : todasSelecionadas
      ? 'Todas as Empresas'
      : empresaAtiva?.nome_fantasia || empresaAtiva?.razao_social || 'Selecionar empresa';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 h-8 px-3 rounded-[3px] transition-colors text-[13px] font-medium max-w-[200px]"
          style={{
            background: 'hsl(var(--navy))',
            border: '1px solid rgba(255,255,255,.18)',
            color: '#fff',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'hsl(var(--navy-hover))')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'hsl(var(--navy))')}
        >
          <Building2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#8ec9b8' }} />
          <span className="truncate">{label}</span>
          <ChevronDown className="w-3 h-3 flex-shrink-0" style={{ color: 'rgba(255,255,255,.5)' }} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {ehContaDeEngenharia ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">
            Conta da plataforma: opera o sistema pelo Admin e não entra em empresa de cliente.
          </p>
        ) : empresas.length === 0 ? (
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
                  {todasSelecionadas && <Check className="w-4 h-4 ml-auto text-primary" />}
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
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                )}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}