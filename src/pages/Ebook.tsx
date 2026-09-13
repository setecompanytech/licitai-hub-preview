import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, FileText, Loader2, Info, Lightbulb } from 'lucide-react';
import { generateEbook } from '@/lib/ebook-generator';
import { toast } from 'sonner';

const chapters = [
  { code: '01', title: 'Dashboard — Visão Estratégica' },
  { code: '02', title: 'Monitoramento de Editais' },
  { code: '03', title: 'Chat do Pregão em Tempo Real' },
  { code: '04', title: 'Proposta Técnica e Comercial' },
  { code: '05', title: 'Precificação Inteligente' },
  { code: '06', title: 'Apoio Jurídico com IA' },
  { code: '07', title: 'Gestão de Documentos' },
  { code: '08', title: 'Kanban de Licitações' },
  { code: '09', title: 'Robô de Lances' },
  { code: '10', title: 'Governança Multiempresa' },
];

export default function Ebook() {
  const [generating, setGenerating] = useState(false);

  const handleDownload = async () => {
    setGenerating(true);
    try {
      await generateEbook();
      toast.success('Guia PRAEFECTUS gerado com sucesso.');
    } catch {
      toast.error('Erro ao gerar o e-book.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl space-y-6">
        <CabecalhoPagina />

        <Card className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex h-20 w-16 flex-shrink-0 items-center justify-center rounded-md border border-border bg-muted">
              <FileText className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">
                  PRAEFECTUS — Guia Técnico e Operacional
                </h2>
                <Badge variant="muted">v4.0</Badge>
              </div>
              <p className="mt-1 text-base text-muted-foreground">
                10 capítulos ilustrados com capturas de tela, explicações didáticas, passo a passo e dicas práticas para cada módulo.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button onClick={handleDownload} disabled={generating}>
                  {generating ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Download aria-hidden="true" />
                  )}
                  {generating ? 'Gerando PDF...' : 'Baixar guia completo'}
                </Button>
                <span className="text-xs text-muted-foreground">PDF A4 • sumário clicável • ilustrado</span>
              </div>
            </div>
          </div>
        </Card>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">Capítulos</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {chapters.map((ch) => (
              <div
                key={ch.code}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="text-sm font-semibold tabular-nums text-muted-foreground">{ch.code}</span>
                  <span className="min-w-0 text-sm font-medium text-foreground">{ch.title}</span>
                </div>
                <Lightbulb className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
              </div>
            ))}
          </div>
        </section>

        <Alert variant="info">
          <Info className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>
            Material interno para equipes com plano ativo. O documento contém explicações didáticas,
            ilustrações das telas do sistema e dicas práticas para cada módulo.
          </AlertDescription>
        </Alert>
      </div>
    </AppLayout>
  );
}
