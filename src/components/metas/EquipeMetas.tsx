import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Users } from 'lucide-react';
import { useMetas, useRealizadoMensal, useColaboradores } from '@/hooks/useMetasComercial';
import { filtrarColaboradoresDoPainel } from '@/lib/metas/colaboradores';
import { nomeExibido } from '@/lib/equipe/nomeExibido';

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

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** Faixa de atingimento — mesma leitura que a Fase 5 usará no multiplicador. */
const faixaDe = (pct: number | null) => {
  if (pct === null) return { rotulo: 'sem meta', cls: 'bg-muted text-muted-foreground border-border' };
  if (pct >= 100) return { rotulo: 'meta batida', cls: 'bg-success/10 text-success border-success/30' };
  if (pct >= 80) return { rotulo: 'na faixa', cls: 'bg-warning/10 text-warning border-warning/30' };
  return { rotulo: 'abaixo', cls: 'bg-destructive/10 text-destructive border-destructive/30' };
};

export default function EquipeMetas() {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [base, setBase] = useState<'faturamento' | 'contratos'>('faturamento');

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

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Users className="w-4 h-4 text-accent" />
          <span className="font-semibold text-sm">Cumprimento por colaborador</span>

          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <Select value={base} onValueChange={(v) => setBase(v as typeof base)}>
              <SelectTrigger className="h-8 w-[190px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="faturamento">Meta de faturamento</SelectItem>
                <SelectItem value="contratos">Meta de contratos ganhos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
              <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MESES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
              <SelectTrigger className="h-8 w-[90px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[hoje.getFullYear() - 1, hoje.getFullYear()].map((a) => (
                  <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {pctEquipe !== null && (
          <p className="text-xs text-muted-foreground mt-3">
            Equipe: <span className="font-semibold text-foreground tabular-nums">{pctEquipe}%</span> da meta
            {base === 'faturamento' ? ` · ${brl(totalFeito)} de ${brl(totalAlvo)}` : ` · ${totalFeito} de ${totalAlvo}`}
          </p>
        )}
      </Card>

      {linhas.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Nenhum colaborador do comercial com meta ou movimento neste período.
        </Card>
      ) : (
        <Card className="divide-y divide-border">
          {linhas.map((l) => {
            const faixa = faixaDe(l.pct);
            return (
              <div key={l.user_id} className="p-4 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{l.nome}</span>
                  <Badge variant="outline" className={`text-xs ${faixa.cls}`}>{faixa.rotulo}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {l.participados} participação(ões) no mês
                  </span>
                  <span className="ml-auto text-sm tabular-nums whitespace-nowrap">
                    {base === 'faturamento'
                      ? <>{brl(l.feito)} <span className="text-muted-foreground">de {l.alvo > 0 ? brl(l.alvo) : '—'}</span></>
                      : <>{l.feito} <span className="text-muted-foreground">de {l.alvo > 0 ? l.alvo : '—'}</span></>}
                  </span>
                  <span className="text-sm font-semibold tabular-nums w-14 text-right">
                    {l.pct === null ? '—' : `${l.pct}%`}
                  </span>
                </div>
                <Progress value={Math.min(l.pct ?? 0, 100)} className="h-1.5" />
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
