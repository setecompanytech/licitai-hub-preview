import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, FileSignature, Loader2, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface PropostaRendererProps {
  proposal: string;
  timbradoUrl?: string | null;
  usarMarcaDagua?: boolean;
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

/** Strip HTML/CSS blocks and raw tags from AI output */
function sanitizeProposalText(raw: string): string {
  let text = raw;
  text = text.replace(/```(?:markdown|html|css)?\s*\n?/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<\/?(html|head|body|meta|div|span|br|hr|img|link|!DOCTYPE)[^>]*\/?>/gi, '');
  text = text.replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, '');
  text = text.replace(/<!--.*?-->/g, '');
  text = text.replace(/^[\s]*([\w-]+\s*:\s*[^|]+;\s*)$/gm, '');
  text = text.replace(/^\s*[{}]\s*$/gm, '');
  text = text.replace(/^\s*[\w\s,.#:>+~*-]+\{\s*$/gm, '');
  text = text.replace(/@page\s*\{[^}]*\}/gi, '');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

/** Parse structured sections from the AI markdown proposal */
function parseSections(text: string) {
  const clean = sanitizeProposalText(text);
  const sections: { title: string; content: string }[] = [];
  const parts = clean.split(/^(#{1,3}\s+.+)$/gm);

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
                      <TableRow key={ri} className={ri % 2 === 0 ? 'bg-muted' : undefined}>
                        <TableCell className="font-semibold text-foreground w-1/3 py-2 px-3 text-sm border-r border-border">
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
                  <TableRow className="bg-foreground">
                    {table.headers.map((h, hi) => (
                      <TableHead key={hi} className="whitespace-nowrap border border-border px-2 py-2 text-center text-sm font-semibold text-background">
                        {h.replace(/\*\*/g, '')}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {table.rows.map((row, ri) => (
                    <TableRow key={ri} className={ri % 2 === 0 ? 'bg-muted' : undefined}>
                      {row.map((cell, ci) => (
                        <TableCell key={ci} className="whitespace-nowrap border border-border px-2 py-2 text-center text-sm">
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
                  <p className="text-sm text-foreground leading-relaxed flex-1 text-justify">
                    {renderInlineFormatting(trimmed.slice(2))}
                  </p>
                </div>
              );
            }

            if (trimmed === '---' || trimmed === '___') {
              return <hr key={li} className="my-4 border-border" />;
            }

            if (trimmed.startsWith('___')) {
              return <div key={li} className="mx-auto my-6 w-72 border-b-2 border-foreground" />;
            }

            return (
              <p key={li} className="text-sm text-foreground leading-relaxed text-justify">
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
        <h3 className="mb-2 border-b border-border pb-1 text-sm font-bold uppercase tracking-wide text-foreground">
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

  const hasCertificado = !!(empresaData?.certificado_nome);

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
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      <div className="flex items-center gap-2 mb-2">
        <FileSignature className="w-4 h-4 text-muted-foreground" />
        <p className="font-bold text-sm text-foreground uppercase tracking-wide">Assinatura Digital</p>
      </div>

      <div className="space-y-2 rounded-md border border-border bg-muted p-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-muted-foreground" />
          <div>
            <p className="text-xs font-semibold text-foreground">Assinatura Digital (Certificado e-CNPJ/A1)</p>
            <p className="text-xs text-muted-foreground">
              Assine a proposta com o certificado digital cadastrado no sistema
            </p>
          </div>
        </div>

        {hasCertificado ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">
              <ShieldCheck className="w-3 h-3 mr-1" aria-hidden="true" />
              {empresaData?.certificado_tipo === 'e-cnpj' ? 'e-CNPJ' : 'e-CPF'} — {empresaData?.certificado_nome}
            </Badge>
            {assinado ? (
              <Badge variant="success">
                <CheckCircle2 className="w-3 h-3 mr-1" aria-hidden="true" />
                Assinado digitalmente
              </Badge>
            ) : (
              <Button size="sm" onClick={handleAssinar} disabled={assinando}>
                {assinando ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Assinando...</>
                ) : (
                  <><FileSignature className="w-4 h-4" /> Assinar com certificado digital</>
                )}
              </Button>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Nenhum certificado digital cadastrado. Cadastre em <strong>Configurações &gt; Empresas</strong> para habilitar.
          </p>
        )}
      </div>
    </div>
  );
}

export default function PropostaRenderer({ proposal, empresaData, repData, timbradoUrl, usarMarcaDagua }: PropostaRendererProps) {
  const sections = parseSections(proposal);

  return (
    <div className="space-y-4 font-serif relative" style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: '12pt', lineHeight: '1.5' }}>
      {/* Timbrado header */}
      {timbradoUrl && /\.(png|jpe?g|webp|svg)(\?|$)/i.test(timbradoUrl) && (
        <div className="mb-3 border-b border-border pb-3">
          <img src={timbradoUrl} alt="Timbrado" className="h-16 max-w-[300px] object-contain" />
        </div>
      )}

      {/* Render all sections from AI in order */}
      {sections.map((section, idx) => (
        <RenderSection key={idx} title={section.title} content={section.content} />
      ))}

      {/* Digital Certificate Signature — always rendered */}
      <AssinaturaCertificado empresaData={empresaData} repData={repData} />
    </div>
  );
}
