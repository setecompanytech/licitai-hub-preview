import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  FileText, FileSpreadsheet, Loader2, AlertTriangle, Info, Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useMembroPermissoes } from '@/hooks/useMembroPermissoes';
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

const CorSeveridade: Record<string, string> = {
  alta: 'bg-destructive/10 text-destructive border-destructive/30',
  media: 'bg-warning/10 text-warning border-warning/30',
  baixa: 'bg-muted text-muted-foreground border-border',
};

function hojeSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export default function RelatoriosMetas() {
  const { user } = useAuth();
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
      if (formato === 'pdf') exportarRelatorioPdf(relatorio);
      else await exportarRelatorioPlanilha(relatorio);

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
      <Card>
        <CardHeader className="py-3 px-5 border-b">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            Relatório por colaborador
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <Label className="text-xs text-muted-foreground mb-1 block">Colaborador</Label>
              <Select value={selecionado} onValueChange={setColaboradorId} disabled={!isAdmin}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {disponiveis.map((c) => (
                    <SelectItem key={c.user_id} value={c.user_id}>
                      {nomeDoColaborador(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-[220px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TipoRelatorio)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => <SelectItem key={t.valor} value={t.valor}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="w-[140px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Mês</Label>
              <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="w-[100px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Ano</Label>
              <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[ano - 1, ano, ano + 1].map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <Button
              size="sm" className="h-9"
              disabled={!relatorio || exportando}
              onClick={() => exportar('pdf')}
            >
              {exportando ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <FileText className="w-3.5 h-3.5 mr-1.5" />}
              PDF
            </Button>
            <Button
              size="sm" variant="outline" className="h-9"
              disabled={!relatorio || exportando}
              onClick={() => exportar('xlsx')}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
              Planilha
            </Button>
          </div>
        </CardContent>
      </Card>

      {!relatorio ? (
        <Card className="p-12 text-center">
          <FileText className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            Selecione um colaborador para montar o relatório.
          </p>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold">{relatorio.periodo.rotulo}</h3>
            <Badge variant="outline" className="text-xs">{relatorio.colaborador}</Badge>
            {relatorio.parcial && (
              <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/30">
                <Info className="w-3 h-3 mr-1" /> Período em curso — números parciais
              </Badge>
            )}
            <span className="ml-auto text-xs text-muted-foreground inline-flex items-center gap-1">
              <Save className="w-3 h-3" /> A exportação registra o snapshot do período
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card>
              <CardHeader className="py-2.5 px-4 border-b">
                <CardTitle className="text-xs font-semibold">Indicadores do período</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableBody>
                    {relatorio.indicadores.map((i) => (
                      <TableRow key={i.rotulo} className="text-sm">
                        <TableCell className="pl-4 text-muted-foreground">{i.rotulo}</TableCell>
                        <TableCell className="text-right pr-4 font-medium tabular-nums">{i.valor}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-2.5 px-4 border-b">
                <CardTitle className="text-xs font-semibold">
                  {relatorio.tipo === 'MES' ? 'Situação de fechamento' : 'Caminho até a meta'}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableBody>
                    {relatorio.sugestoes.map((s) => (
                      <TableRow key={s.rotulo} className="text-sm">
                        <TableCell className="pl-4 text-muted-foreground">{s.rotulo}</TableCell>
                        <TableCell className="text-right pr-4 font-medium tabular-nums">{s.valor}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {relatorio.riscos.length > 0 && (
            <Card>
              <CardHeader className="py-2.5 px-4 border-b">
                <CardTitle className="text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" />
                  Riscos identificados
                  <Badge variant="outline" className="text-[10px]">{relatorio.riscos.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 divide-y">
                {relatorio.riscos.map((r) => (
                  <div key={r.codigo} className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${CorSeveridade[r.severidade]}`}>
                        {r.severidade}
                      </Badge>
                      <div className="min-w-0">
                        <p className="text-sm">{r.descricao}</p>
                        {r.acao && <p className="text-xs text-muted-foreground mt-0.5">→ {r.acao}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card>
              <CardHeader className="py-2.5 px-4 border-b">
                <CardTitle className="text-xs font-semibold">Trabalhos registrados no sistema</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {relatorio.atividades.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                    Nenhuma atividade registrada no período.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs bg-muted/30">
                        <TableHead className="pl-4">Módulo</TableHead>
                        <TableHead className="text-right pr-4 w-[100px]">Registros</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {relatorio.atividades.map((a) => (
                        <TableRow key={a.modulo} className="text-sm">
                          <TableCell className="pl-4">{a.modulo}</TableCell>
                          <TableCell className="text-right pr-4 tabular-nums">{a.quantidade}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-2.5 px-4 border-b">
                <CardTitle className="text-xs font-semibold">Premissas do cálculo</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableBody>
                    {relatorio.premissas.map((p) => (
                      <TableRow key={p.rotulo} className="text-sm">
                        <TableCell className="pl-4 text-muted-foreground">{p.rotulo}</TableCell>
                        <TableCell className="text-right pr-4 font-medium tabular-nums">{p.valor}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
