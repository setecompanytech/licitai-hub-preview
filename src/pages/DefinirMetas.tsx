import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import EstadoVazio from '@/components/shared/EstadoVazio';
import BarraFiltros from '@/components/gestao/BarraFiltros';
import { SecaoGestao } from '@/components/gestao/TelaGestao';
import { ValorIndisponivel } from '@/components/gestao/SeloSituacao';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Target, Lock, Pencil, Gauge, Users } from 'lucide-react';
import ParametrizacaoMetas from '@/components/metas/ParametrizacaoMetas';
import DefinirMetaDialog from '@/components/metas/DefinirMetaDialog';
import { CampoFiltro } from '@/components/metas/comuns';
import { MESES } from '@/components/metas/meses';
import { useAuthorization } from '@/hooks/useAuthorization';
import { useColaboradores, useMetas } from '@/hooks/useMetasComercial';
import { nomeExibido } from '@/lib/equipe/nomeExibido';
import { formatBRL } from '@/lib/financeiro/formatters';
import { BASES_META } from '@/lib/metas/painel';

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
 *
 * A autoridade de papel é `useAuthorization`, a mesma das três abas de Metas
 * do Comercial — ver a nota em `pages/MetasComercial.tsx`. Ela confina o admin
 * de empresa à empresa ATIVA, o que importa dobrado numa tela de ESCRITA: a
 * anterior abria o formulário para quem administra OUTRA empresa, e o banco é
 * que recusava depois, em forma de erro.
 */
export default function DefinirMetas() {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAuthorization();
  const hoje = new Date();
  const anoRef = hoje.getFullYear();
  const mesRef = hoje.getMonth() + 1;
  const [ano, setAno] = useState(anoRef);
  const [mes, setMes] = useState(mesRef);
  const [emEdicao, setEmEdicao] = useState<{ user_id: string; nome: string } | null>(null);

  const { data: colaboradores } = useColaboradores();
  const { data: metas } = useMetas({ ano, mes });

  const anos = [anoRef - 1, anoRef, anoRef + 1];
  const metaDe = (userId: string) => (metas ?? []).find((m) => m.user_id === userId) ?? null;

  if (loading) {
    return (
      <AppLayout>
        <div role="status" aria-label="Carregando" className="flex flex-col gap-4">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-5 w-96 max-w-full" />
          <Skeleton className="h-64 w-full rounded-[var(--g-raio)]" />
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AppLayout>
        {/* Título, descrição, ícone e trilha vêm do registro de páginas. */}
        <CabecalhoPagina denso />
        <div className="g-cartao">
          <EstadoVazio
            icone={<Lock />}
            titulo="Acesso restrito"
            descricao="Definir metas é atribuição do administrador desta empresa. Seu acompanhamento está em Gestão → Metas do Comercial."
            acao={
              <Button variant="outline" onClick={() => navigate('/metas-comercial')}>
                Ir para o painel
              </Button>
            }
          />
        </div>
      </AppLayout>
    );
  }

  const comMeta = (colaboradores ?? []).filter((c) => metaDe(c.user_id)).length;
  const filtrosAplicados = (mes !== mesRef ? 1 : 0) + (ano !== anoRef ? 1 : 0);

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
          denso
        acoes={
          <Button variant="outline" onClick={() => navigate('/metas-comercial')}>
            <Gauge aria-hidden="true" />
            Ver o painel
          </Button>
        }
      />

      <div className="flex min-w-0 flex-col gap-6">
        {/* ── Meta mensal por colaborador ── */}
        <SecaoGestao
          titulo="Meta mensal por colaborador"
          contagem={colaboradores?.length ?? 0}
          acoes={
            <span className="g-meta text-muted-foreground">
              {comMeta} com meta em {MESES[mes - 1].toLowerCase()}
            </span>
          }
        >
          {/* O período fica ACIMA da lista que ele filtra — mudar o mês muda
              todas as linhas abaixo, e não dá para descobrir isso depois. */}
          <BarraFiltros
            filtrosAplicados={filtrosAplicados}
            aoLimpar={() => { setMes(mesRef); setAno(anoRef); }}
          >
            <CampoFiltro rotulo="Mês" className="w-full sm:w-40">
              <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
                <SelectTrigger aria-label="Mês" className="g-controle"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES.map((n, i) => (
                    <SelectItem key={n} value={String(i + 1)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CampoFiltro>
            <CampoFiltro rotulo="Ano" className="w-full sm:w-28">
              <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
                <SelectTrigger aria-label="Ano" className="g-controle"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </CampoFiltro>
          </BarraFiltros>

          {/* A equipe inteira de uma vez, em vez de um seletor por pessoa:
              quem define metas define as de todos no mesmo dia, e comparar
              lado a lado é o que evita alvo desigual sem querer. */}
          <div className="g-cartao divide-y divide-border">
            {(colaboradores ?? []).length === 0 ? (
              <EstadoVazio
                icone={<Users />}
                titulo="Nenhum colaborador comercial cadastrado"
                descricao="A meta pertence a uma pessoa e a um mês — sem equipe cadastrada não há a quem atribuí-la."
                /* Vazio com a ação que realmente resolve, e não só o caminho
                   escrito: quem chega aqui precisa ir para Equipe. */
                acao={
                  <Button onClick={() => navigate('/equipe')}>
                    <Users aria-hidden="true" />
                    Cadastrar a equipe
                  </Button>
                }
              />
            ) : (
              (colaboradores ?? []).map((c) => {
                const m = metaDe(c.user_id);
                const nome = nomeExibido(c as never) || c.user_id.slice(0, 8);
                return (
                  <div key={c.user_id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="g-corpo truncate font-medium text-foreground">{nome}</p>
                      {m ? (
                        <p className="g-meta text-muted-foreground tabular-nums">
                          {m.meta_contratos ? `${m.meta_contratos} contrato(s) · ` : ''}
                          {formatBRL(Number(m.meta_faturamento) || 0)} faturado
                          {/* A ponta 3 só aparece quando tem valor. Ela sumia
                              mesmo preenchida: o `meta_quitacao` ficava fora do
                              payload do upsert (corrigido em useSalvarMeta). */}
                          {m.meta_quitacao ? ` · ${formatBRL(Number(m.meta_quitacao))} quitado` : ''}
                          {' · principal: '}{BASES_META[m.base_meta]?.label.toLowerCase() ?? 'faturamento'}
                        </p>
                      ) : (
                        <p className="g-meta text-muted-foreground">
                          <ValorIndisponivel razao={`Sem meta para ${MESES[mes - 1].toLowerCase()}`} />
                        </p>
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
              })
            )}
          </div>
        </SecaoGestao>

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
