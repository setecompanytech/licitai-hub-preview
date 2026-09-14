import { useState, useEffect, useMemo } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import AreaComPainel from '@/components/gestao/AreaComPainel';
import BarraFiltros from '@/components/gestao/BarraFiltros';
import FaixaIndicadores, { type Indicador } from '@/components/gestao/FaixaIndicadores';
import ListaDeCampos, { BlocoDoPainel, type Campo } from '@/components/gestao/ListaDeCampos';
import SeloSituacao, {
  AvisoDeContexto, AvisoDeFalha, ValorIndisponivel, type TomSituacao,
} from '@/components/gestao/SeloSituacao';
import TabelaGestao, { type ColunaGestao, type OrdenacaoTabela } from '@/components/gestao/TabelaGestao';
import TextoExpansivel from '@/components/gestao/TextoExpansivel';
import {
  DIAS_CARENCIA_ARQUIVAMENTO, DIAS_RETENCAO_ARQUIVO, RESULTADOS_ENCERRADORES,
  ehDecidido, STATUS_PROCESSO, normalizarStatus, rotuloStatus, type StatusProcesso,
} from '@/lib/licitacao/status';
import {
  Archive, Trophy, XCircle, Download, TrendingUp, CheckCircle, AlertTriangle,
  BarChart3, Clock, RotateCw,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import { downloadCSV, downloadPDF, downloadJSON } from '@/lib/download-utils';
import { identidadeDoEdital } from '@/lib/licitacao/identidade-edital';

// A quarta lista de status que existia aqui ('Publicado', 'Homologado' no
// masculino, 'Contrato Assinado'…) era a origem dos valores que nenhuma outra
// tela reconhecia — e do arquivamento automático que nunca disparava (D1).
// Status agora é o vocabulário canônico; Deserto/Fracassado/Revogado/Anulado
// e Contrato Assinado são DESFECHOS e vivem no campo Resultado.
const STATUS_FLOW = STATUS_PROCESSO;

/**
 * UNIFICAÇÃO DAS DUAS TABELAS DE APARÊNCIA (achado 6).
 *
 * Conviviam aqui `statusConfig` — vocabulário legado masculino, com
 * precedência sobre tudo — e `VARIANTE_STATUS`, canônico. A autoridade correta
 * é `@/lib/licitacao/status` (princípio 1 do CLAUDE.md): ele é quem o banco, o
 * Kanban e as edge functions seguem. `statusConfig` foi removido; o RÓTULO
 * passa a vir sempre de `rotuloStatus`.
 *
 * O que NÃO se importou da lib foi `aparenciaStatus().className`: ela devolve
 * alfa composto à mão (`bg-warning/10 text-warning`), que a régua de 13/09
 * aposentou em favor da tripla tint/ink/line de `SeloSituacao`. Então o que
 * sobra local é só o TOM — a família semântica —, com o tipo garantindo
 * cobertura completa do vocabulário. Vocabulário na lib, tinta no módulo.
 */
const TOM_STATUS: Record<StatusProcesso, TomSituacao> = {
  Monitorando: 'neutro',
  'Em Análise': 'atencao',
  'Proposta Enviada': 'ativo',
  'Em Disputa': 'ativo',
  Vencida: 'sucesso',
  Homologada: 'sucesso',
  Perdida: 'critico',
  Arquivada: 'neutro',
};

/**
 * Desfechos que o vocabulário legado escrevia na coluna `status`. Precisam ser
 * reconhecidos para NÃO caírem em `normalizarStatus`: 'Deserto' e 'Fracassado'
 * não casam com nenhuma regra de lá e voltariam como "Monitorando" — a tela
 * afirmaria que um processo deserto está no topo do funil. Aqui eles aparecem
 * como o banco gravou, com a explicação de que estão no eixo errado.
 */
const DESFECHOS_NO_EIXO_ERRADO = new Set<string>([
  ...RESULTADOS_ENCERRADORES.map((r) => r.toLowerCase()),
  'contrato assinado',
]);

/** Tom de cada desfecho. Chave em minúscula: o banco tem grafias concorrentes. */
const TOM_RESULTADO: Record<string, TomSituacao> = {
  vencida: 'sucesso',
  vencedor: 'sucesso',
  'contrato assinado': 'sucesso',
  homologada: 'sucesso',
  perdida: 'critico',
  perdedor: 'critico',
  desclassificada: 'critico',
  deserto: 'neutro',
  fracassado: 'atencao',
  revogado: 'atencao',
  anulado: 'atencao',
};

const resultadoOptions = ['Vencida', 'Perdida', 'Desclassificada', 'Deserto', 'Fracassado', 'Revogado', 'Anulado', 'Contrato Assinado'];

/** Grafia que o fluxo oficial de perda grava (`useLicitacaoIntegration.registrarPerda`). */
const RESULTADO_PERDA_DO_COMERCIAL = 'Perdedor';
/** Grafia que o indicador "Perdidas" conta — e que o select de Resultado oferece. */
const RESULTADO_PERDA_DO_HISTORICO = 'Perdida';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const formatData = (v: string | null) => (v ? new Date(v).toLocaleDateString('pt-BR') : null);

/** Ausência de dado — nunca zero, nunca vazio silencioso. */
const TRACO = <span className="text-muted-foreground">—</span>;

type Licitacao = {
  id: string;
  numero: string;
  orgao: string;
  objeto: string;
  modalidade: string;
  status: string;
  valor_estimado: number | null;
  valor_adjudicado: number | null;
  resultado: string | null;
  vencedor: boolean | null;
  data_homologacao: string | null;
  data_encerramento: string | null;
  arquivado_em: string | null;
  uf: string | null;
  municipio: string | null;
  created_at: string;
};

/**
 * Dias que faltam para o expurgo do arquivo.
 *
 * O prazo vem de `DIAS_RETENCAO_ARQUIVO`, não do "120" que estava escrito à
 * mão aqui e repetido no texto do aviso: a política mora em
 * `lib/licitacao/status.ts` (espelhada no Deno de `_shared/licitacao-status.ts`)
 * e, se mudar lá, esta tela tem que mudar junto sem ninguém lembrar dela.
 */
const diasRestantes = (arquivadoEm: string | null) => {
  if (!arquivadoEm) return null;
  const dias = DIAS_RETENCAO_ARQUIVO
    - Math.floor((Date.now() - new Date(arquivadoEm).getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, dias);
};

/** ETAPA — onde o processo parou. Primeiro dos três eixos. */
function etapaVisivel(status: string): { rotulo: string; tom: TomSituacao; explicacao?: string } {
  const bruto = (status || '').trim();
  if (DESFECHOS_NO_EIXO_ERRADO.has(bruto.toLowerCase())) {
    return {
      rotulo: bruto,
      tom: TOM_RESULTADO[bruto.toLowerCase()] ?? 'neutro',
      explicacao: 'Desfecho gravado no campo de etapa (vocabulário legado). O eixo próprio é Resultado.',
    };
  }
  const rotulo = rotuloStatus(bruto);
  return {
    rotulo,
    tom: TOM_STATUS[normalizarStatus(bruto)],
    // Verificável: quem vê "Monitorando" numa linha gravada como "Publicado"
    // consegue descobrir de onde veio sem abrir o banco.
    explicacao: bruto && bruto !== rotulo ? `Gravado como "${bruto}"` : undefined,
  };
}

/** RESULTADO — como o processo terminou. Segundo eixo, independente da etapa. */
function desfechoVisivel(lic: Licitacao): { rotulo: string; tom: TomSituacao; vencedora: boolean } | null {
  const bruto = (lic.resultado || '').trim();
  if (!bruto) {
    // `vencedor` é coluna própria: há processo ganho sem resultado preenchido.
    return lic.vencedor === true ? { rotulo: 'Vencedora', tom: 'sucesso', vencedora: true } : null;
  }
  return {
    rotulo: bruto,
    tom: TOM_RESULTADO[bruto.toLowerCase()] ?? 'neutro',
    vencedora: lic.vencedor === true,
  };
}

/** ARQUIVAMENTO — saiu de circulação? Terceiro eixo, decidido por `arquivado_em`. */
function arquivamentoVisivel(lic: Licitacao): { rotulo: string; tom: TomSituacao; explicacao?: string } {
  const dias = diasRestantes(lic.arquivado_em);
  if (dias === null) return { rotulo: 'Em circulação', tom: 'neutro' };
  return {
    rotulo: `${dias}d restantes`,
    // Mesma régua de antes: vermelho até 30 dias, âmbar até 60.
    tom: dias <= 30 ? 'critico' : dias <= 60 ? 'atencao' : 'neutro',
    explicacao: `Arquivado em ${formatData(lic.arquivado_em)}. Retenção de ${DIAS_RETENCAO_ARQUIVO} dias.`,
  };
}

/** Extratores de ordenação. Ausência devolve `null` e vai para o fim da lista. */
const VALOR_ORDENACAO: Record<string, (l: Licitacao) => string | number | null> = {
  identidade: (l) => l.objeto.toLocaleLowerCase('pt-BR'),
  orgao: (l) => l.orgao.toLocaleLowerCase('pt-BR'),
  arquivamento: (l) => (l.arquivado_em ? new Date(l.arquivado_em).getTime() : null),
  valor: (l) => l.valor_adjudicado,
};

/**
 * Painel contextual do processo selecionado — o detalhe que saiu da tabela.
 *
 * A densidade nova só existe porque o painel absorve o que a linha não precisa
 * carregar: objeto inteiro, local, modalidade, valores dos dois lados e as
 * três datas. A tabela fica com os eixos; aqui fica a auditoria da linha.
 */
function PainelDoProcesso({ lic, aoEditar }: { lic: Licitacao; aoEditar: () => void }) {
  const identidade = identidadeDoEdital({ numeroCompra: lic.numero, modalidade: lic.modalidade });
  const etapa = etapaVisivel(lic.status);
  const desfecho = desfechoVisivel(lic);
  const arquivamento = arquivamentoVisivel(lic);
  const decidido = ehDecidido(lic.status, lic.resultado);

  const identificacao: Campo[] = [
    { rotulo: 'Órgão', valor: lic.orgao },
    { rotulo: 'Local', valor: lic.municipio && lic.uf ? `${lic.municipio}/${lic.uf}` : lic.uf || TRACO },
    { rotulo: 'Modalidade', valor: lic.modalidade || TRACO },
    { rotulo: 'Objeto', largo: true, valor: <TextoExpansivel texto={lic.objeto} linhas={3} /> },
  ];

  const valores: Campo[] = [
    {
      rotulo: 'Valor estimado',
      numerico: true,
      valor: lic.valor_estimado != null ? formatCurrency(lic.valor_estimado) : TRACO,
    },
    {
      rotulo: 'Valor adjudicado',
      numerico: true,
      valor: lic.valor_adjudicado != null
        ? formatCurrency(lic.valor_adjudicado)
        // Decidido e sem adjudicação lançada não é R$ 0,00: é apuração que
        // falta. A distinção é regra do padrão, não preferência visual.
        : decidido
          ? <ValorIndisponivel razao="Adjudicação não lançada" />
          : TRACO,
    },
    {
      rotulo: 'Empresa vencedora',
      valor: lic.vencedor === true ? 'Sim' : lic.vencedor === false ? 'Não' : TRACO,
    },
  ];

  const datas: Campo[] = [
    { rotulo: 'Encerramento', valor: formatData(lic.data_encerramento) ?? TRACO },
    { rotulo: 'Homologação', valor: formatData(lic.data_homologacao) ?? TRACO },
    { rotulo: 'Cadastrado em', valor: formatData(lic.created_at) ?? TRACO },
  ];

  const retencao: Campo[] = [
    {
      rotulo: 'Situação',
      valor: lic.arquivado_em ? `Arquivado em ${formatData(lic.arquivado_em)}` : 'Em circulação',
    },
    {
      rotulo: 'Prazo restante',
      numerico: true,
      valor: lic.arquivado_em
        ? `${diasRestantes(lic.arquivado_em)} de ${DIAS_RETENCAO_ARQUIVO} dias`
        : TRACO,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="g-titulo-secao text-foreground">{identidade.rotulo}</h2>
        {identidade.reescrito && (
          <p className="g-meta text-muted-foreground">Como o portal publica: {identidade.bruto}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <SeloSituacao tom={etapa.tom} explicacao={etapa.explicacao}>{etapa.rotulo}</SeloSituacao>
          {desfecho && (
            <SeloSituacao tom={desfecho.tom} icone={desfecho.vencedora ? Trophy : undefined}>
              {desfecho.rotulo}
            </SeloSituacao>
          )}
          <SeloSituacao tom={arquivamento.tom} icone={Archive} explicacao={arquivamento.explicacao}>
            {arquivamento.rotulo}
          </SeloSituacao>
          {identidade.srpNoTexto && <SeloSituacao tom="neutro">SRP</SeloSituacao>}
        </div>
      </div>

      <BlocoDoPainel titulo="Identificação">
        <ListaDeCampos campos={identificacao} />
      </BlocoDoPainel>

      <BlocoDoPainel titulo="Valores">
        <ListaDeCampos campos={valores} />
      </BlocoDoPainel>

      <BlocoDoPainel titulo="Datas">
        <ListaDeCampos campos={datas} />
      </BlocoDoPainel>

      <BlocoDoPainel titulo="Arquivamento">
        <ListaDeCampos campos={retencao} />
        <p className="g-meta text-muted-foreground">
          Retenção de {DIAS_RETENCAO_ARQUIVO} dias contados do arquivamento; o
          arquivamento automático só ocorre {DIAS_CARENCIA_ARQUIVAMENTO} dias
          depois do desfecho.
        </p>
      </BlocoDoPainel>

      <Button onClick={aoEditar} className="g-controle w-full">Atualizar resultado</Button>
    </div>
  );
}

export default function HistoricoLicitacoes() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [resultadoFilter, setResultadoFilter] = useState<string>('all');
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [ordenacao, setOrdenacao] = useState<OrdenacaoTabela | null>(null);

  // Edit dialog
  const [editingLic, setEditingLic] = useState<Licitacao | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editResultado, setEditResultado] = useState('');
  const [editVencedor, setEditVencedor] = useState<string>('');
  const [editValorAdj, setEditValorAdj] = useState('');
  const [editDataHom, setEditDataHom] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    if (!user) return;
    // Histórico da empresa: o resultado de uma licitação é patrimônio da
    // empresa, não do colaborador que a cadastrou.
    let q = supabase
      .from('licitacoes')
      .select('id, numero, orgao, objeto, modalidade, status, valor_estimado, valor_adjudicado, resultado, vencedor, data_homologacao, data_encerramento, arquivado_em, uf, municipio, created_at');
    if (empresaAtiva) q = q.eq('empresa_id', empresaAtiva.id);
    const { data, error } = await q.order('created_at', { ascending: false });
    // ACHADO — falha silenciosa (princípio 3 do CLAUDE.md). O `error` era
    // descartado: queda de rede virava `data: null` → lista vazia, e a tela
    // dizia "Nenhuma licitação encontrada" para uma empresa com 300
    // processos. Agora a falha aparece com a mensagem real do banco e um
    // "Tentar novamente" — e a lista anterior NÃO é apagada, porque sumir com
    // o que já estava na tela é a mesma mentira em outro formato.
    if (error) {
      setErroCarga(error.message);
      setLoading(false);
      return;
    }
    setErroCarga(null);
    setLicitacoes(data || []);
    setLoading(false);
  };

  const recarregar = () => {
    setLoading(true);
    fetchData();
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, [user, empresaAtiva?.id]);

  const filtrosAplicados =
    (search.trim() ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0) + (resultadoFilter !== 'all' ? 1 : 0);

  const filtered = useMemo(() => {
    const termo = search.toLowerCase();
    return licitacoes.filter((l) => {
      const matchSearch =
        l.objeto.toLowerCase().includes(termo) ||
        l.orgao.toLowerCase().includes(termo) ||
        l.numero.toLowerCase().includes(termo);
      const matchStatus = statusFilter === 'all' || l.status === statusFilter;
      const matchResult = resultadoFilter === 'all' || l.resultado === resultadoFilter;
      return matchSearch && matchStatus && matchResult;
    });
  }, [licitacoes, search, statusFilter, resultadoFilter]);

  /**
   * Indicadores sobre `filtered`, não sobre `licitacoes`.
   *
   * Era a incoerência mais cara da tela: a pessoa filtrava "Perdida", via 12
   * linhas e 87 no cartão "Total". Número de topo que não descreve a lista de
   * baixo não é resumo, é ruído — e leva a decisão errada quando alguém
   * fotografa a tela filtrada achando que fotografou a empresa inteira. As
   * exportações já se comportavam assim (todas sobre `filtered`); os
   * indicadores agora falam da mesma seleção que a tabela e o CSV.
   */
  const metrics = useMemo(() => {
    const total = filtered.length;
    /* Ganho e perda passaram a sair da MESMA autoridade do painel e do Kanban
       (`normalizarStatus`), em 14/09/2026. Havia três definições de "ganhou"
       no app, e as duas daqui eram as mais estreitas:

         - "Vencidas" contava só `vencedor === true`, ignorando quem tem
           `status = 'Homologada'` sem a coluna marcada — e homologação é o
           desfecho que fecha o processo;
         - "Perdidas" procurava `resultado = 'Perdida'`, mas o fluxo oficial
           (`registrarPerda`) grava `'Perdedor'`. Perda registrada pelo caminho
           certo ficava fora da conta.

       `normalizarStatus` cobre as duas colunas: recebe `status`, e o
       `resultado` entra quando o status ainda não foi movido. */
    const desfecho = (l: { status?: string | null; resultado?: string | null }) =>
      normalizarStatus(l.status || l.resultado);
    const vencidas = filtered.filter(l => l.vencedor === true || ['Vencida', 'Homologada'].includes(desfecho(l))).length;
    const perdidas = filtered.filter(l => desfecho(l) === 'Perdida').length;
    // Conta pelo desfecho real (status OU resultado) — a lista masculina antiga nunca casava com o que o app grava
    const finalizados = filtered.filter(l => ehDecidido(l.status, l.resultado)).length;
    const emAndamento = total - finalizados;
    const taxaSucesso = finalizados > 0 ? ((vencidas / finalizados) * 100).toFixed(1) : null;
    const valorGanho = filtered
      .filter(l => l.vencedor === true || ['Vencida', 'Homologada'].includes(desfecho(l)))
      .reduce((s, l) => s + (l.valor_adjudicado || l.valor_estimado || 0), 0);
    const arquivados = filtered.filter(l => l.arquivado_em).length;
    return { total, vencidas, perdidas, finalizados, emAndamento, taxaSucesso, valorGanho, arquivados };
  }, [filtered]);

  /**
   * DIVERGÊNCIA DE AGREGAÇÃO — sinalizada, não corrigida.
   *
   * O indicador "Perdidas" conta `resultado === 'Perdida'`. Mas o caminho
   * oficial de registro de perda (`useLicitacaoIntegration.registrarPerda`,
   * linha ~338) grava `status: 'Perdida'` e `resultado: 'Perdedor'` — e
   * 'Perdedor' também está em `RESULTADOS_ENCERRADORES`, ou seja, é grafia
   * legítima do vocabulário. Resultado prático: **perda registrada pelo fluxo
   * oficial não entra no número de perdas desta tela**, e o select de
   * Resultado nem oferece 'Perdedor' para achá-la.
   *
   * Somar as duas grafias aqui seria mudar a regra de agregação por conta
   * própria — e o mesmo indicador aparece em outras telas com a mesma
   * definição. Então a tela conta o que sempre contou e DECLARA o que ficou de
   * fora, com o número, para quem decide poder revisar. Enquanto a decisão não
   * vem, ninguém lê "3 perdidas" sem saber que existem outras 9.
   */
  const perdasForaDaContagem = useMemo(
    () => filtered.filter(
      (l) => (l.resultado || '').trim().toLowerCase() === RESULTADO_PERDA_DO_COMERCIAL.toLowerCase(),
    ).length,
    [filtered],
  );

  const itens = useMemo(() => {
    // Sem ordenação escolhida vale a ordem da consulta (`created_at desc`) —
    // a consulta não foi tocada.
    if (!ordenacao) return filtered;
    const extrair = VALOR_ORDENACAO[ordenacao.chave];
    if (!extrair) return filtered;
    const sinal = ordenacao.direcao === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = extrair(a);
      const vb = extrair(b);
      // Ausência vai para o fim nos dois sentidos: "sem valor adjudicado" não
      // é "valor baixo", e ordenar não pode transformar falta de dado em zero.
      if (va == null) return vb == null ? 0 : 1;
      if (vb == null) return -1;
      if (typeof va === 'string' && typeof vb === 'string') return va.localeCompare(vb, 'pt-BR') * sinal;
      return (Number(va) - Number(vb)) * sinal;
    });
  }, [filtered, ordenacao]);

  // Derivado de `filtered`: filtrar para fora a linha selecionada fecha o
  // painel sozinho, em vez de deixar um detalhe órfão ao lado de uma tabela
  // que não o contém mais.
  const selecionado = useMemo(
    () => filtered.find((l) => l.id === selecionadoId) ?? null,
    [filtered, selecionadoId],
  );

  const alternarOrdem = (chave: string) => {
    setOrdenacao((atual) => {
      if (atual?.chave !== chave) return { chave, direcao: 'asc' };
      // Terceiro clique devolve a ordem da consulta.
      return atual.direcao === 'asc' ? { chave, direcao: 'desc' } : null;
    });
  };

  const limparFiltros = () => {
    setSearch('');
    setStatusFilter('all');
    setResultadoFilter('all');
  };

  const openEdit = (lic: Licitacao) => {
    setEditingLic(lic);
    setEditStatus(lic.status);
    setEditResultado(lic.resultado || '');
    setEditVencedor(lic.vencedor === true ? 'sim' : lic.vencedor === false ? 'nao' : '');
    setEditValorAdj(lic.valor_adjudicado?.toString() || '');
    setEditDataHom(lic.data_homologacao ? lic.data_homologacao.split('T')[0] : '');
  };

  const handleSave = async () => {
    if (!editingLic) return;
    setSaving(true);
    // A lista literal que existia aqui era a mesma da edge function e usava
    // grafias que o app nunca grava ('Homologado' no masculino). `ehDecidido`
    // olha os dois eixos — status e resultado — que é onde os desfechos
    // realmente estão.
    const shouldArchive = ehDecidido(editStatus, editResultado) && !editingLic.arquivado_em;

    const { error } = await supabase
      .from('licitacoes')
      .update({
        status: editStatus,
        resultado: editResultado || null,
        vencedor: editVencedor === 'sim' ? true : editVencedor === 'nao' ? false : null,
        valor_adjudicado: editValorAdj ? parseFloat(editValorAdj) : null,
        data_homologacao: editDataHom ? new Date(editDataHom).toISOString() : null,
        arquivado_em: shouldArchive ? new Date().toISOString() : editingLic.arquivado_em,
      })
      .eq('id', editingLic.id);

    setSaving(false);
    if (error) {
      toast.error('Erro ao atualizar: ' + error.message);
    } else {
      toast.success('Licitação atualizada!');
      setEditingLic(null);
      fetchData();
    }
  };

  const handleDownloadAll = () => {
    const headers = ['Número', 'Órgão', 'Objeto', 'Status', 'Resultado', 'Vencedor', 'Valor Estimado', 'Valor Adjudicado', 'Homologação', 'UF'];
    const rows = filtered.map(l => [
      l.numero, l.orgao, l.objeto, l.status, l.resultado || '', l.vencedor ? 'Sim' : 'Não',
      l.valor_estimado?.toString() || '', l.valor_adjudicado?.toString() || '',
      l.data_homologacao ? new Date(l.data_homologacao).toLocaleDateString('pt-BR') : '', l.uf || '',
    ]);
    downloadCSV('historico-licitacoes', headers, rows);
    toast.success('Download realizado!');
  };

  const handleDownloadPDF = () => {
    const headers = ['Número', 'Órgão', 'Status', 'Resultado', 'Valor Adj.', 'Homologação'];
    const rows = filtered.map(l => [
      l.numero, l.orgao, l.status, l.resultado || '-',
      l.valor_adjudicado ? formatCurrency(l.valor_adjudicado) : '-',
      l.data_homologacao ? new Date(l.data_homologacao).toLocaleDateString('pt-BR') : '-',
    ]);
    downloadPDF('historico-licitacoes', 'Histórico de Licitações', headers, rows);
    toast.success('PDF gerado!');
  };

  const handleDownloadJSON = () => {
    downloadJSON('historico-licitacoes', filtered);
    toast.success('JSON exportado!');
  };

  const indicadores: Indicador[] = [
    { rotulo: 'Total', valor: metrics.total, icone: BarChart3 },
    { rotulo: 'Em andamento', valor: metrics.emAndamento, icone: Clock, tom: 'aviso' },
    { rotulo: 'Vencidas', valor: metrics.vencidas, icone: Trophy, tom: 'ok' },
    {
      rotulo: 'Perdidas',
      valor: metrics.perdidas,
      icone: XCircle,
      tom: 'critico',
      // Só este indicador tem filtro equivalente exato no select de Resultado.
      // Os demais medem outras colunas (`vencedor`, `ehDecidido`) e ligá-los a
      // um filtro que não reproduz a mesma conta seria mentir sobre o número.
      aoClicar: () => setResultadoFilter((v) =>
        v === RESULTADO_PERDA_DO_HISTORICO ? 'all' : RESULTADO_PERDA_DO_HISTORICO),
      ativo: resultadoFilter === RESULTADO_PERDA_DO_HISTORICO,
      detalhe: perdasForaDaContagem > 0
        ? `+${perdasForaDaContagem} como "${RESULTADO_PERDA_DO_COMERCIAL}", fora desta conta`
        : undefined,
    },
    {
      rotulo: 'Taxa de sucesso',
      // Sem processo decidido a taxa não é 0%: é indivisível. Zero afirmaria
      // que a empresa perdeu tudo o que disputou.
      valor: metrics.taxaSucesso === null ? null : `${metrics.taxaSucesso}%`,
      razaoIndisponivel: 'Nenhum processo decidido na seleção',
      detalhe: metrics.taxaSucesso !== null ? `${metrics.vencidas} de ${metrics.finalizados} decididos` : undefined,
      icone: TrendingUp,
    },
    { rotulo: 'Valor ganho', valor: formatCurrency(metrics.valorGanho), icone: CheckCircle, tom: 'ok' },
  ];

  const colunas: ColunaGestao<Licitacao>[] = [
    {
      chave: 'identidade',
      titulo: 'Nº / Objeto',
      tituloCurto: 'Processo',
      prioridade: 'sempre',
      ordenavel: true,
      largura: '30%',
      render: (lic) => {
        // Autoridade única de nomeação — "P.E. 044", "6" e "00046" crus não
        // identificam; a forma do portal fica no hover.
        const identidade = identidadeDoEdital({ numeroCompra: lic.numero, modalidade: lic.modalidade });
        return (
          <div className="flex min-w-0 flex-col">
            <span
              className="g-meta block font-medium text-muted-foreground"
              title={identidade.reescrito ? `Como o portal publica: ${identidade.bruto}` : undefined}
            >
              {identidade.rotulo}{identidade.srpNoTexto ? ' · SRP' : ''}
            </span>
            <span className="g-corpo line-clamp-1 font-medium text-foreground">{lic.objeto}</span>
          </div>
        );
      },
    },
    {
      chave: 'orgao',
      titulo: 'Órgão',
      prioridade: 'desktop',
      ordenavel: true,
      largura: '20%',
      render: (lic) => (
        <div className="flex min-w-0 flex-col">
          <span className="line-clamp-1">{lic.orgao}</span>
          {lic.municipio && lic.uf && (
            <span className="g-meta text-muted-foreground">{lic.municipio}/{lic.uf}</span>
          )}
        </div>
      ),
    },
    {
      // Eixo 1 — onde o processo parou.
      chave: 'etapa',
      titulo: 'Etapa',
      prioridade: 'sempre',
      largura: '140px',
      render: (lic) => {
        const etapa = etapaVisivel(lic.status);
        return <SeloSituacao tom={etapa.tom} explicacao={etapa.explicacao}>{etapa.rotulo}</SeloSituacao>;
      },
    },
    {
      // Eixo 2 — como terminou. Vazio aqui significa "ainda não terminou",
      // não "empate": por isso traço, e não selo neutro.
      chave: 'resultado',
      titulo: 'Resultado',
      prioridade: 'sempre',
      largura: '150px',
      render: (lic) => {
        const desfecho = desfechoVisivel(lic);
        if (!desfecho) return <span title="Sem desfecho registrado">{TRACO}</span>;
        return (
          <SeloSituacao tom={desfecho.tom} icone={desfecho.vencedora ? Trophy : undefined}>
            {desfecho.rotulo}
          </SeloSituacao>
        );
      },
    },
    {
      // Eixo 3 — saiu de circulação, e por quanto tempo ainda está consultável.
      chave: 'arquivamento',
      titulo: 'Arquivamento',
      prioridade: 'desktop',
      ordenavel: true,
      largura: '150px',
      render: (lic) => {
        const arq = arquivamentoVisivel(lic);
        if (!lic.arquivado_em) return <span className="g-meta text-muted-foreground">Em circulação</span>;
        return (
          <SeloSituacao tom={arq.tom} icone={Archive} explicacao={arq.explicacao}>{arq.rotulo}</SeloSituacao>
        );
      },
    },
    {
      chave: 'valor',
      titulo: 'Valor adjudicado',
      tituloCurto: 'Adjudicado',
      alinhamento: 'direita',
      prioridade: 'desktop',
      ordenavel: true,
      largura: '160px',
      render: (lic) => (lic.valor_adjudicado != null
        ? <span className="font-semibold">{formatCurrency(lic.valor_adjudicado)}</span>
        : TRACO),
    },
    {
      chave: 'acoes',
      titulo: 'Ações',
      alinhamento: 'centro',
      prioridade: 'desktop',
      largura: '110px',
      render: (lic) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => { e.stopPropagation(); openEdit(lic); }}
        >
          Editar
        </Button>
      ),
    },
  ];

  return (
    <AppLayout>
      {/* Título, descrição, ícone e trilha vêm do registro
          `lib/navegacao/paginas.ts` pela rota. O prazo de retenção saiu da
          descrição e ficou onde ele significa alguma coisa: no aviso que só
          aparece quando existe processo arquivado correndo o prazo. */}
      <CabecalhoPagina
        denso
        acoes={
          <>
            {/* As três exportações levam `filtered` — o que a tabela mostra,
                não o histórico inteiro. O rodapé da tabela diz o número. */}
            <Button variant="outline" onClick={handleDownloadAll}>
              <Download aria-hidden="true" /> CSV
            </Button>
            <Button variant="outline" onClick={handleDownloadPDF}>
              <Download aria-hidden="true" /> PDF
            </Button>
            <Button variant="outline" onClick={handleDownloadJSON}>
              <Download aria-hidden="true" /> JSON
            </Button>
          </>
        }
      />

      {/* Composição da referência: indicadores → filtros → tabela, com o
          detalhe do registro selecionado em painel contextual. */}
      <div className="flex min-w-0 flex-col gap-4">
        <FaixaIndicadores itens={indicadores} />

        {perdasForaDaContagem > 0 && (
          <p className="g-meta text-muted-foreground">
            Divergência de vocabulário a revisar: {perdasForaDaContagem} processo(s) com resultado
            {' '}"{RESULTADO_PERDA_DO_COMERCIAL}" — a grafia que o registro de perda do Comercial grava —
            {' '}não entram no indicador "Perdidas", que conta "{RESULTADO_PERDA_DO_HISTORICO}".
            {' '}Os números acima refletem o dado como está gravado.
          </p>
        )}

        <BarraFiltros
          busca={search}
          aoBuscar={setSearch}
          placeholderBusca="Buscar por objeto, órgão ou número"
          filtrosAplicados={filtrosAplicados}
          aoLimpar={limparFiltros}
        >
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="g-controle w-full rounded-[var(--g-raio)] md:w-48" aria-label="Filtrar por status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {STATUS_FLOW.map(s => <SelectItem key={s} value={s}>{rotuloStatus(s)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={resultadoFilter} onValueChange={setResultadoFilter}>
            <SelectTrigger className="g-controle w-full rounded-[var(--g-raio)] md:w-48" aria-label="Filtrar por resultado">
              <SelectValue placeholder="Resultado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos resultados</SelectItem>
              {resultadoOptions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </BarraFiltros>

        {erroCarga && (
          <AvisoDeFalha aoTentarNovamente={recarregar}>
            Não foi possível carregar o histórico: {erroCarga}
          </AvisoDeFalha>
        )}

        {metrics.arquivados > 0 && (
          <AvisoDeContexto
            titulo={`${metrics.arquivados} processo(s) arquivado(s) nesta seleção`}
            acao={
              <Button variant="outline" size="sm" onClick={handleDownloadAll}>
                <Download aria-hidden="true" className="mr-1.5 h-4 w-4" /> Baixar CSV
              </Button>
            }
          >
            O arquivo fica disponível por {DIAS_RETENCAO_ARQUIVO} dias a partir do
            arquivamento. Exporte antes do fim do prazo para não perder o registro.
          </AvisoDeContexto>
        )}

        <AreaComPainel
          tituloPainel="Detalhes do processo"
          aoFechar={() => setSelecionadoId(null)}
          painel={selecionado && (
            <PainelDoProcesso lic={selecionado} aoEditar={() => openEdit(selecionado)} />
          )}
        >
          <TabelaGestao
            descricao="Histórico de licitações da empresa"
            colunas={colunas}
            itens={itens}
            chaveDoItem={(l) => l.id}
            carregando={loading}
            aoSelecionar={(l) => setSelecionadoId((atual) => (atual === l.id ? null : l.id))}
            selecionado={(l) => l.id === selecionadoId}
            ordenacao={ordenacao ?? undefined}
            aoOrdenar={alternarOrdem}
            vazio={
              <EstadoVazio
                tamanho="compacto"
                icone={<Archive />}
                titulo="Nenhuma licitação encontrada"
                descricao="Ajuste a busca ou os filtros de status e resultado."
              />
            }
            rodape={
              <span>
                {itens.length} processo(s)
                {filtrosAplicados > 0 ? ` de ${licitacoes.length}` : ''} · as exportações levam esta seleção
              </span>
            }
          />
        </AreaComPainel>

        {/* Fluxo de status padronizado */}
        <section className="g-cartao flex flex-col gap-3 p-6">
          <h2 className="g-titulo-secao text-foreground">Fluxo de status padronizado</h2>
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_FLOW.map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <SeloSituacao tom={TOM_STATUS[s]}>{rotuloStatus(s)}</SeloSituacao>
                {i < 3 && <span className="g-meta text-muted-foreground" aria-hidden="true">→</span>}
                {i === 3 && <span className="g-meta ml-2 text-muted-foreground" aria-hidden="true">|</span>}
              </div>
            ))}
          </div>
          {/* Os dois prazos vêm das constantes da política, não de literal. */}
          <p className="g-meta text-muted-foreground">
            Decidido o processo, o arquivamento automático espera {DIAS_CARENCIA_ARQUIVAMENTO} dias
            de carência — tempo de Contratos e Financeiro engancharem. No arquivo, o registro
            permanece consultável por {DIAS_RETENCAO_ARQUIVO} dias.
          </p>
        </section>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingLic} onOpenChange={(o) => !o && setEditingLic(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Atualizar resultado — {editingLic ? identidadeDoEdital({ numeroCompra: editingLic.numero, modalidade: editingLic.modalidade }).rotulo : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger id="edit-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_FLOW.map(s => <SelectItem key={s} value={s}>{rotuloStatus(s)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-resultado">Resultado</Label>
              <Select value={editResultado} onValueChange={setEditResultado}>
                <SelectTrigger id="edit-resultado"><SelectValue placeholder="Selecionar resultado" /></SelectTrigger>
                <SelectContent>
                  {resultadoOptions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-vencedor">Empresa vencedora?</Label>
              <Select value={editVencedor} onValueChange={setEditVencedor}>
                <SelectTrigger id="edit-vencedor"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sim">Sim</SelectItem>
                  <SelectItem value="nao">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-valor-adj">Valor adjudicado (R$)</Label>
              <MoneyInput id="edit-valor-adj" value={Number(editValorAdj) || 0} onValueChange={v => setEditValorAdj(String(v))} placeholder="R$ 0,00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-data-hom">Data de homologação</Label>
              <Input id="edit-data-hom" type="date" value={editDataHom} onChange={e => setEditDataHom(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingLic(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
