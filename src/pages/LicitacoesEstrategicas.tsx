import { useMemo, useState, type ElementType, type MouseEvent } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AbasGestao from '@/components/gestao/AbasGestao';
import AreaComPainel from '@/components/gestao/AreaComPainel';
import BarraFiltros from '@/components/gestao/BarraFiltros';
import FaixaIndicadores, { type Indicador } from '@/components/gestao/FaixaIndicadores';
import ListaDeCampos, { BlocoDoPainel, type Campo } from '@/components/gestao/ListaDeCampos';
import SeloSituacao, {
  AvisoDeContexto,
  ValorIndisponivel,
  type TomSituacao,
} from '@/components/gestao/SeloSituacao';
import TabelaGestao, {
  type ColunaGestao,
  type OrdenacaoTabela,
} from '@/components/gestao/TabelaGestao';
import { SecaoGestao } from '@/components/gestao/TelaGestao';
import TextoExpansivel from '@/components/gestao/TextoExpansivel';
import AnaliseCapag from '@/components/licitacoes/AnaliseCapag';
import AureliaEditalPanel from '@/components/aurelia/AureliaEditalPanel';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { useAbaNaUrl } from '@/lib/navegacao/aba-na-url';
import {
  useLicitacoesEstrategicas,
  type LicitacaoEstrategica,
} from '@/hooks/useLicitacoesEstrategicas';
import {
  AlertTriangle, BarChart3, Brain, CheckCircle2, DollarSign, ExternalLink,
  Landmark, MapPin, RefreshCw, Search, Star, Target, Trophy, Zap,
} from 'lucide-react';

const UFS_BRASIL = [
  { sigla: 'AC', nome: 'Acre' }, { sigla: 'AL', nome: 'Alagoas' }, { sigla: 'AP', nome: 'Amapá' },
  { sigla: 'AM', nome: 'Amazonas' }, { sigla: 'BA', nome: 'Bahia' }, { sigla: 'CE', nome: 'Ceará' },
  { sigla: 'DF', nome: 'Distrito Federal' }, { sigla: 'ES', nome: 'Espírito Santo' }, { sigla: 'GO', nome: 'Goiás' },
  { sigla: 'MA', nome: 'Maranhão' }, { sigla: 'MT', nome: 'Mato Grosso' }, { sigla: 'MS', nome: 'Mato Grosso do Sul' },
  { sigla: 'MG', nome: 'Minas Gerais' }, { sigla: 'PA', nome: 'Pará' }, { sigla: 'PB', nome: 'Paraíba' },
  { sigla: 'PR', nome: 'Paraná' }, { sigla: 'PE', nome: 'Pernambuco' }, { sigla: 'PI', nome: 'Piauí' },
  { sigla: 'RJ', nome: 'Rio de Janeiro' }, { sigla: 'RN', nome: 'Rio Grande do Norte' },
  { sigla: 'RS', nome: 'Rio Grande do Sul' }, { sigla: 'RO', nome: 'Rondônia' }, { sigla: 'RR', nome: 'Roraima' },
  { sigla: 'SC', nome: 'Santa Catarina' }, { sigla: 'SP', nome: 'São Paulo' }, { sigla: 'SE', nome: 'Sergipe' },
  { sigla: 'TO', nome: 'Tocantins' },
];

type Recomendacao = LicitacaoEstrategica['recomendacao'];
type FiltroRecomendacao = 'todas' | Recomendacao;

/**
 * O rótulo da recomendação é deliberadamente uma palavra sobre a RECOMENDAÇÃO,
 * não sobre o desfecho da disputa: "Baixa chance", que estava aqui, afirma uma
 * probabilidade de vitória que o modelo nunca foi validado para calcular.
 */
const RECOMENDACAO: Record<Recomendacao, { rotulo: string; tom: TomSituacao; icone: ElementType }> = {
  alta: { rotulo: 'Recomendada', tom: 'sucesso', icone: Star },
  media: { rotulo: 'Moderada', tom: 'atencao', icone: AlertTriangle },
  baixa: { rotulo: 'Baixa', tom: 'critico', icone: AlertTriangle },
};

