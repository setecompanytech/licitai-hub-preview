import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Target, Lock, Pencil, Gauge, Users } from 'lucide-react';
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

  if (loading) {
    return (
      <AppLayout>
        <div role="status" aria-label="Carregando" className="space-y-4">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-5 w-96 max-w-full" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AppLayout>
        {/* Título, descrição, ícone e trilha vêm do registro de páginas. */}
        <CabecalhoPagina />
        <Card>
          <EstadoVazio
            icone={<Lock />}
            titulo="Acesso restrito"
            descricao="Definir metas é atribuição do administrador. Seu acompanhamento está em Gestão → Metas do Comercial."
            acao={
              <Button variant="outline" onClick={() => navigate('/metas-comercial')}>
                Ir para o painel
              </Button>
            }
          />
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* A meta nasce por colaborador (botão Definir/Editar em cada linha), então
          a ação do topo é a travessia para o acompanhamento.

          DIVERGÊNCIA REGISTRADA: o registro de páginas declara `acao: 'Nova
          meta'` para /definir-metas (src/lib/navegacao/paginas.ts), ação que
          esta tela nunca teve — não há "nova meta" solta: toda meta pertence a
          um colaborador e a um mês. Ou o registro perde a ação, ou o diálogo
          ganha um seletor de colaborador; a decisão é de quem mantém o
          registro, que fica fora deste lote. */}
      <CabecalhoPagina
        acoes={
          <Button variant="outline" onClick={() => navigate('/metas-comercial')}>
            <Gauge aria-hidden="true" />
            Ver o painel
          </Button>
        }
      />

      <div className="space-y-6">
        {/* ── Meta mensal por colaborador ── */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[12rem] flex-1">
                <Label htmlFor="definir-metas-mes" className="mb-1 block text-sm text-muted-foreground">Mês</Label>
                <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
                  <SelectTrigger id="definir-metas-mes"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NOMES_MES.map((n, i) => (
                      <SelectItem key={n} value={String(i + 1)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-32">
                <Label htmlFor="definir-metas-ano" className="mb-1 block text-sm text-muted-foreground">Ano</Label>
                <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
                  <SelectTrigger id="definir-metas-ano"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* A equipe inteira de uma vez, em vez de um seletor por pessoa:
                quem define metas define as de todos no mesmo dia, e comparar
                lado a lado é o que evita alvo desigual sem querer. */}
            <div className="divide-y divide-border rounded-lg border border-border">
              {(colaboradores ?? []).length === 0 && (
                <EstadoVazio
                  tamanho="compacto"
                  icone={<Users />}
                  titulo="Nenhum colaborador comercial cadastrado"
                  descricao="Cadastre a equipe em Ferramentas → Equipe."
                />
              )}
              {(colaboradores ?? []).map((c) => {
                const m = metaDe(c.user_id);
                const nome = nomeExibido(c as never) || c.user_id.slice(0, 8);
                return (
                  <div key={c.user_id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-base font-medium text-foreground">{nome}</p>
                      {m ? (
                        <p className="text-sm text-muted-foreground tabular-nums">
                          {m.meta_contratos ? `${m.meta_contratos} contrato(s) · ` : ''}
                          {formatBRL(Number(m.meta_faturamento) || 0)} faturado
                          {m.meta_quitacao ? ` · ${formatBRL(Number(m.meta_quitacao))} quitado` : ''}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">Sem meta para {NOMES_MES[mes - 1]}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {m && <Badge variant="success">Meta definida</Badge>}
                      <Button size="sm" variant={m ? 'outline' : 'default'}
                        onClick={() => setEmEdicao({ user_id: c.user_id, nome })}>
                        {m ? <Pencil aria-hidden="true" /> : <Target aria-hidden="true" />}
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
