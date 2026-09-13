import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import EstadoVazio from '@/components/shared/EstadoVazio';
import BarraFiltros from '@/components/gestao/BarraFiltros';
import { SecaoGestao } from '@/components/gestao/TelaGestao';
import { ValorIndisponivel } from '@/components/gestao/SeloSituacao';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  FileText, FileSpreadsheet, Loader2, AlertTriangle, Info, Save, Activity,
  Target, Users, SlidersHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useAuthorization } from '@/hooks/useAuthorization';
import { carregarTimbrado } from '@/lib/timbrado/timbrado';
import {
  useMetasConfig, useValoresAlvo, useMetas, useRealizadoMensal, useColaboradores,
  useFeriados, useContratosAssinados, usePerdasPorMotivo, useAtividadesPorModulo,
  useSalvarSnapshot,
} from '@/hooks/useMetasComercial';
import { apurarTickets } from '@/lib/metas/tickets';
import { resolverValoresAlvo } from '@/lib/metas/valores-alvo';
import { filtrarHistorico, inicioDaJanela, realizadoDoMes, type BaseMeta } from '@/lib/metas/painel';
import { filtrarFeriadosPorPraca } from '@/lib/metas/praca';
import { filtrarColaboradoresDoPainel, nomeDoColaborador } from '@/lib/metas/colaboradores';
import { paraCentavos } from '@/lib/metas/dinheiro';
import { projetarMeta } from '@/lib/metas/projecao';
import { montarRelatorio, periodoDoRelatorio, type TipoRelatorio } from '@/lib/metas/relatorio';
import { exportarRelatorioPdf, exportarRelatorioPlanilha } from '@/lib/metas/relatorio-export';
import { AVISO_CRITERIOS_DISTINTOS, apuracaoDoIndicador } from '@/lib/metas/apuracao';
import { CampoFiltro, LinhaApuracao } from './comuns';
import { MESES } from './meses';

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

/**
 * Uma tabela de pares rótulo/valor do relatório, com a base de apuração de
 * cada linha escrita abaixo do rótulo.
 *
 * `montarRelatorio` devolve os pares já formatados — e continua assim: mexer
 * nele mudaria o PDF, a planilha e o snapshot gravado. O metadado é resolvido
 * aqui, pelo rótulo (ver `lib/metas/apuracao.ts`), e some quando não houver
 * base declarada em vez de inventar uma.
 */
