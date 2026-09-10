import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TrendingUp, Pencil, Check, X, Loader2, AlertTriangle, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { situacaoDoReajuste, valorEstimadoDoReajuste } from '@/lib/contratos/reajuste';
import { TIPOS_REAJUSTE } from '@/lib/contratos/instrumentos';
import { deDataLocal, hojeLocal } from '@/lib/financeiro/data-local';

/**
 * A cláusula de reajuste do contrato — e o relógio do interregno anual.
 *
 * O índice e a data-base vêm da leitura inteligente do PDF (cláusula
 * obrigatória: art. 25, §7º e art. 92, V da Lei 14.133/2021); aqui é onde se
 * confere o que a IA leu e se preenche o que ela não achou — o mesmo papel do
 * card de Condições de entrega. Cumprido 1 ano da data-base (Lei 10.192/2001,
 * arts. 2º-3º), o reajuste é devido: aplicação por apostila (art. 136, I),
 * pedido formal ANTES de qualquer aditivo (risco de preclusão — o alerta da
 * casa no formulário de prorrogação nasce daqui).
 *
 * A estimativa usa o acumulado de 12 meses do índice oficial (base
 * indices_economicos, fonte Banco Central); o número exato do requerimento
 * sai do simulador, com a série entre as datas.
 */

type Clausula = {
  indice_reajuste: string | null;
  data_base_reajuste: string | null;
  reajuste_clausula: string | null;
  valor_global: number | null;
};

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const dataBr = (iso: string) => deDataLocal(iso).toLocaleDateString('pt-BR');

