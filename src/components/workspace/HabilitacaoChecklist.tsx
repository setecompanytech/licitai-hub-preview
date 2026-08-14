import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useActivityLog } from '@/hooks/useActivityLog';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, ShieldCheck, AlertTriangle, XCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { extractTextFromBlob } from '@/lib/pdf-text-extractor';
import { TIPOS_HABILITACAO } from '@/lib/habilitacao/tipos';

/**
 * Fase 3 do prontuário integrado — checklist de habilitação.
 *
 * A Aurélia lê o edital e extrai as exigências; o sistema casa cada uma com o
 * cofre da EMPRESA (agent_documentos) por tipo, compara validade com a data da
 * sessão e persiste tudo. IA propõe, gente confirma: o aceite marca
 * `conferido` e vai para a trilha de auditoria.
 */

type Linha = {
  id: string;
  tipo: string | null;
  grupo: string | null;
  exigencia: string;
  referencia: string | null;
  obrigatorio: boolean;
  observacao: string | null;
  status: 'ok' | 'vence_antes_sessao' | 'faltante';
  documento_nome: string | null;
  documento_validade: string | null;
  conferido: boolean;
};

const ESTADOS = {
  ok:                 { label: 'OK',                    cls: 'bg-success/10 text-success border-success/20',          icon: CheckCircle2 },
  vence_antes_sessao: { label: 'Vence antes da sessão', cls: 'bg-warning/10 text-warning border-warning/20',          icon: AlertTriangle },
  faltante:           { label: 'Faltante',              cls: 'bg-destructive/10 text-destructive border-destructive/20', icon: XCircle },
} as const;

const GRUPOS: Record<string, string> = {
  juridica: 'Habilitação jurídica',
  fiscal: 'Regularidade fiscal e trabalhista',
  economica: 'Qualificação econômico-financeira',
  tecnica: 'Qualificação técnica',
  declaracoes: 'Declarações',
  outro: 'Outros',
};

const rotuloTipo = (id: string | null) =>
  TIPOS_HABILITACAO.find((t) => t.id === id)?.label ?? null;

const dataBr = (v: string | null) => {
  const m = String(v ?? '').match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
};

