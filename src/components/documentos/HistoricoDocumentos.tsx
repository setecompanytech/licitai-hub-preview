import { useCallback, useEffect, useMemo, useState } from 'react';
import { History, Lock, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import EstadoVazio from '@/components/shared/EstadoVazio';
import BarraFiltros from '@/components/gestao/BarraFiltros';
import TabelaGestao, { type ColunaGestao } from '@/components/gestao/TabelaGestao';
import SeloSituacao, { AvisoDeFalha } from '@/components/gestao/SeloSituacao';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useAuthorization } from '@/hooks/useAuthorization';
import { useColaboradores } from '@/hooks/useMetasComercial';
import {
  ACOES_DO_HISTORICO, TAMANHO_DA_PAGINA, TOM_DA_ACAO,
  type LinhaDoHistorico, detalhesDaLinha, limitesDoDia,
} from '@/lib/documentos/historico';

/* ═══════════════════════════════════════════════════════════════════════════
   Histórico de alterações do Controle de Documentos.

   O registro NASCE NO BANCO, em gatilho (`registrar_alteracao_documento`,
   migration 20260903000006): envio, compartilhamento, substituição, mudança
   de validade, edição e remoção deixam rastro por QUALQUER caminho — não só
   por esta tela. Por isso nada aqui escreve: a tela só lê.

   Três defeitos do bloco inline que este componente substitui:

   1. NÃO RECARREGAVA. O `abrirHistorico` do `Documentos.tsx` tinha
      `if (historicoAberto || historico.length > 0 || ...) return`, então
      depois da primeira abertura a lista congelava: quem enviava um documento
      e voltava ao histórico na mesma sessão não via o próprio envio e
      concluía que o rastro não estava funcionando. Aqui a carga acontece na
      montagem, a cada mudança de filtro, e há um botão de atualizar.

   2. `.limit(100)` sem paginação. A centésima-primeira linha simplesmente não
      existia, sem nada na tela dizendo que havia mais. Agora a carga é
      incremental e o rodapé conta o que já veio.

   3. Sem filtros. Procurar "quem mexeu na CND federal em agosto" era rolar
      cem linhas com o olho.

   ⚠️ RESTRIÇÃO ADMINISTRATIVA. O RLS já limita a leitura ao admin da empresa
   (`documentos_historico_select_admin`, com `empresa_id IS NOT NULL AND
   is_empresa_admin(...)`). A checagem de `isCompanyAdmin` aqui é CONVENIÊNCIA
   — ela explica a recusa em vez de mostrar uma tabela vazia —, e NÃO é a
   autorização: esconder a aba nunca autorizou nada, quem manda é o banco.

   ⚠️ Linha com `empresa_id NULL` (documento legado privado, nunca
   compartilhado) é invisível para TODOS por causa do mesmo RLS. Se a contagem
   parecer baixa, é isto — e está dito no rodapé, porque número que some sem
   explicação vira desconfiança do sistema inteiro.
   ═══════════════════════════════════════════════════════════════════════════ */

type Filtros = { busca: string; acao: string; de: string; ate: string };

const FILTROS_VAZIOS: Filtros = { busca: '', acao: 'todas', de: '', ate: '' };