export default function ContratoReajuste({ contratoId }: { contratoId: string }) {
  const [dados, setDados] = useState<Clausula | null>(null);
  const [indisponivel, setIndisponivel] = useState(false);
  const [reajustesRegistrados, setReajustesRegistrados] = useState<string[]>([]);
  const [indiceOficial, setIndiceOficial] = useState<{ acumulado_12m: number | null; periodo: string } | null>(null);
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({ indice: '', dataBase: '' });

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data, error } = await supabase
        .from('contratos')
        .select('indice_reajuste, data_base_reajuste, reajuste_clausula, valor_global' as never)
        .eq('id', contratoId)
        .single();
      if (!vivo) return;
      // As colunas vêm da migration 20260908000004, colada à mão. Enquanto
      // ela não rodar, o card se recolhe em vez de derrubar o Dashboard.
      if (error) { setIndisponivel(true); return; }
      const c = data as unknown as Clausula;
      setDados(c);

      // Reajustes já registrados reiniciam a contagem: a data-base do aditivo
      // é o marco novo; na falta dela, a assinatura.
      const { data: adts } = await supabase
        .from('contrato_aditivos')
        .select('tipo, data_assinatura, data_base_reajuste' as never)
        .eq('contrato_id', contratoId);
      if (!vivo) return;
      setReajustesRegistrados(
        ((adts ?? []) as unknown as Array<{ tipo: string; data_assinatura: string | null; data_base_reajuste: string | null }>)
          .filter((a) => TIPOS_REAJUSTE.includes(a.tipo))
          .map((a) => a.data_base_reajuste ?? a.data_assinatura)
          .filter((d): d is string => !!d),
      );

      if (c.indice_reajuste) {
        const { data: idx } = await supabase
          .from('indices_economicos')
          .select('sigla, acumulado_12m, periodo')
          .eq('sigla', c.indice_reajuste)
          .order('created_at', { ascending: false })
          .limit(1);
        if (!vivo) return;
        const linha = (idx ?? [])[0] as { acumulado_12m: number | null; periodo: string } | undefined;
        if (linha) setIndiceOficial(linha);
      }
    })();
    return () => { vivo = false; };
  }, [contratoId]);

  if (indisponivel) return null;

  const abrir = () => {
    setForm({ indice: dados?.indice_reajuste ?? '', dataBase: dados?.data_base_reajuste ?? '' });
    setEditando(true);
  };

  const salvar = async () => {
    setSalvando(true);
    const payload = {
      indice_reajuste: form.indice.trim().toUpperCase() || null,
      data_base_reajuste: form.dataBase || null,
    };
    const { data: linhas, error } = await supabase
      .from('contratos')
      .update(payload as never)
      .eq('id', contratoId)
      .select('id');
    setSalvando(false);
    if (error || !linhas?.length) {
      toast.error('Não foi possível salvar', { description: error?.message ?? 'nenhuma linha alterada' });
      return;
    }
    setDados({ ...(dados as Clausula), ...payload });
    setEditando(false);
    toast.success('Cláusula de reajuste registrada.');
  };

  const situacao = situacaoDoReajuste({
    dataBase: dados?.data_base_reajuste,
    reajustesRegistrados,
    hoje: hojeLocal(),
  });
  const estimativa = situacao?.devido
    ? valorEstimadoDoReajuste(Number(dados?.valor_global ?? 0), indiceOficial?.acumulado_12m)
    : null;

  const semNada = !dados?.indice_reajuste && !dados?.data_base_reajuste;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-muted-foreground" /> Reajuste por índice
        </h4>
        {!editando && (
          <Button variant="ghost" size="icon" className="h-5 w-5 nao-imprime" onClick={abrir} title="Editar">
            <Pencil className="w-3 h-3" />
          </Button>
        )}
      </div>

      {editando ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Índice da cláusula (sigla)</Label>
              <Input placeholder="IPCA, IGP-M, INPC…" value={form.indice}
                onChange={(e) => setForm((f) => ({ ...f, indice: e.target.value }))} />
            </div>
            <div>
              {/* A data-base é a da PROPOSTA/orçamento, não a da assinatura:
                  trocar uma pela outra desloca o aniversário em meses. */}
              <Label className="text-xs text-muted-foreground">Data-base (proposta/orçamento)</Label>
              <Input type="date" value={form.dataBase}
                onChange={(e) => setForm((f) => ({ ...f, dataBase: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-8 text-xs" onClick={salvar} disabled={salvando}>
              {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />}
              Salvar
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditando(false)}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      ) : semNada ? (
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="flex items-center gap-1.5 text-warning">
            <AlertTriangle className="w-3.5 h-3.5" /> Cláusula de reajuste não registrada
          </p>
          <p>
            O edital é obrigado a prever índice de reajustamento (art. 25, §7º). Sem o índice e a
            data-base, o sistema não vigia o aniversário anual — reenvie o PDF do contrato para a
            leitura automática, ou preencha aqui pelo lápis.
          </p>
        </div>
      ) : (
        <div className="space-y-2 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <span className="text-muted-foreground">Índice:</span>
              <p className="font-medium">{dados?.indice_reajuste ?? '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">
                {situacao?.marcoEhReajusteAnterior ? 'Último reajuste:' : 'Data-base:'}
              </span>
              <p className="font-medium">{situacao ? dataBr(situacao.marco) : dados?.data_base_reajuste ? dataBr(dados.data_base_reajuste) : '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Aniversário anual:</span>
              <p className="font-medium">{situacao ? dataBr(situacao.aniversario) : 'informe a data-base'}</p>
            </div>
          </div>

          {situacao?.devido ? (
            <div className="rounded-md border border-warning/40 bg-warning/5 p-2.5 space-y-1">
              <p className="font-semibold text-warning flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Reajuste devido desde {dataBr(situacao.aniversario)}
                {situacao.mesesDesdeAniversario > 0 && ` — há ${situacao.mesesDesdeAniversario} ${situacao.mesesDesdeAniversario === 1 ? 'mês' : 'meses'}`}
              </p>
              {estimativa != null && indiceOficial ? (
                <p className="text-muted-foreground">
                  {dados?.indice_reajuste} acumulado 12m ({indiceOficial.periodo}):{' '}
                  <b className="text-foreground tabular-nums">{indiceOficial.acumulado_12m?.toFixed(2)}%</b>
                  {' '}→ estimativa de <b className="text-foreground tabular-nums">{brl(estimativa)}</b> sobre o
                  valor global. O número do requerimento usa a série exata entre as datas — confira no simulador.
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Sem o acumulado oficial do índice {dados?.indice_reajuste ?? ''} na base — atualize os
                  índices no painel para a estimativa aparecer.
                </p>
              )}
              <p className="text-muted-foreground">
                Aplicação por simples apostila (art. 136, I) — não precisa de termo aditivo. Registre o
                pedido formal <b>antes</b> de assinar qualquer aditivo: prorrogação aceita sem ressalva
                pode ser lida como renúncia (preclusão lógica).
              </p>
              <Link to="/indices-repactuacao" className="text-primary inline-flex items-center gap-1 nao-imprime">
                Abrir índices e simulador <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          ) : situacao ? (
            <Badge variant="outline" className="text-xs border-success/30 text-success">
              Em dia — próximo aniversário em {dataBr(situacao.aniversario)}
            </Badge>
          ) : (
            <p className="text-warning">
              Índice registrado, mas sem data-base — sem ela o aniversário não é vigiado. Edite pelo lápis.
            </p>
          )}

          {dados?.reajuste_clausula && (
            <p className="text-[11px] text-muted-foreground italic border-l-2 border-border pl-2">
              “{dados.reajuste_clausula}”
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
