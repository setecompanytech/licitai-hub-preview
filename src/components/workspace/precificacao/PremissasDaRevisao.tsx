import { useId } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import SeloSituacao, { AvisoDeFalha } from '@/components/gestao/SeloSituacao';
import { SecaoGestao } from '@/components/gestao/TelaGestao';
import type { CamadasPreco } from '@/lib/precificacao/formacao-preco';
import type { CriterioDeDisputa, FonteDaPremissa } from '@/lib/precificacao/versao';
import type { IndicadorAdotado } from '@/hooks/usePrecificacaoVersoes';
import CampoDoFormulario from './CampoDoFormulario';
import {
  formatPercentual,
  ORDEM_DAS_CAMADAS,
  ROTULO_DA_CAMADA,
  ROTULO_DA_FONTE,
  ROTULO_DO_CRITERIO,
} from './formato';
import { fontesDisponiveis, type ErroDoFormulario, type FormularioDasPremissas } from './estadoDaRevisao';

/**
 * As quatro camadas percentuais da versão e o critério de disputa.
 *
 * Cada percentual mostra DE ONDE veio, porque é isso que quem aprova precisa
 * conferir: "7,20% — indicador adotado, 12 meses até 08/2026" é verificável;
 * "7,20%" solto não é. E nenhum campo nasce com número de padrão: camada sem
 * origem aparece como "Configuração pendente" e trava a aprovação no cálculo.
 */
const CLASSE_DO_SELETOR =
  'g-controle h-10 w-full rounded-[var(--g-raio)] border border-input bg-background px-3 text-foreground ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

const CLASSE_DO_LINK =
  'g-meta rounded font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const CRITERIOS: CriterioDeDisputa[] = ['menor_preco_item', 'menor_preco_lote', 'maior_desconto', 'outro'];

function CartaoDaPremissa({
  camada,
  formulario,
  erro,
  indicador,
  somenteLeitura,
  aoAlterarTexto,
  aoEscolherFonte,
}: {
  camada: keyof CamadasPreco;
  formulario: FormularioDasPremissas;
  erro: string | null;
  indicador: IndicadorAdotado | null;
  somenteLeitura: boolean;
  aoAlterarTexto: (camada: keyof CamadasPreco, texto: string) => void;
  aoEscolherFonte: (camada: keyof CamadasPreco, fonte: FonteDaPremissa) => void;
}) {
  const idOrigem = useId();
  const origem = formulario.origem[camada];
  const texto = formulario.textos[camada];
  const pendente = !origem || origem.fonte === 'nao_configurado' || !texto.trim();
  const fontes = fontesDisponiveis(camada, origem, indicador);
  // Tributo e despesa administrativa são as camadas que o Financeiro sabe (ou
  // deveria saber) responder; operacional e margem são decisão da revisão.
  const temCasaNoFinanceiro = camada === 'pctImpostos' || camada === 'pctDespesasAdmin';
  const haIndicadorMaisNovo =
    camada === 'pctDespesasAdmin' &&
    origem?.fonte === 'indicadores_financeiro' &&
    indicador?.pctDespesaAdministrativa != null &&
    origem.referencia !== indicador.id;

  return (
    <div className="g-cartao flex min-w-0 flex-col gap-3 p-3">
      <CampoDoFormulario
        rotulo={ROTULO_DA_CAMADA[camada]}
        rotuloDoSufixo="percentual de 0 a 100"
        sufixo="%"
        numerico
        valor={texto}
        aoAlterar={(v) => aoAlterarTexto(camada, v)}
        erro={erro}
        desabilitado={somenteLeitura}
      />
      <div className="flex flex-col gap-1">
        <Label htmlFor={idOrigem} className="g-meta text-muted-foreground">
          Origem de {ROTULO_DA_CAMADA[camada].toLowerCase()}
        </Label>
        <select
          id={idOrigem}
          className={CLASSE_DO_SELETOR}
          value={pendente ? 'nao_configurado' : origem.fonte}
          onChange={(e) => aoEscolherFonte(camada, e.target.value as FonteDaPremissa)}
          disabled={somenteLeitura}
        >
          {fontes.map((f) => (
            <option key={f} value={f}>
              {ROTULO_DA_FONTE[f]}
            </option>
          ))}
        </select>
      </div>

      {pendente ? (
        <div className="flex flex-wrap items-center gap-2">
          <SeloSituacao tom="atencao">Configuração pendente</SeloSituacao>
          {temCasaNoFinanceiro && (
            <Link to="/financeiro" className={CLASSE_DO_LINK}>
              Configurar no Financeiro
            </Link>
          )}
        </div>
      ) : origem.fonte === 'indicadores_financeiro' ? (
        <p className="g-meta text-muted-foreground">
          Indicador adotado no Financeiro{origem.periodo ? ` · ${origem.periodo}` : ''}
        </p>
      ) : (
        <p className="g-meta text-muted-foreground">{ROTULO_DA_FONTE[origem.fonte]}</p>
      )}

      {pendente && camada === 'pctImpostos' && (
        <p className="g-meta text-muted-foreground">
          A configuração tributária do Financeiro guarda alíquotas por tributo, não a alíquota efetiva sobre a venda.
          Informe a da empresa.
        </p>
      )}

      {haIndicadorMaisNovo && (
        <div className="flex flex-col items-start gap-2 rounded-[var(--g-raio)] border border-border bg-muted/40 p-2">
          <p className="g-meta text-foreground">
            Há indicador adotado mais recente: {formatPercentual(indicador.pctDespesaAdministrativa)} ({indicador.periodo}).
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => aoEscolherFonte(camada, 'indicadores_financeiro')}
            disabled={somenteLeitura}
          >
            Usar o indicador mais recente
          </Button>
        </div>
      )}
    </div>
  );
}