export default function HistoricoDocumentos() {
  const { empresaAtiva } = useEmpresa();
  const { isCompanyAdmin, loading: autorizacaoCarregando } = useAuthorization();
  const { data: colaboradores = [] } = useColaboradores();

  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS);
  // A busca por texto vai ao banco; sem atraso, cada tecla seria uma consulta.
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [linhas, setLinhas] = useState<LinhaDoHistorico[]>([]);
  const [pagina, setPagina] = useState(0);
  const [temMais, setTemMais] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setBuscaAplicada(filtros.busca.trim()), 300);
    return () => clearTimeout(t);
  }, [filtros.busca]);

  const empresaId = empresaAtiva?.id;

  /**
   * Uma página do histórico. Os filtros vão ao BANCO, não ao array já
   * carregado: filtrar no cliente sobre 25 linhas esconderia o que está na
   * página seguinte e daria a impressão de que o registro não existe.
   */
  const buscarPagina = useCallback(
    async (numero: number) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- `documentos_historico` ainda fora do types.ts gerado
      let q = (supabase.from as any)('documentos_historico')
        .select(
          'id, documento_nome, acao, autor, validade_anterior, validade_nova, arquivo_anterior, arquivo_novo, criado_em',
        )
        .eq('empresa_id', empresaId)
        .order('criado_em', { ascending: false })
        // `range` é inclusivo nos dois extremos: pede-se um a mais do que cabe
        // na página para saber se existe próxima sem um COUNT separado.
        .range(numero * TAMANHO_DA_PAGINA, numero * TAMANHO_DA_PAGINA + TAMANHO_DA_PAGINA);

      if (buscaAplicada) q = q.ilike('documento_nome', `%${buscaAplicada}%`);
      if (filtros.acao !== 'todas') q = q.eq('acao', filtros.acao);
      // O campo `date` do filtro é dia LOCAL; o `criado_em` é timestamptz.
      // Converter pelos componentes locais evita perder (ou ganhar) o dia da
      // borda para quem não está em UTC.
      const inicio = filtros.de ? limitesDoDia(filtros.de) : null;
      if (inicio) q = q.gte('criado_em', inicio);
      const fim = filtros.ate ? limitesDoDia(filtros.ate, true) : null;
      if (fim) q = q.lte('criado_em', fim);

      const { data, error } = await q;
      if (error) throw error;
      const recebidas = (data ?? []) as LinhaDoHistorico[];
      return {
        linhas: recebidas.slice(0, TAMANHO_DA_PAGINA),
        temMais: recebidas.length > TAMANHO_DA_PAGINA,
      };
    },
    [empresaId, buscaAplicada, filtros.acao, filtros.de, filtros.ate],
  );

  const recarregar = useCallback(async () => {
    if (!empresaId || !isCompanyAdmin) {
      setCarregando(false);
      return;
    }
    setCarregando(true);
    setErro(null);
    try {
      const r = await buscarPagina(0);
      setLinhas(r.linhas);
      setTemMais(r.temMais);
      setPagina(0);
    } catch (e) {
      // Princípio 3: mensagem real do banco, com retry ao lado.
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setCarregando(false);
    }
  }, [empresaId, isCompanyAdmin, buscarPagina]);

  // A carga acontece na MONTAGEM e a cada mudança de filtro — era exatamente
  // isto que faltava no bloco inline, que carregava uma vez e nunca mais.
  useEffect(() => {
    recarregar();
  }, [recarregar]);

  const carregarMais = async () => {
    setCarregandoMais(true);
    try {
      const r = await buscarPagina(pagina + 1);
      setLinhas((prev) => [...prev, ...r.linhas]);
      setTemMais(r.temMais);
      setPagina((p) => p + 1);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setCarregandoMais(false);
    }
  };

  /** `autor` é o `auth.uid()` do gatilho; NULL = escrita sem sessão = sistema. */
  const nomeDoAutor = useCallback(
    (uid: string | null) => {
      if (!uid) return 'sistema';
      const c = (colaboradores as Array<{ user_id: string; nome?: string | null; email?: string | null }>)
        .find((x) => x.user_id === uid);
      return c?.nome || c?.email || 'membro da equipe';
    },
    [colaboradores],
  );

  const colunas = useMemo<ColunaGestao<LinhaDoHistorico>[]>(
    () => [
      {
        chave: 'criado_em',
        titulo: 'Data e hora',
        tituloCurto: 'Quando',
        largura: '170px',
        render: (l) => (
          <span className="tabular-nums whitespace-nowrap">
            {new Date(l.criado_em).toLocaleString('pt-BR', {
              dateStyle: 'short',
              timeStyle: 'short',
            })}
          </span>
        ),
      },
      {
        chave: 'acao',
        titulo: 'Ação',
        largura: '180px',
        render: (l) => (
          <SeloSituacao tom={TOM_DA_ACAO[l.acao] ?? 'neutro'}>{l.acao}</SeloSituacao>
        ),
      },
      {
        chave: 'documento_nome',
        titulo: 'Documento ou atestado',
        tituloCurto: 'Documento',
        render: (l) => <span className="font-medium">{l.documento_nome}</span>,
      },
      {
        chave: 'autor',
        titulo: 'Responsável',
        largura: '200px',
        render: (l) => <span className="truncate">{nomeDoAutor(l.autor)}</span>,
      },
      {
        chave: 'detalhes',
        titulo: 'Detalhes disponíveis',
        tituloCurto: 'Detalhes',
        prioridade: 'desktop',
        render: (l) => {
          const partes = detalhesDaLinha(l);
          if (partes.length === 0) return <span className="text-muted-foreground">—</span>;
          return <span className="text-muted-foreground">{partes.join(' · ')}</span>;
        },
      },
    ],
    [nomeDoAutor],
  );

  const filtrosAplicados =
    (buscaAplicada ? 1 : 0) +
    (filtros.acao !== 'todas' ? 1 : 0) +
    (filtros.de ? 1 : 0) +
    (filtros.ate ? 1 : 0);

  /* ── Autorização ────────────────────────────────────────────────────── */
  if (autorizacaoCarregando) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  if (!isCompanyAdmin) {
    // Tabela vazia diria "não aconteceu nada"; a recusa tem que dizer o que é.
    return (
      <div className="rounded-xl border border-border bg-card">
        <EstadoVazio
          icone={<Lock />}
          titulo="Acesso não autorizado"
          descricao="O histórico de alterações é restrito aos administradores da empresa. A restrição está no banco (RLS), não apenas nesta tela — peça a um administrador se precisar consultar a trilha."
        />
      </div>
    );
  }

  if (!empresaId) {
    return (
      <div className="rounded-xl border border-border bg-card">
        <EstadoVazio
          icone={<History />}
          titulo="Escolha uma empresa"
          descricao="A trilha de alterações é registrada por empresa. Selecione a empresa ativa para consultá-la."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="g-titulo-secao text-foreground">Histórico de alterações</h3>
          <p className="g-corpo mt-1 text-muted-foreground">
            Quem alterou o quê no cofre de documentos e nos atestados. O registro nasce de gatilho
            no banco: todo caminho que toca um documento deixa rastro, não só esta tela.
          </p>
        </div>
      </div>

      <BarraFiltros
        busca={filtros.busca}
        aoBuscar={(v) => setFiltros((f) => ({ ...f, busca: v }))}
        placeholderBusca="Buscar por documento ou atestado…"
        filtrosAplicados={filtrosAplicados}
        aoLimpar={() => setFiltros(FILTROS_VAZIOS)}
        acao={
          <Button
            type="button"
            variant="outline"
            onClick={recarregar}
            disabled={carregando}
            className="g-controle rounded-[var(--g-raio)]"
          >
            <RotateCw aria-hidden="true" className="mr-1.5 h-4 w-4" />
            Atualizar
          </Button>
        }
      >
        <div className="flex min-w-0 flex-col gap-1">
          <Label htmlFor="hist-docs-acao" className="g-meta text-muted-foreground">
            Ação
          </Label>
          <Select
            value={filtros.acao}
            onValueChange={(v) => setFiltros((f) => ({ ...f, acao: v }))}
          >
            <SelectTrigger
              id="hist-docs-acao"
              className="g-controle w-full rounded-[var(--g-raio)] md:w-48"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as ações</SelectItem>
              {ACOES_DO_HISTORICO.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex min-w-0 flex-col gap-1">
          <Label htmlFor="hist-docs-de" className="g-meta text-muted-foreground">
            De
          </Label>
          <Input
            id="hist-docs-de"
            type="date"
            value={filtros.de}
            max={filtros.ate || undefined}
            onChange={(e) => setFiltros((f) => ({ ...f, de: e.target.value }))}
            className="g-controle w-full rounded-[var(--g-raio)] md:w-40"
          />
        </div>

        <div className="flex min-w-0 flex-col gap-1">
          <Label htmlFor="hist-docs-ate" className="g-meta text-muted-foreground">
            Até
          </Label>
          <Input
            id="hist-docs-ate"
            type="date"
            value={filtros.ate}
            min={filtros.de || undefined}
            onChange={(e) => setFiltros((f) => ({ ...f, ate: e.target.value }))}
            className="g-controle w-full rounded-[var(--g-raio)] md:w-40"
          />
        </div>
      </BarraFiltros>

      {erro && <AvisoDeFalha aoTentarNovamente={recarregar}>Não foi possível carregar o histórico: {erro}</AvisoDeFalha>}

      {!erro && (
        <TabelaGestao
          descricao="Histórico de alterações de documentos"
          colunas={colunas}
          itens={linhas}
          chaveDoItem={(l) => l.id}
          carregando={carregando}
          vazio={
            // "Vazio" e "nada encontrado" são coisas diferentes: uma é a trilha
            // não ter nascido, a outra é o filtro estar apertado demais.
            filtrosAplicados > 0 ? (
              <EstadoVazio
                tamanho="compacto"
                icone={<History />}
                titulo="Nenhum registro com esses filtros"
                descricao="Ajuste o período, a ação ou o texto da busca."
                acao={
                  <Button variant="outline" onClick={() => setFiltros(FILTROS_VAZIOS)}>
                    Limpar filtros
                  </Button>
                }
              />
            ) : (
              <EstadoVazio
                tamanho="compacto"
                icone={<History />}
                titulo="Nenhum registro ainda"
                descricao="A trilha grava a partir da migration 20260903000006 — alterações anteriores a ela não foram registradas e não são reconstruídas."
              />
            )
          }
          rodape={
            <>
              <span className="tabular-nums">
                {linhas.length} registro{linhas.length === 1 ? '' : 's'} carregado
                {linhas.length === 1 ? '' : 's'}
                {temMais ? ' — há mais' : ''}
              </span>
              {temMais && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={carregarMais}
                  disabled={carregandoMais}
                  className="g-controle rounded-[var(--g-raio)]"
                >
                  {carregandoMais ? 'Carregando…' : 'Carregar mais'}
                </Button>
              )}
            </>
          }
        />
      )}

      <p className="g-meta text-muted-foreground">
        Registro de documento que ainda é privado (sem empresa) não aparece para ninguém: o RLS
        exige `empresa_id`. Se a contagem parecer baixa, é por isso — e não porque a alteração
        deixou de ser gravada.
      </p>
    </div>
  );
}
