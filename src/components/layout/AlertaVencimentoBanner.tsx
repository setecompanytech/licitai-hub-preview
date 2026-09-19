import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { AlertTriangle, X, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface AssinaturaInfo {
  data_fim: string;
  status: string;
  plano_nome: string;
}

export default function AlertaVencimentoBanner() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [assinatura, setAssinatura] = useState<AssinaturaInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!empresaAtiva) return;

    (async () => {
      const { data } = await supabase
        .from('assinaturas')
        .select('data_fim, status, plano_id')
        .eq('empresa_id', empresaAtiva.id)
        .eq('status', 'ativa')
        .order('data_fim', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data?.data_fim) return;

      const dataFim = new Date(data.data_fim);
      const agora = new Date();
      const diffDias = Math.ceil((dataFim.getTime() - agora.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDias > 7) return;

      // Get plan name
      const { data: plano } = await supabase
        .from('planos')
        .select('nome')
        .eq('id', data.plano_id)
        .maybeSingle();

      setAssinatura({
        data_fim: data.data_fim,
        status: data.status,
        plano_nome: plano?.nome || 'Seu plano',
      });
    })();
  }, [empresaAtiva]);

  if (!assinatura || dismissed) return null;

  const dataFim = new Date(assinatura.data_fim);
  const agora = new Date();
  const diffDias = Math.ceil((dataFim.getTime() - agora.getTime()) / (1000 * 60 * 60 * 24));
  const expirado = diffDias <= 0;

  const severity = expirado ? 'expired' : diffDias <= 1 ? 'critical' : diffDias <= 3 ? 'warning' : 'info';

  return (
    <div
      className={cn(
        'relative mb-4 flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium animate-fade-in',
        severity === 'expired' && 'border-destructive-line bg-destructive-tint text-destructive-ink',
        severity === 'critical' && 'border-destructive-line bg-destructive-tint text-destructive-ink',
        severity === 'warning' && 'border-warning-line bg-warning-tint text-warning-ink',
        severity === 'info' && 'border-info-line bg-info-tint text-info-ink'
      )}
    >
      <AlertTriangle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <div className="flex-1">
        {expirado ? (
          <span>
            Seu plano <strong>{assinatura.plano_nome}</strong> expirou em{' '}
            {dataFim.toLocaleDateString('pt-BR')}. Renove agora para restaurar o acesso.
          </span>
        ) : (
          <span>
            Seu plano <strong>{assinatura.plano_nome}</strong> vence em{' '}
            <strong>{diffDias} dia(s)</strong> ({dataFim.toLocaleDateString('pt-BR')}).{' '}
            {diffDias <= 3 ? 'Renove para evitar perda de acesso.' : 'Considere renovar.'}
          </span>
        )}
      </div>
      <button
        onClick={() => {
          navigate('/configuracoes?scroll=planos');
        }}
        className={cn(
          'flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          severity === 'expired' || severity === 'critical'
            ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
            : severity === 'warning'
            ? 'bg-warning text-warning-foreground hover:bg-warning/90'
            : 'bg-info text-info-foreground hover:bg-info/90'
        )}
      >
        <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
        Renovar Agora
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dispensar aviso"
        className="rounded-md p-1 transition-colors hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
