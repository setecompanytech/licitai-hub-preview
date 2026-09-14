import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useProcessoAtivo } from '@/hooks/useProcessoAtivo';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FolderOpen, ArrowLeft, ChevronDown, Unlink } from 'lucide-react';

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
  // As mesmas abas da pasta do processo, na mesma ordem (14/09/2026).
  { aba: 'visao', label: 'Visão geral' },
  { aba: 'documentos', label: 'Documentos' },
  { aba: 'habilitacao', label: 'Habilitação' },
  { aba: 'precificacao', label: 'Precificação' },
  { aba: 'proposta', label: 'Proposta' },
  { aba: 'robo', label: 'Robô de Lances' },
  { aba: 'historico', label: 'Histórico' },
];

export default function ProcessoContextoBanner() {
  const { processoId, setProcessoId } = useProcessoAtivo();

  // Sem seletor de processos aqui, por decisão do dono do produto: quem opera
  // dezenas de certames ao mesmo tempo não quer poder TROCAR a pasta de dentro
  // de um módulo — é assim que documento de um processo vai parar em outro. A
  // troca acontece onde ela é consciente: abrindo a pasta desejada.
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

  // Sem processo vinculado, a barra não aparece.
  //
  // Ela avisava que as ações "não serão associadas a uma pasta" — mas isso
  // virou o normal de quem entra pelo menu, e alarme que toca o tempo todo
  // deixa de ser alarme. O vínculo só existe quando a pessoa veio da pasta, e é
  // nesse caso que dizer QUAL pasta importa.
  if (!processoId) return null;

  // replace: voltar/ir não deve empilhar histórico — era o que fazia o botão
  // do navegador (e o ← da pasta) girar entre módulo e prontuário.
  const irPara = (aba: string) => navigate(`/processo/${processoId}?aba=${aba}`, { replace: true });

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-primary-tint px-4 py-3 text-sm">
      <FolderOpen className="w-4 h-4 shrink-0 text-primary" aria-hidden="true" />
      <span className="text-muted-foreground">Trabalhando no processo:</span>
      <span className="font-semibold text-foreground">
        {meta ? `${meta.numero}${meta.orgao ? ` — ${meta.orgao}` : ''}` : '…'}
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => irPara('visao')}>
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Voltar ao prontuário
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline">
              Ir para <ChevronDown className="w-4 h-4" aria-hidden="true" />
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
            {/* Quem entra pelo menu — e não pela pasta — pode não querer
                processo nenhum atrelado. O vínculo é conveniência, não
                imposição, e desfazê-lo precisava estar à mão. */}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setProcessoId(null)}
              className="text-sm text-muted-foreground"
            >
              <Unlink className="w-4 h-4 mr-2" aria-hidden="true" /> Desvincular processo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
