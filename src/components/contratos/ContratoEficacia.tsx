import { useEffect, useState, useCallback } from 'react';
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
  ShieldCheck, ShieldAlert, AlertTriangle, Plus, ExternalLink, Loader2, Trash2, Gavel,
} from 'lucide-react';
import { extratosExigidos, ROTULO_PUBLICACAO, type TipoDePublicacao } from '@/lib/contratos/eficacia';
import { useSituacaoJuridica } from '@/hooks/useSituacaoJuridica';
import { deDataLocal, hojeLocal } from '@/lib/financeiro/data-local';

type Publicacao = {
  id: string; tipo: string; veiculo: string; data_publicacao: string;
  numero: string | null; url: string | null; aditivo_id: string | null;
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
  const { situacao: s, recarregar: recarregarSituacao } = useSituacaoJuridica(contratoId);
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
    const { error } = await supabase.from('contrato_publicacoes' as never).insert({
      empresa_id: empresaAtiva.id,
      contrato_id: contratoId,
      aditivo_id: form.tipo === 'extrato_aditivo' ? form.aditivo_id : null,
      tipo: form.tipo,
      veiculo: form.veiculo,
      data_publicacao: form.data_publicacao,
      numero: form.numero.trim() || null,
      url: form.url.trim() || null,
      created_by: user?.id ?? null,
    } as never);
    setSalvando(false);
    if (error) { toast.error('Não foi possível registrar', { description: error.message }); return; }
    setCriando(false);
    setForm(f => ({ ...f, numero: '', url: '' }));
    toast.success('Publicação registrada.');
    void carregar();
    // A publicação do extrato é o que dá eficácia: o painel de cima precisa
    // mudar junto, senão continua dizendo "não inicie a execução".
    recarregarSituacao();
  };

  const excluir = async (id: string) => {
    if (!confirm('Excluir este registro de publicação?')) return;
    const { error } = await supabase.from('contrato_publicacoes' as never).delete().eq('id', id);
    if (error) { toast.error('Não foi possível excluir', { description: error.message }); return; }
    void carregar();
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
                  <a href={p.url} target="_blank" rel="noreferrer" className="text-primary shrink-0" title="Abrir">
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto shrink-0 nao-imprime"
                  onClick={() => excluir(p.id)}>
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
    </div>
  );
}
