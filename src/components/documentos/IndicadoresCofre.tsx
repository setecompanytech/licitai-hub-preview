import { AlertTriangle, CheckCircle2, FileX, HelpCircle, ShieldCheck } from 'lucide-react';
import FaixaIndicadores, { type Indicador } from '@/components/gestao/FaixaIndicadores';
import { DIAS_DE_ANTECEDENCIA } from '@/lib/documentos/situacao';
import type { ContagemDoCofre, FiltroSituacao } from './item-do-cofre';

interface Props {
  contagem: ContagemDoCofre;
  filtro: FiltroSituacao;
  aoFiltrar: (filtro: FiltroSituacao) => void;
  /**
   * Por que não há número para mostrar. Preenchido, os indicadores viram "—"
   * com a razão em vez de zero — a distinção entre "apurei e deu zero" e "não
   * apurei" é regra do comando, e aqui ela tem um caso real: o modo "Todas as
   * empresas", em que o cofre não pertence a ninguém em particular.
   */
  indisponivel?: string;
}

export default function IndicadoresCofre({ contagem, filtro, aoFiltrar, indisponivel }: Props) {
  const { previstos, regulares, vencendo, vencidos, ausentes, semValidade } = contagem;

  // Alternar: clicar no indicador já ativo devolve a lista inteira. Sem isso,
  // o único jeito de sair do filtro seria achar o "Limpar" da barra.
  const alternar = (alvo: FiltroSituacao) => () => aoFiltrar(filtro === alvo ? 'todas' : alvo);

  const valor = (n: number) => (indisponivel ? null : n);

  const itens: Indicador[] = [
    {
      rotulo: 'Itens previstos',
      valor: valor(previstos),
      razaoIndisponivel: indisponivel,
      icone: ShieldCheck,
      // O número NÃO é literal: sai de `VAGAS_PREVISTAS.length`. Escrever "18"
      // aqui congelaria a tela na lei de hoje — a lista muda quando a exigência
      // muda, e o indicador tem de mudar junto.
      detalhe: 'Checklist de habilitação da Lei 14.133/2021',
      aoClicar: () => aoFiltrar('todas'),
      ativo: filtro === 'todas',
    },
    {
      rotulo: 'Regulares',
      valor: valor(regulares),
      razaoIndisponivel: indisponivel,
      icone: CheckCircle2,
      tom: 'ok',
      /* A exigência literal do comando: "a vencer" É subconjunto de "regular",
         e a tela tem de dizer isso. Quem lê "Regulares: 9" precisa poder
         descobrir que 2 daqueles 9 vencem este mês — sem que os 2 sejam
         somados de novo em lugar nenhum. */
      detalhe: indisponivel
        ? undefined
        : vencendo > 0
          ? `${vencendo} ${vencendo === 1 ? 'vence' : 'vencem'} nos próximos ${DIAS_DE_ANTECEDENCIA} dias (já contados aqui)`
          : `Nenhum vence nos próximos ${DIAS_DE_ANTECEDENCIA} dias`,
      aoClicar: alternar('regulares'),
      ativo: filtro === 'regulares',
    },
    {
      rotulo: 'Vencidos',
      valor: valor(vencidos),
      razaoIndisponivel: indisponivel,
      icone: AlertTriangle,
      tom: vencidos > 0 ? 'critico' : 'neutro',
      detalhe: indisponivel
        ? undefined
        : vencidos > 0
          ? 'Impedem a habilitação hoje'
          : 'Nenhum documento fora do prazo',
      aoClicar: alternar('vencido'),
      ativo: filtro === 'vencido',
    },
    {
      rotulo: 'Ausentes',
      valor: valor(ausentes),
      razaoIndisponivel: indisponivel,
      icone: FileX,
      tom: ausentes > 0 ? 'aviso' : 'neutro',
      detalhe: indisponivel ? undefined : 'Vaga do checklist sem arquivo anexado',
      aoClicar: alternar('ausente'),
      ativo: filtro === 'ausente',
    },
    {
      /* QUINTO INDICADOR, e não uma linha de aviso — a decisão está justificada
         no cabeçalho de `Documentos.tsx`. Em resumo: sem ele a soma dos quatro
         primeiros não fecha com "previstos", e um aviso em texto não dá o que
         os outros quatro dão — o clique que leva à lista dos afetados. */
      rotulo: 'Validade não informada',
      valor: valor(semValidade),
      razaoIndisponivel: indisponivel,
      icone: HelpCircle,
      tom: semValidade > 0 ? 'aviso' : 'neutro',
      detalhe: indisponivel
        ? undefined
        : semValidade > 0
          ? 'Vence por natureza e está sem data — não conta como regular'
          : 'Toda certidão anexada tem data',
      aoClicar: alternar('sem_validade'),
      ativo: filtro === 'sem_validade',
    },
  ];

  return <FaixaIndicadores itens={itens} />;
}