export default function PremissasDaRevisao({
  formulario,
  erros,
  indicador,
  avisoDoIndicador,
  somenteLeitura,
  aoAlterarTexto,
  aoEscolherFonte,
  aoEscolherCriterio,
  aoTentarNovamente,
}: {
  formulario: FormularioDasPremissas;
  erros: ErroDoFormulario[];
  indicador: IndicadorAdotado | null;
  avisoDoIndicador: string | null;
  somenteLeitura: boolean;
  aoAlterarTexto: (camada: keyof CamadasPreco, texto: string) => void;
  aoEscolherFonte: (camada: keyof CamadasPreco, fonte: FonteDaPremissa) => void;
  aoEscolherCriterio: (criterio: CriterioDeDisputa) => void;
  aoTentarNovamente?: () => void;
}) {
  const idCriterio = useId();
  const idAjudaCriterio = useId();

  return (
    <SecaoGestao titulo="Premissas da versão">
      <p className="g-corpo text-muted-foreground">
        Percentuais sobre o preço de venda (método do divisor). Nenhum valor é preenchido por padrão.
      </p>
      {avisoDoIndicador && <AvisoDeFalha aoTentarNovamente={aoTentarNovamente}>{avisoDoIndicador}</AvisoDeFalha>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ORDEM_DAS_CAMADAS.map((camada) => (
          <CartaoDaPremissa
            key={camada}
            camada={camada}
            formulario={formulario}
            erro={erros.find((e) => e.campo === `premissa:${camada}`)?.mensagem ?? null}
            indicador={indicador}
            somenteLeitura={somenteLeitura}
            aoAlterarTexto={aoAlterarTexto}
            aoEscolherFonte={aoEscolherFonte}
          />
        ))}
      </div>
      <div className="flex max-w-md flex-col gap-1">
        <Label htmlFor={idCriterio} className="g-corpo font-medium text-foreground">
          Critério de disputa
        </Label>
        <select
          id={idCriterio}
          className={CLASSE_DO_SELETOR}
          value={formulario.criterio}
          onChange={(e) => aoEscolherCriterio(e.target.value as CriterioDeDisputa)}
          aria-describedby={idAjudaCriterio}
          disabled={somenteLeitura}
        >
          <option value="nao_informado">Selecione o critério do edital</option>
          {CRITERIOS.map((c) => (
            <option key={c} value={c}>
              {ROTULO_DO_CRITERIO[c]}
            </option>
          ))}
        </select>
        <p id={idAjudaCriterio} className="g-meta text-muted-foreground">
          Decide se o limite vale por item ou pelo total do lote.
        </p>
      </div>
    </SecaoGestao>
  );
}
