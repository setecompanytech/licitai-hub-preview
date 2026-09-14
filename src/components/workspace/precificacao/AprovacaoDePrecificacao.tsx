import { useCallback, useEffect, useId, useMemo, useState, type ElementType } from 'react';
import { toast } from 'sonner';
import { Loader2, PencilLine, RotateCw, Save, Search, Send, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import TabelaGestao, { type ColunaGestao } from '@/components/gestao/TabelaGestao';
import AreaComPainel from '@/components/gestao/AreaComPainel';
import SeloSituacao, { AvisoDeContexto, AvisoDeFalha, ValorIndisponivel } from '@/components/gestao/SeloSituacao';
import { SecaoGestao } from '@/components/gestao/TelaGestao';
import { usePapelEmpresa } from '@/hooks/usePapelEmpresa';
import {
  montarItensDaRevisao,
  premissasIniciais,
  recalcularVersao,
  usePrecificacaoVersoes,
} from '@/hooks/usePrecificacaoVersoes';
import {
  calcularVersao,
  diferencasEntreVersoes,
  type CriterioDeDisputa,
  type FonteDaPremissa,
  type ItemCalculado,
  type ItemDePrecificacao,
} from '@/lib/precificacao/versao';
import type { CamadasPreco } from '@/lib/precificacao/formacao-preco';
import DetalheDoItem from './DetalheDoItem';
import HistoricoDeVersoes from './HistoricoDeVersoes';
import LimitesSomenteLeitura from './LimitesSomenteLeitura';
import PainelDePendencias from './PainelDePendencias';
import PremissasDaRevisao from './PremissasDaRevisao';
import {
  assinatura,
  comFonteDaPremissa,
  comItemAlterado,
  comTextoDaPremissa,
  comTextoDoItem,
  formularioDaRevisao,
  lerFormulario,
  type CampoNumerico,
  type FormularioDaRevisao,
  type FormularioDoItem,
} from './estadoDaRevisao';
import {
  dataHoraDeBrasilia,
  formatarCentavos,
  formatarReais,
  MENSAGEM_DE_MIGRACAO_PENDENTE,
  SITUACAO_DA_VERSAO,
} from './formato';

/**
 * Aprovação de precificação — onde o cálculo vira limite do robô.
 *
 * O fluxo tem três degraus, e a tela mostra UM como próximo passo de cada vez:
 *
 *   salvar revisão  →  submeter para aprovação  →  aprovar limites
 *     (quem opera)          (operador)                (administrador)
 *
 * Três garantias que não dependem de a pessoa ler com atenção:
 *
 *  - o número é do `calcularVersao`, não da tela. A tela lê o que foi
 *    digitado, entrega ao cálculo e mostra a memória que ele devolveu;
 *  - aprovação vale para o que está GRAVADO. Com alteração não salva, o botão
 *    trava e diz por quê — aprovar um número e gravar outro é o pior defeito
 *    que esta tela poderia ter;
 *  - aprovar não liga nada. O texto ao lado do botão diz isso, porque o medo
 *    razoável de quem aprova é disparar lance numa disputa em curso.
 */

interface LinhaDaTabela {
  formulario: FormularioDoItem;
  calculado: ItemCalculado;
  invalidos: number;
}

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function SituacaoDoItem({ linha }: { linha: LinhaDaTabela }) {
  const { calculado, invalidos } = linha;
  if (invalidos) return <SeloSituacao tom="critico">Campo inválido</SeloSituacao>;
  if (!calculado.autorizado) return <SeloSituacao tom="indisponivel">Fora da disputa</SeloSituacao>;
  const bloqueios = calculado.pendencias.filter((p) => p.gravidade === 'bloqueia').length;
  const avisos = calculado.pendencias.length - bloqueios;
  if (bloqueios) return <SeloSituacao tom="critico">{bloqueios === 1 ? '1 bloqueio' : `${bloqueios} bloqueios`}</SeloSituacao>;
  if (avisos) return <SeloSituacao tom="atencao">{avisos === 1 ? '1 aviso' : `${avisos} avisos`}</SeloSituacao>;
  return <SeloSituacao tom="sucesso">Pronto</SeloSituacao>;
}

/** Botão cuja indisponibilidade se explica em texto visível, logo abaixo. */
function AcaoComMotivos({
  rotulo,
  icone: Icone,
  primaria,
  motivos,
  emAndamento,
  bloqueadoPorOutra,
  aoClicar,
}: {
  rotulo: string;
  icone: ElementType;
  primaria: boolean;
  motivos: string[];
  emAndamento: boolean;
  bloqueadoPorOutra: boolean;
  aoClicar: () => void;
}) {
  const idMotivos = useId();
  return (
    <div className="flex flex-col gap-1 sm:items-end">
      <Button
        type="button"
        variant={primaria ? 'default' : 'outline'}
        onClick={aoClicar}
        disabled={motivos.length > 0 || emAndamento || bloqueadoPorOutra}
        aria-describedby={motivos.length ? idMotivos : undefined}
        className="max-sm:w-full"
      >
        {emAndamento ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Icone aria-hidden="true" />}
        {rotulo}
      </Button>
      {motivos.length > 0 && (
        <ul id={idMotivos} className="g-meta max-w-xs text-muted-foreground sm:text-right">
          {motivos.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AprovacaoDePrecificacao({
  licitacaoId,
  empresaId,
}: {
  licitacaoId: string;
  empresaId: string | null;
}) {
  const { isAdmin, podeOperar, isViewer } = usePapelEmpresa();
  const somenteLimites = isViewer || !podeOperar;
  const dados = usePrecificacaoVersoes({ licitacaoId, empresaId, habilitado: !somenteLimites });
  const { carregando, versoes, vigente, rascunhoAtual, itensDoProcesso, indicador, recarregar } = dados;

  /** A versão de onde a revisão parte: a em curso; senão, a aprovada. */
  const base = rascunhoAtual ?? vigente ?? null;

  // Recalculado só quando o banco devolve dados novos (carga, salvar,
  // submeter, aprovar). Digitação não passa por aqui.
  const inicial = useMemo(() => {
    if (somenteLimites || carregando) return null;
    const formulario = formularioDaRevisao(
      montarItensDaRevisao(base, itensDoProcesso),
      base ? base.premissas : premissasIniciais(indicador),
    );
    // O que está gravado. Item do processo que a versão ainda não tem, ou
    // item religado a um id novo, conta como alteração a salvar.
    const gravado = base ? formularioDaRevisao(montarItensDaRevisao(base, []), base.premissas) : formulario;
    return { formulario, assinatura: assinatura(gravado) };
  }, [somenteLimites, carregando, base, itensDoProcesso, indicador]);

  const [formulario, setFormulario] = useState<FormularioDaRevisao | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [soPendencias, setSoPendencias] = useState(false);
  const [mensagemDaAcao, setMensagemDaAcao] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const idBusca = useId();
  const idSoPendencias = useId();

  useEffect(() => {
    if (inicial) setFormulario(inicial.formulario);
  }, [inicial]);

  const lido = useMemo(() => (formulario ? lerFormulario(formulario) : null), [formulario]);
  const calculo = useMemo(() => (lido ? calcularVersao(lido.itens, lido.premissas) : null), [lido]);
  const assinaturaAtual = useMemo(() => assinatura(formulario), [formulario]);
  const sujo = Boolean(formulario && inicial && assinaturaAtual !== inicial.assinatura);

  // Sair da página com revisão não salva perde trabalho de cotação — o
  // navegador pergunta antes.
  useEffect(() => {
    if (!sujo) return;
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [sujo]);

  const alterarTextoDaPremissa = useCallback((camada: keyof CamadasPreco, texto: string) => {
    setFormulario((f) => (f ? { ...f, premissas: comTextoDaPremissa(f.premissas, camada, texto) } : f));
  }, []);
  const escolherFonte = useCallback(
    (camada: keyof CamadasPreco, fonte: FonteDaPremissa) => {
      setFormulario((f) => (f ? { ...f, premissas: comFonteDaPremissa(f.premissas, camada, fonte, indicador) } : f));
    },
    [indicador],
  );
  const escolherCriterio = useCallback((criterio: CriterioDeDisputa) => {
    setFormulario((f) => (f ? { ...f, premissas: { ...f.premissas, criterio } } : f));
  }, []);
  const alterarTextoDoItem = useCallback((chave: string, campo: CampoNumerico, texto: string) => {
    setFormulario((f) => (f ? comTextoDoItem(f, chave, campo, texto) : f));
  }, []);
  const alterarItem = useCallback((chave: string, parcial: Partial<ItemDePrecificacao>) => {
    setFormulario((f) => (f ? comItemAlterado(f, chave, parcial) : f));
  }, []);

  const linhas = useMemo<LinhaDaTabela[]>(() => {
    if (!formulario || !calculo || !lido) return [];
    return formulario.itens.map((fi, i) => ({
      formulario: fi,
      calculado: calculo.itens[i],
      invalidos: lido.erros.filter((e) => e.chave === fi.chave).length,
    }));
  }, [formulario, calculo, lido]);

  const visiveis = useMemo(() => {
    const termo = normalizar(busca.trim());
    return linhas.filter((l) => {
      if (soPendencias && l.calculado.pendencias.length === 0 && l.invalidos === 0) return false;
      if (!termo) return true;
      const i = l.formulario.item;
      return normalizar([i.numero, i.lote, i.descricao, i.marca, i.fabricante, i.modelo].filter(Boolean).join(' ')).includes(termo);
    });
  }, [linhas, busca, soPendencias]);

  const mudancasParaConfirmar = useMemo(() => {
    if (!confirmando || !vigente || !calculo) return null;
    return diferencasEntreVersoes(recalcularVersao(vigente).itens, calculo.itens).filter((d) => d.campo !== 'custo').length;
  }, [confirmando, vigente, calculo]);

  // ── Estados que substituem a tela ─────────────────────────────────────────

  if (somenteLimites) return <LimitesSomenteLeitura licitacaoId={licitacaoId} />;

  if (dados.migracaoPendente) {
    return (
      <AvisoDeContexto
        titulo={MENSAGEM_DE_MIGRACAO_PENDENTE}
        acao={
          <Button type="button" variant="outline" onClick={() => void recarregar()}>
            <RotateCw aria-hidden="true" />
            Verificar de novo
          </Button>
        }
      >
        As versões da precificação dependem da atualização do banco de 14/09/2026. Até ela ser aplicada, nada aqui é
        gravado — e nenhum limite é presumido.
      </AvisoDeContexto>
    );
  }

  if (dados.erro) {
    return (
      <AvisoDeFalha aoTentarNovamente={() => void recarregar()}>
        Não foi possível carregar a precificação: {dados.erro}
      </AvisoDeFalha>
    );
  }

  if (!formulario || !lido || !calculo) {
    return (
      <div aria-busy="true">
        <TabelaGestao colunas={[]} itens={[]} chaveDoItem={() => ''} carregando descricao="Carregando a precificação" />
      </div>
    );
  }

  if (formulario.itens.length === 0) {
    return (
      <div className="g-cartao flex flex-col items-start gap-2 p-6">
        <p className="g-titulo-secao text-foreground">Nenhum item extraído para este processo</p>
        <p className="g-corpo text-muted-foreground">
          A precificação parte dos itens do edital. Extraia-os na aba Documentos (extração do edital) e volte aqui.
        </p>
      </div>
    );
  }

  // ── Próximo passo ─────────────────────────────────────────────────────────

  const ocupado = dados.ocupado;
  const bloqueios = calculo.pendencias.filter((p) => p.gravidade === 'bloqueia').length;
  const invalidos = lido.erros.length;
  const proximoNumero = versoes.reduce((max, v) => Math.max(max, v.numero), 0) + 1;

  const motivosParaSalvar: string[] = [];
  if (!empresaId) motivosParaSalvar.push('Empresa do processo não identificada.');
  if (invalidos) motivosParaSalvar.push(`Corrija ${invalidos === 1 ? '1 campo inválido' : `${invalidos} campos inválidos`}.`);
  if (!sujo && base) motivosParaSalvar.push('Nenhuma alteração para salvar.');

  const motivosParaSubmeter: string[] = [];
  if (!rascunhoAtual || sujo) motivosParaSubmeter.push('Salve a revisão antes de submeter.');
  else if (rascunhoAtual.situacao !== 'rascunho') motivosParaSubmeter.push(`Versão ${rascunhoAtual.numero} já foi submetida.`);
  if (bloqueios) motivosParaSubmeter.push(`Resolva ${bloqueios === 1 ? 'a pendência que bloqueia' : `as ${bloqueios} pendências que bloqueiam`} a aprovação.`);

  const motivosParaAprovar: string[] = [];
  if (!isAdmin) motivosParaAprovar.push('Aprovar limites exige administrador da empresa.');
  if (!rascunhoAtual) motivosParaAprovar.push('Salve a revisão antes de aprovar.');
  else if (sujo) motivosParaAprovar.push('Há alterações não salvas — a aprovação vale para o que está gravado.');
  if (bloqueios) motivosParaAprovar.push(`${bloqueios === 1 ? '1 pendência bloqueia' : `${bloqueios} pendências bloqueiam`} a aprovação — veja o painel de pendências.`);

  const proximo: 'salvar' | 'submeter' | 'aprovar' | null =
    motivosParaSalvar.length === 0 && (sujo || !base)
      ? 'salvar'
      : isAdmin && motivosParaAprovar.length === 0
        ? 'aprovar'
        : !isAdmin && motivosParaSubmeter.length === 0
          ? 'submeter'
          : null;

  const salvar = async () => {
    setMensagemDaAcao(null);
    const r = await dados.salvarRevisao(lido.premissas, lido.itens);
    if (r.ok) toast.success('Revisão salva. Ela só vale para o robô depois de aprovada.');
    else setMensagemDaAcao(r.erro ?? 'Não foi possível salvar a revisão.');
  };
  const submeter = async () => {
    if (!rascunhoAtual) return;
    setMensagemDaAcao(null);
    const r = await dados.submeter(rascunhoAtual.id);
    if (r.ok) toast.success(`Versão ${rascunhoAtual.numero} submetida para aprovação.`);
    else setMensagemDaAcao(r.erro ?? 'Não foi possível submeter.');
  };
  const aprovar = async () => {
    if (!rascunhoAtual) return;
    setMensagemDaAcao(null);
    const numero = rascunhoAtual.numero;
    const r = await dados.aprovar(rascunhoAtual.id);
    setConfirmando(false);
    if (r.ok) toast.success(`Versão ${numero} aprovada.`);
    // A mensagem do servidor, sem tradução: é ele quem confere papel e pendências.
    else setMensagemDaAcao(r.erro ?? 'Não foi possível aprovar.');
  };

  const irParaItem = (numero: number, lote: string | null) => {
    const alvo = formulario.itens.find((i) => i.item.numero === numero && (i.item.lote ?? null) === (lote ?? null))
      ?? formulario.itens.find((i) => i.item.numero === numero);
    if (alvo) setSelecionado(alvo.chave);
  };

  // ── Tabela e painel ───────────────────────────────────────────────────────

  const colunas: ColunaGestao<LinhaDaTabela>[] = [
    {
      chave: 'item',
      titulo: 'Item',
      prioridade: 'sempre',
      largura: '5rem',
      render: ({ formulario: { item } }) => (
        <span className="tabular-nums">
          {item.numero}
          {item.lote && item.lote !== 'Único' && <span className="g-meta block text-muted-foreground">Lote {item.lote}</span>}
        </span>
      ),
    },
    {
      chave: 'produto',
      titulo: 'Produto',
      prioridade: 'sempre',
      render: ({ formulario: { item } }) => (
        <span className="flex min-w-0 flex-col">
          <span className="line-clamp-2">{item.descricao}</span>
          {item.marca && <span className="g-meta text-muted-foreground">{item.marca}</span>}
        </span>
      ),
    },
    {
      chave: 'quantidade',
      titulo: 'Qtd.',
      alinhamento: 'direita',
      prioridade: 'desktop',
      render: ({ formulario: { item } }) => `${Number(item.quantidade).toLocaleString('pt-BR')} ${item.unidade}`,
    },
    {
      chave: 'custo',
      titulo: 'Custo unitário',
      tituloCurto: 'Custo',
      alinhamento: 'direita',
      prioridade: 'desktop',
      render: ({ calculado }) =>
        calculado.item.custoUnitario ? formatarReais(calculado.item.custoUnitario) : <ValorIndisponivel razao="Não cotado" />,
    },
    {
      chave: 'preco',
      titulo: 'Preço de proposta',
      tituloCurto: 'Preço',
      alinhamento: 'direita',
      prioridade: 'sempre',
      render: ({ calculado, formulario: fi }) => (
        <span className="flex flex-col items-end">
          {formatarCentavos(calculado.precoInicialCentavos)}
          {calculado.precoInicialCentavos != null && !fi.textos.precoInicial.trim() && (
            <span className="g-meta text-muted-foreground">sugerido</span>
          )}
        </span>
      ),
    },
    {
      chave: 'limite',
      titulo: 'Limite',
      alinhamento: 'direita',
      prioridade: 'sempre',
      render: ({ calculado }) => formatarCentavos(calculado.limiteCentavos),
    },
    { chave: 'situacao', titulo: 'Situação', prioridade: 'sempre', render: (l) => <SituacaoDoItem linha={l} /> },
  ];

  const linhaSelecionada = linhas.find((l) => l.formulario.chave === selecionado) ?? null;
  const painel = linhaSelecionada ? (
    <DetalheDoItem
      key={linhaSelecionada.formulario.chave}
      formulario={linhaSelecionada.formulario}
      calculado={linhaSelecionada.calculado}
      premissas={lido.premissas}
      erros={lido.erros.filter((e) => e.chave === linhaSelecionada.formulario.chave)}
      somenteLeitura={false}
      aoAlterarTexto={(campo, texto) => alterarTextoDoItem(linhaSelecionada.formulario.chave, campo, texto)}
      aoAlterarItem={(parcial) => alterarItem(linhaSelecionada.formulario.chave, parcial)}
    />
  ) : null;

  const situacaoEmCurso = rascunhoAtual ? SITUACAO_DA_VERSAO[rascunhoAtual.situacao] : null;
  const nome = (id: string | null) => (id && dados.nomes[id]) || 'usuário não identificado';

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* ── Situação da versão ─────────────────────────────────────────── */}
      <section aria-label="Situação da precificação" className="g-cartao flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="g-titulo-secao text-foreground">Aprovação de limites</h2>
          {rascunhoAtual && situacaoEmCurso && (
            <SeloSituacao tom={situacaoEmCurso.tom}>
              Versão {rascunhoAtual.numero} · {situacaoEmCurso.rotulo}
            </SeloSituacao>
          )}
          {!rascunhoAtual && vigente && <SeloSituacao tom="sucesso">Versão {vigente.numero} · Aprovada</SeloSituacao>}
          {!base && <SeloSituacao tom="indisponivel">Nenhuma versão salva</SeloSituacao>}
          {sujo && (
            <SeloSituacao tom="atencao" icone={PencilLine}>
              Alterações não salvas
            </SeloSituacao>
          )}
        </div>

        {vigente && (
          <p className="g-corpo flex items-start gap-2 text-foreground">
            <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-success-ink" />
            <span>
              Versão {vigente.numero} aprovada por {nome(vigente.aprovada_por)} em {dataHoraDeBrasilia(vigente.aprovada_em)}{' '}
              (horário de Brasília).
            </span>
          </p>
        )}

        {rascunhoAtual && (
          <AvisoDeContexto titulo={`Versão ${rascunhoAtual.numero} ainda não liberada para o robô`}>
            {vigente
              ? `Até a aprovação, o robô segue com a versão ${vigente.numero}.`
              : 'Nenhuma versão aprovada: o robô não tem limites deste processo.'}
            {rascunhoAtual.situacao === 'submetida' &&
              ` Submetida por ${nome(rascunhoAtual.submetida_por)} em ${dataHoraDeBrasilia(rascunhoAtual.submetida_em)}; alterar e salvar cria a versão ${proximoNumero}.`}
          </AvisoDeContexto>
        )}

        {!rascunhoAtual && (sujo || !base) && (
          <p className="g-meta text-muted-foreground">
            Salvar cria a versão {proximoNumero}, que só vale para o robô depois de aprovada.
          </p>
        )}

        {!empresaId && (
          <AvisoDeContexto titulo="Empresa do processo não identificada">
            Sem ela a revisão não pode ser gravada. Selecione a empresa ativa e recarregue.
          </AvisoDeContexto>
        )}
      </section>

      {dados.conflito && (
        <AvisoDeContexto
          titulo={dados.conflito}
          acao={
            <Button type="button" variant="outline" onClick={() => void recarregar()}>
              <RotateCw aria-hidden="true" />
              Recarregar
            </Button>
          }
        >
          Recarregar descarta as alterações desta tela que ainda não foram salvas.
        </AvisoDeContexto>
      )}

      <PremissasDaRevisao
        formulario={formulario.premissas}
        erros={lido.erros}
        indicador={indicador}
        avisoDoIndicador={dados.avisoDoIndicador}
        somenteLeitura={false}
        aoAlterarTexto={alterarTextoDaPremissa}
        aoEscolherFonte={escolherFonte}
        aoEscolherCriterio={escolherCriterio}
        aoTentarNovamente={() => void recarregar()}
      />

      {/* ── Itens ──────────────────────────────────────────────────────── */}
      <SecaoGestao titulo="Itens da versão" contagem={linhas.length}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 sm:max-w-sm sm:flex-1">
            <Label htmlFor={idBusca} className="sr-only">
              Buscar item
            </Label>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id={idBusca}
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por número, produto ou marca"
              className="g-controle h-10 rounded-[var(--g-raio)] pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch id={idSoPendencias} checked={soPendencias} onCheckedChange={setSoPendencias} />
            <Label htmlFor={idSoPendencias} className="g-corpo text-foreground">
              Só pendências
            </Label>
          </div>
        </div>

        <AreaComPainel
          painel={painel}
          tituloPainel={linhaSelecionada ? `Item ${linhaSelecionada.formulario.item.numero}` : 'Item'}
          aoFechar={() => setSelecionado(null)}
        >
          <TabelaGestao
            colunas={colunas}
            itens={visiveis}
            chaveDoItem={(l) => l.formulario.chave}
            aoSelecionar={(l) => setSelecionado(l.formulario.chave)}
            selecionado={(l) => l.formulario.chave === selecionado}
            descricao="Itens da versão da precificação"
            vazio={
              <p className="g-corpo p-6 text-muted-foreground">
                {soPendencias ? 'Nenhum item com pendência.' : 'Nenhum item corresponde à busca.'}
              </p>
            }
            rodape={
              <>
                <span>
                  {visiveis.length === linhas.length ? `${linhas.length} itens` : `${visiveis.length} de ${linhas.length} itens`}
                </span>
                <span className="tabular-nums text-foreground">
                  Total inicial dos autorizados: {formatarCentavos(calculo.totalInicialCentavos)}
                </span>
              </>
            }
          />
          {formulario.premissas.criterio === 'menor_preco_lote' && calculo.lotes.length > 0 && (
            <ul className="g-cartao mt-3 flex flex-col px-4" aria-label="Limites por lote">
              {calculo.lotes.map((l) => (
                <li key={l.lote} className="g-corpo flex flex-wrap justify-between gap-2 border-b border-border/70 py-2.5 last:border-0">
                  <span className="font-medium text-foreground">Lote {l.lote}</span>
                  <span className="tabular-nums text-foreground">
                    Total inicial {formatarCentavos(l.totalInicialCentavos)} · Limite do lote{' '}
                    {l.limiteTotalCentavos != null ? formatarCentavos(l.limiteTotalCentavos) : 'indefinido (há item sem limite)'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AreaComPainel>
      </SecaoGestao>

      <SecaoGestao titulo="Pendências" contagem={calculo.pendencias.length + invalidos}>
        <PainelDePendencias pendencias={calculo.pendencias} erros={lido.erros} aoIrParaItem={irParaItem} />
      </SecaoGestao>

      <SecaoGestao titulo="Histórico de versões" contagem={versoes.length}>
        <HistoricoDeVersoes
          versoes={versoes}
          vigente={vigente}
          atuais={calculo.itens}
          premissasAtuais={lido.premissas}
          compararComVigente={Boolean(vigente && (rascunhoAtual || sujo))}
          nomes={dados.nomes}
        />
      </SecaoGestao>

      {/* ── Ações ──────────────────────────────────────────────────────── */}
      <section
        aria-label="Ações da revisão"
        className="sticky bottom-0 z-10 flex flex-col gap-3 rounded-[var(--g-raio)] border border-border bg-card p-4 shadow-sm"
      >
        {mensagemDaAcao && mensagemDaAcao !== dados.conflito && <AvisoDeFalha>{mensagemDaAcao}</AvisoDeFalha>}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <p className="g-meta text-muted-foreground lg:max-w-md">
            Aprovar limites não envia proposta nem ativa o robô. Disputas em andamento não mudam de limite automaticamente.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
            <AcaoComMotivos
              rotulo="Salvar revisão"
              icone={Save}
              primaria={proximo === 'salvar'}
              motivos={motivosParaSalvar}
              emAndamento={ocupado === 'salvando'}
              bloqueadoPorOutra={ocupado != null && ocupado !== 'salvando'}
              aoClicar={() => void salvar()}
            />
            {!isAdmin && (
              <AcaoComMotivos
                rotulo="Submeter para aprovação"
                icone={Send}
                primaria={proximo === 'submeter'}
                motivos={motivosParaSubmeter}
                emAndamento={ocupado === 'submetendo'}
                bloqueadoPorOutra={ocupado != null && ocupado !== 'submetendo'}
                aoClicar={() => void submeter()}
              />
            )}
            <AcaoComMotivos
              rotulo="Aprovar limites"
              icone={ShieldCheck}
              primaria={proximo === 'aprovar'}
              motivos={motivosParaAprovar}
              emAndamento={ocupado === 'aprovando'}
              bloqueadoPorOutra={ocupado != null && ocupado !== 'aprovando'}
              aoClicar={() => setConfirmando(true)}
            />
          </div>
        </div>
      </section>

      <AlertDialog open={confirmando} onOpenChange={(aberto) => ocupado !== 'aprovando' && setConfirmando(aberto)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar limites da versão {rascunhoAtual?.numero}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="g-corpo flex flex-col gap-2 text-muted-foreground">
                <p>
                  Total inicial dos itens autorizados: {formatarCentavos(calculo.totalInicialCentavos)}.
                  {vigente && mudancasParaConfirmar != null &&
                    ` ${mudancasParaConfirmar === 1 ? '1 mudança' : `${mudancasParaConfirmar} mudanças`} de item em relação à versão ${vigente.numero}.`}
                </p>
                <p>
                  Aprovar limites não envia proposta nem ativa o robô. Disputas em andamento não mudam de limite
                  automaticamente.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={ocupado === 'aprovando'}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={ocupado === 'aprovando'}
              onClick={(e) => {
                // Mantém o diálogo aberto até o servidor responder.
                e.preventDefault();
                void aprovar();
              }}
            >
              {ocupado === 'aprovando' && <Loader2 aria-hidden="true" className="animate-spin" />}
              Confirmar aprovação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