/**
 * Conformidade documental — o percentual, com a composição na tela.
 *
 * O comando é explícito nos dois pontos, e os dois nasceram de defeitos reais:
 *
 *  1. EXPLICAR A COMPOSIÇÃO. O número era `ok / 18` com "sem validade" dentro
 *     de `ok`, e ninguém tinha como saber disso olhando "72%".
 *  2. NÃO APRESENTAR COMO GARANTIA DE HABILITAÇÃO. O percentual conta arquivos
 *     e prazos; não lê o conteúdo do PDF, não sabe se a certidão é da filial
 *     certa e não conhece a exigência específica do edital.
 *
 * A barra segmentada foi preservada da tela anterior — a leitura instantânea de
 * "o que falta" vale mais que o número —, mas agora com QUATRO faixas, os
 * quatro baldes disjuntos. Antes eram três, e o quarto (sem validade) estava
 * escondido dentro do verde.
 */
export function ConformidadeDocumental({
  contagem,
  indisponivel,
}: {
  contagem: ContagemDoCofre;
  indisponivel?: string;
}) {
  const { previstos, regulares, vencendo, vencidos, ausentes, semValidade } = contagem;
  const base = previstos || 1;
  const pct = Math.round((regulares / base) * 100);

  // A tinta de cada faixa é a MESMA do selo da linha (APRESENTACAO_DA_SITUACAO),
  // senão a barra e o selo contariam a mesma pendência com cores diferentes.
  // `sem validade` fica no cinza-azulado de `info` porque não é acusação: é
  // "não sei", o mesmo tom do selo `indisponivel`.
  const faixas = [
    { chave: 'regulares', n: regulares, cor: 'bg-success', rotulo: 'Regulares' },
    { chave: 'vencidos', n: vencidos, cor: 'bg-destructive', rotulo: 'Vencidos' },
    { chave: 'ausentes', n: ausentes, cor: 'bg-warning', rotulo: 'Ausentes' },
    { chave: 'sem_validade', n: semValidade, cor: 'bg-info', rotulo: 'Validade não informada' },
  ];

  // Verde só ganha o direito de dizer "pode ir" quando nada impede: 90% com uma
  // certidão vencida é inabilitação, e o número não pode parecer bom.
  const tomDoNumero = vencidos > 0
    ? 'text-destructive-ink'
    : ausentes + semValidade > 0
      ? 'text-warning-ink'
      : 'text-success-ink';

  if (indisponivel) {
    return (
      <section className="g-cartao flex flex-col gap-1 p-4">
        <h2 className="g-titulo-secao text-foreground">Conformidade documental</h2>
        <p className="g-corpo text-muted-foreground">{indisponivel}</p>
      </section>
    );
  }

  return (
    <section className="g-cartao flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="g-titulo-secao text-foreground">Conformidade documental</h2>
          <p className={`mt-1 text-[1.875rem] font-semibold leading-9 tabular-nums ${tomDoNumero}`}>
            {pct}%
          </p>
        </div>
        <p className="g-corpo min-w-0 text-muted-foreground sm:text-right">
          {vencidos > 0 ? (
            <span className="font-medium text-destructive-ink">
              {vencidos} {vencidos === 1 ? 'documento vencido' : 'documentos vencidos'} — impedem a habilitação
            </span>
          ) : ausentes + semValidade > 0 ? (
            <>
              {ausentes > 0 && `${ausentes} ${ausentes === 1 ? 'vaga sem arquivo' : 'vagas sem arquivo'}`}
              {ausentes > 0 && semValidade > 0 && ' · '}
              {semValidade > 0 && `${semValidade} sem validade informada`}
            </>
          ) : (
            <span className="font-medium text-success-ink">
              Todas as vagas preenchidas e dentro da validade
            </span>
          )}
        </p>
      </div>

      {/* O vão de 2px entre as faixas é o que separa "duas fatias" de "uma
          fatia com sombra". */}
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted">
        {faixas.filter((f) => f.n > 0).map((f) => (
          <div
            key={f.chave}
            className={`${f.cor} transition-[width] duration-500 motion-reduce:transition-none`}
            style={{ width: `${(f.n / base) * 100}%` }}
            title={`${f.n} ${f.rotulo}`}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {faixas.map((f) => (
          <span key={f.chave} className="g-meta inline-flex items-center gap-1.5 text-muted-foreground">
            <span aria-hidden="true" className={`h-2 w-2 rounded-sm ${f.cor}`} />
            <span className="font-medium tabular-nums text-foreground">{f.n}</span>
            {f.rotulo}
          </span>
        ))}
      </div>

      {/* A COMPOSIÇÃO, por escrito. Exigência do comando e, antes disso, do bom
          senso: percentual sem denominador declarado é um número que ninguém
          pode conferir. */}
      <p className="g-meta text-muted-foreground">
        {regulares} de {previstos} itens previstos estão regulares — inclui os {vencendo} que
        vencem em até {DIAS_DE_ANTECEDENCIA} dias (ainda válidos, contados uma vez só) e os
        documentos sem prazo por natureza. Ficam de fora vencidos, ausentes e os que estão sem
        validade informada.
      </p>
      <p className="g-meta text-warning-ink">
        Não é garantia de habilitação: o cálculo confere arquivo e prazo, não lê o conteúdo do
        documento nem conhece as exigências específicas de cada edital.
      </p>
    </section>
  );
}
