import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import BotaoReanalisar from '@/components/contratos/BotaoReanalisar';
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
  numero_contrato: string | null;
  orgao_contratante: string | null;
  objeto: string | null;
};

/** Resultado do cálculo exato — série oficial SGS/BCB, zero IA nos números. */
type CalculoExato = {
  indice: string;
  fonte: string;
  data_base: string;
  data_alvo: string;
  meses: Array<{ competencia: string; variacao: number; fator: number }>;
  meses_esperados: number;
  completo: boolean;
  serie_ate: string | null;
  fator: number;
  percentual: number;
};

/**
 * Índices oficiais com série mensal no SGS/BCB — os que a calculadora exata
 * sabe calcular. A cláusula pode prever outro (setorial, tabela própria):
 * o "Outro (digitar)" cobre, com o aviso de que o cálculo será manual.
 */
const INDICES_OFICIAIS = [
  { sigla: 'IPCA', rotulo: 'IPCA — IBGE · preços ao consumidor amplo (o mais comum)' },
  { sigla: 'INPC', rotulo: 'INPC — IBGE · preços ao consumidor' },
  { sigla: 'IGP-M', rotulo: 'IGP-M — FGV · índice geral de preços do mercado' },
  { sigla: 'IGP-DI', rotulo: 'IGP-DI — FGV · disponibilidade interna' },
  { sigla: 'INCC-DI', rotulo: 'INCC-DI — FGV · custo da construção (obras)' },
] as const;

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
  // Calculadora exata: série oficial entre a data-base (marco) e o aniversário.
  const [calculo, setCalculo] = useState<CalculoExato | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [baseCalculo, setBaseCalculo] = useState<string>('');
  const [memoriaAberta, setMemoriaAberta] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data, error } = await supabase
        .from('contratos')
        .select('indice_reajuste, data_base_reajuste, reajuste_clausula, valor_global, numero_contrato, orgao_contratante, objeto' as never)
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

  /** "84451,07" ou "84451.07" — os dois formatos entram. */
  const parseBrl = (s: string): number => {
    const t = s.trim();
    if (!t) return NaN;
    return t.includes(',') ? parseFloat(t.replace(/\./g, '').replace(',', '.')) : parseFloat(t);
  };

  // O número do REQUERIMENTO: fator real da série oficial entre o marco e o
  // aniversário (razão dos números-índices). Determinístico — IA nenhuma.
  const calcularExato = async () => {
    if (!situacao || !dados?.indice_reajuste) return;
    setCalculando(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('indices-economicos', {
        body: {
          action: 'calculo_reajuste',
          indice: dados.indice_reajuste,
          data_base: situacao.marco,
          data_alvo: situacao.aniversario,
        },
      });
      if (error) throw error;
      if (!res?.success) throw new Error(res?.error || 'Falha no cálculo');
      setCalculo(res as CalculoExato);
      if (!baseCalculo && dados.valor_global) {
        setBaseCalculo(Number(dados.valor_global).toFixed(2).replace('.', ','));
      }
    } catch (e) {
      toast.error('Não foi possível calcular', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setCalculando(false);
    }
  };

  /** Estudo técnico imprimível: memória de cálculo linha a linha, fonte
   *  oficial citada e fundamentação — pronto para instruir o requerimento. */
  const gerarEstudo = () => {
    if (!calculo || !situacao || !dados) return;
    const base = parseBrl(baseCalculo);
    const temBase = Number.isFinite(base) && base > 0;
    const num = (v: number, casas = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
    const linhas = calculo.meses
      .map((m) => `<tr><td>${m.competencia}</td><td class="n">${num(m.variacao)}%</td><td class="n">${m.fator.toFixed(6).replace('.', ',')}</td></tr>`)
      .join('');
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Estudo Técnico — Reajuste ${dados.numero_contrato ?? ''}</title>
<style>
  body{font-family:Georgia,'Times New Roman',serif;color:#111;max-width:760px;margin:2rem auto;padding:0 1.5rem;font-size:13px;line-height:1.55}
  h1{font-size:16px;text-align:center;text-transform:uppercase;letter-spacing:.04em}
  h2{font-size:13px;text-transform:uppercase;margin-top:1.6em;border-bottom:1px solid #999;padding-bottom:2px}
  table{width:100%;border-collapse:collapse;margin:.6em 0}
  th,td{border:1px solid #bbb;padding:3px 8px;text-align:left}
  th{background:#f0f0f0} .n{text-align:right;font-variant-numeric:tabular-nums}
  .destaque{border:1px solid #999;background:#f7f7f7;padding:8px 12px;margin:.8em 0}
  .rodape{margin-top:3em;text-align:center}
  @media print{body{margin:0 auto}}
</style></head><body>
<h1>Estudo Técnico — Reajustamento Contratual por Números-Índices</h1>
<h2>1. Identificação</h2>
<table>
  <tr><th>Contrato</th><td>${dados.numero_contrato ?? '—'}</td></tr>
  <tr><th>Órgão contratante</th><td>${dados.orgao_contratante ?? '—'}</td></tr>
  <tr><th>Objeto</th><td>${(dados.objeto ?? '—').slice(0, 300)}</td></tr>
  <tr><th>Índice da cláusula</th><td>${calculo.indice} (${calculo.fonte})</td></tr>
  <tr><th>${situacao.marcoEhReajusteAnterior ? 'Marco (último reajuste)' : 'Data-base (proposta/orçamento)'}</th><td>${dataBr(calculo.data_base)}</td></tr>
  <tr><th>Aniversário anual</th><td>${dataBr(calculo.data_alvo)}</td></tr>
</table>
<h2>2. Fundamentação Jurídica</h2>
<p>O reajustamento em sentido estrito recompõe a variação inflacionária ordinária pelo índice
previsto em cláusula (Lei nº 14.133/2021, art. 6º, LVIII, art. 25, §7º e art. 92, §3º),
observado o interregno mínimo de 1 (um) ano contado da data-base — periodicidade inferior é
nula (Lei nº 10.192/2001, arts. 2º e 3º). A aplicação dá-se por simples apostila
(Lei nº 14.133/2021, art. 136, I), dispensado termo aditivo. Recomenda-se o requerimento
formal antes da assinatura de qualquer aditivo, ante o risco de preclusão lógica
(Parecer nº 3/2023 AGU).</p>
<h2>3. Memória de Cálculo — série oficial ${calculo.fonte}</h2>
<table><tr><th>Competência</th><th class="n">Variação mensal</th><th class="n">Fator (1 + i)</th></tr>${linhas}</table>
<div class="destaque">
  <p><b>Fator acumulado</b> (produto dos fatores mensais = razão dos números-índices):
  <b>${calculo.fator.toFixed(6).replace('.', ',')}</b> → variação de <b>${num(calculo.percentual)}%</b></p>
  ${calculo.completo ? '' : `<p><b>Atenção:</b> série oficial disponível até ${calculo.serie_ate ?? '—'} — fator PARCIAL (${calculo.meses.length} de ${calculo.meses_esperados} meses). Refaça o cálculo após a divulgação dos meses faltantes.</p>`}
  ${temBase ? `<p><b>Base de cálculo:</b> R$ ${num(base)} · <b>Reajuste:</b> R$ ${num(base * (calculo.fator - 1))} · <b>Valor reajustado:</b> R$ ${num(base * calculo.fator)}</p>
  <p>O reajuste incide sobre o <b>saldo remanescente</b> a executar na data do aniversário; a base informada acima é de responsabilidade do requerente.</p>` : ''}
</div>
<h2>4. Fontes</h2>
<p>Série temporal oficial obtida do Sistema Gerenciador de Séries Temporais (SGS) do Banco
Central do Brasil — apuração do índice pelo ${calculo.fonte.split('·')[0].trim()}. Consulta em ${new Date().toLocaleDateString('pt-BR')}.</p>
<div class="rodape">
  <p>_________________________________________</p>
  <p>Responsável pelo estudo</p>
</div>
<script>window.print()</script>
</body></html>`;
    const w = window.open('', '_blank');
    if (!w) { toast.error('Habilite pop-ups para gerar o estudo.'); return; }
    w.document.write(html);
    w.document.close();
  };
  const estimativa = situacao?.devido
    ? valorEstimadoDoReajuste(Number(dados?.valor_global ?? 0), indiceOficial?.acumulado_12m)
    : null;

  const semNada = !dados?.indice_reajuste && !dados?.data_base_reajuste;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-lg font-semibold flex items-center gap-1.5">
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
              <Label className="text-xs text-muted-foreground">Índice da cláusula</Label>
              {/* Filtro padronizado (pedido de 12/09): os índices oficiais com
                  série no SGS entram por seleção — sigla digitada à mão errava
                  grafia ("IGPM") e a calculadora não achava a série. Cláusula
                  com índice fora da lista usa o "Outro (digitar)". */}
              {form.indice && !INDICES_OFICIAIS.some((i) => i.sigla === form.indice) ? (
                <div className="flex gap-1">
                  <Input placeholder="Sigla do índice da cláusula" value={form.indice}
                    onChange={(e) => setForm((f) => ({ ...f, indice: e.target.value }))} />
                  <Button type="button" size="sm" variant="ghost" className="px-2 text-xs shrink-0 self-center"
                    title="Voltar à lista de índices oficiais"
                    onClick={() => setForm((f) => ({ ...f, indice: '' }))}>
                    lista
                  </Button>
                </div>
              ) : (
                <Select
                  value={form.indice || undefined}
                  onValueChange={(v) => setForm((f) => ({ ...f, indice: v === '__outro__' ? 'OUTRO' : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Selecionar o índice…" /></SelectTrigger>
                  <SelectContent>
                    {INDICES_OFICIAIS.map((i) => (
                      <SelectItem key={i.sigla} value={i.sigla}>{i.rotulo}</SelectItem>
                    ))}
                    <SelectItem value="__outro__">Outro (digitar)…</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {form.indice && !INDICES_OFICIAIS.some((i) => i.sigla === form.indice) && (
                <p className="text-xs text-muted-foreground mt-1">
                  Índice fora da base oficial SGS — a calculadora exata não o cobre; o cálculo será manual.
                </p>
              )}
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
          <p className="flex items-center gap-1.5 text-warning-ink">
            <AlertTriangle className="w-3.5 h-3.5" /> Cláusula de reajuste não registrada
          </p>
          <p>
            O edital é obrigado a prever índice de reajustamento (art. 25, §7º). Sem o índice e a
            data-base, o sistema não vigia o aniversário anual — reanalise os documentos já
            anexados, ou preencha aqui pelo lápis.
          </p>
          <BotaoReanalisar />
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
            <div className="rounded-md border border-warning-line bg-warning-tint p-2.5 space-y-1">
              <p className="font-semibold text-warning-ink flex items-center gap-1.5">
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

              {/* Calculadora EXATA: série oficial entre o marco e o aniversário
                  (razão dos números-índices) — o número do requerimento. */}
              <div className="rounded-md border border-border bg-card p-2.5 space-y-2 nao-imprime">
                {!calculo ? (
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={calcularExato} disabled={calculando}>
                    {calculando ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <TrendingUp className="w-3.5 h-3.5 mr-1" />}
                    Calcular pela série oficial (SGS/BCB)
                  </Button>
                ) : (
                  <>
                    <p>
                      <b>{calculo.indice}</b> entre {dataBr(calculo.data_base)} e {dataBr(calculo.data_alvo)}:{' '}
                      fator <b className="tabular-nums">{calculo.fator.toFixed(6).replace('.', ',')}</b>{' '}
                      → <b className="tabular-nums text-foreground">
                        {calculo.percentual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                      </b>
                      <span className="text-muted-foreground"> · {calculo.fonte}</span>
                    </p>
                    {!calculo.completo && (
                      <p className="text-warning-ink flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        Série divulgada até {calculo.serie_ate ?? '—'} — fator parcial
                        ({calculo.meses.length}/{calculo.meses_esperados} meses). Refaça após a divulgação.
                      </p>
                    )}
                    <div className="flex items-end gap-2 flex-wrap">
                      <div>
                        <Label className="text-xs text-muted-foreground">Base de cálculo (R$) — use o saldo a executar</Label>
                        <Input className="h-8 w-40 text-xs tabular-nums" value={baseCalculo}
                          onChange={(e) => setBaseCalculo(e.target.value)} placeholder="0,00" />
                      </div>
                      {(() => {
                        const base = parseBrl(baseCalculo);
                        if (!Number.isFinite(base) || base <= 0) return null;
                        return (
                          <p className="pb-1.5">
                            Reajuste: <b className="tabular-nums">{brl(base * (calculo.fator - 1))}</b>{' '}
                            · Reajustado: <b className="tabular-nums">{brl(base * calculo.fator)}</b>
                          </p>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setMemoriaAberta((v) => !v)}>
                        {memoriaAberta ? 'Ocultar memória de cálculo' : `Memória de cálculo (${calculo.meses.length} meses)`}
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={gerarEstudo}>
                        Gerar estudo técnico
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => { setCalculo(null); setMemoriaAberta(false); }}>
                        Refazer
                      </Button>
                    </div>
                    {memoriaAberta && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-muted-foreground">
                              <th className="text-left py-0.5">Competência</th>
                              <th className="text-right">Variação</th>
                              <th className="text-right">Fator</th>
                            </tr>
                          </thead>
                          <tbody>
                            {calculo.meses.map((m) => (
                              <tr key={m.competencia} className="border-t border-border/50">
                                <td className="py-0.5">{m.competencia}</td>
                                <td className="text-right tabular-nums">{m.variacao.toFixed(2).replace('.', ',')}%</td>
                                <td className="text-right tabular-nums">{m.fator.toFixed(6).replace('.', ',')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>

              <Link to="/indices-repactuacao" className="text-primary inline-flex items-center gap-1 nao-imprime">
                Abrir índices e simulador <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          ) : situacao ? (
            <Badge variant="outline" className="text-xs border-success-line text-success-ink">
              Em dia — próximo aniversário em {dataBr(situacao.aniversario)}
            </Badge>
          ) : (
            <p className="text-warning-ink">
              Índice registrado, mas sem data-base — sem ela o aniversário não é vigiado. Edite pelo lápis.
            </p>
          )}

          {dados?.reajuste_clausula && (
            <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-2">
              “{dados.reajuste_clausula}”
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
