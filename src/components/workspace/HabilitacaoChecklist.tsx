import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useActivityLog } from '@/hooks/useActivityLog';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { Loader2, Sparkles, ShieldCheck, AlertTriangle, XCircle, CheckCircle2, RefreshCw, FolderDown } from 'lucide-react';
import { toast } from 'sonner';
import { TIPOS_HABILITACAO, ARTIGO_POR_GRUPO } from '@/lib/habilitacao/tipos';
import { gerarChecklist, getEstadoGeracao, subscribeGeracao } from '@/lib/habilitacao/gerarChecklist';
import { montarPastaHabilitacao, getEstadoMontagem, subscribeMontagem } from '@/lib/habilitacao/montarPasta';

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
  trecho_edital: string | null;
  obrigatorio: boolean;
  observacao: string | null;
  status: 'ok' | 'vence_antes_sessao' | 'faltante';
  documento_origem: string | null;
  documento_nome: string | null;
  documento_validade: string | null;
  conferido: boolean;
};

/** Estado da exigência: selo do Badge (tinta da identidade 12/09) + ícone.
 *  A cor é reforço — o rótulo sempre aparece escrito. */
const ESTADOS = {
  ok:                 { label: 'OK',                    variant: 'success' as const, icon: CheckCircle2, tinta: 'text-success-ink' },
  vence_antes_sessao: { label: 'Vence antes da sessão', variant: 'warning' as const, icon: AlertTriangle, tinta: 'text-warning-ink' },
  faltante:           { label: 'Faltante',              variant: 'danger'  as const, icon: XCircle, tinta: 'text-destructive-ink' },
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
  const [aceitando, setAceitando] = useState(false);
  // A geração roda FORA do React (lib/habilitacao/gerarChecklist): trocar de
  // aba não a mata. Aqui só observamos o estado e recarregamos ao concluir.
  const geracao = useSyncExternalStore(
    useCallback((cb) => subscribeGeracao(licitacaoId, cb), [licitacaoId]),
    useCallback(() => getEstadoGeracao(licitacaoId), [licitacaoId]),
  );
  const gerando = geracao.rodando;
  const progresso = geracao.fase;
  // "Montar pasta" também roda fora do React — mesmo padrão da geração.
  const montagem = useSyncExternalStore(
    useCallback((cb) => subscribeMontagem(licitacaoId, cb), [licitacaoId]),
    useCallback(() => getEstadoMontagem(licitacaoId), [licitacaoId]),
  );

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('processo_habilitacao_checklist' as never)
      .select('id, tipo, grupo, exigencia, referencia, trecho_edital, obrigatorio, observacao, status, documento_origem, documento_nome, documento_validade, conferido')
      .eq('licitacao_id', licitacaoId)
      .order('grupo')
      .order('exigencia');
    setLinhas(((data || []) as unknown) as Linha[]);
    setLoading(false);
  }, [licitacaoId]);

  useEffect(() => { carregar(); }, [carregar]);

  // Recarrega o checklist sempre que uma geração (externa) conclui — mesmo
  // que ela tenha rodado enquanto o usuário estava em outra aba.
  useEffect(() => {
    if (!geracao.rodando && geracao.concluidas > 0) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geracao.rodando, geracao.concluidas]);

  const gerar = () => { void gerarChecklist(licitacaoId); };

  // Recasar é outro trabalho, e muito mais barato: reaproveita as exigências já
  // extraídas do edital e só refaz o encontro com o cofre. Existe como botão
  // próprio porque o cofre muda o tempo todo — anexar a certidão no Jurídico e
  // ter de reler o edital inteiro (com IA, e sujeito ao limite por minuto) para
  // o checklist enxergá-la era cobrar caro por um trabalho barato.
  const [recasando, setRecasando] = useState(false);
  const recasar = async () => {
    setRecasando(true);
    const { data, error } = await supabase.functions.invoke('habilitacao-checklist', {
      body: { licitacao_id: licitacaoId, recasar: true },
    });
    setRecasando(false);
    if (error) { toast.error('Não foi possível recasar com o cofre.'); return; }
    const r = (data as { resumo?: { ok: number; faltante: number } } | null)?.resumo;
    toast.success(r ? `Cofre reconferido: ${r.ok} casado(s), ${r.faltante} faltante(s).` : 'Cofre reconferido.');
    await carregar();
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
  // Há o que copiar do cofre para a pasta Habilitação dos Anexos?
  const temParaMontar = linhas.some(
    (l) => l.status !== 'faltante' && l.documento_origem && l.documento_origem !== 'processo_anexos',
  );
  const tudoConferido = linhas.length > 0 && linhas.every((l) => l.conferido);
  const grupos = [...new Set(linhas.map((l) => l.grupo || 'outro'))];

  if (loading) {
    return (
      <Card className="flex items-center gap-2 p-6 text-sm text-muted-foreground" role="status" aria-busy="true">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Carregando checklist de habilitação…
      </Card>
    );
  }

  return (
    <Card className="space-y-4 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-primary" aria-hidden="true" />
        <h2 className="text-lg font-semibold">Checklist de habilitação</h2>
        {linhas.length > 0 && (
          <>
            <Badge variant="success">{resumo.ok} ok</Badge>
            {resumo.vencendo > 0 && (
              <Badge variant="warning">{resumo.vencendo} vencendo</Badge>
            )}
            {resumo.faltante > 0 && (
              <Badge variant="danger">{resumo.faltante} faltante(s)</Badge>
            )}
            {tudoConferido && <Badge variant="info">Conferido</Badge>}
          </>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {temParaMontar && (
            <Button size="sm" variant="outline" onClick={() => montarPastaHabilitacao(licitacaoId)} disabled={montagem.rodando}>
              {montagem.rodando
                ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                : <FolderDown className="w-4 h-4" aria-hidden="true" />}
              Montar pasta de habilitação
            </Button>
          )}
          {linhas.length > 0 && (
            <Button size="sm" variant="outline" onClick={recasar} disabled={recasando || gerando}>
              {recasando
                ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                : <RefreshCw className="w-4 h-4" aria-hidden="true" />}
              Recasar com o cofre
            </Button>
          )}
          {linhas.length > 0 && !tudoConferido && (
            <Button size="sm" variant="outline" onClick={aceitar} disabled={aceitando}>
              {aceitando
                ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                : <ShieldCheck className="w-4 h-4" aria-hidden="true" />}
              Conferi — aceitar checklist
            </Button>
          )}
          <Button size="sm" onClick={gerar} disabled={gerando}>
            {gerando
              ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              : linhas.length
                ? <RefreshCw className="w-4 h-4" aria-hidden="true" />
                : <Sparkles className="w-4 h-4" aria-hidden="true" />}
            {linhas.length ? 'Regerar com a Aurélia' : 'Gerar com a Aurélia'}
          </Button>
        </div>
      </div>

      {gerando && progresso && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> {progresso}
        </p>
      )}

      {montagem.rodando && montagem.fase && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> {montagem.fase} (continua mesmo se você trocar de aba)
        </p>
      )}

      {!linhas.length && !gerando && (
        <EstadoVazio
          tamanho="compacto"
          icone={<ShieldCheck />}
          titulo="Checklist ainda não gerado"
          descricao="A Aurélia lê o edital, extrai as exigências de habilitação e casa cada uma com os documentos do cofre da empresa (Jurídico → Documentos), comparando a validade com a data da sessão. O resultado fica salvo aqui, com aceite registrado na auditoria."
          acao={
            <Button onClick={gerar} disabled={gerando}>
              <Sparkles className="w-4 h-4" aria-hidden="true" /> Gerar com a Aurélia
            </Button>
          }
        />
      )}

      {grupos.map((g) => (
        <div key={g} className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 pt-2 text-sm font-semibold text-muted-foreground">
            {GRUPOS[g] || g}
            {ARTIGO_POR_GRUPO[g] && (
              <Badge variant="muted">{ARTIGO_POR_GRUPO[g]} · Lei 14.133/21</Badge>
            )}
          </div>
          {linhas.filter((l) => (l.grupo || 'outro') === g).map((l) => {
            const est = ESTADOS[l.status];
            const Icone = est.icon;
            return (
              <div key={l.id} className={`flex items-start gap-3 rounded-md border px-3 py-2 ${l.conferido ? 'border-border' : 'border-dashed border-border'}`}>
                <Icone className={`w-4 h-4 mt-1 shrink-0 ${est.tinta}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {l.referencia && <span className="shrink-0 text-sm font-semibold text-primary">{l.referencia}</span>}
                    <span className="text-sm font-medium">{l.exigencia}</span>
                    {!l.obrigatorio && <Badge variant="muted">facultativo</Badge>}
                    {!l.conferido && <span className="text-xs text-muted-foreground">sugerido pela IA</span>}
                  </div>
                  {/* Texto do órgão, literal. A linha acima é a leitura da IA;
                      esta é a fonte — quem confere não precisa abrir o PDF para
                      saber quem pode emitir o atestado ou o que conta como
                      objeto similar. */}
                  {l.trecho_edital && (
                    <blockquote className="mt-2 border-l-2 border-border pl-3 text-sm leading-relaxed text-muted-foreground">
                      “{l.trecho_edital}”
                    </blockquote>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {rotuloTipo(l.tipo) && <span>{rotuloTipo(l.tipo)} · </span>}
                    {l.status === 'faltante' && <span>nenhum documento do tipo no cofre da empresa</span>}
                    {l.status !== 'faltante' && l.documento_nome && (
                      <span>
                        casado com <span className="font-medium text-foreground">{l.documento_nome}</span>
                        {l.documento_validade && <> · validade {dataBr(l.documento_validade)}</>}
                        {l.documento_origem === 'processo_anexos' && <> · anexado na pasta do certame</>}
                      </span>
                    )}
                    {l.observacao && <> · {l.observacao}</>}
                  </p>
                </div>
                <Badge variant={est.variant} className="shrink-0">{est.label}</Badge>
              </div>
            );
          })}
        </div>
      ))}
    </Card>
  );
}
