import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import EstadoVazio from '@/components/shared/EstadoVazio';
import BarraFiltros from '@/components/gestao/BarraFiltros';
import FaixaIndicadores, { type Indicador } from '@/components/gestao/FaixaIndicadores';
import { SecaoGestao } from '@/components/gestao/TelaGestao';
import { ValorIndisponivel } from '@/components/gestao/SeloSituacao';
import { CalendarDays, Target, Trophy, Users } from 'lucide-react';
import { useMetas, useRealizadoMensal, useColaboradores } from '@/hooks/useMetasComercial';
import { filtrarColaboradoresDoPainel } from '@/lib/metas/colaboradores';
import { nomeExibido } from '@/lib/equipe/nomeExibido';
import { APURACAO } from '@/lib/metas/apuracao';
import { CampoFiltro, LinhaApuracao } from './comuns';
import { MESES_CURTOS } from './meses';

/**
 * Cumprimento de meta da EQUIPE, um colaborador por linha.
 *
 * Painel e Relatórios mostram um colaborador por vez — servem para a pessoa
 * acompanhar a si mesma. Faltava a leitura de gestão: quem está adiante, quem
 * ficou para trás, no mesmo período e lado a lado. Os dados sempre foram por
 * usuário (`comercial_metas.user_id` e a view de realizado); o que não existia
 * era a visão que os compara.
 */

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

/**
 * As duas bases de comparação da aba e a DATA que apura cada uma.
 *
 * São critérios diferentes, não dois recortes do mesmo número: contrato conta
 * pela assinatura, pedido conta pela data do pedido. Trocar a base troca o mês
 * em que o mesmo negócio aparece — e é isso que a linha de apuração avisa.
 */
const BASES = {
  faturamento: { label: 'Meta de faturamento', apuracao: APURACAO.pedidos_faturados, moeda: true },
  contratos: { label: 'Meta de contratos ganhos', apuracao: APURACAO.ganhos, moeda: false },
} as const;

type BaseComparacao = keyof typeof BASES;

/**
 * Faixa de atingimento — mesma leitura que a Fase 5 usará no multiplicador.
 * A cor vem da família semântica do Badge (tinta); o rótulo é que informa, a
 * cor só reforça.
 */
const faixaDe = (pct: number | null): { rotulo: string; variante: 'muted' | 'success' | 'warning' | 'danger' } => {
  if (pct === null) return { rotulo: 'sem meta', variante: 'muted' };
  if (pct >= 100) return { rotulo: 'meta batida', variante: 'success' };
  if (pct >= 80) return { rotulo: 'na faixa', variante: 'warning' };
  return { rotulo: 'abaixo', variante: 'danger' };
};

