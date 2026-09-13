import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useMembroPermissoes } from '@/hooks/useMembroPermissoes';
import { toast } from 'sonner';
import { Briefcase, Link2, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import FinVincularDespesasLote from './FinVincularDespesasLote';
import FinCustoContratoDetalhe from './FinCustoContratoDetalhe';

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
  const [detalhe, setDetalhe] = useState<Linha | null>(null);

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

  // Sincronização automática: vínculo feito em Contas a Pagar, custo digitado
  // na aba do contrato ou pedido novo mudam este painel — o recálculo vem
  // sozinho, sem F5. Debounce curto para rajadas (vínculo em lote).
  useEffect(() => {
    if (!podeVer || !empresaAtiva?.id) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const recarregar = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => load(), 800);
    };
    const canal = supabase
      .channel(`custos-contratos-${empresaAtiva.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financeiro_lancamentos', filter: `empresa_id=eq.${empresaAtiva.id}` }, recarregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contrato_custos' }, recarregar)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(canal);
    };
  }, [podeVer, empresaAtiva?.id, load]);

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
      <Card>
        <EstadoVazio
          icone={<ShieldAlert />}
          titulo="Acesso restrito"
          descricao="Custos por Contrato é visível apenas para o administrador da empresa e a equipe do Financeiro."
        />
      </Card>
    );
  }

  const mostraRateio = config.ratear_indiretas;

  return (
    <div className="space-y-4">
      {/* A descrição da tela já vem do cabeçalho padrão (registro do módulo):
          aqui fica só a barra de ações, que embrulha no celular. */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant={incluirEncerrados ? 'default' : 'outline'}
          aria-pressed={incluirEncerrados}
          onClick={() => setIncluirEncerrados(v => !v)}
        >
          {incluirEncerrados ? 'Ocultar encerrados' : 'Incluir encerrados'}
        </Button>
        <Button variant="outline" size="icon" onClick={load} disabled={loading} aria-label="Recarregar custos por contrato" title="Recarregar">
          {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
        </Button>
        <Button onClick={() => setVincularAberto(true)}>
          <Link2 aria-hidden="true" /> Vincular despesas em lote
        </Button>
      </div>

      {/* Rateio: política da empresa, nunca padrão do produto (princípio 7) */}
      <Card className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Switch id="ratear" checked={config.ratear_indiretas} onCheckedChange={alternarRateio} disabled={salvandoConfig} />
          <div>
            <Label htmlFor="ratear" className="text-base font-semibold">Ratear despesas indiretas</Label>
            <p className="text-sm text-muted-foreground">
              Soma as despesas a pagar <b>sem vínculo de contrato</b> (aluguel, energia, folha,
              pró-labore…) dos últimos {config.rateio_meses} meses e reparte entre os contratos
              vigentes, proporcional ao faturamento — como linha separada, nunca misturada ao custo direto.
            </p>
          </div>
        </div>
        {mostraRateio && (
          <div className="text-right shrink-0">
            <p className="text-sm text-muted-foreground">Indiretas no período</p>
            <p className="text-lg font-semibold tabular-nums">{fmt(indiretas)}</p>
          </div>
        )}
      </Card>

      {erro ? (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Não foi possível carregar os custos</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{erro}</p>
            <Button size="sm" variant="outline" onClick={load}>Tentar novamente</Button>
          </AlertDescription>
        </Alert>
      ) : loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : linhas.length === 0 ? (
        <Card>
          <EstadoVazio
            icone={<Briefcase />}
            titulo={`Nenhum contrato ${incluirEncerrados ? 'cadastrado' : 'vigente'}`}
            descricao={incluirEncerrados
              ? 'Esta empresa ainda não tem contratos cadastrados.'
              : 'Esta empresa não tem contratos vigentes. Use "Incluir encerrados" para ver os antigos.'}
          />
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Contrato</TableHead>
                <TableHead className="whitespace-nowrap">Vigência</TableHead>
                <TableHead className="text-right whitespace-nowrap">Faturado</TableHead>
                <TableHead className="text-right whitespace-nowrap" title="Despesas vinculadas com status realizado/conciliado">Custo pago</TableHead>
                <TableHead className="text-right whitespace-nowrap" title="Despesas vinculadas ainda não pagas — já são custo pelo regime de competência">Comprometido</TableHead>
                <TableHead className="text-right whitespace-nowrap" title="Aba Custos do contrato (sem parcelas cujo lançamento já está vinculado)">Digitado</TableHead>
                {mostraRateio && <TableHead className="text-right whitespace-nowrap" title="Fatia das despesas indiretas, proporcional ao faturamento entre os vigentes">Rateio</TableHead>}
                <TableHead className="text-right whitespace-nowrap">Custo total</TableHead>
                <TableHead className="text-right whitespace-nowrap">Margem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map(l => {
                const custoTotal = calc.custoTotalDe(l);
                const margem = calc.margemDe(l);
                const pctMargem = l.faturamento > 0 ? (margem / l.faturamento) * 100 : null;
                return (
                  <TableRow
                    key={l.contrato_id}
                    className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    onClick={() => setDetalhe(l)}
                    // A linha inteira abre a DRE: quem navega por teclado
                    // precisa da mesma porta. Sem `role="button"` — trocar o
                    // papel da <tr> tiraria a linha da leitura da tabela; o
                    // guard `target === currentTarget` evita roubar o Enter do
                    // link do contrato, que fica dentro da própria linha.
                    tabIndex={0}
                    onKeyDown={e => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setDetalhe(l);
                      }
                    }}
                    title="Clique para ver o resultado detalhado (DRE do contrato)"
                  >
                    <TableCell className="text-sm max-w-[240px]">
                      <Link
                        to={`/gestao-contratos?contrato=${l.contrato_id}`}
                        onClick={e => e.stopPropagation()}
                        className="font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {l.numero_contrato || '(sem número)'}
                      </Link>
                      <span className="block truncate text-xs text-muted-foreground" title={l.orgao_contratante || undefined}>
                        {l.tipo_documento === 'ata_srp' ? 'ATA · ' : ''}{l.orgao_contratante || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      <Badge variant={l.vigente ? 'success' : 'muted'}>
                        {l.vigente ? 'Vigente' : 'Encerrado'}
                      </Badge>
                      {l.data_fim && (
                        <span className="mt-1 block text-xs tabular-nums text-muted-foreground">
                          até {new Date(`${l.data_fim}T12:00:00`).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-right whitespace-nowrap tabular-nums">{fmt(l.faturamento)}</TableCell>
                    <TableCell className="text-sm text-right whitespace-nowrap tabular-nums">{fmt(l.custo_pago)}</TableCell>
                    <TableCell className="text-sm text-right whitespace-nowrap tabular-nums">{fmt(l.custo_comprometido)}</TableCell>
                    <TableCell className="text-sm text-right whitespace-nowrap tabular-nums">{fmt(l.custo_digitado)}</TableCell>
                    {mostraRateio && (
                      <TableCell className="text-sm text-right whitespace-nowrap tabular-nums text-muted-foreground">{fmt(calc.rateioDe(l))}</TableCell>
                    )}
                    <TableCell className="text-sm text-right whitespace-nowrap tabular-nums font-medium">{fmt(custoTotal)}</TableCell>
                    <TableCell className={`text-sm text-right whitespace-nowrap tabular-nums font-medium ${margem < 0 ? 'text-destructive-ink' : 'text-success-ink'}`}>
                      {fmt(margem)}
                      {pctMargem != null && (
                        <span className="block text-xs font-normal text-muted-foreground">{pctMargem.toFixed(1)}%</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="bg-muted font-semibold">
                <TableCell className="text-sm" colSpan={2}>Total ({linhas.length} contrato{linhas.length === 1 ? '' : 's'})</TableCell>
                <TableCell className="text-sm text-right whitespace-nowrap tabular-nums">{fmt(calc.tot.faturamento)}</TableCell>
                <TableCell className="text-sm text-right whitespace-nowrap tabular-nums">{fmt(calc.tot.pago)}</TableCell>
                <TableCell className="text-sm text-right whitespace-nowrap tabular-nums">{fmt(calc.tot.comprometido)}</TableCell>
                <TableCell className="text-sm text-right whitespace-nowrap tabular-nums">{fmt(calc.tot.digitado)}</TableCell>
                {mostraRateio && <TableCell className="text-sm text-right whitespace-nowrap tabular-nums">{fmt(calc.tot.rateio)}</TableCell>}
                <TableCell className="text-sm text-right whitespace-nowrap tabular-nums">
                  {fmt(calc.tot.pago + calc.tot.comprometido + calc.tot.digitado + calc.tot.rateio)}
                </TableCell>
                <TableCell className="text-sm text-right whitespace-nowrap tabular-nums">
                  {fmt(calc.tot.faturamento - (calc.tot.pago + calc.tot.comprometido + calc.tot.digitado + calc.tot.rateio))}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
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

      {detalhe && (
        <FinCustoContratoDetalhe
          linha={detalhe}
          rateio={calc.rateioDe(detalhe)}
          aoFechar={() => setDetalhe(null)}
          aoVincular={() => { setDetalhe(null); setVincularAberto(true); }}
        />
      )}
    </div>
  );
}
