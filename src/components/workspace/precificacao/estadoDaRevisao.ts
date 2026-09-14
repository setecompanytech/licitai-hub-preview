/**
 * O formulário da revisão — o que a pessoa digitou, antes de virar número.
 *
 * Por que texto e não número: "12," no meio da digitação não é número, e um
 * campo controlado por `number` apagaria a vírgula a cada tecla. E porque
 * campo em branco é informação: custo em branco é "não cotado", margem em
 * branco é "não configurada" — nenhum dos dois é zero, e o cálculo trata os
 * dois como pendência que bloqueia.
 *
 * Tudo aqui é puro: o componente guarda o formulário em estado, e
 * `lerFormulario` o traduz, a cada render, para o que `calcularVersao` recebe.
 */
import type { CamadasPreco } from '@/lib/precificacao/formacao-preco';
import {
  chaveDoItem,
  type CriterioDeDisputa,
  type FonteDaPremissa,
  type ItemDePrecificacao,
  type OrigemDaPremissa,
  type PremissasDaVersao,
} from '@/lib/precificacao/versao';
import type { IndicadorAdotado } from '@/hooks/usePrecificacaoVersoes';
import { lerNumero, numeroParaCampo, ORDEM_DAS_CAMADAS, ROTULO_DA_CAMADA } from './formato';

export type CampoNumerico =
  | 'custoUnitario'
  | 'freteUnitario'
  | 'seguroUnitario'
  | 'outrasDespesasUnitario'
  | 'precoInicial'
  | 'limite';

export const CAMPOS_NUMERICOS: CampoNumerico[] = [
  'custoUnitario',
  'freteUnitario',
  'seguroUnitario',
  'outrasDespesasUnitario',
  'precoInicial',
  'limite',
];

export const ROTULO_DO_CAMPO: Record<CampoNumerico, string> = {
  custoUnitario: 'Custo unitário',
  freteUnitario: 'Frete unitário',
  seguroUnitario: 'Seguro unitário',
  outrasDespesasUnitario: 'Outras despesas unitárias',
  precoInicial: 'Preço inicial',
  limite: 'Limite autorizado',
};

export interface FormularioDoItem {
  /** Identidade do item nesta sessão de edição (id estável; na falta, lote + número). */
  chave: string;
  /** Campos não numéricos. Os numéricos ficam nulos aqui e moram em `textos`. */
  item: ItemDePrecificacao;
  textos: Record<CampoNumerico, string>;
}

export interface FormularioDasPremissas {
  textos: Record<keyof CamadasPreco, string>;
  origem: Record<keyof CamadasPreco, OrigemDaPremissa>;
  criterio: CriterioDeDisputa;
}

export interface FormularioDaRevisao {
  premissas: FormularioDasPremissas;
  itens: FormularioDoItem[];
}

export interface ErroDoFormulario {
  /** `premissa:<camada>`, `<campo numérico>` ou `cotacaoValidade`. */
  campo: string;
  mensagem: string;
  chave?: string;
  numero?: number;
}

export function formularioDasPremissas(p: PremissasDaVersao): FormularioDasPremissas {
  const textos = {} as Record<keyof CamadasPreco, string>;
  const origem = {} as Record<keyof CamadasPreco, OrigemDaPremissa>;
  ORDEM_DAS_CAMADAS.forEach((k) => {
    const o = p.origem?.[k] ?? { fonte: 'nao_configurado' as const };
    origem[k] = { ...o };
    // Camada não configurada começa em branco mesmo que a linha traga um 0:
    // mostrar "0" ali seria afirmar uma política que ninguém escolheu.
    textos[k] = o.fonte === 'nao_configurado' ? '' : numeroParaCampo(p.camadas?.[k]);
  });
  return { textos, origem, criterio: p.criterio ?? 'nao_informado' };
}

export function formularioDaRevisao(itens: ItemDePrecificacao[], premissas: PremissasDaVersao): FormularioDaRevisao {
  const vistas = new Set<string>();
  return {
    premissas: formularioDasPremissas(premissas),
    itens: itens.map((item) => {
      let chave = chaveDoItem(item);
      // Duas linhas legadas sem id com o mesmo lote e número não podem dividir
      // a chave: editar uma editaria as duas.
      while (vistas.has(chave)) chave = `${chave}~`;
      vistas.add(chave);
      const textos = {} as Record<CampoNumerico, string>;
      const semNumeros: ItemDePrecificacao = { ...item };
      CAMPOS_NUMERICOS.forEach((c) => {
        textos[c] = numeroParaCampo(item[c] as number | null | undefined);
        semNumeros[c] = null;
      });
      return { chave, item: semNumeros, textos };
    }),
  };
}

/** Assinatura para "há alterações não salvas?" — comparação por conteúdo. */
export function assinatura(f: FormularioDaRevisao | null): string {
  return f ? JSON.stringify(f) : '';
}

/**
 * Formulário → entrada do cálculo, com os erros de digitação à parte.
 * Campo inválido entra no cálculo como ausente (e aparece como erro): nunca
 * como o último número válido, que a pessoa já não vê na tela.
 */