export default function EquipeMetas() {
  const navigate = useNavigate();
  const hoje = new Date();
  const anoRef = hoje.getFullYear();
  const mesRef = hoje.getMonth() + 1;
  const [ano, setAno] = useState(anoRef);
  const [mes, setMes] = useState(mesRef);
  const [base, setBase] = useState<BaseComparacao>('faturamento');

  const { data: metas } = useMetas({ ano, mes });
  const { data: realizado } = useRealizadoMensal({ ano });
  const { data: membros } = useColaboradores();

  const linhas = useMemo(() => {
    const doPainel = filtrarColaboradoresDoPainel(membros ?? [], (metas ?? []).map((m) => m.user_id));
    const metaPorUser = new Map((metas ?? []).map((m) => [m.user_id, m]));
    const realPorUser = new Map(
      (realizado ?? []).filter((r) => r.ano === ano && r.mes === mes).map((r) => [r.user_id, r]),
    );

    return doPainel
      .map((c) => {
        const meta = metaPorUser.get(c.user_id);
        const real = realPorUser.get(c.user_id);
        const alvo = base === 'faturamento' ? (meta?.meta_faturamento ?? 0) : (meta?.meta_contratos ?? 0);
        const feito = base === 'faturamento' ? (real?.valor_faturado ?? 0) : (real?.ganhos ?? 0);
        // Sem meta definida, atingimento é indefinido — não é zero. Zero diria
        // "não cumpriu"; a verdade é que ninguém estabeleceu o alvo.
        const pct = alvo > 0 ? Math.round((feito / alvo) * 100) : null;
        return { user_id: c.user_id, nome: nomeExibido(c as never), alvo, feito, pct, participados: real?.participados ?? 0 };
      })
      .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));
  }, [membros, metas, realizado, ano, mes, base]);

  const totalAlvo = linhas.reduce((s, l) => s + l.alvo, 0);
  const totalFeito = linhas.reduce((s, l) => s + l.feito, 0);
  const pctEquipe = totalAlvo > 0 ? Math.round((totalFeito / totalAlvo) * 100) : null;

  const { apuracao, moeda } = BASES[base];
  const exibir = (v: number) => (moeda ? brl(v) : String(v));
  const comMeta = linhas.filter((l) => l.alvo > 0).length;

  const filtrosAplicados =
    (mes !== mesRef ? 1 : 0) + (ano !== anoRef ? 1 : 0) + (base !== 'faturamento' ? 1 : 0);
  const limparFiltros = () => { setMes(mesRef); setAno(anoRef); setBase('faturamento'); };

  const irParaMesAnterior = () => {
    if (mes === 1) { setMes(12); setAno((a) => a - 1); return; }
    setMes((m) => m - 1);
  };

  /** Os três números da equipe, cada um declarando a base que o apura. */
  const indicadores: Indicador[] = [
    {
      rotulo: 'Cumprimento da equipe',
      // Sem nenhum alvo escrito, o cumprimento é indefinido — e 0% diria que a
      // equipe fracassou numa meta que ninguém chegou a estabelecer.
      valor: pctEquipe === null ? null : `${pctEquipe}%`,
      razaoIndisponivel: 'Nenhuma meta definida no período',
      detalhe: `${comMeta} de ${linhas.length} com meta`,
      icone: Target,
      tom: pctEquipe !== null && pctEquipe >= 100 ? 'ok' : 'neutro',
    },
    {
      rotulo: 'Realizado da equipe',
      valor: exibir(totalFeito),
      detalhe: <span title={apuracao.explicacao}>{apuracao.curto}</span>,
      icone: Trophy,
    },
    {
      rotulo: 'Alvo somado',
      valor: totalAlvo > 0 ? exibir(totalAlvo) : null,
      razaoIndisponivel: 'Nenhuma meta definida no período',
      detalhe: BASES[base].label.toLowerCase(),
      icone: Users,
    },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* ── Filtros: período e base ACIMA dos resultados ── */}
      <BarraFiltros filtrosAplicados={filtrosAplicados} aoLimpar={limparFiltros}>
        <CampoFiltro rotulo="Base da comparação" className="w-full sm:w-56">
          <Select value={base} onValueChange={(v) => setBase(v as BaseComparacao)}>
            <SelectTrigger aria-label="Base da comparação" className="g-controle"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="faturamento">{BASES.faturamento.label}</SelectItem>
              <SelectItem value="contratos">{BASES.contratos.label}</SelectItem>
            </SelectContent>
          </Select>
        </CampoFiltro>
        <CampoFiltro rotulo="Mês" className="w-full sm:w-28">
          <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
            <SelectTrigger aria-label="Mês" className="g-controle"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES_CURTOS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </CampoFiltro>
        <CampoFiltro rotulo="Ano" className="w-full sm:w-28">
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger aria-label="Ano" className="g-controle"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[anoRef - 1, anoRef].map((a) => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CampoFiltro>
      </BarraFiltros>

      {linhas.length === 0 ? (
        <div className="g-cartao">
          <EstadoVazio
            icone={<Users />}
            titulo="Nenhum colaborador no período"
            descricao="Entra nesta comparação quem está no setor comercial ou tem meta no mês escolhido. Nenhum dos dois se aplica aqui."
            /* Vazio com ação: ou o mês está errado, ou falta meta — e as duas
               saídas ficam a um clique. */
            acao={
              <>
                <Button onClick={() => navigate('/definir-metas')}>
                  <Target aria-hidden="true" />
                  Definir metas do mês
                </Button>
                <Button variant="outline" onClick={irParaMesAnterior}>
                  <CalendarDays aria-hidden="true" />
                  Ver o mês anterior
                </Button>
              </>
            }
          />
        </div>
      ) : (
        <>
          <FaixaIndicadores itens={indicadores} />

          <SecaoGestao titulo="Cumprimento por colaborador" contagem={linhas.length}>
            {/* A base escolhida decide a data que apura TODA a coluna abaixo —
                trocar de base não reordena o mesmo dado, mede outro. */}
            <LinhaApuracao curto={`${BASES[base].label} · ${apuracao.curto}`} explicacao={apuracao.explicacao} />
            <div className="g-cartao divide-y divide-border">
              {linhas.map((l) => {
                const faixa = faixaDe(l.pct);
                return (
                  <div key={l.user_id} className="flex flex-col gap-2 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="g-corpo font-medium text-foreground">{l.nome}</span>
                      <Badge variant={faixa.variante}>{faixa.rotulo}</Badge>
                      <span className="g-meta text-muted-foreground" title={APURACAO.participados.explicacao}>
                        {l.participados} participação(ões) · {APURACAO.participados.curto}
                      </span>
                      <span className="g-corpo ml-auto whitespace-nowrap tabular-nums text-foreground">
                        {exibir(l.feito)}{' '}
                        <span className="text-muted-foreground">
                          de {l.alvo > 0 ? exibir(l.alvo) : <ValorIndisponivel razao="Sem meta definida" />}
                        </span>
                      </span>
                      <span className="g-corpo w-14 text-right font-semibold tabular-nums text-foreground">
                        {l.pct === null ? '—' : `${l.pct}%`}
                      </span>
                    </div>
                    <Progress
                      value={Math.min(l.pct ?? 0, 100)}
                      className="h-2"
                      aria-label={`${l.nome}: ${l.pct === null ? 'sem meta definida' : `${l.pct}% da meta`}`}
                    />
                  </div>
                );
              })}
            </div>
          </SecaoGestao>
        </>
      )}
    </div>
  );
}
