import type { ReactNode } from 'react';
import { Building2, ExternalLink, FileText, FilePlus2, Link2, ScrollText, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import ListaDeCampos, { BlocoDoPainel, type Campo } from '@/components/gestao/ListaDeCampos';
import SeloSituacao, { ValorIndisponivel, AvisoDeContexto } from '@/components/gestao/SeloSituacao';
import TextoExpansivel from '@/components/gestao/TextoExpansivel';
import { nomeDoOrgao, rotuloDoDocumento } from '@/lib/contratos/rotulos';
import { situacaoDaVigencia, statusEfetivo } from '@/lib/contratos/vigencia';
import {
  AVISO_BASES_DISTINTAS,
  EXPLICA_ATA_ENCERRADA,
  formatarBRL,
  foiApurado,
  situacaoDoDocumento,
} from './formato';

/**
 * PainelDoContrato — o detalhe do registro selecionado na lista, à direita.
 *
 * A composição que o comando de 13/09 fixa para Contratos: selecionar uma
 * linha NÃO tira a pessoa da lista; abre um painel de 384px com o que se
 * precisa saber antes de decidir entrar na pasta. Entrar continua sendo um
 * gesto explícito ("Abrir pasta completa").
 *
 * A regra dura da tela mora aqui: quando o registro é uma ATA SRP, o painel
 * mostra DOIS blocos — o que a ata registrou e o que os contratos derivados
 * dela já comprometeram — separados por um aviso de que as duas bases não se
 * somam. O valor da ata é um teto estimado de fornecimento; o dos derivados é
 * a parte desse teto que virou obrigação. Somar conta o mesmo dinheiro duas
 * vezes.
 *
 * Onde o sistema não apurou o número, o painel diz que não apurou
 * (`ValorIndisponivel`) — nunca `R$ 0,00`. "Total de itens" é o caso típico:
 * ele vive em `contrato_itens`, que esta tela não carrega, e escrever zero ali
 * afirmaria que a ata não tem item nenhum.
 */

export interface RegistroDoPainel {
  id: string;
  numero_contrato: string;
  numero_ata?: string | null;
  objeto: string;
  orgao_contratante: string;
  tipo_documento: 'contrato' | 'ata_srp';
  ata_srp_id: string | null;
  valor_global: number;
  valor_consumido: number;
  saldo_remanescente: number;
  data_inicio: string | null;
  data_fim: string | null;
  status: string;
  permite_carona?: boolean | null;
  uf?: string | null;
  municipio?: string | null;
}

/** 'AAAA-MM-DD' → 'DD/MM/AAAA' sem passar por fuso (o `Date` recua um dia). */
function dataBr(iso: string | null | undefined): string | null {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

function LinkDeContexto({
  icone: Icone,
  children,
  aoClicar,
  titulo,
}: {
  icone: typeof Link2;
  children: ReactNode;
  aoClicar: () => void;
  titulo?: string;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      title={titulo}
      className="g-corpo flex w-full items-center gap-2 rounded-[var(--g-raio)] px-2 py-2 text-left text-primary transition-colors hover:bg-primary-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icone aria-hidden="true" className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <ExternalLink aria-hidden="true" className="h-3.5 w-3.5 shrink-0 opacity-60" />
    </button>
  );
}

interface PainelDoContratoProps {
  registro: RegistroDoPainel;
  /** Derivados da ata, no mesmo recorte de responsável da lista. Vazio fora dela. */
  derivados?: RegistroDoPainel[];
  /** Quantos derivados estão vigentes agora — o fato que sobrevive à ata. */
  derivadosVigentes?: number;
  ataDeOrigem?: RegistroDoPainel | null;
  /** Quem responde pelo registro: seletor para o admin, texto para os demais. */
  responsavel?: ReactNode;
  /** Abre a pasta completa do registro. */
  aoAbrir: () => void;
  /** Abre a pasta já numa aba — 'pedidos', 'contratos-derivados'. */
  aoAbrirNaAba?: (aba: string) => void;
  aoAbrirAtaDeOrigem?: () => void;
  /** Processo licitatório de origem, quando há elo. */
  processo?: { numero: string; aoAbrir: () => void; aoAbrirAnexos: () => void } | null;
}

export default function PainelDoContrato({
  registro,
  derivados = [],
  derivadosVigentes = 0,
  ataDeOrigem,
  responsavel,
  aoAbrir,
  aoAbrirNaAba,
  aoAbrirAtaDeOrigem,
  processo,
}: PainelDoContratoProps) {
  const ehAta = registro.tipo_documento === 'ata_srp';
  const numero = ehAta ? registro.numero_ata || registro.numero_contrato : registro.numero_contrato;
  const chaveSituacao = statusEfetivo(registro.status, registro.data_fim);
  const situacao = situacaoDoDocumento(chaveSituacao);
  const prazo = situacaoDaVigencia(registro.data_fim);
  const ataEncerradaComExecucao = ehAta && chaveSituacao === 'encerrado' && derivadosVigentes > 0;

  const valorApurado = foiApurado(registro.valor_global);
  const consumido = foiApurado(registro.valor_consumido) ? registro.valor_consumido : null;
  const pct = valorApurado && registro.valor_global > 0 && consumido !== null
    ? (consumido / registro.valor_global) * 100
    : null;

  // A soma dos derivados é a base DELES, e só aparece ao lado da base da ata
  // por causa do aviso que as separa — nunca somada a ela.
  const derivadosApurados = derivados.filter((d) => foiApurado(d.valor_global));
  const totalDerivados = derivadosApurados.reduce((s, d) => s + d.valor_global, 0);
  const execucaoGlobal = valorApurado && registro.valor_global > 0
    ? (totalDerivados / registro.valor_global) * 100
    : null;

  const camposIdentificacao: Campo[] = [
    {
      rotulo: 'Órgão',
      valor: (
        <span className="inline-flex items-center gap-1.5">
          <Building2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {nomeDoOrgao(registro.orgao_contratante)}
        </span>
      ),
    },
  ];
  if (registro.uf) {
    camposIdentificacao.push({
      rotulo: 'Local',
      valor: `${registro.uf}${registro.municipio ? ` / ${registro.municipio}` : ''}`,
    });
  }
  camposIdentificacao.push({
    rotulo: 'Objeto',
    valor: <TextoExpansivel texto={registro.objeto} linhas={3} />,
    largo: true,
  });
  if (responsavel) camposIdentificacao.push({ rotulo: 'Responsável', valor: responsavel, largo: true });

  const periodo = (() => {
    const inicio = dataBr(registro.data_inicio);
    const fim = dataBr(registro.data_fim);
    if (inicio && fim) return `${inicio} a ${fim}`;
    if (fim) return `Até ${fim}`;
    if (inicio) return `A partir de ${inicio}`;
    return null;
  })();

  const camposDeVigencia: Campo[] = [
    { rotulo: 'Início', valor: dataBr(registro.data_inicio) ?? <ValorIndisponivel razao="Não informado" /> },
    { rotulo: 'Fim', valor: dataBr(registro.data_fim) ?? <ValorIndisponivel razao="Não informado" /> },
    {
      rotulo: 'Situação',
      valor: (
        <SeloSituacao tom={situacao.tom} icone={situacao.icone}>
          {situacao.rotulo}
        </SeloSituacao>
      ),
    },
  ];
  if (prazo.frase) camposDeVigencia.push({ rotulo: 'Prazo', valor: prazo.frase });

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <p className="g-titulo-secao text-foreground">{rotuloDoDocumento(registro.tipo_documento, numero)}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Dois selos SEPARADOS na ata encerrada: a vigência acabou (não
              admite nova contratação) e a execução dos derivados segue. São
              fatos diferentes, e um selo só fazia a tela negar o outro. */}
          {ataEncerradaComExecucao ? (
            <>
              <SeloSituacao tom="neutro" icone={situacao.icone} explicacao={EXPLICA_ATA_ENCERRADA}>
                Vigência encerrada
              </SeloSituacao>
              <SeloSituacao tom="sucesso" explicacao={EXPLICA_ATA_ENCERRADA}>
                Execução dos derivados ativa — {derivadosVigentes} vigente
                {derivadosVigentes > 1 ? 's' : ''}
              </SeloSituacao>
            </>
          ) : (
            <SeloSituacao tom={situacao.tom} icone={situacao.icone}>
              {ehAta && chaveSituacao === 'encerrado' ? 'Vigência encerrada' : situacao.rotulo}
            </SeloSituacao>
          )}
          {ehAta && registro.permite_carona && <SeloSituacao tom="neutro">Permite carona</SeloSituacao>}
          {registro.ata_srp_id && (
            <SeloSituacao tom="neutro" icone={FilePlus2}>
              Derivado de ATA
            </SeloSituacao>
          )}
        </div>
        <Button type="button" onClick={aoAbrir} className="g-controle w-full">
          Abrir pasta completa
        </Button>
      </header>

      <BlocoDoPainel titulo="Identificação">
        <ListaDeCampos campos={camposIdentificacao} />
      </BlocoDoPainel>

      {ehAta ? (
        <>
          {/* ── As duas bases da ata, e o aviso que as impede de virar uma ── */}
          <BlocoDoPainel titulo="Base da ATA">
            <ListaDeCampos
              campos={[
                {
                  rotulo: 'Valor total estimado',
                  valor: valorApurado ? (
                    formatarBRL(registro.valor_global)
                  ) : (
                    <ValorIndisponivel razao="Valor não informado no cadastro" />
                  ),
                  numerico: true,
                },
                {
                  // Não é zero: é apuração que esta tela não faz. Os itens
                  // vivem em `contrato_itens`, carregada dentro da pasta.
                  rotulo: 'Total de itens',
                  valor: <ValorIndisponivel razao="Apurado na aba Itens/lotes" />,
                },
                { rotulo: 'Vigência', valor: periodo ?? <ValorIndisponivel razao="Sem datas no cadastro" /> },
                {
                  rotulo: 'Situação',
                  valor: (
                    <SeloSituacao
                      tom={ataEncerradaComExecucao ? 'neutro' : situacao.tom}
                      icone={situacao.icone}
                      explicacao={chaveSituacao === 'encerrado' ? EXPLICA_ATA_ENCERRADA : undefined}
                    >
                      {chaveSituacao === 'encerrado' ? 'Vigência encerrada' : situacao.rotulo}
                    </SeloSituacao>
                  ),
                },
              ]}
            />
          </BlocoDoPainel>

          <AvisoDeContexto titulo={AVISO_BASES_DISTINTAS.titulo}>
            {AVISO_BASES_DISTINTAS.texto}
          </AvisoDeContexto>

          <BlocoDoPainel titulo="Valor dos contratos derivados">
            <ListaDeCampos
              campos={[
                {
                  rotulo: 'Valor total',
                  valor:
                    derivados.length === 0 ? (
                      <ValorIndisponivel razao="Nenhum contrato derivado" />
                    ) : derivadosApurados.length === 0 ? (
                      <ValorIndisponivel razao="Nenhum derivado com valor apurado" />
                    ) : (
                      formatarBRL(totalDerivados)
                    ),
                  numerico: true,
                },
                { rotulo: 'Quantidade', valor: derivados.length, numerico: true },
                {
                  rotulo: 'Execução global',
                  valor:
                    execucaoGlobal === null ? (
                      <ValorIndisponivel razao="Sem valor registrado na ATA" />
                    ) : (
                      <span className="inline-flex flex-col items-end gap-1">
                        <span>{execucaoGlobal.toFixed(1).replace('.', ',')}% do registrado</span>
                        <Progress value={Math.min(execucaoGlobal, 100)} className="h-1.5 w-28" />
                      </span>
                    ),
                  numerico: true,
                },
              ]}
            />
            <p className="g-meta text-muted-foreground">
              Base: soma do valor global dos contratos derivados desta ata, no recorte de
              responsável da lista.
            </p>
          </BlocoDoPainel>
        </>
      ) : (
        <>
          <BlocoDoPainel titulo="Vigência">
            <ListaDeCampos campos={camposDeVigencia} />
          </BlocoDoPainel>

          <BlocoDoPainel titulo="Valores">
            <ListaDeCampos
              campos={[
                {
                  rotulo: 'Valor global',
                  valor: valorApurado ? (
                    formatarBRL(registro.valor_global)
                  ) : (
                    <ValorIndisponivel razao="Valor não informado no cadastro" />
                  ),
                  numerico: true,
                },
                {
                  rotulo: 'Consumido',
                  valor:
                    consumido === null ? (
                      <ValorIndisponivel razao="Consumo não apurado" />
                    ) : (
                      formatarBRL(consumido)
                    ),
                  numerico: true,
                },
                {
                  rotulo: 'Saldo remanescente',
                  valor: foiApurado(registro.saldo_remanescente) ? (
                    formatarBRL(registro.saldo_remanescente)
                  ) : (
                    <ValorIndisponivel razao="Saldo não apurado" />
                  ),
                  numerico: true,
                },
                {
                  rotulo: 'Execução',
                  valor:
                    pct === null ? (
                      <ValorIndisponivel razao="Sem valor global apurado" />
                    ) : (
                      <span className="inline-flex flex-col items-end gap-1">
                        <span>{pct.toFixed(1).replace('.', ',')}% consumido</span>
                        <Progress value={Math.min(pct, 100)} className="h-1.5 w-28" />
                      </span>
                    ),
                  numerico: true,
                },
              ]}
            />
            <p className="g-meta text-muted-foreground">
              Base: valor global do contrato e saldo calculado pelo próprio contrato — a ata
              de origem tem base própria.
            </p>
          </BlocoDoPainel>
        </>
      )}

      {(ataDeOrigem || processo || aoAbrirNaAba) && (
        <BlocoDoPainel titulo="Contexto">
          <div className="flex flex-col">
            {ataDeOrigem && aoAbrirAtaDeOrigem && (
              <LinkDeContexto icone={ScrollText} aoClicar={aoAbrirAtaDeOrigem} titulo="Abrir a ATA SRP de origem">
                ATA de origem — {ataDeOrigem.numero_ata || ataDeOrigem.numero_contrato}
              </LinkDeContexto>
            )}
            {aoAbrirNaAba && !ehAta && (
              <LinkDeContexto icone={ShoppingCart} aoClicar={() => aoAbrirNaAba('pedidos')}>
                Pedidos vinculados
              </LinkDeContexto>
            )}
            {aoAbrirNaAba && ehAta && derivados.length > 0 && (
              <LinkDeContexto icone={FilePlus2} aoClicar={() => aoAbrirNaAba('contratos-derivados')}>
                Contratos derivados ({derivados.length})
              </LinkDeContexto>
            )}
            {processo && (
              <>
                <LinkDeContexto icone={Link2} aoClicar={processo.aoAbrir} titulo="Abrir a pasta do processo de origem">
                  Processo {processo.numero}
                </LinkDeContexto>
                <LinkDeContexto
                  icone={FileText}
                  aoClicar={processo.aoAbrirAnexos}
                  titulo="Edital, Termo de Referência e demais anexos do certame"
                >
                  Edital e anexos
                </LinkDeContexto>
              </>
            )}
          </div>
        </BlocoDoPainel>
      )}
    </div>
  );
}
