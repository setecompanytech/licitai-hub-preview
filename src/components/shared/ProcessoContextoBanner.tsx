import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useProcessoAtivo } from '@/hooks/useProcessoAtivo';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FolderOpen, AlertTriangle, ArrowLeft, ChevronDown } from 'lucide-react';

/**
 * Barra de contexto e navegação dos módulos que operam sobre o "processo ativo"
 * (Precificação, Proposta avulsa, Apoio Jurídico, Documentos, Aurélia).
 *
 * Dois problemas que ela resolve:
 *  1. O vínculo com o processo era INVISÍVEL — vinha do ?lid= ou do último
 *     processo usado, e a tela não dizia sobre qual agia.
 *  2. Quem entrava pelo prontuário ficava sem fio de volta: o "voltar" de cada
 *     módulo só andava dentro do próprio módulo. Aqui o usuário volta à pasta
 *     do processo OU salta direto para a etapa seguinte do trabalho.
 */

const ETAPAS = [
  { aba: 'visao', label: 'Visão Geral' },
  { aba: 'documentos', label: 'Documentos' },
  { aba: 'anexos', label: 'Anexos' },
  { aba: 'precificacao', label: 'Precificação' },
  { aba: 'proposta', label: 'Proposta' },
  { aba: 'modulos', label: 'Módulos' },
  { aba: 'historico', label: 'Histórico' },
];

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

  const irPara = (aba: string) => navigate(`/processo/${processoId}?aba=${aba}`);

  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-accent/30 bg-accent/5 px-4 py-2.5 text-sm flex-wrap">
      <FolderOpen className="w-4 h-4 text-accent shrink-0" />
      <span className="text-muted-foreground">Trabalhando no processo:</span>
      <span className="font-semibold">
        {meta ? `${meta.numero}${meta.orgao ? ` — ${meta.orgao}` : ''}` : '…'}
      </span>
      <div className="flex items-center gap-1.5 ml-auto">
        <Button size="sm" variant="ghost" className="h-7" onClick={() => irPara('visao')}>
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Voltar ao prontuário
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="h-7">
              Ir para <ChevronDown className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-xs">Etapas do processo</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {ETAPAS.map((e) => (
              <DropdownMenuItem key={e.aba} onClick={() => irPara(e.aba)} className="text-sm">
                {e.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
