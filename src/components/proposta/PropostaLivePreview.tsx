import { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye } from 'lucide-react';
import { valorPorExtenso } from '@/lib/numero-extenso';
import type { EditalItem } from '@/components/proposta/EditalUploader';

interface LivePreviewProps {
  empresa?: {
    razao_social?: string;
    nome_fantasia?: string | null;
    cnpj?: string;
    cnae_principal?: string | null;
    endereco?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    cep?: string | null;
    municipio?: string | null;
    uf?: string | null;
    regime_tributario?: string | null;
  } | null;
  telefone: string;
  email: string;
  inscEstadual: string;
  inscMunicipal: string;
  repNome: string;
  repCpf: string;
  repRg: string;
  repOrgaoExp: string;
  repCargo: string;
  repNaturalidade: string;
  repNacionalidade: string;
  repEstadoCivil: string;
  repEndereco: string;
  numeroLicitacao: string;
  orgao: string;
  modalidade: string;
  objeto: string;
  valorEstimado: string;
  prazoValidade: string;
  prazoPagamento: string;
  prazoEntrega: string;
  localEntrega: string;
  garantia?: string;
  condicoesEntrega?: string;
  liquidacaoNfe?: string;
  itens: EditalItem[];
  declaracoesAtivas: string[];
  banco: string;
  agencia: string;
  conta: string;
  tipoConta: string;
  pix: string;
  fontFamily: string;
  fontSize: number;
  timbradoUrl: string | null;
  usarMarcaDagua: boolean;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function PropostaLivePreview(props: LivePreviewProps) {
  const {
    empresa, telefone, email, inscEstadual, inscMunicipal,
    repNome, repCpf, repRg, repOrgaoExp, repCargo, repNaturalidade, repNacionalidade, repEstadoCivil, repEndereco,
    numeroLicitacao, orgao, modalidade, objeto, valorEstimado, prazoValidade, prazoPagamento, prazoEntrega, localEntrega,
    garantia, condicoesEntrega, liquidacaoNfe,
    itens, declaracoesAtivas, banco, agencia, conta, tipoConta, pix,
    fontFamily, fontSize, timbradoUrl, usarMarcaDagua,
  } = props;

  const itensValidos = useMemo(() => itens.filter(i => i.descricao.trim()), [itens]);
  const valorGlobal = useMemo(() =>
    itensValidos.reduce((s, i) => s + (parseFloat(i.valorTotal?.replace(',', '.') || '0') || 0), 0),
    [itensValidos]
  );

  const dataAtual = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

  const hasAnyData = orgao || objeto || empresa?.razao_social || repNome || itensValidos.length > 0;

  if (!hasAnyData) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-center">
        <Eye className="w-12 h-12 text-muted-foreground/20 mb-3" />
        <p className="text-sm text-muted-foreground font-medium">Pré-visualização em Tempo Real</p>
        <p className="text-xs text-muted-foreground/70 mt-1 max-w-[200px]">
          Preencha os campos ao lado para visualizar a proposta sendo montada
        </p>
      </div>
    );
  }

  const enderecoCompleto = [
    empresa?.endereco,
    empresa?.complemento,
    empresa?.bairro,
    empresa?.municipio && empresa?.uf ? `${empresa.municipio}/${empresa.uf}` : empresa?.municipio,
    empresa?.cep ? `CEP: ${empresa.cep}` : null,
  ].filter(Boolean).join(', ');

  return (
    <div
      className="bg-white dark:bg-card rounded-lg shadow-inner border border-border/30 relative overflow-hidden"
      style={{
        fontFamily: `'${fontFamily}', Arial, Helvetica, sans-serif`,
        fontSize: `${Math.max(fontSize - 2, 9)}pt`,
        lineHeight: '1.6',
        padding: '24px',
        minHeight: '600px',
        color: '#000',
      }}
    >
      {/* Marca d'água */}
      {usarMarcaDagua && timbradoUrl && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <img src={timbradoUrl} alt="" className="w-[250px] h-[250px] object-contain opacity-[0.05]" style={{ transform: 'rotate(-25deg)' }} />
        </div>
      )}

      <div className="relative z-10 space-y-4">
        {/* ── TIMBRADO ── */}
        {timbradoUrl ? (
          <div className="border-b-2 border-black pb-3 mb-3 text-center">
            <img src={timbradoUrl} alt="Timbrado" className="h-16 max-w-[280px] object-contain mx-auto" />
          </div>
        ) : empresa?.razao_social ? (
          <div className="border-b-2 border-black pb-3 mb-3 text-center">
            <p className="font-black text-sm uppercase tracking-widest">{empresa.razao_social}</p>
            <p className="text-[10px] text-gray-500 mt-1">CNPJ: {empresa.cnpj}</p>
          </div>
        ) : null}

        {/* ── DESTINATÁRIO ── */}
        {orgao && (
          <div className="mb-3" style={{ lineHeight: '1.8' }}>
            <span className="text-lg italic block mb-1">A</span>
            <p className="font-bold text-[10px]">{orgao}</p>
          </div>
        )}

        {/* ── CABEÇALHO DA PROPOSTA ── */}
        <div className="text-center mb-4">
          <span className="font-black text-xs uppercase tracking-wide border-2 border-black px-4 py-1 inline-block">
            PROPOSTA COMERCIAL
          </span>
          {numeroLicitacao && (
            <p className="text-[10px] mt-1.5">
              Ref.: {modalidade || 'Pregão Eletrônico'} Nº {numeroLicitacao}
            </p>
          )}
        </div>

        {/* ── APRESENTAÇÃO ── */}
        {empresa?.razao_social && (
          <div className="text-[9px] text-justify mb-4">
            A empresa <strong>{empresa.razao_social}</strong>, devidamente inscrita no Ministério da Fazenda sob o
            CNPJ nº. <strong>{empresa.cnpj}</strong>{enderecoCompleto ? `, com sede na ${enderecoCompleto}` : ''},
            por intermédio de seu representante legal, infra-assinado, apresenta a seguinte
            <strong> PROPOSTA COMERCIAL:</strong>
          </div>
        )}

        {/* ── TABELA DE ITENS ── */}
        {itensValidos.length > 0 && (
          <div className="space-y-1">
            <div className="overflow-x-auto rounded border border-black">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-800">
                    {['ITEM', 'UNID', 'QTDE', 'ESPECIFICAÇÃO TÉCNICA', 'MARCA', 'VL. UNIT.', 'EXTENSO', 'VL. TOTAL', 'EXTENSO'].map(h => (
                      <TableHead key={h} className="font-bold text-white text-[7px] py-1 px-1 text-center whitespace-nowrap border border-black">
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itensValidos.map((item, idx) => {
                    const vlUnit = parseFloat(item.valorUnitario?.replace(',', '.') || '0') || 0;
                    const vlTotal = parseFloat(item.valorTotal?.replace(',', '.') || '0') || 0;
                    return (
                      <TableRow key={idx}>
                        <TableCell className="text-[7px] py-0.5 px-1 text-center font-bold border border-black">{item.item}</TableCell>
                        <TableCell className="text-[7px] py-0.5 px-1 text-center border border-black">{item.unidade}</TableCell>
                        <TableCell className="text-[7px] py-0.5 px-1 text-center border border-black">{item.quantidade}</TableCell>
                        <TableCell className="text-[7px] py-0.5 px-1 border border-black" style={{ whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: '120px' }}>{item.descricao}</TableCell>
                        <TableCell className="text-[7px] py-0.5 px-1 text-center border border-black">{item.marca || '-'}</TableCell>
                        <TableCell className="text-[7px] py-0.5 px-1 text-right border border-black">R$ {item.valorUnitario}</TableCell>
                        <TableCell className="text-[7px] py-0.5 px-1 text-center italic text-gray-600 border border-black">
                          {vlUnit > 0 ? valorPorExtenso(vlUnit) : '-'}
                        </TableCell>
                        <TableCell className="text-[7px] py-0.5 px-1 text-right font-bold border border-black">R$ {item.valorTotal}</TableCell>
                        <TableCell className="text-[7px] py-0.5 px-1 text-center italic text-gray-600 border border-black">
                          {vlTotal > 0 ? valorPorExtenso(vlTotal) : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {/* Total row */}
                  <TableRow className="bg-gray-100">
                    <TableCell colSpan={7} className="text-[8px] py-1 px-2 text-right font-bold border-2 border-black italic">
                      {valorGlobal > 0 ? valorPorExtenso(valorGlobal) : '...'}
                    </TableCell>
                    <TableCell colSpan={2} className="text-[9px] py-1 px-2 text-center font-bold border-2 border-black">
                      {formatCurrency(valorGlobal)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* ── ENCARGOS ── */}
        {itensValidos.length > 0 && (
          <p className="text-[9px] text-justify">
            Nos valores propostos acima, estão inclusos todos e quaisquer encargos inerentes ao fornecimento do objeto desta proposta, tais como: tributos, taxas, transportes, carregamento, descarregamento, encargos sociais, trabalhistas, frete, seguro, e outros que, direta e indiretamente, incidam sobre o perfeito e integral cumprimento da proposta apresentada.
          </p>
        )}

        {/* ── CONDIÇÕES DE PAGAMENTO ── */}
        {prazoPagamento && (
          <div className="text-[9px]">
            <p className="font-black underline uppercase text-[10px] mb-0.5">Condições de Pagamento:</p>
            <p className="text-justify">{prazoPagamento}</p>
          </div>
        )}

        {/* ── CONDIÇÕES DE ENTREGA ── */}
        {prazoEntrega && (
          <div className="text-[9px]">
            <p className="font-black underline uppercase text-[10px] mb-0.5">Condições de Entrega:</p>
            <p className="text-justify">{prazoEntrega}</p>
          </div>
        )}

        {/* ── LOCAL DE ENTREGA ── */}
        {localEntrega && (
          <div className="text-[9px]">
            <p className="font-black underline uppercase text-[10px] mb-0.5">Local de Entrega:</p>
            <p className="text-justify">{localEntrega}</p>
          </div>
        )}

        {/* ── CONDIÇÕES ESPECIAIS ── */}
        {condicoesEntrega && (
          <div className="text-[9px]">
            <p className="font-black underline uppercase text-[10px] mb-0.5">Condições Especiais:</p>
            <p className="text-justify">{condicoesEntrega}</p>
          </div>
        )}

        {/* ── LIQUIDAÇÃO/NFe ── */}
        {liquidacaoNfe && (
          <div className="text-[9px]">
            <p className="font-black underline uppercase text-[10px] mb-0.5">Liquidação / Nota Fiscal:</p>
            <p className="text-justify">{liquidacaoNfe}</p>
          </div>
        )}

        {/* ── GARANTIA ── */}
        {garantia && (
          <div className="text-[9px]">
            <p className="font-black underline uppercase text-[10px] mb-0.5">Garantia:</p>
            <p className="text-justify">{garantia}</p>
          </div>
        )}

        {/* ── VALIDADE ── */}
        {prazoValidade && (
          <div className="text-[9px]">
            <p className="font-black underline uppercase text-[10px] mb-0.5">Prazo de Validade desta Proposta:</p>
            <p>O prazo de validade da proposta não será inferior a <strong>{prazoValidade}</strong>, a contar da data de sua apresentação.</p>
          </div>
        )}

        {/* ── DECLARAÇÕES LEGAIS ── */}
        {declaracoesAtivas.length > 0 && (
          <div className="space-y-1">
            <p className="font-black underline uppercase text-[10px] mb-0.5">Declarações</p>
            <p className="text-[9px] text-justify mb-1">
              DECLARA-SE que os produtos/serviços constantes desta proposta comercial ofertada atendem
              fielmente as Especificações Técnicas constantes do Termo de Referência – Anexo I do
              respectivo Edital.
            </p>
            <p className="text-[9px] font-bold">DECLARA-SE também:</p>
            <div className="text-[9px] space-y-0.5">
              {declaracoesAtivas.map((d, i) => (
                <p key={i} className="text-justify">
                  <strong>Declaração</strong> {d}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* ── IDENTIFICAÇÃO DA EMPRESA ── */}
        {empresa?.razao_social && (
          <div className="border-t border-gray-400 pt-3 mt-3 text-[9px] space-y-0.5" style={{ lineHeight: '1.8' }}>
            <p><strong>Razão Social:</strong> {empresa.razao_social}. <strong>CNPJ/MF:</strong> {empresa.cnpj}.</p>
            {enderecoCompleto && <p><strong>Endereço:</strong> {enderecoCompleto}.</p>}
            {telefone && <p><strong>Telefone/WhatsApp:</strong> {telefone}</p>}
            {email && <p><strong>E-mail:</strong> {email}</p>}
            {inscEstadual && <p><strong>IE:</strong> {inscEstadual}</p>}
            {inscMunicipal && <p><strong>IM:</strong> {inscMunicipal}</p>}
            {banco && (
              <p>
                <strong>Banco:</strong> {banco}
                {agencia && <> · <strong>Agência:</strong> {agencia}</>}
                {conta && <>. <strong>{tipoConta}:</strong> {conta}.</>}
                {pix && <> <strong>PIX:</strong> {pix}</>}
              </p>
            )}
          </div>
        )}

        {/* ── RESPONSÁVEL ── */}
        {repNome && (
          <div className="text-[9px] mt-3">
            <p className="font-black underline uppercase text-[10px] mb-1">
              Responsável pela Assinatura do Contrato:
            </p>
            <p><strong>Nome:</strong> {repNome}</p>
            {repEstadoCivil && (
              <p>
                <strong>Estado Civil:</strong> {repEstadoCivil}.
                {repCargo && <> <strong>Cargo/Função:</strong> {repCargo}.</>}
              </p>
            )}
            {repCpf && (
              <p>
                <strong>CPF:</strong> {repCpf}
                {repRg && <> · <strong>RG:</strong> {repRg}</>}
                {repOrgaoExp && <> — {repOrgaoExp}</>}
              </p>
            )}
            {repEndereco && <p><strong>Endereço:</strong> {repEndereco}</p>}
          </div>
        )}

        {/* ── ASSINATURA ── */}
        <div className="pt-6 text-right space-y-2">
          <p className="text-[9px] mb-8">
            {empresa?.municipio || '________'}/{empresa?.uf || '__'}, {dataAtual}.
          </p>
          <div className="inline-block text-center border-t border-black pt-1.5 min-w-[200px]">
            <p className="text-[9px] font-bold">{empresa?.razao_social || '(Razão Social)'}</p>
            <p className="text-[8px] text-gray-500">CNPJ: {empresa?.cnpj || ''}</p>
            {repNome && <p className="text-[9px] font-bold mt-1">{repNome}</p>}
            {repCpf && <p className="text-[8px] text-gray-500">CPF: {repCpf}</p>}
            {repCargo && <p className="text-[8px] text-gray-500">{repCargo}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