const PONTO_DO_FILTRO: Record<FiltroRecomendacao, string | null> = {
  todas: null,
  alta: 'bg-success',
  media: 'bg-warning',
  baixa: 'bg-destructive',
};

const ROTULO_DO_FILTRO: Record<FiltroRecomendacao, string> = {
  todas: 'Todas',
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
};

const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * `data_abertura_proposta` chega como string vazia quando o edital não informa
 * a data, e `new Date('')` imprime "Invalid Date" na tela. Data ausente é
 * ausência de informação, não uma data quebrada.
 */
function dataLegivel(iso: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('pt-BR');
}

/**
 * O hook preenche órgão ausente com 'N/I' e valor ausente com 0 — os dois
 * precisam voltar a ser "não informado" na tela, porque zero é uma afirmação
 * sobre a licitação e 'N/I' não é o nome de nenhum órgão.
 */
const temOrgao = (lic: LicitacaoEstrategica) => Boolean(lic.orgao) && lic.orgao !== 'N/I';
const temValor = (lic: LicitacaoEstrategica) => Number.isFinite(lic.valor) && lic.valor > 0;

/**
 * A linha da tabela inteira é clicável. Sem isto, o botão "ver descrição
 * completa" do objeto e os atalhos da coluna de ações abririam o painel junto
 * com a própria ação.
 */
const naoAbrirPainel = (e: MouseEvent<HTMLElement>) => {
  if ((e.target as HTMLElement).closest('button,a')) e.stopPropagation();
};

