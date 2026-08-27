import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Target, Lock, Pencil, Gauge, SlidersHorizontal } from 'lucide-react';
import ParametrizacaoMetas from '@/components/metas/ParametrizacaoMetas';
import DefinirMetaDialog from '@/components/metas/DefinirMetaDialog';
import { useMembroPermissoes } from '@/hooks/useMembroPermissoes';
import { useColaboradores, useMetas } from '@/hooks/useMetasComercial';
import { nomeExibido } from '@/lib/equipe/nomeExibido';
import { formatBRL } from '@/lib/financeiro/formatters';

const NOMES_MES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/**
 * Definir Metas — a tela onde o alvo é escrito.
 *
 * Por decisão do dono do produto, definição e acompanhamento passam a ser
 * telas separadas: aqui se DEFINE, em Gestão → Metas do Comercial se
 * ACOMPANHA. Antes eram a mesma página com duas entradas de menu, e as duas
 * pareciam funções distintas — a ponto de o próprio dono descrever cada uma
 * como se fizesse coisa diferente.
 *
 * O que vive aqui:
 *   • a meta mensal de cada colaborador, nas três pontas da esteira;
 *   • a parametrização geral: valores-alvo por modalidade, limiares de
 *     alerta e motivos de perda.
 *
 * O que NÃO vive aqui: nenhum acompanhamento. Quem quer ver como a equipe vai
 * indo abre o painel — e é por isso que cada linha abaixo leva até ele.
 */
export default function DefinirMetas() {
  const navigate = useNavigate();
  const { isAdmin, loading } = useMembroPermissoes();
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [emEdicao, setEmEdicao] = useState<{ user_id: string; nome: string } | null>(null);

  const { data: colaboradores } = useColaboradores();
  const { data: metas } = useMetas({ ano, mes });

  const anos = [hoje.getFullYear() - 1, hoje.getFullYear(), hoje.getFullYear() + 1];
  const metaDe = (userId: string) => (metas ?? []).find((m) => m.user_id === userId) ?? null;

  if (loading) return <AppLayout><div /></AppLayout>;

  if (!isAdmin) {
    return (
      <AppLayout>
        <Card className="p-12 text-center">
          <Lock className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-base font-medium text-muted-foreground">Acesso restrito</p>
          <p className="text-base text-muted-foreground mt-1">
            Definir metas é atribuição do administrador. Seu acompanhamento está em
            Gestão → Metas do Comercial.
          </p>
          <Button variant="outline" size="sm" className="mt-4"
            onClick={() => navigate('/metas-comercial')}>
            Ir para o painel
          </Button>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />
            Definir Metas
          </h1>
          <p className="text-base text-muted-foreground mt-1">
            Onde o alvo é escrito. O acompanhamento fica em Gestão → Metas do Comercial.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/metas-comercial')}>
          <Gauge className="w-3.5 h-3.5 mr-1.5" />
          Ver o painel
        </Button>
      </div>

      <div className="space-y-6">
        {/* ── Meta mensal por colaborador ── */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-end gap-3 flex-wrap">
              <div className="flex-1 min-w-[8rem]">
                <Label className="text-sm text-muted-foreground mb-1 block">Mês</Label>
                <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NOMES_MES.map((n, i) => (
                      <SelectItem key={n} value={String(i + 1)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-28">
                <Label className="text-sm text-muted-foreground mb-1 block">Ano</Label>
                <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* A equipe inteira de uma vez, em vez de um seletor por pessoa:
                quem define metas define as de todos no mesmo dia, e comparar
                lado a lado é o que evita alvo desigual sem querer. */}
            <div className="rounded-lg border divide-y">
              {(colaboradores ?? []).length === 0 && (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  Nenhum colaborador comercial cadastrado. Ferramentas → Equipe.
                </p>
              )}
              {(colaboradores ?? []).map((c) => {
                const m = metaDe(c.user_id);
                const nome = nomeExibido(c as never) || c.user_id.slice(0, 8);
                return (
                  <div key={c.user_id} className="flex items-center justify-between gap-3 p-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{nome}</p>
                      {m ? (
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {m.meta_contratos ? `${m.meta_contratos} contrato(s) · ` : ''}
                          {formatBRL(Number(m.meta_faturamento) || 0)} faturado
                          {m.meta_quitacao ? ` · ${formatBRL(Number(m.meta_quitacao))} quitado` : ''}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Sem meta para {NOMES_MES[mes - 1]}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {m && <Badge variant="outline" className="text-xs">definida</Badge>}
                      <Button size="sm" variant={m ? 'outline' : 'default'}
                        onClick={() => setEmEdicao({ user_id: c.user_id, nome })}>
                        {m ? <Pencil className="w-3.5 h-3.5 mr-1.5" /> : <Target className="w-3.5 h-3.5 mr-1.5" />}
                        {m ? 'Editar' : 'Definir'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ── Parametrização geral ── */}
        <ParametrizacaoMetas />
      </div>

      {emEdicao && (
        <DefinirMetaDialog
          aberto={!!emEdicao}
          onFechar={() => setEmEdicao(null)}
          colaborador={emEdicao}
          ano={ano}
          mes={mes}
          metaAtual={metaDe(emEdicao.user_id)}
        />
      )}
    </AppLayout>
  );
}
