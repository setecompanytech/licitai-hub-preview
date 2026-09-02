import { useEffect, useState, useCallback, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { useColaboradores } from '@/hooks/useMetasComercial';
import { useAuthorization } from '@/hooks/useAuthorization';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  ShieldCheck, ShieldAlert, AlertTriangle, Plus, ExternalLink, Loader2, Trash2, Gavel, FileText,
} from 'lucide-react';
import { extratosExigidos, ROTULO_PUBLICACAO, type TipoDePublicacao } from '@/lib/contratos/eficacia';
import { useSituacaoJuridica } from '@/hooks/useSituacaoJuridica';
import { deDataLocal, hojeLocal } from '@/lib/financeiro/data-local';

type Publicacao = {
  id: string; tipo: string; veiculo: string; data_publicacao: string;
  numero: string | null; url: string | null; aditivo_id: string | null;
  /** O recorte guardado no dossiê. A coluna existe desde a 20260829000005 e
   *  nunca foi preenchida — o registro dizia QUE foi publicado, sem a prova. */
  arquivo_id: string | null;
};

type Contrato = {
  data_assinatura: string | null;
  modalidade: string | null;
  tipo_documento: string | null;
  fiscal_nome: string | null;
  assinatura_situacao: string | null;
  eficacia_por_urgencia: boolean | null;
};

const ESTILO = {
  critico: { fundo: 'border-destructive/40 bg-destructive/5', cor: 'text-destructive', Icone: ShieldAlert },
  atencao: { fundo: 'border-warning/40 bg-warning/5', cor: 'text-warning', Icone: AlertTriangle },
  ok: { fundo: 'border-success/40 bg-success/5', cor: 'text-success', Icone: ShieldCheck },
} as const;

/**
 * Validade e eficácia, ditas separadamente.
 *
 * O contrato é válido quando assinado pelas partes competentes. Só é eficaz
 * depois de divulgado (Lei 14.133/2021, art. 94). Entre uma coisa e outra há
 * uma janela em que o ajuste existe e não produz efeitos — e é nessa janela
 * que o fornecedor se machuca, entregando sob um contrato que ainda não
 * sustenta a cobrança.
 *
 * Este painel responde uma pergunta só, no topo: **posso começar a executar?**
 * O resto é a prova disso — os extratos que precisam existir e os que já
 * existem.
 *
 * Publicar é dever do órgão, e nenhuma mensagem daqui acusa o assinante de
 * atraso. Elas dizem o que ele pode fazer: esperar, e cobrar.
 */