function TabelaDeLinhas({
  linhas,
  base,
}: {
  linhas: { rotulo: string; valor: string }[];
  base?: BaseMeta;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableBody>
          {linhas.map((i) => {
            const apuracao = base ? apuracaoDoIndicador(i.rotulo, base) : null;
            return (
              <TableRow key={i.rotulo}>
                <TableCell className="g-corpo pl-4 text-muted-foreground sm:pl-6">
                  {i.rotulo}
                  {apuracao && <LinhaApuracao curto={apuracao} />}
                </TableCell>
                <TableCell className="g-corpo pr-4 text-right font-medium tabular-nums sm:pr-6">
                  {/* `montarRelatorio` já devolve "—" quando o número não pôde
                      ser apurado (taxa sem participação, por exemplo). Aqui ele
                      vira ausência declarada, e não um traço mudo que se lê
                      como zero. */}
                  {i.valor === '—'
                    ? <ValorIndisponivel razao="Não apurado no período" />
                    : i.valor}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export default function RelatoriosMetas() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  // Mesma autoridade das demais telas do módulo — ver a nota em
  // `pages/MetasComercial.tsx` sobre as três que o repo mantém.
  const { isAdmin } = useAuthorization();
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

  /** A base da meta decide quais colunas — e quais DATAS — medem o realizado. */
  const baseDoRelatorio: BaseMeta =
    (metas ?? []).find((m) => m.user_id === selecionado)?.base_meta ?? 'faturamento';

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

  const hojeAno = Number(hoje.slice(0, 4));
  const hojeMes = Number(hoje.slice(5, 7));
  const filtrosAplicados =
    (mes !== hojeMes ? 1 : 0) + (ano !== hojeAno ? 1 : 0) + (tipo !== 'Q1' ? 1 : 0)
    + (isAdmin && colaboradorId && colaboradorId !== disponiveis[0]?.user_id ? 1 : 0);
  const limparFiltros = () => {
    setMes(hojeMes); setAno(hojeAno); setTipo('Q1'); setColaboradorId('');
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* ── Filtros: período e colaborador ACIMA dos resultados ──
          A emissão é a ação principal da aba, então ela fica ancorada à direita
          da barra, junto do aviso do efeito colateral que ela provoca. */}
      <BarraFiltros
        filtrosAplicados={filtrosAplicados}
        aoLimpar={limparFiltros}
        acao={
          <div className="flex flex-wrap items-center gap-2">
            <Button className="g-controle" disabled={!relatorio || exportando} onClick={() => exportar('pdf')}>
              {exportando
                ? <Loader2 aria-hidden="true" className="animate-spin" />
                : <FileText aria-hidden="true" />}
              PDF
            </Button>
            <Button variant="outline" className="g-controle" disabled={!relatorio || exportando} onClick={() => exportar('xlsx')}>
              <FileSpreadsheet aria-hidden="true" />
              Planilha
            </Button>
          </div>
        }
      >
        <CampoFiltro rotulo="Colaborador" className="w-full sm:w-56">
          <Select value={selecionado} onValueChange={setColaboradorId} disabled={!isAdmin}>
            <SelectTrigger aria-label="Colaborador" className="g-controle"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {disponiveis.map((c) => (
                <SelectItem key={c.user_id} value={c.user_id}>
                  {nomeDoColaborador(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CampoFiltro>

        <CampoFiltro rotulo="Tipo" className="w-full sm:w-56">
          <Select value={tipo} onValueChange={(v) => setTipo(v as TipoRelatorio)}>
            <SelectTrigger aria-label="Tipo" className="g-controle"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIPOS.map((t) => <SelectItem key={t.valor} value={t.valor}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </CampoFiltro>

        <CampoFiltro rotulo="Mês" className="w-full sm:w-40">
          <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
            <SelectTrigger aria-label="Mês" className="g-controle"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </CampoFiltro>

        <CampoFiltro rotulo="Ano" className="w-full sm:w-28">
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger aria-label="Ano" className="g-controle"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[ano - 1, ano, ano + 1].map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </CampoFiltro>
      </BarraFiltros>

      {/* O efeito colateral fica no cabeçalho da aba, e não escondido junto do
          resultado: quem clica em PDF grava um snapshot do período, e precisa
          saber disso ANTES de clicar. */}
      <p className="g-meta inline-flex items-center gap-1.5 text-muted-foreground">
        <Save aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        Toda exportação registra um snapshot do período em
        {' '}<code className="font-mono">comercial_meta_snapshots</code> — indicadores e premissas
        congelados como estavam na emissão.
      </p>

      {!relatorio ? (
        <div className="g-cartao">
          {disponiveis.length === 0 ? (
            <EstadoVazio
              icone={<Users />}
              titulo="Nenhum colaborador para relatar"
              descricao={isAdmin
                ? 'O relatório é por pessoa. Entra na lista quem está no setor comercial ou tem meta no período.'
                : 'Você ainda não aparece no comercial nem tem meta no período — por isso não há relatório para montar.'}
              acao={isAdmin ? (
                <>
                  <Button onClick={() => navigate('/definir-metas')}>
                    <Target aria-hidden="true" />
                    Definir metas
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/equipe')}>
                    <Users aria-hidden="true" />
                    Cadastrar a equipe
                  </Button>
                </>
              ) : undefined}
            />
          ) : !config ? (
            /* Sem `comercial_metas_config` o motor não tem taxas, janela nem
               limiares — e o relatório não pode ser montado com valores
               inventados. A ação é criar os padrões, que vivem em Definir Metas. */
            <EstadoVazio
              icone={<SlidersHorizontal />}
              titulo="Parâmetros do módulo ainda não criados"
              descricao="Janela histórica, taxas padrão e limiares de alerta são insumos do relatório. Sem eles não há o que projetar."
              acao={isAdmin ? (
                <Button onClick={() => navigate('/definir-metas')}>
                  <SlidersHorizontal aria-hidden="true" />
                  Restaurar padrões em Definir Metas
                </Button>
              ) : undefined}
            />
          ) : (
            <EstadoVazio
              icone={<FileText />}
              titulo="Nenhum relatório montado"
              descricao="Escolha um colaborador na barra acima para montar o relatório do período."
            />
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="g-titulo-secao text-foreground">{relatorio.periodo.rotulo}</h2>
            <Badge variant="muted">{relatorio.colaborador}</Badge>
            {relatorio.parcial && (
              <Badge variant="warning">
                <Info aria-hidden="true" className="mr-1 h-3 w-3" /> Período em curso — números parciais
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SecaoGestao titulo="Indicadores do período">
              <p className="g-meta text-muted-foreground">{AVISO_CRITERIOS_DISTINTOS}</p>
              <div className="g-cartao py-2">
                <TabelaDeLinhas linhas={relatorio.indicadores} base={baseDoRelatorio} />
              </div>
            </SecaoGestao>

            <SecaoGestao titulo={relatorio.tipo === 'MES' ? 'Situação de fechamento' : 'Caminho até a meta'}>
              <div className="g-cartao py-2">
                {/* Sugestões são alvos, mas serão cobrados pela data da
                    métrica correspondente — a base vai junto. */}
                <TabelaDeLinhas linhas={relatorio.sugestoes} base={baseDoRelatorio} />
              </div>
            </SecaoGestao>
          </div>

          {relatorio.riscos.length > 0 && (
            <SecaoGestao titulo="Riscos identificados" contagem={relatorio.riscos.length}>
              <div className="g-cartao divide-y divide-border">
                {relatorio.riscos.map((r) => (
                  <div key={r.codigo} className="flex items-start gap-3 p-4">
                    <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <Badge variant={VarianteSeveridade[r.severidade] ?? 'muted'} className="shrink-0">
                      {r.severidade}
                    </Badge>
                    <div className="min-w-0">
                      <p className="g-corpo text-foreground">{r.descricao}</p>
                      {r.acao && <p className="g-meta mt-1 text-muted-foreground">→ {r.acao}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </SecaoGestao>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SecaoGestao titulo="Trabalhos registrados no sistema">
              <div className="g-cartao">
                {relatorio.atividades.length === 0 ? (
                  <EstadoVazio
                    tamanho="compacto"
                    icone={<Activity />}
                    titulo="Nenhuma atividade no período"
                    descricao="Registros de licitações, propostas e contratos do período aparecem aqui, contados pela data em que foram feitos."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted">
                          <TableHead className="pl-4 sm:pl-6">Módulo</TableHead>
                          <TableHead className="w-[110px] pr-4 text-right sm:pr-6">Registros</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {relatorio.atividades.map((a) => (
                          <TableRow key={a.modulo}>
                            <TableCell className="g-corpo pl-4 sm:pl-6">{a.modulo}</TableCell>
                            <TableCell className="g-corpo pr-4 text-right tabular-nums sm:pr-6">{a.quantidade}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </SecaoGestao>

            <SecaoGestao titulo="Premissas do cálculo">
              <div className="g-cartao py-2">
                {/* As duas conversões dividem números apurados por datas
                    diferentes: é aqui que a mistura precisa estar escrita. */}
                <TabelaDeLinhas linhas={relatorio.premissas} base={baseDoRelatorio} />
              </div>
            </SecaoGestao>
          </div>
        </>
      )}
    </div>
  );
}