export default function LicitacoesEstrategicas() {
  const [aba, definirAba] = useAbaNaUrl('oportunidades');
  const [filtro, setFiltro] = useState<FiltroRecomendacao>('todas');
  const [filtroUf, setFiltroUf] = useState('');
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [ordenacao, setOrdenacao] = useState<OrdenacaoTabela>({ chave: 'score', direcao: 'desc' });
  const [capagUf, setCapagUf] = useState('');
  const [capagMunicipio, setCapagMunicipio] = useState('');
  const [capagOrgaoInput, setCapagOrgaoInput] = useState('');
  const [capagOrgao, setCapagOrgao] = useState<{ orgao: string; uf?: string; municipio?: string } | null>(null);

  const { licitacoes, loading, fonteClassificacao, recarregar } = useLicitacoesEstrategicas();

  /**
   * No caminho de contingência (edge function fora do ar) o hook devolve os
   * quatro scores fixos em 50 e a recomendação fixa em "media" — número de
   * preenchimento, não resultado de análise. A tela precisa dizer isso: exibir
   * "score 50" ao lado de um score calculado de verdade é apresentar um valor
   * inventado como se fosse medição.
   */
  const semClassificacao = fonteClassificacao === 'fallback';

  const iniciarCapag = () => {
    if (!capagOrgaoInput.trim()) return;
    setCapagOrgao({
      orgao: capagOrgaoInput.trim(),
      uf: capagUf || undefined,
      municipio: capagMunicipio || undefined,
    });
  };

  /** Leva o órgão da oportunidade para a consulta CAPAG — e para a aba dela. */
  const consultarCapagDe = (lic: LicitacaoEstrategica) => {
    setCapagOrgaoInput(lic.orgao);
    setCapagUf(lic.uf || '');
    setCapagMunicipio('');
    setCapagOrgao({ orgao: lic.orgao, uf: lic.uf || undefined });
    definirAba('capag');
  };

  const filtradas = useMemo(
    () => licitacoes.filter(l => filtro === 'todas' || l.recomendacao === filtro),
    [licitacoes, filtro],
  );

  const ordenadas = useMemo(() => {
    const criterio = (l: LicitacaoEstrategica) => {
      if (ordenacao.chave === 'valor') return temValor(l) ? l.valor : 0;
      if (ordenacao.chave === 'abertura') {
        const t = Date.parse(l.dataAbertura);
        return Number.isNaN(t) ? 0 : t;
      }
      return l.scoreGeral;
    };
    const sinal = ordenacao.direcao === 'asc' ? 1 : -1;
    return [...filtradas].sort((a, b) => (criterio(a) - criterio(b)) * sinal);
  }, [filtradas, ordenacao]);

  const contadores = {
    todas: licitacoes.length,
    alta: licitacoes.filter(l => l.recomendacao === 'alta').length,
    media: licitacoes.filter(l => l.recomendacao === 'media').length,
    baixa: licitacoes.filter(l => l.recomendacao === 'baixa').length,
  };

  const apurado = useMemo(() => {
    const comValor = filtradas.filter(temValor);
    return {
      quantosComValor: comValor.length,
      somaDosValores: comValor.reduce((n, l) => n + l.valor, 0),
      scoreMedio: filtradas.length
        ? Math.round(filtradas.reduce((n, l) => n + l.scoreGeral, 0) / filtradas.length)
        : null,
    };
  }, [filtradas]);

  const selecionada = ordenadas.find(l => l.id === selecionadaId) ?? null;

  const filtrosAplicados = (filtro !== 'todas' ? 1 : 0) + (filtroUf ? 1 : 0);

  const limparFiltros = () => {
    setFiltro('todas');
    if (filtroUf) {
      setFiltroUf('');
      recarregar(undefined);
    }
  };

  /**
   * Antes da primeira resposta não há nada apurado: "0 oportunidades" e
   * "R$ 0,00" durante a carga são afirmações sobre a carteira, quando a
   * verdade é que ainda não se sabe. Numa recarga a lista anterior continua
   * em mãos, e aí os números seguem valendo.
   */
  const primeiraCarga = loading && licitacoes.length === 0;
  const indicadores = (itens: Indicador[]): Indicador[] =>
    primeiraCarga
      ? itens.map(i => ({
          ...i,
          valor: null,
          razaoIndisponivel: 'Carregando',
          detalhe: undefined,
          aoClicar: undefined,
        }))
      : itens;

  const alternarOrdem = (chave: string) =>
    setOrdenacao(atual =>
      atual.chave === chave
        ? { chave, direcao: atual.direcao === 'asc' ? 'desc' : 'asc' }
        : { chave, direcao: chave === 'abertura' ? 'asc' : 'desc' },
    );

  const colunas: ColunaGestao<LicitacaoEstrategica>[] = [
    {
      chave: 'score',
      titulo: 'Score',
      alinhamento: 'direita',
      ordenavel: true,
      prioridade: 'sempre',
      largura: '150px',
      render: lic =>
        semClassificacao ? (
          <ValorIndisponivel razao="Não calculado" />
        ) : (
          <span className="font-semibold">{Math.round(lic.scoreGeral)}</span>
        ),
    },
    {
      chave: 'recomendacao',
      titulo: 'Recomendação',
      prioridade: 'desktop',
      largura: '170px',
      render: lic => {
        if (semClassificacao) {
          return (
            <SeloSituacao tom="indisponivel" explicacao="A classificação por IA não respondeu nesta carga.">
              Não classificada
            </SeloSituacao>
          );
        }
        const cfg = RECOMENDACAO[lic.recomendacao];
        return <SeloSituacao tom={cfg.tom} icone={cfg.icone}>{cfg.rotulo}</SeloSituacao>;
      },
    },
    {
      chave: 'processo',
      titulo: 'Número / Objeto',
      tituloCurto: 'Processo',
      prioridade: 'sempre',
      render: lic => (
        <div className="flex min-w-0 flex-col gap-0.5" onClick={naoAbrirPainel}>
          <span className="g-corpo font-semibold text-foreground">{lic.numero}</span>
          {lic.objeto ? (
            <TextoExpansivel texto={lic.objeto} linhas={2} className="text-muted-foreground" />
          ) : (
            <ValorIndisponivel razao="Objeto não informado" />
          )}
          {lic.modalidade && <span className="g-meta text-muted-foreground">{lic.modalidade}</span>}
        </div>
      ),
    },
    {
      chave: 'orgao',
      titulo: 'Órgão',
      prioridade: 'desktop',
      render: lic =>
        temOrgao(lic) ? (
          <span className="block max-w-[26ch] truncate" title={lic.orgao}>{lic.orgao}</span>
        ) : (
          <ValorIndisponivel razao="Órgão não informado" />
        ),
    },
    {
      chave: 'uf',
      titulo: 'UF',
      prioridade: 'desktop',
      largura: '140px',
      render: lic =>
        lic.uf ? (
          <span className="flex flex-col">
            <span>{lic.uf}</span>
            {lic.municipio && <span className="g-meta text-muted-foreground">{lic.municipio}</span>}
          </span>
        ) : (
          <ValorIndisponivel razao="Sem UF" />
        ),
    },
    {
      chave: 'valor',
      titulo: 'Valor estimado',
      alinhamento: 'direita',
      ordenavel: true,
      prioridade: 'desktop',
      largura: '180px',
      render: lic =>
        temValor(lic) ? formatCurrency(lic.valor) : <ValorIndisponivel razao="Não informado" />,
    },
    {
      chave: 'abertura',
      titulo: 'Abertura',
      ordenavel: true,
      prioridade: 'sempre',
      largura: '160px',
      render: lic => dataLegivel(lic.dataAbertura) ?? <ValorIndisponivel razao="Sem data" />,
    },
    {
      chave: 'acoes',
      titulo: <span className="sr-only">Ações</span>,
      alinhamento: 'direita',
      prioridade: 'desktop',
      largura: '110px',
      render: lic => (
        <div className="flex items-center justify-end gap-1" onClick={naoAbrirPainel}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => consultarCapagDe(lic)}
            disabled={!temOrgao(lic)}
            title={temOrgao(lic) ? `Consultar CAPAG de ${lic.orgao}` : 'Órgão não informado'}
            aria-label={`Consultar CAPAG de ${lic.numero}`}
          >
            <Landmark aria-hidden="true" className="h-4 w-4" />
          </Button>
          {lic.linkOrigem && (
            <Button variant="ghost" size="icon" asChild title="Abrir edital na origem">
              <a
                href={lic.linkOrigem}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Abrir edital ${lic.numero} na origem`}
              >
                <ExternalLink aria-hidden="true" className="h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <AppLayout>
      {/* Sem `titulo`/`descricao`/`icone`: a rota é item de menu, então o
          cabeçalho tira tudo do registro `lib/navegacao/paginas.ts` — título,
          linha de descrição, ícone e trilha. */}
      <CabecalhoPagina
        denso
        acoes={
          <>
            {fonteClassificacao && (
              <SeloSituacao
                tom={fonteClassificacao === 'ia' ? 'sucesso' : 'indisponivel'}
                icone={Brain}
                explicacao={
                  fonteClassificacao === 'ia'
                    ? 'Scores e recomendação calculados pela análise de IA.'
                    : 'A análise de IA não respondeu: os scores desta carga não foram calculados.'
                }
              >
                {fonteClassificacao === 'ia' ? 'Classificada por IA' : 'Sem IA'}
              </SeloSituacao>
            )}
            <Button variant="outline" onClick={() => recarregar(filtroUf || undefined)} disabled={loading}>
              <RefreshCw className={loading ? 'animate-spin' : ''} aria-hidden="true" /> Atualizar
            </Button>
          </>
        }
      >
        <AbasGestao
          abas={[
            { valor: 'oportunidades', rotulo: 'Oportunidades', contagem: licitacoes.length },
            { valor: 'capag', rotulo: 'CAPAG' },
          ]}
          valor={aba}
          aoMudar={definirAba}
        />
      </CabecalhoPagina>

      {aba === 'oportunidades' && (
        <div className="flex flex-col gap-4">
          <FaixaIndicadores
            itens={indicadores([
              {
                rotulo: 'Oportunidades listadas',
                valor: filtradas.length.toLocaleString('pt-BR'),
                detalhe: filtro === 'todas' ? undefined : `de ${contadores.todas} carregadas`,
                icone: BarChart3,
              },
              {
                // Sem "%" e sem "probabilidade": o score é uma nota de
                // aderência numa escala 0–100, não a chance de ganhar.
                rotulo: 'Score médio',
                valor: semClassificacao ? null : apurado.scoreMedio,
                razaoIndisponivel: semClassificacao
                  ? 'Sem classificação por IA'
                  : 'Nenhuma oportunidade na seleção',
                detalhe: semClassificacao || apurado.scoreMedio === null ? undefined : 'Escala 0 a 100',
                icone: Target,
              },
              {
                // O contador é sobre a lista INTEIRA (é ele que filtra a
                // tabela), enquanto os vizinhos falam da seleção atual — por
                // isso a base vai escrita embaixo, e não subentendida.
                rotulo: 'Recomendação alta',
                valor: semClassificacao ? null : contadores.alta,
                razaoIndisponivel: 'Sem classificação por IA',
                detalhe: `sobre as ${contadores.todas} carregadas`,
                icone: Trophy,
                tom: 'ok',
                aoClicar: semClassificacao
                  ? undefined
                  : () => setFiltro(filtro === 'alta' ? 'todas' : 'alta'),
                ativo: filtro === 'alta',
              },
              {
                rotulo: 'Valor estimado somado',
                valor: apurado.quantosComValor ? formatCurrency(apurado.somaDosValores) : null,
                razaoIndisponivel: 'Nenhum valor informado',
                detalhe: `${apurado.quantosComValor} de ${filtradas.length} com valor informado`,
                icone: DollarSign,
              },
            ])}
          />

          {semClassificacao && (
            <AvisoDeContexto
              titulo="Classificação por IA indisponível nesta carga"
              acao={
                <Button variant="outline" onClick={() => recarregar(filtroUf || undefined)} disabled={loading}>
                  <RefreshCw className={loading ? 'animate-spin' : ''} aria-hidden="true" /> Tentar novamente
                </Button>
              }
            >
              Os editais abaixo vieram direto do cache do PNCP, sem análise: score e recomendação
              não foram calculados e por isso aparecem como indisponíveis.
            </AvisoDeContexto>
          )}

          <BarraFiltros filtrosAplicados={filtrosAplicados} aoLimpar={limparFiltros}>
            {/* Pastilhas de filtro. O ponto colorido substitui os emojis
                ⭐ ⚠️ 🔻 que estavam aqui: emoji não existe em nenhuma tela do
                protótipo, muda de desenho conforme o sistema operacional e não
                acompanha a paleta. */}
            <div className="flex flex-wrap items-center gap-2">
              {(['todas', 'alta', 'media', 'baixa'] as const).map(f => {
                const ativo = filtro === f;
                const ponto = PONTO_DO_FILTRO[f];
                return (
                  <Button
                    key={f}
                    variant={ativo ? 'default' : 'outline'}
                    onClick={() => setFiltro(f)}
                    aria-pressed={ativo}
                    className="g-controle rounded-[var(--g-raio)]"
                  >
                    {ponto && <span className={`w-2 h-2 rounded-full ${ponto}`} aria-hidden="true" />}
                    {ROTULO_DO_FILTRO[f]}
                    <span className="tabular-nums opacity-70">({contadores[f]})</span>
                  </Button>
                );
              })}
            </div>
            {/* Rótulo visível (não sr-only): depois de escolher "SP", o
                controle sozinho não diz mais o que filtra. */}
            <div className="flex items-center gap-2">
              <Label htmlFor="filtro-uf" className="g-corpo whitespace-nowrap text-muted-foreground">UF</Label>
              <Select
                value={filtroUf}
                onValueChange={v => {
                  setFiltroUf(v === 'todas' ? '' : v);
                  recarregar(v === 'todas' ? undefined : v);
                }}
              >
                <SelectTrigger id="filtro-uf" className="g-controle w-40 rounded-[var(--g-raio)]">
                  <SelectValue placeholder="Filtrar UF" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas UFs</SelectItem>
                  {UFS_BRASIL.map(uf => (
                    <SelectItem key={uf.sigla} value={uf.sigla}>{uf.sigla}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </BarraFiltros>

          {loading && (
            <div role="status" aria-live="polite" className="flex flex-col items-center gap-1 text-center">
              <p className="g-corpo text-muted-foreground">Analisando licitações com IA...</p>
              <p className="g-meta text-muted-foreground">Isso pode levar alguns segundos</p>
            </div>
          )}

          <AreaComPainel
            painel={
              selecionada && (
                <PainelOportunidade
                  key={selecionada.id}
                  lic={selecionada}
                  semClassificacao={semClassificacao}
                  aoConsultarCapag={() => consultarCapagDe(selecionada)}
                />
              )
            }
            tituloPainel={selecionada ? `Oportunidade ${selecionada.numero}` : 'Detalhes'}
            aoFechar={() => setSelecionadaId(null)}
          >
            <TabelaGestao
              descricao="Oportunidades estratégicas com abertura futura"
              colunas={colunas}
              itens={ordenadas}
              chaveDoItem={lic => lic.id}
              carregando={loading}
              ordenacao={ordenacao}
              aoOrdenar={alternarOrdem}
              aoSelecionar={lic => setSelecionadaId(atual => (atual === lic.id ? null : lic.id))}
              selecionado={lic => lic.id === selecionadaId}
              rodape={
                ordenadas.length > 0 ? (
                  <span>
                    {ordenadas.length.toLocaleString('pt-BR')} de {contadores.todas.toLocaleString('pt-BR')} oportunidades
                  </span>
                ) : undefined
              }
              vazio={
                <EstadoVazio
                  icone={<Target />}
                  titulo="Nenhuma licitação estratégica encontrada"
                  descricao={
                    licitacoes.length === 0
                      ? 'Não há licitações com abertura futura no momento. Tente atualizar.'
                      : 'Nenhuma licitação corresponde ao filtro selecionado.'
                  }
                  acao={
                    licitacoes.length === 0 ? (
                      <Button variant="outline" onClick={() => recarregar(filtroUf || undefined)}>
                        <RefreshCw aria-hidden="true" /> Atualizar
                      </Button>
                    ) : (
                      <Button variant="outline" onClick={limparFiltros}>Limpar filtros</Button>
                    )
                  }
                />
              }
            />
          </AreaComPainel>
        </div>
      )}

      {aba === 'capag' && (
        <div className="flex flex-col gap-6">
          <SecaoGestao titulo="Consulta CAPAG por ente federativo">
            <div className="g-cartao flex flex-col gap-4 p-4">
              <p className="g-corpo flex items-start gap-2 text-muted-foreground">
                <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                Informe o ente. Os números vêm do Tesouro Nacional quando publicados; a nota, o
                risco e as recomendações são leitura da IA sobre eles.
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="capag-uf">UF</Label>
                  <Select value={capagUf} onValueChange={v => { setCapagUf(v); setCapagMunicipio(''); }}>
                    <SelectTrigger id="capag-uf" className="g-controle rounded-[var(--g-raio)]">
                      <SelectValue placeholder="Selecione a UF" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="federal">Federal (União)</SelectItem>
                      {UFS_BRASIL.map(uf => (
                        <SelectItem key={uf.sigla} value={uf.sigla}>{uf.sigla} – {uf.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="capag-municipio">Município (opcional)</Label>
                  <Input
                    id="capag-municipio"
                    className="g-controle rounded-[var(--g-raio)]"
                    placeholder="Município"
                    value={capagMunicipio}
                    onChange={e => setCapagMunicipio(e.target.value)}
                    disabled={!capagUf || capagUf === 'federal'}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="capag-orgao">Órgão / ente</Label>
                  <Input
                    id="capag-orgao"
                    className="g-controle rounded-[var(--g-raio)]"
                    placeholder="Nome do órgão / ente"
                    value={capagOrgaoInput}
                    onChange={e => setCapagOrgaoInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && iniciarCapag()}
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <Button onClick={iniciarCapag} disabled={!capagOrgaoInput.trim()} className="g-controle">
                    <Search aria-hidden="true" /> Analisar CAPAG
                  </Button>
                </div>
              </div>
              {licitacoes.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="g-meta text-muted-foreground">Atalhos:</span>
                  {[...new Set(licitacoes.map(l => l.orgao))].slice(0, 5).map(org => (
                    <Button
                      key={org}
                      variant="ghost"
                      size="sm"
                      title={org}
                      onClick={() => {
                        setCapagOrgaoInput(org);
                        setCapagOrgao({
                          orgao: org,
                          uf: capagUf || undefined,
                          municipio: capagMunicipio || undefined,
                        });
                      }}
                    >
                      {org.length > 40 ? org.slice(0, 40) + '…' : org}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </SecaoGestao>

          {capagOrgao ? (
            <>
              {/* O que foi PERGUNTADO fica separado do que a IA respondeu: sem
                  esta divisão, o parâmetro digitado e a conclusão do modelo
                  chegam com o mesmo peso na mesma superfície. */}
              <SecaoGestao
                titulo="Dados consultados"
                acoes={
                  <Button variant="ghost" onClick={() => setCapagOrgao(null)}>Nova consulta</Button>
                }
              >
                <div className="g-cartao p-4">
                  <ListaDeCampos
                    campos={[
                      { rotulo: 'Órgão / ente', valor: capagOrgao.orgao, largo: true },
                      {
                        rotulo: 'UF',
                        valor: capagOrgao.uf ?? <ValorIndisponivel razao="Não informada" />,
                      },
                      {
                        rotulo: 'Município',
                        valor: capagOrgao.municipio ?? <ValorIndisponivel razao="Não informado" />,
                      },
                      {
                        rotulo: 'Situação da consulta',
                        valor: (
                          <SeloSituacao
                            tom="ativo"
                            explicacao="A análise em si é disparada no bloco de resultado, abaixo."
                          >
                            Ente selecionado
                          </SeloSituacao>
                        ),
                      },
                    ]}
                  />
                </div>
              </SecaoGestao>

              <SecaoGestao titulo="Fonte, período e interpretação da IA">
                <p className="g-corpo text-muted-foreground">
                  O cartão de resultado identifica a origem dos números (Tesouro Nacional/SICONFI ou
                  estimativa) e o período a que se referem. A nota CAPAG, o score de risco e as
                  recomendações são interpretação da IA sobre esses números — não são dado consultado.
                </p>
                <AnaliseCapag
                  orgao={capagOrgao.orgao}
                  uf={capagOrgao.uf}
                  municipio={capagOrgao.municipio}
                />
              </SecaoGestao>
            </>
          ) : (
            <div className="g-cartao">
              <EstadoVazio
                icone={<Landmark />}
                titulo="Nenhuma consulta iniciada"
                descricao={<>Preencha os filtros acima e clique em <strong>Analisar CAPAG</strong> para consultar.</>}
              />
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}

/**
 * O detalhe da oportunidade, no painel de 384px.
 *
 * A Aurélia não é montada junto com o painel: são quatro análises de IA por
 * edital, e selecionar uma linha para ler o órgão não deve disparar quatro
 * chamadas. O botão devolve a decisão a quem lê — era o que o "Detalhes" do
 * cartão expansível fazia antes.
 */
function PainelOportunidade({
  lic,
  semClassificacao,
  aoConsultarCapag,
}: {
  lic: LicitacaoEstrategica;
  semClassificacao: boolean;
  aoConsultarCapag: () => void;
}) {
  const [aureliaPedida, setAureliaPedida] = useState(false);
  const cfg = RECOMENDACAO[lic.recomendacao];
  const abertura = dataLegivel(lic.dataAbertura);

  const campos: Campo[] = [
    {
      rotulo: 'Órgão',
      valor: temOrgao(lic) ? lic.orgao : <ValorIndisponivel razao="Não informado" />,
      largo: true,
    },
    {
      rotulo: 'Local',
      valor: lic.uf
        ? `${lic.uf}${lic.municipio ? ` — ${lic.municipio}` : ''}`
        : <ValorIndisponivel razao="Sem UF" />,
    },
    { rotulo: 'Modalidade', valor: lic.modalidade || <ValorIndisponivel razao="Não informada" /> },
    { rotulo: 'Abertura', valor: abertura ?? <ValorIndisponivel razao="Sem data" /> },
    {
      rotulo: 'Valor estimado',
      valor: temValor(lic) ? formatCurrency(lic.valor) : <ValorIndisponivel razao="Não informado" />,
      numerico: true,
    },
    { rotulo: 'Fonte', valor: lic.fonte || <ValorIndisponivel razao="Não informada" /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="g-titulo-secao min-w-0 text-foreground">{lic.numero}</h2>
          {semClassificacao ? (
            <SeloSituacao tom="indisponivel">Não classificada</SeloSituacao>
          ) : (
            <SeloSituacao tom={cfg.tom} icone={cfg.icone}>{cfg.rotulo}</SeloSituacao>
          )}
        </div>
        {lic.objeto ? (
          <TextoExpansivel texto={lic.objeto} linhas={3} className="text-muted-foreground" />
        ) : (
          <ValorIndisponivel razao="Objeto não informado" />
        )}
      </div>

      <BlocoDoPainel titulo="Identificação">
        <ListaDeCampos campos={campos} />
      </BlocoDoPainel>

      <BlocoDoPainel titulo="Scores da análise">
        {semClassificacao ? (
          <AvisoDeContexto titulo="Scores não calculados">
            Esta carga veio sem a análise de IA. Os valores de relevância, viabilidade e
            concorrência não foram apurados para esta oportunidade.
          </AvisoDeContexto>
        ) : (
          <div className="flex flex-col gap-3">
            {[
              { rotulo: 'Relevância', valor: lic.scoreRelevancia },
              { rotulo: 'Viabilidade', valor: lic.scoreViabilidade },
              { rotulo: 'Concorrência (favorável)', valor: lic.scoreConcorrencia },
              { rotulo: 'Score geral', valor: lic.scoreGeral },
            ].map(item => (
              <div key={item.rotulo} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="g-corpo text-muted-foreground">{item.rotulo}</span>
                  <span className="g-corpo font-semibold tabular-nums text-foreground">
                    {Math.round(item.valor)}
                  </span>
                </div>
                <Progress value={Math.min(Math.max(Math.round(item.valor), 0), 100)} className="h-2" />
              </div>
            ))}
            <p className="g-meta text-muted-foreground">
              Escala 0 a 100 — é a aderência da oportunidade ao perfil, não a probabilidade de vitória.
            </p>
          </div>
        )}
      </BlocoDoPainel>

      {!semClassificacao && lic.fatoresPositivos.length > 0 && (
        <BlocoDoPainel titulo="Fatores positivos">
          <ul className="flex flex-col gap-1.5">
            {lic.fatoresPositivos.map((f, i) => (
              <li key={i} className="g-corpo flex items-start gap-2 text-muted-foreground">
                <Zap aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <span className="min-w-0">{f}</span>
              </li>
            ))}
          </ul>
        </BlocoDoPainel>
      )}

      {!semClassificacao && lic.fatoresRisco.length > 0 && (
        <BlocoDoPainel titulo="Fatores de risco">
          <ul className="flex flex-col gap-1.5">
            {lic.fatoresRisco.map((f, i) => (
              <li key={i} className="g-corpo flex items-start gap-2 text-muted-foreground">
                <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <span className="min-w-0">{f}</span>
              </li>
            ))}
          </ul>
        </BlocoDoPainel>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={aoConsultarCapag}
          disabled={!temOrgao(lic)}
          title={temOrgao(lic) ? undefined : 'Órgão não informado neste edital'}
        >
          <Landmark aria-hidden="true" /> CAPAG do órgão
        </Button>
        {lic.linkOrigem && (
          <Button variant="outline" asChild>
            <a href={lic.linkOrigem} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden="true" /> Edital
            </a>
          </Button>
        )}
      </div>

      <BlocoDoPainel titulo="Leitura da Aurélia">
        {aureliaPedida ? (
          <AureliaEditalPanel
            colunas={1}
            edital={{
              titulo: lic.numero,
              objeto: lic.objeto,
              orgao: lic.orgao,
              // Sem valor apurado, "R$ 0,00" entraria no contexto da IA como
              // se o edital tivesse estimado zero.
              valor: temValor(lic) ? formatCurrency(lic.valor) : 'Não informado',
              modalidade: lic.modalidade || 'Licitação',
              dataAbertura: lic.dataAbertura,
            }}
          />
        ) : (
          <div className="flex flex-col items-start gap-2">
            <p className="g-corpo text-muted-foreground">
              Resumo, habilitação, riscos e recomendação deste edital, gerados sob demanda.
            </p>
            <Button variant="outline" onClick={() => setAureliaPedida(true)}>
              <CheckCircle2 aria-hidden="true" /> Analisar com a Aurélia
            </Button>
          </div>
        )}
      </BlocoDoPainel>
    </div>
  );
}