export default function ContratoEficacia({ contratoId }: { contratoId: string }) {
  const { empresaAtiva } = useEmpresa();
  const { user } = useAuth();
  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [publicacoes, setPublicacoes] = useState<Publicacao[]>([]);
  const [aditivos, setAditivos] = useState<Array<{ id: string; numero_aditivo: string }>>([]);
  const [indisponivel, setIndisponivel] = useState(false);
  const { situacao: s, leituraDaAssinatura, recarregar: recarregarSituacao } = useSituacaoJuridica(contratoId);
  const [conferindo, setConferindo] = useState(false);
  // Hooks SEMPRE antes dos returns antecipados (linhas de guarda abaixo):
  // declarados no meio do componente, quebravam a ordem de hooks quando o
  // guard deixava de disparar — tela branca em produção (02/09, versão .5).
  const { isCompanyAdmin: isEmpresaAdmin } = useAuthorization();
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const [motivoExclusao, setMotivoExclusao] = useState('');
  const [exclusoes, setExclusoes] = useState<Array<{
    id: string; motivo: string; excluido_por: string; excluido_em: string; registro: any;
  }>>([]);
  const { data: colaboradores = [] } = useColaboradores();
  const nomeDoAutor = (uid: string) => {
    const c = colaboradores.find((x: any) => x.user_id === uid);
    return c?.nome || c?.email || 'membro da equipe';
  };
  /**
   * O recorte do Diário, esperando o Registrar.
   *
   * `contrato_publicacoes.arquivo_id` existe desde a 20260829000005 e nunca foi
   * preenchido: o registro dizia QUE foi publicado, e não guardava a PROVA. O
   * link do Diário caduca — o portal muda de endereço, a edição sai do ar —, e
   * o que sobra na fiscalização é o recorte que se guardou.
   *
   * Anexar não é registrar: o arquivo espera, como no empenho e na NF-e.
   */
  const [recorte, setRecorte] = useState<File | null>(null);
  const entradaDoRecorte = useRef<HTMLInputElement>(null);
  const [criando, setCriando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({
    tipo: 'extrato_contrato' as TipoDePublicacao,
    veiculo: 'PNCP',
    data_publicacao: hojeLocal(),
    numero: '',
    url: '',
    aditivo_id: '',
  });

  const carregar = useCallback(async () => {
    const [cRes, pRes, aRes] = await Promise.all([
      supabase
        .from('contratos')
        .select('data_assinatura, modalidade, tipo_documento, fiscal_nome, assinatura_situacao, eficacia_por_urgencia')
        .eq('id', contratoId)
        .single(),
      supabase.from('contrato_publicacoes' as never).select('*').eq('contrato_id', contratoId),
      supabase.from('contrato_aditivos').select('id, numero_aditivo').eq('contrato_id', contratoId),
    ]);
    // Colunas e tabela vêm da 20260829000005, colada à mão. Enquanto não rodar,
    // o painel se recolhe em vez de derrubar o Dashboard inteiro.
    if (cRes.error || pRes.error) { setIndisponivel(true); return; }
    setContrato(cRes.data as unknown as Contrato);
    setPublicacoes((pRes.data ?? []) as unknown as Publicacao[]);
    setAditivos((aRes.data ?? []) as Array<{ id: string; numero_aditivo: string }>);
  }, [contratoId]);

  useEffect(() => { void carregar(); }, [carregar]);

  if (indisponivel || !contrato) return null;

  // A situação vem do hook, não de um cálculo local: a aba Pedidos usa a mesma
  // resposta para avisar antes de registrar, e duas contas do mesmo fato
  // divergem — foi o defeito que esta semana inteira se dedicou a arrancar.
  if (!s) return null;
  const { fundo, cor, Icone } = ESTILO[s.severidade];

  const exigidos = extratosExigidos({
    tipoDocumento: contrato.tipo_documento,
    quantidadeDeAditivos: aditivos.length,
    temFiscalDesignado: !!contrato.fiscal_nome,
  });

  const quantosDe = (tipo: string) => publicacoes.filter(p => p.tipo === tipo).length;

  const salvar = async () => {
    if (!empresaAtiva?.id) return;
    if (form.tipo === 'extrato_aditivo' && !form.aditivo_id) {
      toast.error('Diga a qual aditivo este extrato se refere.');
      return;
    }
    setSalvando(true);

    // O recorte vai para o dossiê do contrato antes, porque é dele que sai o
    // `arquivo_id` do registro. Falhando, o registro continua: a publicação
    // aconteceu de todo jeito, e perdê-la por causa do anexo seria trocar o
    // fato pela prova.
    let arquivoId: string | null = null;
    if (recorte && user?.id) {
      // A PRIMEIRA pasta tem de ser o auth.uid(): é o que a política do bucket
      // confere.
      const caminho = `${user.id}/${contratoId}/publicacoes/${Date.now()}-${recorte.name.replace(/[^\w.\-]+/g, '_')}`;
      const { error: upErr } = await supabase.storage
        .from('contratos-docs').upload(caminho, recorte, { upsert: false, contentType: recorte.type });
      if (upErr) {
        toast.warning('O recorte não pôde ser guardado.', { description: upErr.message });
      } else {
        const { data: arq } = await supabase.from('contrato_arquivos').insert({
          contrato_id: contratoId,
          nome_arquivo: recorte.name,
          storage_path: caminho,
          tamanho_bytes: recorte.size,
          tipo: 'publicacao',
          descricao: `${ROTULO_PUBLICACAO[form.tipo]} · ${form.veiculo}`,
          user_id: user.id,
        } as never).select('id').single();
        arquivoId = (arq as { id: string } | null)?.id ?? null;
      }
    }

    const { error } = await supabase.from('contrato_publicacoes' as never).insert({
      empresa_id: empresaAtiva.id,
      contrato_id: contratoId,
      aditivo_id: form.tipo === 'extrato_aditivo' ? form.aditivo_id : null,
      tipo: form.tipo,
      veiculo: form.veiculo,
      data_publicacao: form.data_publicacao,
      numero: form.numero.trim() || null,
      url: form.url.trim() || null,
      arquivo_id: arquivoId,
      created_by: user?.id ?? null,
    } as never);
    setSalvando(false);
    if (error) { toast.error('Não foi possível registrar', { description: error.message }); return; }
    setCriando(false);
    setForm(f => ({ ...f, numero: '', url: '' }));
    setRecorte(null);
    toast.success(
      arquivoId ? 'Publicação registrada, com o recorte guardado.' : 'Publicação registrada.',
      { description: arquivoId ? undefined : 'Sem recorte anexado — o link do Diário pode sair do ar.' },
    );
    void carregar();
    // A publicação do extrato é o que dá eficácia: o painel de cima precisa
    // mudar junto, senão continua dizendo "não inicie a execução".
    recarregarSituacao();
  };

  /** Abre o recorte guardado no dossiê do contrato. */
  const abrirRecorte = async (arquivoId: string) => {
    const { data } = await supabase
      .from('contrato_arquivos').select('storage_path, nome_arquivo').eq('id', arquivoId).single();
    if (!data?.storage_path) { toast.error('O recorte não foi encontrado no dossiê.'); return; }
    // Bucket dos CONTRATOS — o recorte é documento do contrato, não do
    // Financeiro. Assinar no armário errado falha sempre, e foi o erro que se
    // repetiu duas vezes em 31/08.
    const { data: url, error } = await supabase.storage
      .from('contratos-docs').createSignedUrl(data.storage_path, 600);
    if (error || !url?.signedUrl) {
      toast.error('Não foi possível abrir o recorte.', { description: error?.message });
      return;
    }
    window.open(url.signedUrl, '_blank', 'noopener,noreferrer');
  };

  /**
   * Exclusão com as duas lições da auditoria: (1) window.confirm pode ser
   * suprimido pelo navegador — o diálogo da casa não; (2) DELETE barrado por
   * RLS devolve SUCESSO com zero linhas — sem conferir o efeito, o botão
   * "funcionava" sem fazer nada e sem dizer nada. A policy restringe exclusão
   * a administradores da empresa, e agora a tela diz isso em voz alta.
   */
  /**
   * Política decidida pelo dono (02/09): QUALQUER membro exclui — com motivo
   * obrigatório e histórico imutável para o administrador. A RPC
   * excluir_publicacao_com_motivo valida, congela o registro e apaga numa
   * transação só; ninguém passa por fora da porta que registra.
   */
  const pedirExclusao = (id: string) => {
    setMotivoExclusao('');
    setExcluindo(id);
  };

  const carregarExclusoes = useCallback(async () => {
    const { data } = await supabase
      .from('contrato_publicacoes_exclusoes' as never)
      .select('id, motivo, excluido_por, excluido_em, registro')
      .eq('contrato_id', contratoId)
      .order('excluido_em', { ascending: false });
    setExclusoes(((data ?? []) as unknown) as typeof exclusoes);
  }, [contratoId]);

  useEffect(() => { void carregarExclusoes(); }, [carregarExclusoes]);

  const excluir = async () => {
    const id = excluindo;
    const motivo = motivoExclusao.trim();
    if (!id || motivo.length < 5) return;
    setExcluindo(null);
    const { error } = await (supabase as any).rpc('excluir_publicacao_com_motivo', {
      p_publicacao_id: id,
      p_motivo: motivo,
    });
    if (error) { toast.error('Não foi possível excluir', { description: error.message }); return; }
    toast.success('Registro excluído e motivo arquivado no histórico.');
    void carregar();
    void carregarExclusoes();
    recarregarSituacao();
  };

  /**
   * Quem tem o instrumento em mãos corrige a leitura.
   *
   * Fica gravado como `conferido`, e não como se a máquina tivesse lido: a
   * releitura automática não desfaz isto (gatilho da 20260831000003), e quem
   * auditar depois sabe em que está apoiado.
   */
  const confirmarAssinaturas = async () => {
    setConferindo(true);
    const { error } = await supabase
      .from('contratos')
      .update({ assinatura_situacao: 'ambas', assinatura_origem: 'conferido' } as never)
      .eq('id', contratoId);
    setConferindo(false);
    if (error) { toast.error('Não foi possível registrar', { description: error.message }); return; }
    toast.success('Registrado: as duas partes assinaram.', {
      description: 'Fica marcado como conferido por pessoa — a releitura automática não desfaz.',
    });
    recarregarSituacao();
  };

  return (
    <div className="space-y-3">
      {/* A pergunta que importa, respondida antes de tudo. */}
      <Card className={`p-4 border ${fundo}`}>
        <div className="flex items-start gap-2.5">
          <Icone className={`w-5 h-5 shrink-0 mt-0.5 ${cor}`} />
          <div className="min-w-0">
            <p className={`text-sm font-semibold ${cor}`}>{s.titulo}</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{s.detalhe}</p>
            {!s.podeExecutar && (
              <Badge variant="outline" className="mt-2 text-xs border-destructive/40 text-destructive">
                Não inicie a execução
              </Badge>
            )}

            {/* ── A leitura pode estar errada, e quem tem o papel decide ──────
                A assinatura digital é desenhada pelo fluxo de aparência do PDF
                e nem sempre entra na camada de texto; o carimbo ICP vem em
                caixa própria; a contratada aparece rotulada "Contratado".
                Qualquer um desses perde o lado.

                Um alerta crítico que a pessoa sabe estar errado e não pode
                desligar não vira ruído só ele — ensina que os alertas daquele
                painel podem ser ignorados. E os outros ali são verdadeiros. */}
            {s.estado === 'assinatura_incompleta' && (
              <div className="mt-2.5 space-y-1.5 nao-imprime">
                {leituraDaAssinatura.observacao && (
                  <p className="text-[11px] text-muted-foreground">
                    O que a leitura encontrou: {leituraDaAssinatura.observacao}
                  </p>
                )}
                <Button size="sm" variant="outline" className="h-7 text-xs"
                  disabled={conferindo}
                  onClick={confirmarAssinaturas}>
                  {conferindo ? 'registrando…' : 'Conferi — as duas partes assinaram'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold flex items-center gap-1.5">
            <Gavel className="w-4 h-4 text-muted-foreground" /> Extratos e publicações
          </h4>
          {!criando && (
            <Button size="sm" variant="outline" className="h-7 text-xs nao-imprime" onClick={() => setCriando(true)}>
              <Plus className="w-3 h-3 mr-1" /> Registrar
            </Button>
          )}
        </div>

        {/* O que a lei exige para ESTE registro, com o motivo de cada item.
            Cobrança sem porquê vira burocracia e ninguém cumpre. */}
        <div className="space-y-2">
          {exigidos.map(ex => {
            const tem = quantosDe(ex.tipo);
            const completo = tem >= ex.quantos;
            return (
              <div key={ex.tipo} className="flex items-start gap-2 text-xs">
                {completo
                  ? <ShieldCheck className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
                  : <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />}
                <div className="min-w-0">
                  <p className="font-medium">
                    {ex.rotulo}
                    {ex.quantos > 1 && <span className="text-muted-foreground"> — {tem} de {ex.quantos}</span>}
                    {ex.quantos === 1 && !completo && <span className="text-warning"> — falta</span>}
                  </p>
                  <p className="text-muted-foreground">{ex.porque}</p>
                </div>
              </div>
            );
          })}
        </div>

        {publicacoes.length > 0 && (
          <div className="mt-4 pt-3 border-t space-y-1.5">
            {publicacoes.map(p => (
              <div key={p.id} className="flex items-center gap-2 text-xs">
                <Badge variant="outline" className="text-xs shrink-0">{p.veiculo}</Badge>
                <span className="font-medium truncate">
                  {ROTULO_PUBLICACAO[p.tipo as TipoDePublicacao] ?? p.tipo}
                  {p.aditivo_id && ` — ${aditivos.find(a => a.id === p.aditivo_id)?.numero_aditivo ?? ''}`}
                </span>
                <span className="text-muted-foreground whitespace-nowrap">
                  {deDataLocal(p.data_publicacao).toLocaleDateString('pt-BR')}
                </span>
                {p.numero && <span className="text-muted-foreground truncate">nº {p.numero}</span>}
                {p.url && (
                  <a href={p.url} target="_blank" rel="noreferrer" className="text-primary shrink-0" title="Abrir o link do Diário">
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {/* O recorte guardado. Link e recorte convivem: o primeiro leva
                    à fonte enquanto ela existir, o segundo prova depois. */}
                {p.arquivo_id && (
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 nao-imprime"
                    title="Ver o recorte publicado"
                    onClick={() => abrirRecorte(p.arquivo_id!)}>
                    <FileText className="w-3 h-3 text-primary" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto shrink-0 nao-imprime"
                  title="Excluir registro de publicação (o motivo fica no histórico)"
                  onClick={() => pedirExclusao(p.id)}>
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {criando && (
          <div className="mt-4 pt-3 border-t space-y-3 nao-imprime">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">O que foi publicado</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v as TipoDePublicacao }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ROTULO_PUBLICACAO) as TipoDePublicacao[]).map(t => (
                      <SelectItem key={t} value={t}>{ROTULO_PUBLICACAO[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Onde</Label>
                <Select value={form.veiculo} onValueChange={v => setForm(f => ({ ...f, veiculo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PNCP">PNCP</SelectItem>
                    <SelectItem value="DOU">Diário Oficial da União</SelectItem>
                    <SelectItem value="DOE">Diário Oficial do Estado</SelectItem>
                    <SelectItem value="DOM">Diário Oficial do Município</SelectItem>
                    <SelectItem value="Sítio oficial">Sítio oficial do órgão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Data da publicação</Label>
                <Input type="date" value={form.data_publicacao}
                  onChange={e => setForm(f => ({ ...f, data_publicacao: e.target.value }))} />
              </div>
            </div>

            {form.tipo === 'extrato_aditivo' && (
              <div>
                <Label className="text-xs text-muted-foreground">De qual aditivo</Label>
                <Select value={form.aditivo_id} onValueChange={v => setForm(f => ({ ...f, aditivo_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Escolha o aditivo" /></SelectTrigger>
                  <SelectContent>
                    {aditivos.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.numero_aditivo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Nº / edição (opcional)</Label>
                <Input value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Link (opcional)</Label>
                <Input placeholder="https://pncp.gov.br/..." value={form.url}
                  onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
              </div>
            </div>

            {/* ── O recorte do Diário ─────────────────────────────────────────
                O link caduca: o portal muda de endereço, a edição sai do ar, e
                o PNCP reorganiza URL. Numa fiscalização anos depois, o que
                sustenta a eficácia é o recorte que se guardou — não o endereço
                que se anotou. */}
            <div>
              <Label className="text-xs text-muted-foreground">Recorte publicado (recomendado)</Label>
              <input ref={entradaDoRecorte} type="file" className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={e => { setRecorte(e.target.files?.[0] ?? null); e.target.value = ''; }} />
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Button type="button" size="sm" variant="outline" className="h-8 text-xs"
                  onClick={() => entradaDoRecorte.current?.click()}>
                  {recorte ? 'Trocar arquivo' : 'Escolher arquivo'}
                </Button>
                {recorte
                  ? <span className="text-xs text-muted-foreground">{recorte.name} · guardado ao registrar</span>
                  : <span className="text-xs text-muted-foreground">
                      PDF ou foto da página. O link do Diário sai do ar; o recorte fica.
                    </span>}
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" className="h-8 text-xs" onClick={salvar} disabled={salvando}>
                {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Registrar'}
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setCriando(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </Card>
          {isEmpresaAdmin && exclusoes.length > 0 && (
        <div className="mt-2 rounded-md border border-border bg-muted/30 px-3 py-2 nao-imprime">
          <p className="text-xs font-medium text-muted-foreground mb-1">
            Histórico de exclusões ({exclusoes.length}) — visível ao administrador
          </p>
          <div className="space-y-1">
            {exclusoes.map((e) => (
              <p key={e.id} className="text-xs text-muted-foreground">
                {new Date(e.excluido_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                {' · '}{e.registro?.veiculo ?? '—'} {e.registro?.data_publicacao ?? ''}
                {' · por '}{nomeDoAutor(e.excluido_por)}
                {' — '}<span className="italic" title={e.motivo}>{e.motivo}</span>
              </p>
            ))}
          </div>
        </div>
      )}

      <AlertDialog open={!!excluindo} onOpenChange={(o) => !o && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro de publicação?</AlertDialogTitle>
            <AlertDialogDescription>
              O registro sai da lista de extratos e publicações deste contrato.
              O arquivo do recorte, se houver, não é apagado do repositório. O
              motivo abaixo fica arquivado no histórico de exclusões, visível
              ao administrador.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="motivo-exclusao-pub">Motivo da exclusão *</Label>
            <Textarea
              id="motivo-exclusao-pub"
              value={motivoExclusao}
              onChange={(e) => setMotivoExclusao(e.target.value)}
              placeholder="Ex.: registro duplicado — o extrato do DOE foi lançado duas vezes."
              rows={3}
            />
            {motivoExclusao.trim().length > 0 && motivoExclusao.trim().length < 5 && (
              <p className="text-xs text-destructive">Descreva o motivo com pelo menos 5 caracteres.</p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={excluir} disabled={motivoExclusao.trim().length < 5}>
              Excluir e registrar motivo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
