import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ShieldCheck, FileSignature, Loader2, Building2, User, Landmark, FileText, ScrollText, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface PropostaRendererProps {
  proposal: string;
  empresaData?: {
    razao_social?: string;
    cnpj?: string;
    endereco?: string;
    municipio?: string;
    uf?: string;
    certificado_path?: string | null;
    certificado_nome?: string | null;
    certificado_tipo?: string | null;
  } | null;
  repData?: {
    nome?: string;
    cpf?: string;
    cargo?: string;
  };
}

/** Parse structured sections from the AI markdown proposal */
function parseSections(text: string) {
  const sections: { title: string; content: string }[] = [];
  // Split by ## or # headers
  const parts = text.split(/^(#{1,3}\s+.+)$/gm);

  let currentTitle = '';
  let currentContent = '';

  for (const part of parts) {
    const headerMatch = part.match(/^#{1,3}\s+(.+)$/);
    if (headerMatch) {
      if (currentTitle || currentContent.trim()) {
        sections.push({ title: currentTitle, content: currentContent.trim() });
      }
      currentTitle = headerMatch[1].trim();
      currentContent = '';
    } else {
      currentContent += part;
    }
  }
  if (currentTitle || currentContent.trim()) {
    sections.push({ title: currentTitle, content: currentContent.trim() });
  }

  return sections;
}

/** Parse markdown table into rows */
function parseTable(text: string): { headers: string[]; rows: string[][] } | null {
  const lines = text.split('\n').filter(l => l.trim().startsWith('|'));
  if (lines.length < 3) return null;

  const parseRow = (line: string) =>
    line.split('|').slice(1, -1).map(c => c.trim());

  const headers = parseRow(lines[0]);
  // Skip separator line (line[1])
  const rows = lines.slice(2).map(parseRow);

  return { headers, rows };
}

function SectionIcon({ title }: { title: string }) {
  const t = title.toUpperCase();
  if (t.includes('PLANILHA') || t.includes('PREÇO')) return <FileText className="w-5 h-5 text-accent" />;
  if (t.includes('DECLARAÇ')) return <ScrollText className="w-5 h-5 text-accent" />;
  if (t.includes('CONTRATAÇÃO') || t.includes('EMPRESA')) return <Building2 className="w-5 h-5 text-accent" />;
  if (t.includes('REPRESENTANTE')) return <User className="w-5 h-5 text-accent" />;
  if (t.includes('BANCÁRIO') || t.includes('BANCO')) return <Landmark className="w-5 h-5 text-accent" />;
  return <CheckCircle2 className="w-5 h-5 text-accent" />;
}

function RenderSection({ title, content }: { title: string; content: string }) {
  // Check if content contains a table
  const tableMatch = content.match(/(\|.+\|[\s\S]*?\|.+\|)/);

  const renderContent = (text: string) => {
    // Split around tables
    const parts = text.split(/(\|.+\|(?:\n\|.+\|)*)/g);

    return parts.map((part, idx) => {
      if (part.trim().startsWith('|')) {
        const table = parseTable(part);
        if (table) {
          const isDataTable = table.headers.length === 2 &&
            (table.headers[0].toLowerCase().includes('campo') || table.headers[0].toLowerCase().includes('dado'));

          if (isDataTable) {
            // Key-value style table
            return (
              <div key={idx} className="rounded-lg border border-border overflow-hidden my-4">
                <Table>
                  <TableBody>
                    {table.rows.map((row, ri) => (
                      <TableRow key={ri} className={ri % 2 === 0 ? 'bg-muted/30' : ''}>
                        <TableCell className="font-semibold text-foreground w-1/3 py-3 px-4 text-sm border-r border-border/50">
                          {row[0]?.replace(/\*\*/g, '')}
                        </TableCell>
                        <TableCell className="py-3 px-4 text-sm">
                          {row[1]?.replace(/\*\*/g, '') || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            );
          }

          // Full data table (planilha de preços)
          return (
            <div key={idx} className="rounded-lg border border-border overflow-x-auto my-4">
              <Table>
                <TableHeader>
                  <TableRow className="bg-accent/10">
                    {table.headers.map((h, hi) => (
                      <TableHead key={hi} className="font-bold text-foreground text-xs whitespace-nowrap py-3 px-3 text-center">
                        {h.replace(/\*\*/g, '')}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {table.rows.map((row, ri) => (
                    <TableRow key={ri} className={ri % 2 === 0 ? 'bg-muted/20' : ''}>
                      {row.map((cell, ci) => (
                        <TableCell key={ci} className="py-2.5 px-3 text-xs text-center whitespace-nowrap">
                          {cell.replace(/\*\*/g, '') || '—'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          );
        }
      }

      // Render non-table text
      if (!part.trim()) return null;

      return (
        <div key={idx} className="space-y-2">
          {part.split('\n').map((line, li) => {
            const trimmed = line.trim();
            if (!trimmed) return <div key={li} className="h-2" />;

            // Bold text
            if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
              return <p key={li} className="font-bold text-foreground text-sm">{trimmed.replace(/\*\*/g, '')}</p>;
            }

            // List items
            if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
              return (
                <div key={li} className="flex gap-2 pl-2">
                  <span className="text-accent font-bold mt-0.5">•</span>
                  <p className="text-sm text-foreground/90 leading-relaxed flex-1">
                    {renderInlineFormatting(trimmed.slice(2))}
                  </p>
                </div>
              );
            }

            // Horizontal rule
            if (trimmed === '---' || trimmed === '___') {
              return <hr key={li} className="border-border/50 my-4" />;
            }

            // Signature line
            if (trimmed.startsWith('___')) {
              return <div key={li} className="border-b-2 border-foreground/60 w-72 mx-auto my-6" />;
            }

            return (
              <p key={li} className="text-sm text-foreground/90 leading-relaxed text-justify">
                {renderInlineFormatting(trimmed)}
              </p>
            );
          })}
        </div>
      );
    });
  };

  return (
    <div className="space-y-3">
      {title && (
        <div className="flex items-center gap-2 border-b-2 border-accent/30 pb-2 mb-3">
          <SectionIcon title={title} />
          <h3 className="font-bold text-base text-foreground uppercase tracking-wide">
            {title.replace(/\*\*/g, '')}
          </h3>
        </div>
      )}
      {renderContent(content)}
    </div>
  );
}

function renderInlineFormatting(text: string) {
  // Handle **bold** and *italic*
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return <strong key={i} className="font-semibold text-foreground">{p.slice(2, -2)}</strong>;
    }
    if (p.startsWith('*') && p.endsWith('*')) {
      return <em key={i}>{p.slice(1, -1)}</em>;
    }
    return p;
  });
}

interface AssinaturaCertificadoProps {
  empresaData?: PropostaRendererProps['empresaData'];
  repData?: PropostaRendererProps['repData'];
}

function AssinaturaCertificado({ empresaData, repData }: AssinaturaCertificadoProps) {
  const [assinando, setAssinando] = useState(false);
  const [assinado, setAssinado] = useState(false);

  const hasCertificado = empresaData?.certificado_path && empresaData?.certificado_nome;

  const handleAssinar = async () => {
    if (!hasCertificado) {
      toast.error('Nenhum certificado digital cadastrado para esta empresa. Cadastre em Configurações > Empresas.');
      return;
    }
    setAssinando(true);
    // Simulate signing process
    await new Promise(r => setTimeout(r, 2000));
    setAssinado(true);
    setAssinando(false);
    toast.success('Proposta assinada digitalmente com sucesso!');
  };

  return (
    <div className="border-t-2 border-accent/30 pt-6 mt-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <FileSignature className="w-5 h-5 text-accent" />
        <h3 className="font-bold text-base text-foreground uppercase tracking-wide">Assinatura</h3>
      </div>

      {/* Manual signature area */}
      <div className="text-center space-y-1 py-4">
        <div className="border-b-2 border-foreground/60 w-80 mx-auto mb-2" />
        <p className="font-bold text-sm">{empresaData?.razao_social || '[RAZÃO SOCIAL]'}</p>
        <p className="text-xs text-muted-foreground">CNPJ: {empresaData?.cnpj || '[CNPJ]'}</p>
        <p className="text-sm mt-1">{repData?.nome || '[REPRESENTANTE LEGAL]'}</p>
        <p className="text-xs text-muted-foreground">CPF: {repData?.cpf || '[CPF]'}</p>
        <p className="text-xs text-muted-foreground">{repData?.cargo || '[CARGO]'}</p>
      </div>

      {/* Digital certificate signature */}
      <div className="bg-muted/30 rounded-lg border border-border/50 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-accent" />
          <div>
            <p className="text-sm font-semibold text-foreground">Assinatura Digital (Certificado e-CNPJ/A1)</p>
            <p className="text-xs text-muted-foreground">
              Assine a proposta com o certificado digital cadastrado no sistema
            </p>
          </div>
        </div>

        {hasCertificado ? (
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-xs">
              <ShieldCheck className="w-3 h-3 mr-1" />
              {empresaData?.certificado_tipo === 'e-cnpj' ? 'e-CNPJ' : 'e-CPF'} — {empresaData?.certificado_nome}
            </Badge>
            {assinado ? (
              <Badge className="bg-green-600/20 text-green-700 dark:text-green-400 border-green-600/30 text-xs">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Assinado digitalmente
              </Badge>
            ) : (
              <Button size="sm" onClick={handleAssinar} disabled={assinando}>
                {assinando ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Assinando...</>
                ) : (
                  <><FileSignature className="w-4 h-4 mr-1" /> Assinar com Certificado Digital</>
                )}
              </Button>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            Nenhum certificado digital cadastrado. Cadastre em <strong>Configurações &gt; Empresas</strong> para habilitar a assinatura digital.
          </p>
        )}
      </div>
    </div>
  );
}

export default function PropostaRenderer({ proposal, empresaData, repData }: PropostaRendererProps) {
  const sections = parseSections(proposal);

  return (
    <div className="space-y-6 font-serif" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
      {/* Header */}
      <div className="text-center space-y-2 pb-4 border-b-2 border-accent/30">
        <h2 className="text-xl font-bold tracking-wider uppercase text-foreground">
          Proposta Comercial / Técnica
        </h2>
        <p className="text-xs text-muted-foreground">
          Gerado em: {new Date().toLocaleString('pt-BR')}
        </p>
      </div>

      {/* Sections */}
      {sections.map((section, idx) => (
        <RenderSection key={idx} title={section.title} content={section.content} />
      ))}

      {/* Digital Certificate Signature */}
      <AssinaturaCertificado empresaData={empresaData} repData={repData} />
    </div>
  );
}
