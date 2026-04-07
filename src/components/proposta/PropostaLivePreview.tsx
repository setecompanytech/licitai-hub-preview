import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Building2, User, CreditCard, Scale, Eye } from 'lucide-react';
import { valorPorExtenso } from '@/lib/numero-extenso';
import type { EditalItem } from '@/components/proposta/EditalUploader';

interface LivePreviewProps {
  // Empresa
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
  // Representante
  repNome: string;
  repCpf: string;
  repRg: string;
  repOrgaoExp: string;
  repCargo: string;
  repNaturalidade: string;
  repNacionalidade: string;
  repEstadoCivil: string;
  repEndereco: string;
  // Licitação
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
  // Planilha
  itens: EditalItem[];
  // Declarações
  declaracoesAtivas: string[];
  // Bancário
  banco: string;
  agencia: string;
  conta: string;
  tipoConta: string;
  pix: string;
  // Format
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
    itens, declaracoesAtivas, banco, agencia, conta, tipoConta, pix,
    fontFamily, fontSize, timbradoUrl, usarMarcaDagua,
  } = props;

  const itensValidos = useMemo(() => itens.filter(i => i.descricao.trim()), [itens]);
  const valorGlobal = useMemo(() =>
    itensValidos.reduce((s, i) => s + (parseFloat(i.valorTotal?.replace(',', '.') || '0') || 0), 0),
    [itensValidos]
  );

  const dataAtual = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

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

  return (
    <div
      className="bg-white dark:bg-card rounded-lg shadow-inner border border-border/30 relative overflow-hidden"
      style={{
        fontFamily: `'${fontFamily}', 'Times New Roman', Times, serif`,
        fontSize: `${Math.max(fontSize - 2, 9)}pt`,
        lineHeight: '1.5',
        padding: '24px',
        minHeight: '600px',
      }}
    >
      {/* Marca d'água */}
      {usarMarcaDagua && timbradoUrl && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <img src={timbradoUrl} alt="" className="w-[250px] h-[250px] object-contain opacity-[0.05]" style={{ transform: 'rotate(-25deg)' }} />
        </div>
      )}

      <div className="relative z-10 space-y-4 text-foreground">
        {/* Timbrado */}
        {timbradoUrl && (
          <div className="border-b border-border/30 pb-3 mb-3">
            <img src={timbradoUrl} alt="Timbrado" className="h-12 max-w-[200px] object-contain" />
          </div>
        )}

        {/* Cabeçalho / Endereçamento */}
        {orgao && (
          <div className="text-center space-y-1">
            <p className="font-bold text-xs uppercase tracking-wide">PROPOSTA COMERCIAL</p>
            {numeroLicitacao && <p className="text-[10px] text-muted-foreground">{modalidade} nº {numeroLicitacao}</p>}
            <p className="text-[10px]">Ao {orgao}</p>
          </div>
        )}

        {/* Dados da Empresa */}
        {empresa?.razao_social && (
          <div className="space-y-1">
            <p className="font-bold text-[10px] uppercase tracking-wide border-b border-border/40 pb-0.5 mb-1">
              Identificação do Proponente
            </p>
            <div className="text-[9px] space-y-0.5">
              <p><strong>Razão Social:</strong> {empresa.razao_social}</p>
              <p><strong>CNPJ:</strong> {empresa.cnpj}</p>
              {empresa.endereco && <p><strong>Endereço:</strong> {empresa.endereco}{empresa.complemento ? `, ${empresa.complemento}` : ''}{empresa.bairro ? ` - ${empresa.bairro}` : ''}</p>}
              {(empresa.municipio || empresa.uf) && <p><strong>Cidade/UF:</strong> {empresa.municipio}/{empresa.uf}{empresa.cep ? ` · CEP: ${empresa.cep}` : ''}</p>}
              {telefone && <p><strong>Tel:</strong> {telefone}</p>}
              {email && <p><strong>E-mail:</strong> {email}</p>}
              {inscEstadual && <p><strong>IE:</strong> {inscEstadual}</p>}
              {inscMunicipal && <p><strong>IM:</strong> {inscMunicipal}</p>}
            </div>
          </div>
        )}

        {/* Objeto */}
        {objeto && (
          <div className="space-y-1">
            <p className="font-bold text-[10px] uppercase tracking-wide border-b border-border/40 pb-0.5 mb-1">
              Objeto
            </p>
            <p className="text-[9px] text-justify">{objeto}</p>
          </div>
        )}

        {/* Planilha de Preços */}
        {itensValidos.length > 0 && (
          <div className="space-y-1">
            <p className="font-bold text-[10px] uppercase tracking-wide border-b border-border/40 pb-0.5 mb-1">
              Planilha de Preços
            </p>
            <div className="overflow-x-auto rounded border border-border/40">
              <Table>
                <TableHeader>
                  <TableRow className="bg-foreground/90">
                    {['Item', 'Descrição', 'Qtd', 'Un', 'Marca', 'Vlr Unit.', 'Vlr Total'].map(h => (
                      <TableHead key={h} className="font-bold text-background text-[7px] py-1 px-1 text-center whitespace-nowrap">
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itensValidos.map((item, idx) => (
                    <TableRow key={idx} className={idx % 2 === 0 ? 'bg-muted/20' : ''}>
                      <TableCell className="text-[7px] py-0.5 px-1 text-center">{item.item}</TableCell>
                      <TableCell className="text-[7px] py-0.5 px-1 max-w-[120px] truncate">{item.descricao}</TableCell>
                      <TableCell className="text-[7px] py-0.5 px-1 text-center">{item.quantidade}</TableCell>
                      <TableCell className="text-[7px] py-0.5 px-1 text-center">{item.unidade}</TableCell>
                      <TableCell className="text-[7px] py-0.5 px-1 text-center">{item.marca || '-'}</TableCell>
                      <TableCell className="text-[7px] py-0.5 px-1 text-center">R$ {item.valorUnitario}</TableCell>
                      <TableCell className="text-[7px] py-0.5 px-1 text-center">R$ {item.valorTotal}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-[9px] font-bold text-right">
              Valor Global: {formatCurrency(valorGlobal)}
              <span className="text-[8px] font-normal text-muted-foreground block">
                ({valorGlobal > 0 ? valorPorExtenso(valorGlobal) : '...'})
              </span>
            </p>
          </div>
        )}

        {/* Prazos e Condições */}
        {(prazoValidade || prazoPagamento || prazoEntrega || localEntrega) && (
          <div className="space-y-1">
            <p className="font-bold text-[10px] uppercase tracking-wide border-b border-border/40 pb-0.5 mb-1">
              Prazos e Condições
            </p>
            <div className="text-[9px] space-y-0.5">
              {prazoValidade && <p><strong>Validade da Proposta:</strong> {prazoValidade}</p>}
              {prazoPagamento && <p><strong>Pagamento:</strong> {prazoPagamento}</p>}
              {prazoEntrega && <p><strong>Entrega:</strong> {prazoEntrega}</p>}
              {localEntrega && <p><strong>Local:</strong> {localEntrega}</p>}
            </div>
          </div>
        )}

        {/* Declarações */}
        {declaracoesAtivas.length > 0 && (
          <div className="space-y-1">
            <p className="font-bold text-[10px] uppercase tracking-wide border-b border-border/40 pb-0.5 mb-1">
              Declarações
            </p>
            <div className="text-[9px] space-y-0.5">
              {declaracoesAtivas.map((d, i) => (
                <p key={i} className="flex gap-1.5">
                  <span className="text-accent font-bold">✓</span>
                  <span>{d}</span>
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Dados Bancários */}
        {banco && (
          <div className="space-y-1">
            <p className="font-bold text-[10px] uppercase tracking-wide border-b border-border/40 pb-0.5 mb-1">
              Dados Bancários
            </p>
            <div className="text-[9px] space-y-0.5">
              <p><strong>Banco:</strong> {banco}</p>
              {agencia && <p><strong>Agência:</strong> {agencia}</p>}
              {conta && <p><strong>{tipoConta}:</strong> {conta}</p>}
              {pix && <p><strong>PIX:</strong> {pix}</p>}
            </div>
          </div>
        )}

        {/* Representante e Assinatura */}
        {repNome && (
          <div className="space-y-1 pt-2">
            <p className="font-bold text-[10px] uppercase tracking-wide border-b border-border/40 pb-0.5 mb-1">
              Representante Legal
            </p>
            <div className="text-[9px] space-y-0.5">
              <p><strong>Nome:</strong> {repNome}</p>
              {repCpf && <p><strong>CPF:</strong> {repCpf}</p>}
              {repRg && <p><strong>RG:</strong> {repRg}{repOrgaoExp ? ` — ${repOrgaoExp}` : ''}</p>}
              {repCargo && <p><strong>Cargo:</strong> {repCargo}</p>}
            </div>
          </div>
        )}

        {/* Assinatura */}
        <div className="pt-6 text-center space-y-3">
          <p className="text-[9px]">
            {empresa?.municipio || '________'}/{empresa?.uf || '__'}, {dataAtual}
          </p>
          <div className="border-b border-foreground/40 w-48 mx-auto mt-8" />
          <p className="text-[9px] font-bold">{repNome || '(Nome do Representante)'}</p>
          {repCargo && <p className="text-[8px] text-muted-foreground">{repCargo}</p>}
          {empresa?.razao_social && <p className="text-[8px] text-muted-foreground">{empresa.razao_social}</p>}
        </div>
      </div>
    </div>
  );
}
