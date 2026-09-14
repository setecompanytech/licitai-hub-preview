import { useId } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import ListaDeCampos, { BlocoDoPainel } from '@/components/gestao/ListaDeCampos';
import { ValorIndisponivel } from '@/components/gestao/SeloSituacao';
import type { ItemCalculado, ItemDePrecificacao, PremissasDaVersao } from '@/lib/precificacao/versao';
import CampoDoFormulario from './CampoDoFormulario';
import MemoriaDeCalculo from './MemoriaDeCalculo';
import { lerNumero, formatarCentavos, formatarReais, dataCurta } from './formato';
import type { CampoNumerico, ErroDoFormulario, FormularioDoItem } from './estadoDaRevisao';

/**
 * O item aberto: o que se edita e, logo abaixo, o caminho do cálculo.
 *
 * Mora dentro do painel de `AreaComPainel` — coluna ao lado da tabela em tela
 * larga, gaveta no celular. Assim a edição nunca espreme uma tabela de sete
 * colunas em 390px.
 *
 * O limite nunca nasce preenchido. Antes de 14/09 o piso do robô vinha
 * pré-preenchido com o CUSTO — e custo como piso é vender com prejuízo, porque
 * tributo e despesa saem do preço.
 */
export default function DetalheDoItem({
  formulario,
  calculado,
  premissas,
  erros,
  somenteLeitura,
  aoAlterarTexto,
  aoAlterarItem,
}: {
  formulario: FormularioDoItem;
  calculado: ItemCalculado | null;
  premissas: PremissasDaVersao;
  erros: ErroDoFormulario[];
  somenteLeitura: boolean;
  aoAlterarTexto: (campo: CampoNumerico, texto: string) => void;
  aoAlterarItem: (parcial: Partial<ItemDePrecificacao>) => void;
}) {
  const idAutorizado = useId();
  const { item, textos } = formulario;
  const erroDe = (campo: string) => erros.find((e) => e.campo === campo)?.mensagem ?? null;

  const numero = (campo: CampoNumerico, rotulo: string, ajuda?: string, placeholder?: string) => {
    // Mostra como o texto foi LIDO: "1.234" é mil duzentos e trinta e quatro
    // em pt-BR, e quem colou de uma planilha em inglês precisa ver isso antes
    // de o número virar limite.
    const leitura = lerNumero(textos[campo]);
    const lidoComo = !leitura.vazio && leitura.valor != null ? `Lido como ${formatarReais(leitura.valor)}.` : null;
    return (
      <CampoDoFormulario
        rotulo={rotulo}
        valor={textos[campo]}
        aoAlterar={(v) => aoAlterarTexto(campo, v)}
        erro={erroDe(campo)}
        ajuda={[ajuda, lidoComo].filter(Boolean).join(' ') || undefined}
        placeholder={placeholder}
        numerico
        desabilitado={somenteLeitura}
      />
    );
  };
  const texto = (campo: keyof ItemDePrecificacao, rotulo: string, tipo: 'text' | 'date' = 'text') => (
    <CampoDoFormulario
      rotulo={rotulo}
      tipo={tipo}
      valor={(item[campo] as string) ?? ''}
      aoAlterar={(v) => aoAlterarItem({ [campo]: v || null } as Partial<ItemDePrecificacao>)}
      erro={erroDe(campo)}
      desabilitado={somenteLeitura}
    />
  );

  // Composição do custo: o que foi digitado, lido — nenhum cálculo novo aqui.
  const custo = lerNumero(textos.custoUnitario).valor;
  const parcela = (campo: CampoNumerico) => lerNumero(textos[campo]).valor;
  const pendenciasDoItem = calculado?.pendencias ?? [];
  const sugerido = calculado?.precoSugeridoCentavos ?? null;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <p className="g-meta text-muted-foreground">
          Item {item.numero}
          {item.lote && item.lote !== 'Único' ? ` · Lote ${item.lote}` : ''}
        </p>
        <p className="g-corpo font-medium text-foreground">{item.descricao}</p>
        <p className="g-meta text-muted-foreground">
          {Number(item.quantidade).toLocaleString('pt-BR')} {item.unidade} · Estimado do órgão:{' '}
          {item.valorEstimadoOrgao ? formatarReais(item.valorEstimadoOrgao) : 'não informado'}
        </p>
      </header>

      {pendenciasDoItem.length > 0 && (
        <ul className="flex flex-col gap-1" aria-label="Pendências do item">
          {pendenciasDoItem.map((p, i) => (
            <li
              key={`${p.codigo}-${i}`}
              className={
                p.gravidade === 'bloqueia' ? 'g-meta text-destructive-ink' : 'g-meta text-warning-ink'
              }
            >
              <span className="font-semibold">{p.gravidade === 'bloqueia' ? 'Bloqueia: ' : 'Aviso: '}</span>
              {p.mensagem}
            </li>
          ))}
        </ul>
      )}

      <BlocoDoPainel titulo="Preço e limite">
        <div className="grid gap-3">
          {numero(
            'precoInicial',
            'Preço inicial (por unidade)',
            'Em branco, usa o preço sugerido pelo cálculo.',
            sugerido != null ? `Sugerido: ${formatarCentavos(sugerido)}` : undefined,
          )}
          {numero('limite', 'Limite autorizado (por unidade)', 'Menor preço que o robô pode ofertar. Não é preenchido com o custo.')}
          <div className="flex items-center justify-between gap-3 rounded-[var(--g-raio)] border border-border px-3 py-2">
            <Label htmlFor={idAutorizado} className="g-corpo text-foreground">
              Autorizado para disputa nesta versão
            </Label>
            <Switch
              id={idAutorizado}
              checked={item.autorizado !== false}
              onCheckedChange={(v) => aoAlterarItem({ autorizado: v })}
              disabled={somenteLeitura}
            />
          </div>
        </div>
      </BlocoDoPainel>

      <BlocoDoPainel titulo="Custo e cotação">
        <div className="grid gap-3 sm:grid-cols-2">
          {numero('custoUnitario', 'Custo unitário', 'Até 4 casas decimais.')}
          {numero('freteUnitario', 'Frete unitário')}
          {numero('seguroUnitario', 'Seguro unitário')}
          {numero('outrasDespesasUnitario', 'Outras despesas')}
        </div>
        <div className="grid gap-3">
          {texto('fornecedor', 'Fornecedor')}
          {texto('cotacaoReferencia', 'Referência da cotação')}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {texto('cotacaoData', 'Data da cotação', 'date')}
          {texto('cotacaoValidade', 'Validade da cotação', 'date')}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {texto('marca', 'Marca')}
          {texto('fabricante', 'Fabricante')}
          {texto('modelo', 'Modelo')}
        </div>
      </BlocoDoPainel>

      <BlocoDoPainel titulo="Composição do custo">
        <ListaDeCampos
          campos={[
            {
              rotulo: 'Custo de aquisição',
              valor: custo != null && custo > 0 ? formatarReais(custo) : <ValorIndisponivel razao="Não cotado" />,
              numerico: true,
            },
            { rotulo: 'Frete unitário', valor: formatarReais(parcela('freteUnitario') ?? 0), numerico: true },
            { rotulo: 'Seguro unitário', valor: formatarReais(parcela('seguroUnitario') ?? 0), numerico: true },
            { rotulo: 'Outras despesas unitárias', valor: formatarReais(parcela('outrasDespesasUnitario') ?? 0), numerico: true },
            {
              rotulo: 'Total antes das despesas sobre venda',
              valor: calculado?.custoBase != null ? formatarReais(calculado.custoBase) : '—',
              numerico: true,
            },
            ...(item.fornecedor || item.cotacaoData
              ? [
                  {
                    rotulo: 'Cotação',
                    valor: [item.fornecedor, item.cotacaoData ? `de ${dataCurta(item.cotacaoData)}` : null, item.cotacaoValidade ? `válida até ${dataCurta(item.cotacaoValidade)}` : null]
                      .filter(Boolean)
                      .join(' · '),
                    largo: true,
                  },
                ]
              : []),
          ]}
        />
      </BlocoDoPainel>

      <MemoriaDeCalculo linhas={calculado?.memoria ?? []} origem={premissas.origem} />
    </div>
  );
}
