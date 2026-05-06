import { useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Scale, BookOpen, FileText, Sparkles, TrendingUp, Upload,
  Gavel, MessageSquare, Database, Shield
} from 'lucide-react';
import ReequilibrioIA from '@/components/apoio-juridico/ReequilibrioIA';
import BaseJuridicaUpload from '@/components/apoio-juridico/BaseJuridicaUpload';
import GeradorIAComBase from '@/components/apoio-juridico/GeradorIAComBase';
import ModelosTemplatesTab from '@/components/apoio-juridico/ModelosTemplatesTab';

const LEGISLACAO_REFS = [
  { lei: 'Lei 14.133/2021', desc: 'Nova Lei de Licitações e Contratos Administrativos', url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm' },
  { lei: 'LC 123/2006', desc: 'Estatuto da ME e EPP – tratamento diferenciado', url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm' },
  { lei: 'Decreto 11.462/2023', desc: 'Regulamenta a Lei 14.133/2021 no âmbito federal', url: '' },
  { lei: 'IN SEGES 73/2022', desc: 'Procedimentos para contratação de TIC', url: '' },
  { lei: 'Lei 12.846/2013', desc: 'Lei Anticorrupção', url: '' },
  { lei: 'Lei 9.784/1999', desc: 'Processo Administrativo Federal', url: '' },
  { lei: 'CF/88, Art. 37', desc: 'Princípios da Administração Pública', url: '' },
];

export default function ApoioJuridico() {
  const [activeTab, setActiveTab] = useState('modelos');
  // Quando aberto via deep-link /apoio-juridico/redigir/:modeloId,
  // a página opera em modo "redação dedicada": ocultamos o cabeçalho
  // institucional e as abas (Modelos, Gerador, Reequilíbrio, Base, Legislação),
  // exibindo apenas o gerador do modelo escolhido.
  const { modeloId } = useParams<{ modeloId?: string }>();
  const dedicatedMode = !!modeloId;

  if (dedicatedMode) {
    return (
      <AppLayout>
        <ModelosTemplatesTab />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
              <Scale className="w-5 h-5 sm:w-6 sm:h-6 text-accent flex-shrink-0" />
              Apoio Jurídico Especializado
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Modelos, templates, geração assistida por IA e reequilíbrio contratual – Lei 14.133/2021. Documentos vinculam-se automaticamente ao processo ativo (barra superior).
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Badge variant="outline" className="text-[10px] gap-1">
              <Shield className="w-3 h-3" /> Lei 14.133/2021
            </Badge>
            <Badge variant="outline" className="text-[10px] gap-1">
              <Sparkles className="w-3 h-3" /> IA Jurídica
            </Badge>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="w-full grid grid-cols-2 md:grid-cols-5 h-auto">
            <TabsTrigger value="modelos" className="text-xs gap-1 py-2">
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Modelos e Templates</span>
              <span className="sm:hidden">Modelos</span>
            </TabsTrigger>
            <TabsTrigger value="gerador" className="text-xs gap-1 py-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Gerador IA</span>
              <span className="sm:hidden">Gerador</span>
            </TabsTrigger>
            <TabsTrigger value="reequilibrio" className="text-xs gap-1 py-2">
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reequilíbrio</span>
              <span className="sm:hidden">Reequil.</span>
            </TabsTrigger>
            <TabsTrigger value="base-juridica" className="text-xs gap-1 py-2">
              <Database className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Base Jurídica</span>
              <span className="sm:hidden">Base</span>
            </TabsTrigger>
            <TabsTrigger value="legislacao" className="text-xs gap-1 py-2">
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Legislação</span>
              <span className="sm:hidden">Leis</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Modelos + Templates com Gerador Integrado */}
          <TabsContent value="modelos" className="space-y-4">
            <ModelosTemplatesTab />
          </TabsContent>

          {/* Tab 2: Gerador IA Independente (com Base Jurídica) */}
          <TabsContent value="gerador" className="space-y-4">
            <GeradorIAComBase />
          </TabsContent>

          {/* Tab 3: Reequilíbrio / Repactuação / Revisão */}
          <TabsContent value="reequilibrio">
            <ReequilibrioIA />
          </TabsContent>

          {/* Tab 4: Base Jurídica IA (upload e gestão) */}
          <TabsContent value="base-juridica">
            <BaseJuridicaUpload />
          </TabsContent>

          {/* Tab 5: Legislação */}
          <TabsContent value="legislacao">
            <div className="bg-card rounded-xl border border-border/50 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-5 h-5 text-accent" />
                <h3 className="text-sm font-semibold">Referências Legais</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Base normativa utilizada pela IA para fundamentação jurídica das petições e pareceres.
              </p>
              <div className="space-y-3">
                {LEGISLACAO_REFS.map((l) => (
                  <div key={l.lei} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="text-sm font-medium">{l.lei}</p>
                      <p className="text-xs text-muted-foreground">{l.desc}</p>
                    </div>
                    <Button size="sm" variant="outline" asChild={!!l.url}>
                      {l.url ? (
                        <a href={l.url} target="_blank" rel="noopener noreferrer">
                          <BookOpen className="w-3 h-3 mr-1" /> Consultar
                        </a>
                      ) : (
                        <>
                          <BookOpen className="w-3 h-3 mr-1" /> Consultar
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>

              {/* Súmulas TCU */}
              <div className="mt-6">
                <h4 className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1">
                  <Gavel className="w-3.5 h-3.5" /> Súmulas do TCU Mais Relevantes
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {[
                    { num: '247', desc: 'Exigência de qualificação técnica deve ser pertinente e compatível' },
                    { num: '248', desc: 'Inviabilidade de exigir CNDs na fase de habilitação sem previsão legal' },
                    { num: '269', desc: 'Inexigibilidade de licitação requer comprovação de singularidade' },
                    { num: '270', desc: 'Registro de preços: adesão à ata (carona) com limites' },
                    { num: '272', desc: 'Certificado de registro cadastral não substitui habilitação' },
                    { num: '285', desc: 'Margem de preferência para bens e serviços nacionais' },
                  ].map((s) => (
                    <div key={s.num} className="flex items-start gap-2 p-2 rounded-lg bg-accent/5 border border-accent/10">
                      <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5">
                        Súm. {s.num}
                      </Badge>
                      <p className="text-[11px] text-muted-foreground">{s.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
