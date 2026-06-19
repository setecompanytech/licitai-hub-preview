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
        'relative flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg mb-4 animate-fade-in',
        severity === 'expired' && 'bg-destructive/15 text-destructive border border-destructive/30',
        severity === 'critical' && 'bg-destructive/10 text-destructive border border-destructive/20',
        severity === 'warning' && 'bg-warning/15 text-warning border border-warning/30',
        severity === 'info' && 'bg-info/15 text-info border border-info/30'
      )}
    >
      <AlertTriangle className="w-5 h-5 flex-shrink-0" />
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
          'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap',
          severity === 'expired' || severity === 'critical'
            ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
            : severity === 'warning'
            ? 'bg-warning text-warning-foreground hover:bg-warning/90'
            : 'bg-info text-info-foreground hover:bg-info/90'
        )}
      >
        <CreditCard className="w-3.5 h-3.5" />
        Renovar Agora
      </button>
      <button onClick={() => setDismissed(true)} className="p-1 rounded hover:bg-foreground/10 transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
