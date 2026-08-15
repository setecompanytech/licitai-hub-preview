import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useProcessoAtivo } from '@/hooks/useProcessoAtivo';
import { Button } from '@/components/ui/button';
import { FolderOpen, AlertTriangle, ArrowRight } from 'lucide-react';

/**
 * Cabeçalho de contexto dos módulos que operam sobre o "processo ativo"
 * (Precificação, Proposta Comercial avulsa).
 *
 * O vínculo com o processo sempre existiu — vinha do ?lid= ou do último
 * processo usado — mas era INVISÍVEL: "Ler edital automaticamente" podia
 * agir sobre um processo que a tela não declarava. Concordância de dados
 * sem concordância visual é discordância na prática; este banner declara
 * o contexto e dá o caminho de volta ao prontuário.
 */
export default function ProcessoContextoBanner() {
  const { processoId } = useProcessoAtivo();
  const navigate = useNavigate();
  const [meta, setMeta] = useState<{ numero: string; orgao: string } | null>(null);

  useEffect(() => {
    let ativo = true;
    if (!processoId) { setMeta(null); return; }
    supabase
      .from('licitacoes')
      .select('numero, orgao')
      .eq('id', processoId)
      .maybeSingle()
      .then(({ data }) => {
        if (ativo) setMeta({ numero: data?.numero || 'Processo', orgao: data?.orgao || '' });
      });
    return () => { ativo = false; };
  }, [processoId]);

  if (!processoId) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/5 px-4 py-2.5 text-sm">
        <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
        <span className="text-muted-foreground">
          <span className="font-medium text-foreground">Nenhum processo vinculado</span> — as ações
          desta tela não serão associadas a uma pasta de processo. Abra um processo no Painel para trabalhar dentro dele.
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-accent/30 bg-accent/5 px-4 py-2.5 text-sm flex-wrap">
      <FolderOpen className="w-4 h-4 text-accent shrink-0" />
      <span className="text-muted-foreground">Trabalhando no processo:</span>
      <span className="font-semibold">
        {meta ? `${meta.numero}${meta.orgao ? ` — ${meta.orgao}` : ''}` : '…'}
      </span>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 ml-auto"
        onClick={() => navigate(`/processo/${processoId}`)}
      >
        Voltar ao prontuário <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
      </Button>
    </div>
  );
}
