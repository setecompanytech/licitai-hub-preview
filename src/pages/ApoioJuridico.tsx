import { useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import ProcessoContextoBanner from '@/components/shared/ProcessoContextoBanner';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import SeloPraefectusIA from '@/components/shared/SeloPraefectusIA';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Scale, BookOpen, FileText, Sparkles, TrendingUp,
  Gavel, Database, Shield, Radar
} from 'lucide-react';
import ReequilibrioIA from '@/components/apoio-juridico/ReequilibrioIA';
import BaseJuridicaUpload from '@/components/apoio-juridico/BaseJuridicaUpload';
import GeradorIAComBase from '@/components/apoio-juridico/GeradorIAComBase';
import ModelosTemplatesTab from '@/components/apoio-juridico/ModelosTemplatesTab';
import RadarJuridico from '@/components/apoio-juridico/RadarJuridico';
import FontesOficiais from '@/components/apoio-juridico/FontesOficiais';

const LEGISLACAO_REFS = [
  { lei: 'Lei 14.133/2021', desc: 'Nova Lei de Licitações e Contratos Administrativos', url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm' },
  { lei: 'LC 123/2006', desc: 'Estatuto da ME e EPP – tratamento diferenciado', url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm' },
  { lei: 'Decreto 11.462/2023', desc: 'Regulamenta a Lei 14.133/2021 no âmbito federal', url: '' },
  { lei: 'IN SEGES 73/2022', desc: 'Procedimentos para contratação de TIC', url: '' },
  { lei: 'Lei 12.846/2013', desc: 'Lei Anticorrupção', url: '' },
  { lei: 'Lei 9.784/1999', desc: 'Processo Administrativo Federal', url: '' },
  { lei: 'CF/88, Art. 37', desc: 'Princípios da Administração Pública', url: '' },
];

const SUMULAS_TCU = [
  { num: '247', desc: 'Exigência de qualificação técnica deve ser pertinente e compatível' },
  { num: '248', desc: 'Inviabilidade de exigir CNDs na fase de habilitação sem previsão legal' },
  { num: '269', desc: 'Inexigibilidade de licitação requer comprovação de singularidade' },
  { num: '270', desc: 'Registro de preços: adesão à ata (carona) com limites' },
  { num: '272', desc: 'Certificado de registro cadastral não substitui habilitação' },
  { num: '285', desc: 'Margem de preferência para bens e serviços nacionais' },
];

// O módulo abre pelo Radar (decisão do dono, 27/09): primeiro o que o
// sistema já sabe que precisa de peça; os modelos ficam ao lado.
const ABAS = [
  { v: 'radar', ic: Radar, r: 'Radar' },
  { v: 'modelos', ic: FileText, r: 'Modelos e Templates' },
  { v: 'gerador', ic: Sparkles, r: 'Gerador IA' },
  { v: 'reequilibrio', ic: TrendingUp, r: 'Reequilíbrio' },
  { v: 'base-juridica', ic: Database, r: 'Base Jurídica' },
  { v: 'legislacao', ic: BookOpen, r: 'Legislação' },
];

export default function ApoioJuridico() {
  const [activeTab, setActiveTab] = useState('radar');
  // Quando aberto via deep-link /apoio-juridico/redigir/:modeloId,
  // a página opera em modo "redação dedicada": ocultamos o cabeçalho
  // institucional e as abas (Modelos, Gerador, Reequilíbrio, Base, Legislação),
  // exibindo apenas o gerador do modelo escolhido.
  const { modeloId } = useParams<{ modeloId?: string }>();
  const location = useLocation();
  const legacyModelo = new URLSearchParams(location.search).get('modelo');
  const dedicatedMode = !!modeloId || !!legacyModelo;

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
        {/* Contexto do processo: quem entra pelo prontuário mantém o fio de volta */}
        <ProcessoContextoBanner />

        {/* Identidade 12/09: a faixa navy com foto deu lugar ao cabeçalho
            padrão de fundo claro — o martelo segue como ícone do módulo.
            Design System v3 (19/09): o módulo é de IA e leva o selo
            "Praefectus IA" no lugar do antigo chip "IA Jurídica". */}
        <CabecalhoPagina
          icone={<Scale />}
          titulo="Apoio Jurídico Especializado"
          descricao={
            <>
              Modelos, templates, geração assistida por IA e reequilíbrio contratual — Lei 14.133/2021.{' '}
              <span className="block sm:inline">
                Os documentos vinculam-se automaticamente ao processo ativo.
              </span>
            </>
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info" className="gap-1">
              <Shield className="w-3 h-3" aria-hidden="true" /> Lei 14.133/2021
            </Badge>
            <SeloPraefectusIA />
          </div>
        </CabecalhoPagina>

        {/* Main Tabs — fila sublinhada que ROLA quando não cabe, com o rótulo
            inteiro (sem abreviar "Reequilíbrio" ou "Base Jurídica"). */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="flex-nowrap overflow-x-auto [scrollbar-width:thin]">
            {ABAS.map(({ v, ic: Icone, r }) => (
              <TabsTrigger key={v} value={v} className="shrink-0">
                <Icone className="h-4 w-4 shrink-0" aria-hidden="true" />
                {r}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Tab 0: Radar — eventos derivados dos dados, cada um com a peça */}
          <TabsContent value="radar" className="space-y-4">
            <RadarJuridico />
          </TabsContent>

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
          <TabsContent value="base-juridica" className="space-y-6">
            <FontesOficiais />
            <BaseJuridicaUpload />
          </TabsContent>

          {/* Tab 5: Legislação */}
          <TabsContent value="legislacao">
            <section className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-lg font-semibold leading-6 text-foreground">Referências Legais</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Base normativa utilizada pela IA para fundamentação jurídica das petições e pareceres.
              </p>
              <ul className="space-y-2">
                {LEGISLACAO_REFS.map((l) => (
                  <li key={l.lei} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-3 transition-colors duration-150 hover:bg-muted/60">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{l.lei}</p>
                      <p className="text-xs text-muted-foreground">{l.desc}</p>
                    </div>
                    <Button size="sm" variant="outline" asChild={!!l.url}>
                      {l.url ? (
                        <a href={l.url} target="_blank" rel="noopener noreferrer">
                          <BookOpen aria-hidden="true" /> Consultar
                        </a>
                      ) : (
                        <>
                          <BookOpen aria-hidden="true" /> Consultar
                        </>
                      )}
                    </Button>
                  </li>
                ))}
              </ul>

              {/* Súmulas TCU */}
              <div className="pt-4">
                <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <Gavel className="w-4 h-4 text-muted-foreground" aria-hidden="true" /> Súmulas do TCU Mais Relevantes
                </h3>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {SUMULAS_TCU.map((s) => (
                    <li key={s.num} className="flex items-start gap-2 rounded-md border border-border bg-muted p-3">
                      <Badge variant="info" className="shrink-0">
                        Súm. {s.num}
                      </Badge>
                      <p className="text-sm text-muted-foreground">{s.desc}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