export default function HabilitacaoChecklist({ licitacaoId }: { licitacaoId: string }) {
  const { user } = useAuth();
  const { registrar } = useActivityLog();
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [progresso, setProgresso] = useState('');
  const [aceitando, setAceitando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('processo_habilitacao_checklist' as never)
      .select('id, tipo, grupo, exigencia, referencia, obrigatorio, observacao, status, documento_nome, documento_validade, conferido')
      .eq('licitacao_id', licitacaoId)
      .order('grupo')
      .order('exigencia');
    setLinhas(((data || []) as unknown) as Linha[]);
    setLoading(false);
  }, [licitacaoId]);

  useEffect(() => { carregar(); }, [carregar]);

  /** Busca o texto do edital: PDF materializado do PNCP → extração no cliente (padrão da casa). */
  const obterTextoDoEdital = async (): Promise<string | null> => {
    setProgresso('Localizando o edital no PNCP…');
    const { data: listaResp, error: listaErr } = await supabase.functions.invoke('pncp-arquivos-edital', {
      body: { licitacao_id: licitacaoId, action: 'listar' },
    });
    if (listaErr || !listaResp?.success || !listaResp?.arquivos?.length) return null;
    const edital = listaResp.arquivos.find((a: { tipo?: string }) => /edital/i.test(a.tipo || '')) || listaResp.arquivos[0];

    setProgresso('Baixando o edital…');
    const { data: abrirResp } = await supabase.functions.invoke('pncp-arquivos-edital', {
      body: { licitacao_id: licitacaoId, action: 'abrir', sequencial: edital.sequencial },
    });
    if (!abrirResp?.success || !abrirResp?.path) return null;

    const { data: signed } = await supabase.storage
      .from('processo-arquivos')
      .createSignedUrl(abrirResp.path, 600);
    if (!signed?.signedUrl) return null;

    setProgresso('Lendo o edital (extração de texto)…');
    const blob = await fetch(signed.signedUrl).then((r) => r.blob());
    const texto = await extractTextFromBlob(blob, abrirResp.nome || 'edital.pdf', 80, true);
    return texto && texto.trim().length >= 200 ? texto : null;
  };

  const gerar = async () => {
    setGerando(true);
    setProgresso('');
    try {
      const texto = await obterTextoDoEdital();
      if (!texto) {
        toast.error('Não foi possível ler o edital deste processo — confira o "Edital em tela" na aba Anexos.');
        return;
      }
      setProgresso('Aurélia analisando as exigências…');
      const { data, error } = await supabase.functions.invoke('habilitacao-checklist', {
        body: { licitacao_id: licitacaoId, edital_texto: texto },
      });
      if (error || !data?.success) {
        toast.error((data as { error?: string })?.error || 'Não foi possível gerar o checklist.');
        return;
      }
      const r = data.resumo;
      toast.success(`Checklist gerado: ${r.ok} ok · ${r.vence_antes_sessao} vencendo · ${r.faltante} faltante(s).`);
      await registrar({
        acao: 'habilitacao_checklist_gerado',
        modulo: 'licitacoes',
        descricao: `Checklist de habilitação gerado pela Aurélia: ${r.total} exigências (${r.faltante} faltantes).`,
        licitacaoId,
        metadata: r,
      });
      await carregar();
    } finally {
      setGerando(false);
      setProgresso('');
    }
  };

  const aceitar = async () => {
    if (!user) return;
    setAceitando(true);
    const { error } = await supabase
      .from('processo_habilitacao_checklist' as never)
      .update({ conferido: true, aceito_por: user.id, aceito_em: new Date().toISOString() } as never)
      .eq('licitacao_id', licitacaoId);
    setAceitando(false);
    if (error) { toast.error('Não foi possível registrar o aceite.'); return; }
    toast.success('Checklist conferido e aceito.');
    await registrar({
      acao: 'habilitacao_checklist_aceito',
      modulo: 'licitacoes',
      descricao: 'Checklist de habilitação conferido e aceito.',
      licitacaoId,
    });
    carregar();
  };

  const resumo = {
    ok: linhas.filter((l) => l.status === 'ok').length,
    vencendo: linhas.filter((l) => l.status === 'vence_antes_sessao').length,
    faltante: linhas.filter((l) => l.status === 'faltante').length,
  };
  const tudoConferido = linhas.length > 0 && linhas.every((l) => l.conferido);
  const grupos = [...new Set(linhas.map((l) => l.grupo || 'outro'))];

  if (loading) {
    return (
      <Card className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando checklist de habilitação…
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <ShieldCheck className="w-4 h-4 text-accent" />
        <span className="font-semibold text-sm">Checklist de habilitação</span>
        {linhas.length > 0 && (
          <>
            <Badge variant="outline" className={ESTADOS.ok.cls}>{resumo.ok} ok</Badge>
            {resumo.vencendo > 0 && (
              <Badge variant="outline" className={ESTADOS.vence_antes_sessao.cls}>{resumo.vencendo} vencendo</Badge>
            )}
            {resumo.faltante > 0 && (
              <Badge variant="outline" className={ESTADOS.faltante.cls}>{resumo.faltante} faltante(s)</Badge>
            )}
            {tudoConferido && (
              <Badge variant="outline" className="gap-1"><CheckCircle2 className="w-3 h-3 text-success" /> Conferido</Badge>
            )}
          </>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {linhas.length > 0 && !tudoConferido && (
            <Button size="sm" variant="outline" onClick={aceitar} disabled={aceitando}>
              {aceitando ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />}
              Conferi — aceitar checklist
            </Button>
          )}
          <Button size="sm" onClick={gerar} disabled={gerando}>
            {gerando
              ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              : linhas.length ? <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
            {linhas.length ? 'Regerar com a Aurélia' : 'Gerar com a Aurélia'}
          </Button>
        </div>
      </div>

      {gerando && progresso && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" /> {progresso}
        </p>
      )}

      {!linhas.length && !gerando && (
        <p className="text-sm text-muted-foreground">
          A Aurélia lê o edital, extrai as exigências de habilitação e casa cada uma com os
          documentos do cofre da empresa (Jurídico → Documentos), comparando a validade com a
          data da sessão. O resultado fica salvo aqui, com aceite registrado na auditoria.
        </p>
      )}

      {grupos.map((g) => (
        <div key={g} className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1">{GRUPOS[g] || g}</p>
          {linhas.filter((l) => (l.grupo || 'outro') === g).map((l) => {
            const est = ESTADOS[l.status];
            const Icone = est.icon;
            return (
              <div key={l.id} className={`flex items-start gap-2.5 rounded-md border px-3 py-2 ${l.conferido ? 'border-border/60' : 'border-dashed border-border'}`}>
                <Icone className={`w-4 h-4 mt-0.5 shrink-0 ${l.status === 'ok' ? 'text-success' : l.status === 'faltante' ? 'text-destructive' : 'text-warning'}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{l.exigencia}</span>
                    {l.referencia && <span className="text-xs text-muted-foreground">({l.referencia})</span>}
                    {!l.obrigatorio && <Badge variant="outline" className="text-xs">facultativo</Badge>}
                    {!l.conferido && <span className="text-xs text-muted-foreground italic">sugerido pela IA</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {rotuloTipo(l.tipo) && <span>{rotuloTipo(l.tipo)} · </span>}
                    {l.status === 'faltante' && <span>nenhum documento do tipo no cofre da empresa</span>}
                    {l.status !== 'faltante' && l.documento_nome && (
                      <span>
                        casado com <span className="font-medium text-foreground">{l.documento_nome}</span>
                        {l.documento_validade && <> · validade {dataBr(l.documento_validade)}</>}
                      </span>
                    )}
                    {l.observacao && <> · {l.observacao}</>}
                  </p>
                </div>
                <Badge variant="outline" className={`shrink-0 text-xs ${est.cls}`}>{est.label}</Badge>
              </div>
            );
          })}
        </div>
      ))}
    </Card>
  );
}