export function lerFormulario(f: FormularioDaRevisao): {
  itens: ItemDePrecificacao[];
  premissas: PremissasDaVersao;
  erros: ErroDoFormulario[];
} {
  const erros: ErroDoFormulario[] = [];

  const camadas = {} as CamadasPreco;
  const origem = {} as Record<keyof CamadasPreco, OrigemDaPremissa>;
  ORDEM_DAS_CAMADAS.forEach((k) => {
    const leitura = lerNumero(f.premissas.textos[k], { minimo: 0, maximo: 100 });
    if (leitura.erro) {
      erros.push({
        campo: `premissa:${k}`,
        mensagem: `${ROTULO_DA_CAMADA[k]}: informe um percentual entre 0 e 100, com vírgula decimal.`,
      });
    }
    const utilizavel = !leitura.vazio && !leitura.erro;
    camadas[k] = (utilizavel ? leitura.valor : null) as number;
    const atual = f.premissas.origem[k];
    origem[k] = !utilizavel
      ? { fonte: 'nao_configurado' }
      : atual?.fonte && atual.fonte !== 'nao_configurado'
        ? atual
        : { fonte: 'informado_pelo_usuario' };
  });

  const itens = f.itens.map(({ chave, item, textos }) => {
    const lido: ItemDePrecificacao = { ...item };
    CAMPOS_NUMERICOS.forEach((c) => {
      const leitura = lerNumero(textos[c], { minimo: 0 });
      if (leitura.erro) {
        erros.push({ campo: c, chave, numero: item.numero, mensagem: `${ROTULO_DO_CAMPO[c]}: ${leitura.erro}` });
      }
      lido[c] = leitura.erro ? null : leitura.valor;
    });
    if (item.cotacaoData && item.cotacaoValidade && item.cotacaoValidade < item.cotacaoData) {
      erros.push({
        campo: 'cotacaoValidade',
        chave,
        numero: item.numero,
        mensagem: 'Validade da cotação anterior à data da cotação.',
      });
    }
    return lido;
  });

  return { itens, premissas: { camadas, origem, criterio: f.premissas.criterio }, erros };
}

// ── Transições ──────────────────────────────────────────────────────────────

/**
 * Digitar numa premissa é informá-la. Se ela vinha do Financeiro, deixa de
 * vir: o número na tela já não é o do indicador, e a origem gravada não pode
 * dizer que é.
 */
export function comTextoDaPremissa(
  p: FormularioDasPremissas,
  k: keyof CamadasPreco,
  texto: string,
): FormularioDasPremissas {
  const origem: OrigemDaPremissa = texto.trim() ? { fonte: 'informado_pelo_usuario' } : { fonte: 'nao_configurado' };
  return { ...p, textos: { ...p.textos, [k]: texto }, origem: { ...p.origem, [k]: origem } };
}

export function comFonteDaPremissa(
  p: FormularioDasPremissas,
  k: keyof CamadasPreco,
  fonte: FonteDaPremissa,
  indicador: IndicadorAdotado | null,
): FormularioDasPremissas {
  if (fonte === 'indicadores_financeiro') {
    if (k !== 'pctDespesasAdmin' || indicador?.pctDespesaAdministrativa == null) return p;
    return {
      ...p,
      textos: { ...p.textos, [k]: numeroParaCampo(indicador.pctDespesaAdministrativa) },
      origem: { ...p.origem, [k]: { fonte, referencia: indicador.id, periodo: indicador.periodo } },
    };
  }
  if (fonte === 'nao_configurado') {
    return { ...p, textos: { ...p.textos, [k]: '' }, origem: { ...p.origem, [k]: { fonte } } };
  }
  return { ...p, origem: { ...p.origem, [k]: { fonte } } };
}

/** Origens oferecidas para a camada — só as que têm de onde vir. */
export function fontesDisponiveis(
  k: keyof CamadasPreco,
  atual: OrigemDaPremissa | undefined,
  indicador: IndicadorAdotado | null,
): FonteDaPremissa[] {
  const fontes: FonteDaPremissa[] = ['informado_pelo_usuario', 'nao_configurado'];
  if ((k === 'pctDespesasAdmin' && indicador?.pctDespesaAdministrativa != null) || atual?.fonte === 'indicadores_financeiro') {
    fontes.unshift('indicadores_financeiro');
  }
  // Nenhuma leitura automática produz esta origem hoje; ela só aparece se
  // uma versão gravada a trouxer, para não sumir da tela.
  if (atual?.fonte === 'configuracao_tributaria') fontes.unshift('configuracao_tributaria');
  return fontes;
}

export function comTextoDoItem(
  f: FormularioDaRevisao,
  chave: string,
  campo: CampoNumerico,
  texto: string,
): FormularioDaRevisao {
  return {
    ...f,
    itens: f.itens.map((i) => (i.chave === chave ? { ...i, textos: { ...i.textos, [campo]: texto } } : i)),
  };
}

export function comItemAlterado(
  f: FormularioDaRevisao,
  chave: string,
  parcial: Partial<ItemDePrecificacao>,
): FormularioDaRevisao {
  return {
    ...f,
    itens: f.itens.map((i) => (i.chave === chave ? { ...i, item: { ...i.item, ...parcial } } : i)),
  };
}
