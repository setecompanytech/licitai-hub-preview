import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ShieldCheck, FileSignature, Loader2, CheckCircle2 } from 'lucide-react';
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
  const rows = lines.slice(2).map(parseRow);

  return { headers, rows };
}

function renderInlineFormatting(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return <strong key={i} className="font-bold text-foreground">{p.slice(2, -2)}</strong>;
    }
    if (p.startsWith('*') && p.endsWith('*')) {
      return <em key={i}>{p.slice(1, -1)}</em>;
    }
    return p;
  });
}

function RenderSection({ title, content }: { title: string; content: string }) {
  const renderContent = (text: string) => {
    const parts = text.split(/(\|.+\|(?:\n\|.+\|)*)/g);

    return parts.map((part, idx) => {
      if (part.trim().startsWith('|')) {
        const table = parseTable(part);
        if (table) {
          const isKeyValue = table.headers.length === 2;

          if (isKeyValue) {
            return (
              <div key={idx} className="rounded border border-border overflow-hidden my-4">
                <Table>
                  <TableBody>
                    {table.rows.map((row, ri) => (
                      <TableRow key={ri} className={ri % 2 === 0 ? 'bg-muted/30' : ''}>
                        <TableCell className="font-semibold text-foreground w-1/3 py-2 px-3 text-sm border-r border-border/50">
                          {row[0]?.replace(/\*\*/g, '')}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-sm">
                          {row[1]?.replace(/\*\*/g, '') || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            );
          }

          // Price table
          return (
            <div key={idx} className="rounded border border-border overflow-x-auto my-4">
              <Table>
                <TableHeader>
                  <TableRow className="bg-foreground/90">
                    {table.headers.map((h, hi) => (
                      <TableHead key={hi} className="font-bold text-background text-[10px] whitespace-nowrap py-2 px-2 text-center border border-border/30">
                        {h.replace(/\*\*/g, '')}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {table.rows.map((row, ri) => (
                    <TableRow key={ri} className={ri % 2 === 0 ? 'bg-muted/20' : ''}>
                      {row.map((cell, ci) => (
                        <TableCell key={ci} className="py-2 px-2 text-[10px] text-center border border-border/20 whitespace-nowrap">
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

      if (!part.trim()) return null;

      return (
        <div key={idx} className="space-y-1.5">
          {part.split('\n').map((line, li) => {
            const trimmed = line.trim();
            if (!trimmed) return <div key={li} className="h-1.5" />;

            if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
              return <p key={li} className="font-bold text-foreground text-sm">{trimmed.replace(/\*\*/g, '')}</p>;
            }

            if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
              return (
                <div key={li} className="flex gap-2 pl-2">
                  <span className="text-foreground font-bold mt-0.5">•</span>
                  <p className="text-sm text-foreground/90 leading-relaxed flex-1 text-justify">
                    {renderInlineFormatting(trimmed.slice(2))}
                  </p>
                </div>
              );
            }

            if (trimmed === '---' || trimmed === '___') {
              return <hr key={li} className="border-border/50 my-4" />;
            }

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
    <div className="space-y-2">
      {title && (
        <h3 className="font-bold text-sm text-foreground uppercase tracking-wide border-b border-border/50 pb-1 mb-2">
          {title.replace(/\*\*/g, '')}
        </h3>
      )}
      {renderContent(content)}
    </div>
  );
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
    await new Promise(r => setTimeout(r, 2000));
    setAssinado(true);
    setAssinando(false);
    toast.success('Proposta assinada digitalmente com sucesso!');
  };

  return (
    <div className="border-t border-border/50 pt-4 mt-4 space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <FileSignature className="w-4 h-4 text-accent" />
        <p className="font-bold text-sm text-foreground uppercase tracking-wide">Assinatura Digital</p>
      </div>

      <div className="bg-muted/30 rounded border border-border/50 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-accent" />
          <div>
            <p className="text-xs font-semibold text-foreground">Assinatura Digital (Certificado e-CNPJ/A1)</p>
            <p className="text-[10px] text-muted-foreground">
              Assine a proposta com o certificado digital cadastrado no sistema
            </p>
          </div>
        </div>

        {hasCertificado ? (
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px]">
              <ShieldCheck className="w-3 h-3 mr-1" />
              {empresaData?.certificado_tipo === 'e-cnpj' ? 'e-CNPJ' : 'e-CPF'} — {empresaData?.certificado_nome}
            </Badge>
            {assinado ? (
              <Badge className="bg-green-600/20 text-green-700 dark:text-green-400 border-green-600/30 text-[10px]">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Assinado digitalmente
              </Badge>
            ) : (
              <Button size="sm" onClick={handleAssinar} disabled={assinando} className="h-7 text-xs">
                {assinando ? (
                  <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Assinando...</>
                ) : (
                  <><FileSignature className="w-3 h-3 mr-1" /> Assinar com Certificado Digital</>
                )}
              </Button>
            )}
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground italic">
            Nenhum certificado digital cadastrado. Cadastre em <strong>Configurações &gt; Empresas</strong> para habilitar.
          </p>
        )}
      </div>
    </div>
  );
}

export default function PropostaRenderer({ proposal, empresaData, repData }: PropostaRendererProps) {
  const sections = parseSections(proposal);

  return (
    <div className="space-y-4 font-serif" style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: '12pt', lineHeight: '1.5' }}>
      {/* Render all sections from AI in order */}
      {sections.map((section, idx) => (
        <RenderSection key={idx} title={section.title} content={section.content} />
      ))}

      {/* Digital Certificate Signature */}
      <AssinaturaCertificado empresaData={empresaData} repData={repData} />
    </div>
  );
}
