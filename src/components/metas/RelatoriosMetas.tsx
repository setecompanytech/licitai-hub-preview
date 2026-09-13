import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import EstadoVazio from '@/components/shared/EstadoVazio';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  FileText, FileSpreadsheet, Loader2, AlertTriangle, Info, Save, Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useMembroPermissoes } from '@/hooks/useMembroPermissoes';
import { carregarTimbrado } from '@/lib/timbrado/timbrado';
import {
  useMetasConfig, useValoresAlvo, useMetas, useRealizadoMensal, useColaboradores,
  useFeriados, useContratosAssinados, usePerdasPorMotivo, useAtividadesPorModulo,
  useSalvarSnapshot,
} from '@/hooks/useMetasComercial';
import { apurarTickets } from '@/lib/metas/tickets';
import { resolverValoresAlvo } from '@/lib/metas/valores-alvo';
import { filtrarHistorico, inicioDaJanela, realizadoDoMes } from '@/lib/metas/painel';
import { filtrarFeriadosPorPraca } from '@/lib/metas/praca';
import { filtrarColaboradoresDoPainel, nomeDoColaborador } from '@/lib/metas/colaboradores';
import { paraCentavos } from '@/lib/metas/dinheiro';
import { projetarMeta } from '@/lib/metas/projecao';
import { montarRelatorio, periodoDoRelatorio, type TipoRelatorio } from '@/lib/metas/relatorio';
import { exportarRelatorioPdf, exportarRelatorioPlanilha } from '@/lib/metas/relatorio-export';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const TIPOS: { valor: TipoRelatorio; label: string }[] = [
  { valor: 'Q1', label: 'Quinzenal — dias 1 a 15' },
  { valor: 'Q2', label: 'Quinzenal — dia 16 ao fim' },
  { valor: 'MES', label: 'Mensal — mês inteiro' },
];

/**
 * Severidade do risco → família semântica do Badge (tinta: fundo *-tint, texto
 * *-ink). O texto da severidade fica visível no próprio badge: a cor é
 * reforço, nunca a única pista.
 */
const VarianteSeveridade: Record<string, 'danger' | 'warning' | 'muted'> = {
  alta: 'danger',
  media: 'warning',
  baixa: 'muted',
};

function hojeSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export default function RelatoriosMetas() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const { isAdmin } = useMembroPermissoes();
  const hoje = hojeSaoPaulo();

  const [ano, setAno] = useState(() => Number(hoje.slice(0, 4)));
  const [mes, setMes] = useState(() => Number(hoje.slice(5, 7)));
  const [tipo, setTipo] = useState<TipoRelatorio>('Q1');
  const [colaboradorId, setColaboradorId] = useState<string>('');
  const [exportando, setExportando] = useState(false);

  const periodo = useMemo(() => periodoDoRelatorio(tipo, ano, mes), [tipo, ano, mes]);

  const { data: config } = useMetasConfig();
  const { data: valoresAlvo } = useValoresAlvo();
  const { data: metas } = useMetas({ ano, mes });
  const { data: realizado } = useRealizadoMensal({});
  const { data: colaboradores } = useColaboradores();
  const { data: feriados } = useFeriados(ano);
  const salvarSnapshot = useSalvarSnapshot();

  // Só o comercial e quem tem meta; depois disso, colaborador vê só o seu e
  // admin escolhe. O default evita tela vazia.
  const disponiveis = useMemo(() => {
    const doPainel = filtrarColaboradoresDoPainel(
      colaboradores ?? [],
      (metas ?? []).map((m) => m.user_id),
    );
    return isAdmin ? doPainel : doPainel.filter((c) => c.user_id === user?.id);
  }, [colaboradores, metas, isAdmin, user?.id]);

  const selecionado = colaboradorId || disponiveis[0]?.user_id || '';
  const desde = inicioDaJanela(ano, mes, config?.janela_historica_meses ?? 6);
  const { data: contratos } = useContratosAssinados({ desde, userId: selecionado || undefined });
  const colaborador = disponiveis.find((c) => c.user_id === selecionado);

  const { data: motivosPerda } = usePerdasPorMotivo(periodo.inicio, periodo.fim, selecionado);
  const { data: atividades } = useAtividadesPorModulo(periodo.inicio, periodo.fim, selecionado);

  const relatorio = useMemo(() => {
    if (!colaborador || !config) return null;

    const meta = (metas ?? []).find((m) => m.user_id === selecionado);
    const linhas = realizado ?? [];

    const historico = filtrarHistorico(linhas, {
      userId: selecionado, ano, mes, janelaMeses: config.janela_historica_meses,
    });
    const realizadoCent = realizadoDoMes(linhas, {
      userId: selecionado, ano, mes, base: meta?.base_meta ?? 'faturamento',
    });
    const doMes = linhas.find((l) => l.user_id === selecionado && l.ano === ano && l.mes === mes);

    const projecao = projetarMeta({
      metaCent: paraCentavos(Number(meta?.meta_faturamento ?? 0)),
      realizadoCent,
      ano,
      mes,
      // Período já encerrado: o relatório reflete o fim dele, não a data de hoje
      hoje: hoje > periodo.fim ? periodo.fim : hoje,
      feriados: filtrarFeriadosPorPraca(feriados ?? [], {
        uf: colaborador.praca_uf,
        municipio: colaborador.praca_municipio,
      }),
      historico,
      tickets: apurarTickets(
        (contratos ?? []).map((c) => ({
          modalidade: c.modalidade,
          valorGlobalCent: paraCentavos(c.valor_global),
        })),
      ),
      valoresAlvoCent: resolverValoresAlvo(valoresAlvo ?? [], hoje, selecionado),
      parametros: {
        txGanhoPadrao: Number(config.tx_ganho_padrao),
        txFaturamentoPadrao: Number(config.tx_faturamento_padrao),
        minAmostraTicket: config.min_amostra_ticket,
        minAnosSazonalidade: config.min_anos_sazonalidade,
      },
    });

    return montarRelatorio({
      tipo, ano, mes, hoje,
      colaborador: nomeDoColaborador(colaborador),
      projecao,
      realizado: {
        participados: doMes?.participados ?? 0,
        ganhos: doMes?.ganhos ?? 0,
        perdidos: doMes?.perdidos ?? 0,
        pedidos_faturados: doMes?.pedidos_faturados ?? 0,
        nfe_quitadas: doMes?.nfe_quitadas ?? 0,
      },
      motivosPerda: motivosPerda ?? [],
      atividades: atividades ?? [],
    });
  }, [
    colaborador, config, ano, mes, hoje, periodo.fim, realizado, metas, feriados,
    contratos, valoresAlvo, selecionado, tipo, motivosPerda, atividades,
  ]);

  const exportar = async (formato: 'pdf' | 'xlsx') => {
    if (!relatorio) return;
    setExportando(true);
    try {
      if (formato === 'pdf') {
        // O relatório veste o timbrado da empresa, como todo documento gerado.
        exportarRelatorioPdf(relatorio, await carregarTimbrado(empresaAtiva?.id));
      } else {
        await exportarRelatorioPlanilha(relatorio);
      }

      // O snapshot congela indicadores E premissas da emissão
      await salvarSnapshot.mutateAsync({
        user_id: selecionado,
        ano, mes, referencia: tipo,
        indicadores: relatorio.indicadores,
        premissas: relatorio.premissas,
      });
      toast.success('Relatório emitido e registrado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao exportar.');
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Seletores e emissão ── */}
      <Card>
        <CardHeader className="border-b p-6">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <FileText aria-hidden="true" className="w-4 h-4 text-muted-foreground" />
            Relatório por colaborador
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[12rem] flex-1">
              <Label htmlFor="relatorios-metas-colaborador" className="mb-1 block text-sm text-muted-foreground">Colaborador</Label>
              <Select value={selecionado} onValueChange={setColaboradorId} disabled={!isAdmin}>
                <SelectTrigger id="relatorios-metas-colaborador"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {disponiveis.map((c) => (
                    <SelectItem key={c.user_id} value={c.user_id}>
                      {nomeDoColaborador(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full sm:w-56">
              <Label htmlFor="relatorios-metas-tipo" className="mb-1 block text-sm text-muted-foreground">Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TipoRelatorio)}>
                <SelectTrigger id="relatorios-metas-tipo"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => <SelectItem key={t.valor} value={t.valor}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full sm:w-44">
              <Label htmlFor="relatorios-metas-mes" className="mb-1 block text-sm text-muted-foreground">Mês</Label>
              <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
                <SelectTrigger id="relatorios-metas-mes"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full sm:w-32">
              <Label htmlFor="relatorios-metas-ano" className="mb-1 block text-sm text-muted-foreground">Ano</Label>
              <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
                <SelectTrigger id="relatorios-metas-ano"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[ano - 1, ano, ano + 1].map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                disabled={!relatorio || exportando}
                onClick={() => exportar('pdf')}
              >
                {exportando
                  ? <Loader2 aria-hidden="true" className="animate-spin" />
                  : <FileText aria-hidden="true" />}
                PDF
              </Button>
              <Button
                variant="outline"
                disabled={!relatorio || exportando}
                onClick={() => exportar('xlsx')}
              >
                <FileSpreadsheet aria-hidden="true" />
                Planilha
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {!relatorio ? (
        <Card>
          <EstadoVazio
            icone={<FileText />}
            titulo="Nenhum relatório montado"
            descricao="Selecione um colaborador para montar o relatório."
          />
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-foreground">{relatorio.periodo.rotulo}</h3>
            <Badge variant="muted">{relatorio.colaborador}</Badge>
            {relatorio.parcial && (
              <Badge variant="warning">
                <Info aria-hidden="true" className="mr-1 h-3 w-3" /> Período em curso — números parciais
              </Badge>
            )}
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Save aria-hidden="true" className="h-3 w-3" /> A exportação registra o snapshot do período
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="border-b p-6">
                <CardTitle className="text-lg font-semibold">Indicadores do período</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableBody>
                      {relatorio.indicadores.map((i) => (
                        <TableRow key={i.rotulo}>
                          <TableCell className="pl-6 text-sm text-muted-foreground">{i.rotulo}</TableCell>
                          <TableCell className="pr-6 text-right text-sm font-medium tabular-nums">{i.valor}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b p-6">
                <CardTitle className="text-lg font-semibold">
                  {relatorio.tipo === 'MES' ? 'Situação de fechamento' : 'Caminho até a meta'}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableBody>
                      {relatorio.sugestoes.map((s) => (
                        <TableRow key={s.rotulo}>
                          <TableCell className="pl-6 text-sm text-muted-foreground">{s.rotulo}</TableCell>
                          <TableCell className="pr-6 text-right text-sm font-medium tabular-nums">{s.valor}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {relatorio.riscos.length > 0 && (
            <Card>
              <CardHeader className="border-b p-6">
                <CardTitle className="flex flex-wrap items-center gap-2 text-lg font-semibold">
                  <AlertTriangle aria-hidden="true" className="w-4 h-4 text-muted-foreground" />
                  Riscos identificados
                  <Badge variant="muted">{relatorio.riscos.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border p-0">
                {relatorio.riscos.map((r) => (
                  <div key={r.codigo} className="px-6 py-4">
                    <div className="flex items-start gap-3">
                      <Badge variant={VarianteSeveridade[r.severidade] ?? 'muted'} className="shrink-0">
                        {r.severidade}
                      </Badge>
                      <div className="min-w-0">
                        <p className="text-sm text-foreground">{r.descricao}</p>
                        {r.acao && <p className="mt-1 text-xs text-muted-foreground">→ {r.acao}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="border-b p-6">
                <CardTitle className="text-lg font-semibold">Trabalhos registrados no sistema</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {relatorio.atividades.length === 0 ? (
                  <EstadoVazio
                    tamanho="compacto"
                    icone={<Activity />}
                    titulo="Nenhuma atividade no período"
                    descricao="Registros de licitações, propostas e contratos do período aparecem aqui."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted">
                          <TableHead className="pl-6">Módulo</TableHead>
                          <TableHead className="w-[110px] pr-6 text-right">Registros</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {relatorio.atividades.map((a) => (
                          <TableRow key={a.modulo}>
                            <TableCell className="pl-6 text-sm">{a.modulo}</TableCell>
                            <TableCell className="pr-6 text-right text-sm tabular-nums">{a.quantidade}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b p-6">
                <CardTitle className="text-lg font-semibold">Premissas do cálculo</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableBody>
                      {relatorio.premissas.map((p) => (
                        <TableRow key={p.rotulo}>
                          <TableCell className="pl-6 text-sm text-muted-foreground">{p.rotulo}</TableCell>
                          <TableCell className="pr-6 text-right text-sm font-medium tabular-nums">{p.valor}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
