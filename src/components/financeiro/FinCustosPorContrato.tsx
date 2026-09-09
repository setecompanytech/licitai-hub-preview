import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useMembroPermissoes } from '@/hooks/useMembroPermissoes';
import { toast } from 'sonner';
import { Briefcase, Link2, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import FinVincularDespesasLote from './FinVincularDespesasLote';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

type Linha = {
  contrato_id: string;
  numero_contrato: string | null;
  orgao_contratante: string | null;
  tipo_documento: string | null;
  data_fim: string | null;
  vigente: boolean;
  valor_global: number;
  faturamento: number;
  custo_pago: number;
  custo_comprometido: number;
  custo_digitado: number;
  lancamentos: number;
};

type ConfigCustos = { ratear_indiretas: boolean; rateio_meses: number };

/**
 * Custos por Contrato — a carteira inteira, não um contrato por vez.
 *
 * Acesso: admin da empresa e equipe financeiro. A trava vale nas DUAS pontas:
 * este componente esconde a tela, e as funções de banco negam com exceção
 * declarada — esconder botão nunca foi controle de acesso.
 *
 * Custo direto entra AUTOMÁTICO (lançamento a pagar vinculado ao contrato —
 * NF-e de entrada, comissão do contrato) + o digitado na aba Custos (com a
 * dupla contagem impedida no banco). Despesa indireta (aluguel, energia,
 * folha, pró-labore) só entra por RATEIO opcional, desligado por padrão,
 * como linha separada — critério nenhum é inventado em silêncio.
 */
export default function FinCustosPorContrato() {
  const { empresaAtiva } = useEmpresa();
  const { isFinanceiro, isAdmin, loading: permLoading } = useMembroPermissoes();
  const podeVer = isFinanceiro || isAdmin;

  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [incluirEncerrados, setIncluirEncerrados] = useState(false);
  const [config, setConfig] = useState<ConfigCustos>({ ratear_indiretas: false, rateio_meses: 12 });
  const [indiretas, setIndiretas] = useState(0);
  const [salvandoConfig, setSalvandoConfig] = useState(false);
  const [vincularAberto, setVincularAberto] = useState(false);

  const load = useCallback(async () => {
    if (!empresaAtiva?.id) return;
    setLoading(true);
    setErro(null);

    const { data, error } = await supabase.rpc('contratos_custos_carteira' as never, {
      p_empresa_id: empresaAtiva.id,
      p_incluir_encerrados: incluirEncerrados,
    } as never);
    if (error) {
      // A mensagem real do banco chega ao usuário (princípio 3) — inclusive a
      // negação de acesso, que é exceção declarada e não resultado vazio.
      setErro(error.message);
      setLinhas([]);
      setLoading(false);
      return;
    }
    setLinhas(((data as unknown as Linha[]) || []).map(l => ({
      ...l,
      valor_global: Number(l.valor_global) || 0,
      faturamento: Number(l.faturamento) || 0,
      custo_pago: Number(l.custo_pago) || 0,
      custo_comprometido: Number(l.custo_comprometido) || 0,
      custo_digitado: Number(l.custo_digitado) || 0,
    })));

    // Configuração do rateio — ausência de linha = padrão desligado.
    const { data: cfg } = await supabase
      .from('financeiro_config_custos' as never)
      .select('ratear_indiretas, rateio_meses')
      .eq('empresa_id', empresaAtiva.id)
      .maybeSingle();
    const c = (cfg as unknown as ConfigCustos | null) ?? { ratear_indiretas: false, rateio_meses: 12 };
    setConfig(c);

    if (c.ratear_indiretas) {
      const { data: ind, error: erroInd } = await supabase.rpc('despesas_indiretas_da_empresa' as never, {
        p_empresa_id: empresaAtiva.id,
        p_meses: c.rateio_meses,
      } as never);
      if (erroInd) toast.error('Não foi possível somar as despesas indiretas', { description: erroInd.message });
      setIndiretas(Number(ind) || 0);
    } else {
      setIndiretas(0);
    }
    setLoading(false);
  }, [empresaAtiva?.id, incluirEncerrados]);

  useEffect(() => { if (podeVer) load(); }, [load, podeVer]);

  const alternarRateio = async (ligado: boolean) => {
    if (!empresaAtiva?.id) return;
    setSalvandoConfig(true);
    const { error } = await supabase
      .from('financeiro_config_custos' as never)
      .upsert({
        empresa_id: empresaAtiva.id,
        ratear_indiretas: ligado,
        rateio_meses: config.rateio_meses,
        updated_at: new Date().toISOString(),
      } as never, { onConflict: 'empresa_id' });
    setSalvandoConfig(false);
    if (error) { toast.error('Não foi possível salvar a configuração', { description: error.message }); return; }
    toast.success(ligado
      ? 'Rateio ligado — despesas sem vínculo de contrato entram como linha separada, proporcional ao faturamento.'
      : 'Rateio desligado — a margem volta a considerar apenas custos diretos e digitados.');
    load();
  };

  // Rateio proporcional ao faturamento: só contratos VIGENTES participam, e a
  // fatia de quem não faturou é zero — não existe critério inventado.
  const calc = useMemo(() => {
    const vigentes = linhas.filter(l => l.vigente);
    const fatVigentes = vigentes.reduce((s, l) => s + l.faturamento, 0);
    const rateioDe = (l: Linha) =>
      config.ratear_indiretas && l.vigente && fatVigentes > 0
        ? indiretas * (l.faturamento / fatVigentes)
        : 0;
    const custoTotalDe = (l: Linha) =>
      l.custo_pago + l.custo_comprometido + l.custo_digitado + rateioDe(l);
    const margemDe = (l: Linha) => l.faturamento - custoTotalDe(l);
    const tot = {
      faturamento: linhas.reduce((s, l) => s + l.faturamento, 0),
      pago: linhas.reduce((s, l) => s + l.custo_pago, 0),
      comprometido: linhas.reduce((s, l) => s + l.custo_comprometido, 0),
      digitado: linhas.reduce((s, l) => s + l.custo_digitado, 0),
      rateio: linhas.reduce((s, l) => s + rateioDe(l), 0),
    };
    return { rateioDe, custoTotalDe, margemDe, tot, fatVigentes };
  }, [linhas, config.ratear_indiretas, indiretas]);

  if (permLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  if (!podeVer) {
    return (
      <Card className="p-8 text-center space-y-2">
        <ShieldAlert className="w-8 h-8 mx-auto text-muted-foreground" />
        <p className="text-sm font-medium">Acesso restrito</p>
        <p className="text-xs text-muted-foreground">
          Custos por Contrato é visível apenas para o administrador da empresa e a equipe do Financeiro.
        </p>
      </Card>
    );
  }

  const mostraRateio = config.ratear_indiretas;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-muted-foreground" /> Custos por Contrato
          </h2>
          <p className="text-xs text-muted-foreground">
            O que cada contrato vigente custa de verdade: despesas do Financeiro vinculadas
            (pagas e comprometidas), custos digitados na aba Custos — sem dupla contagem — e,
            se ligado, o rateio das despesas indiretas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" className="text-xs" onClick={() => setVincularAberto(true)}>
            <Link2 className="w-3.5 h-3.5 mr-1" /> Vincular despesas em lote
          </Button>
          <Button size="sm" variant={incluirEncerrados ? 'secondary' : 'outline'} className="text-xs"
            onClick={() => setIncluirEncerrados(v => !v)}>
            {incluirEncerrados ? 'Ocultar encerrados' : 'Incluir encerrados'}
          </Button>
          <Button size="sm" variant="outline" className="text-xs" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* Rateio: política da empresa, nunca padrão do produto (princípio 7) */}
      <Card className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Switch id="ratear" checked={config.ratear_indiretas} onCheckedChange={alternarRateio} disabled={salvandoConfig} />
          <div>
            <Label htmlFor="ratear" className="text-sm">Ratear despesas indiretas</Label>
            <p className="text-xs text-muted-foreground">
              Soma as despesas a pagar <b>sem vínculo de contrato</b> (aluguel, energia, folha,
              pró-labore…) dos últimos {config.rateio_meses} meses e reparte entre os contratos
              vigentes, proporcional ao faturamento — como linha separada, nunca misturada ao custo direto.
            </p>
          </div>
        </div>
        {mostraRateio && (
          <div className="text-right shrink-0">
            <p className="text-xs text-muted-foreground">Indiretas no período</p>
            <p className="text-sm font-semibold tabular-nums">{fmt(indiretas)}</p>
          </div>
        )}
      </Card>

      {erro ? (
        <Card className="p-6 text-center space-y-2">
          <ShieldAlert className="w-6 h-6 mx-auto text-destructive" />
          <p className="text-sm text-destructive">{erro}</p>
          <Button size="sm" variant="outline" onClick={load}>Tentar novamente</Button>
        </Card>
      ) : loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : linhas.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhum contrato {incluirEncerrados ? 'cadastrado' : 'vigente'} nesta empresa.
        </Card>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs whitespace-nowrap">Contrato</TableHead>
                <TableHead className="text-xs whitespace-nowrap">Vigência</TableHead>
                <TableHead className="text-xs text-right whitespace-nowrap">Faturado</TableHead>
                <TableHead className="text-xs text-right whitespace-nowrap" title="Despesas vinculadas com status realizado/conciliado">Custo pago</TableHead>
                <TableHead className="text-xs text-right whitespace-nowrap" title="Despesas vinculadas ainda não pagas — já são custo pelo regime de competência">Comprometido</TableHead>
                <TableHead className="text-xs text-right whitespace-nowrap" title="Aba Custos do contrato (sem parcelas cujo lançamento já está vinculado)">Digitado</TableHead>
                {mostraRateio && <TableHead className="text-xs text-right whitespace-nowrap" title="Fatia das despesas indiretas, proporcional ao faturamento entre os vigentes">Rateio</TableHead>}
                <TableHead className="text-xs text-right whitespace-nowrap">Custo total</TableHead>
                <TableHead className="text-xs text-right whitespace-nowrap">Margem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map(l => {
                const custoTotal = calc.custoTotalDe(l);
                const margem = calc.margemDe(l);
                const pctMargem = l.faturamento > 0 ? (margem / l.faturamento) * 100 : null;
                return (
                  <TableRow key={l.contrato_id}>
                    <TableCell className="text-xs max-w-[240px]">
                      <Link
                        to={`/gestao-contratos?contrato=${l.contrato_id}`}
                        className="font-medium text-foreground hover:text-accent hover:underline"
                      >
                        {l.numero_contrato || '(sem número)'}
                      </Link>
                      <span className="block truncate text-[11px] text-muted-foreground" title={l.orgao_contratante || undefined}>
                        {l.tipo_documento === 'ata_srp' ? 'ATA · ' : ''}{l.orgao_contratante || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      <Badge variant="outline" className={`text-xs font-normal ${l.vigente ? 'bg-success/10 text-success border-success/30' : 'bg-muted text-muted-foreground'}`}>
                        {l.vigente ? 'Vigente' : 'Encerrado'}
                      </Badge>
                      {l.data_fim && (
                        <span className="block text-[11px] text-muted-foreground mt-0.5">
                          até {new Date(`${l.data_fim}T12:00:00`).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-right whitespace-nowrap tabular-nums">{fmt(l.faturamento)}</TableCell>
                    <TableCell className="text-xs text-right whitespace-nowrap tabular-nums">{fmt(l.custo_pago)}</TableCell>
                    <TableCell className="text-xs text-right whitespace-nowrap tabular-nums">{fmt(l.custo_comprometido)}</TableCell>
                    <TableCell className="text-xs text-right whitespace-nowrap tabular-nums">{fmt(l.custo_digitado)}</TableCell>
                    {mostraRateio && (
                      <TableCell className="text-xs text-right whitespace-nowrap tabular-nums text-muted-foreground">{fmt(calc.rateioDe(l))}</TableCell>
                    )}
                    <TableCell className="text-xs text-right whitespace-nowrap tabular-nums font-medium">{fmt(custoTotal)}</TableCell>
                    <TableCell className={`text-xs text-right whitespace-nowrap tabular-nums font-medium ${margem < 0 ? 'text-destructive' : 'text-success'}`}>
                      {fmt(margem)}
                      {pctMargem != null && (
                        <span className="block text-[11px] font-normal text-muted-foreground">{pctMargem.toFixed(1)}%</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="bg-muted/40 font-medium">
                <TableCell className="text-xs" colSpan={2}>Total ({linhas.length} contrato{linhas.length === 1 ? '' : 's'})</TableCell>
                <TableCell className="text-xs text-right whitespace-nowrap tabular-nums">{fmt(calc.tot.faturamento)}</TableCell>
                <TableCell className="text-xs text-right whitespace-nowrap tabular-nums">{fmt(calc.tot.pago)}</TableCell>
                <TableCell className="text-xs text-right whitespace-nowrap tabular-nums">{fmt(calc.tot.comprometido)}</TableCell>
                <TableCell className="text-xs text-right whitespace-nowrap tabular-nums">{fmt(calc.tot.digitado)}</TableCell>
                {mostraRateio && <TableCell className="text-xs text-right whitespace-nowrap tabular-nums">{fmt(calc.tot.rateio)}</TableCell>}
                <TableCell className="text-xs text-right whitespace-nowrap tabular-nums">
                  {fmt(calc.tot.pago + calc.tot.comprometido + calc.tot.digitado + calc.tot.rateio)}
                </TableCell>
                <TableCell className="text-xs text-right whitespace-nowrap tabular-nums">
                  {fmt(calc.tot.faturamento - (calc.tot.pago + calc.tot.comprometido + calc.tot.digitado + calc.tot.rateio))}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        O custo automático nasce do vínculo: toda despesa em Contas a Pagar que aponta o contrato
        (a NF-e de entrada gera a conta e o vínculo é sugerido na extração). O que não nasce de
        lançamento — mão de obra própria, estimativas — é digitado na aba Custos do contrato, e a
        dupla contagem é impedida no banco.
      </p>

      <FinVincularDespesasLote
        aberto={vincularAberto}
        onFechar={() => setVincularAberto(false)}
        onVinculado={load}
      />
    </div>
  );
}
