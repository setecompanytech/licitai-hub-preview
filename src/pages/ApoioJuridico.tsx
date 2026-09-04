import { useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import ProcessoContextoBanner from '@/components/shared/ProcessoContextoBanner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Scale, BookOpen, FileText, Sparkles, TrendingUp, Upload,
  Gavel, MessageSquare, Database, Shield
} from 'lucide-react';
import heroJuridico from '@/assets/brand/hero-apoio-juridico.jpg';
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
        {/* ── Herói do módulo ──
            REBRAND — o cabeçalho era texto sobre a superfície da página, igual
            ao de outras 50 telas. Este módulo é o único que fala com um corpo
            de lei, e o martelo é o símbolo que diz isso sem legenda.

            O véu é um degradê HORIZONTAL, não uma cortina uniforme: navy sólido
            à esquerda, onde mora o texto, abrindo até 40% à direita, onde a
            foto aparece. É o que permite usar uma imagem clara sem apagá-la e
            sem perder o contraste do título — cortina uniforme forte demais
            mata a foto, fraca demais mata o texto, e não existe valor que
            resolva os dois ao mesmo tempo.

            A foto NÃO cobre a faixa inteira: ela sangra na direita, ocupando
            560px. Esticada de ponta a ponta, o recorte de uma faixa larga vira
            uma fatia de 9:1 de uma foto 16:9 — o martelo deixa de ser
            reconhecível e vira um cilindro escuro, que é enfeite, não símbolo.
            Contida à direita, e com a faixa em 232px de altura, a foto aparece
            quase inteira e o assunto lê. Os 232px são a MESMA altura do herói
            do Robô de Lances e do Apoio Contábil: módulo irmão com faixa de
            outro tamanho lê como descuido.

            Dois véus, cada um com um trabalho:
              • o lateral derrete a borda esquerda da foto no navy, para ela não
                parecer colada por cima da faixa;
              • o de topo apaga o brilho branco da tela do notebook, que fica no
                canto superior da imagem e é a única área clara dela.

            Navy nos DOIS temas, pela mesma razão da barra do topo em
            `AppLayout`: é moldura de marca, não superfície de tema. */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-navy-hover to-navy">
          <div
            aria-hidden="true"
            className="absolute inset-y-0 right-0 hidden w-[560px] max-w-[45%] md:block"
          >
            <img
              src={heroJuridico}
              alt=""
              className="w-full h-full object-cover object-[center_50%]"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-navy via-navy/0 via-55% to-transparent" />
            <div className="absolute inset-x-0 top-0 h-[70%] bg-gradient-to-b from-navy/55 to-transparent" />
          </div>

          <div className="relative flex items-start gap-3 px-5 py-6 sm:px-7 sm:py-8 md:min-h-[232px] md:items-center">
            <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 ring-1 ring-white/20 text-gold shrink-0">
              <Scale className="w-5 h-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 max-w-xl">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-tight">
                Apoio Jurídico Especializado
              </h1>
              {/* Duas frases no lugar de uma de 30 palavras. A segunda diz o
                  que a pessoa precisa saber ANTES de gerar a peça — para onde
                  o documento vai —, e isso se perdia no fim de um parágrafo. */}
              <p className="text-sm text-white/75 mt-1 leading-relaxed">
                Modelos, templates, geração assistida por IA e reequilíbrio contratual — Lei 14.133/2021.{' '}
                <span className="block sm:inline">
                  Os documentos vinculam-se automaticamente ao processo ativo.
                </span>
              </p>
              {/* Os dois selos desceram para baixo do texto. Encostados na
                  direita eles cairiam em cima da foto — e empurrar a foto para
                  fora para abrir espaço custaria justamente o que a faixa
                  ganhou. */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <Badge variant="outline" className="text-xs gap-1 border-white/25 bg-white/10 text-white">
                  <Shield className="w-3 h-3" /> Lei 14.133/2021
                </Badge>
                <Badge variant="outline" className="text-xs gap-1 border-white/25 bg-white/10 text-white">
                  <Sparkles className="w-3 h-3" /> IA Jurídica
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          {/* REBRAND — a `barra-abas` do protótipo: faixa que ROLA, com o
              rótulo inteiro.

              A grade de cinco colunas obrigava cada aba a caber numa fração
              fixa da largura, e a saída tinha sido abreviar: "Reequilíbrio"
              virava "Reequil.", "Base Jurídica" virava "Base", "Legislação"
              virava "Leis". Abreviação em rótulo de navegação é a pior troca
              possível — economiza pixel e cobra do usuário adivinhar o destino,
              justamente onde ele ainda não sabe o que vai encontrar.

              Numa faixa rolável a largura de cada aba é a do próprio texto.
              Cabe tudo no desktop, e no celular a pessoa arrasta — gesto que
              ela já faz o dia inteiro. Como bônus, some a duplicação de cada
              rótulo em duas versões. */}
          <div className="-mx-3 px-3 sm:mx-0 sm:px-0 overflow-x-auto">
            <TabsList className="inline-flex w-auto h-auto gap-1">
              {[
                { v: 'modelos', ic: FileText, r: 'Modelos e Templates' },
                { v: 'gerador', ic: Sparkles, r: 'Gerador IA' },
                { v: 'reequilibrio', ic: TrendingUp, r: 'Reequilíbrio' },
                { v: 'base-juridica', ic: Database, r: 'Base Jurídica' },
                { v: 'legislacao', ic: BookOpen, r: 'Legislação' },
              ].map(({ v, ic: Icone, r }) => (
                <TabsTrigger key={v} value={v} className="gap-1.5 py-2 px-3 text-sm whitespace-nowrap">
                  <Icone className="w-4 h-4 shrink-0" aria-hidden="true" />
                  {r}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

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
                <BookOpen className="w-5 h-5 text-muted-foreground" />
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
                    <div key={s.num} className="flex items-start gap-2 p-2 rounded-lg bg-muted border border-border">
                      <Badge variant="outline" className="text-xs shrink-0 mt-0.5">
                        Súm. {s.num}
                      </Badge>
                      <p className="text-xs text-muted-foreground">{s.desc}</p>
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
