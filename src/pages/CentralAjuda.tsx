import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingFooter from '@/components/landing/LandingFooter';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { Search, BookOpen, MessageSquare, FileText, Shield, BarChart3, Gavel, Calculator, Bot, Mail, LifeBuoy } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';

const categories = [
  { icon: BookOpen, title: 'Primeiros Passos', desc: 'Cadastro, login, configuração de empresa e onboarding inicial.', articles: ['Como criar sua conta', 'Configurar perfil de monitoramento', 'Adicionar empresa e CNAEs', 'Entender o dashboard'] },
  { icon: Search, title: 'Monitoramento de Editais', desc: 'Filtros, alertas, perfis de busca e portais integrados.', articles: ['Configurar palavras-chave', 'Criar perfis de alerta', 'Filtrar por CNAE e região', 'Entender o score de aderência'] },
  { icon: Shield, title: 'Integração Compras.gov.br', desc: 'Fonte Tier 1 federal: API v2.0, cobertura Lei 8.666 + 14.133, sincronização automática.', articles: ['Estrutura do banco multi-fonte', 'Sincronização automática (CRON)', 'Badges de fonte nos cards', 'Dashboard de cobertura multi-fonte', 'Carga histórica inicial', 'Verificação pós-deploy'] },
  { icon: Calculator, title: 'Precificação', desc: 'Composição de custos, cotações, BDI e regimes tributários.', articles: ['Criar composição de custo', 'Importar cotações de fornecedores', 'Calcular BDI por modalidade', 'Consultar Painel de Preços Gov', 'Consulta Mercado Livre (API)'] },
  { icon: FileText, title: 'Propostas e Documentos', desc: 'Geração de propostas, upload de documentos e planilhas de preços.', articles: ['Gerar proposta técnica', 'Upload de timbrado e dados', 'Planilha de preços automatizada', 'Importar itens do catálogo'] },
  { icon: Bot, title: 'Robô de Lances', desc: 'Configuração de estratégias, credenciais e automação de disputas.', articles: ['Configurar credenciais do portal', 'Definir estratégia de lances', 'Monitorar disputa em tempo real', 'Entender trilha de auditoria'] },
  { icon: Gavel, title: 'Apoio Jurídico e Contábil', desc: 'Geração de documentos jurídicos, análise de balanços e compliance.', articles: ['Gerar impugnação ou recurso', 'Upload de base jurídica', 'Análise de balanço patrimonial', 'Certidões negativas'] },
  { icon: BarChart3, title: 'Analytics e Relatórios', desc: 'Dashboards, relatórios gerenciais e exportação de dados.', articles: ['Interpretar KPIs do dashboard', 'Exportar dados em Excel', 'Relatório contábil gerencial', 'Histórico de licitações'] },
  { icon: Shield, title: 'Segurança e Conta', desc: 'Senha, sessões, permissões e configurações de segurança.', articles: ['Alterar senha', 'Gerenciar sessões ativas', 'Configurar equipe e permissões', 'Entender logs de auditoria'] },
  { icon: Mail, title: 'Notificações', desc: 'E-mail, WhatsApp, boletins e configurações de alerta.', articles: ['Configurar alertas por e-mail', 'Ativar notificações WhatsApp', 'Personalizar boletins', 'Verificar histórico de envios'] },
];

export default function CentralAjuda() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? categories.filter(c =>
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.articles.some(a => a.toLowerCase().includes(search.toLowerCase()))
      )
    : categories;

  return (
    <>
      <Helmet>
        <title>Central de Ajuda | PRAEFECTUS</title>
        <meta name="description" content="Encontre respostas sobre monitoramento de editais, precificação, propostas, robô de lances, segurança e todas as funcionalidades da PRAEFECTUS." />
        <link rel="canonical" href="https://praefectus.com.br/ajuda" />
      </Helmet>
      <div className="min-h-screen bg-background">
        <LandingNavbar />
        <main className="px-6 pb-20 pt-24">
          <div className="mx-auto max-w-4xl">
            {/* Cabeçalho padrão alinhado à esquerda (sem capa centralizada):
                eyebrow, título 28/36, descrição e a busca larga logo abaixo. */}
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Central de Ajuda</p>
            <CabecalhoPagina
              titulo="Como podemos ajudar?"
              descricao="Encontre guias, tutoriais e respostas sobre todas as funcionalidades da plataforma."
              icone={<LifeBuoy />}
              filtros={
                <div className="relative w-full max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar artigos, temas ou funcionalidades..."
                    aria-label="Buscar artigos"
                    className="pl-9"
                    maxLength={100}
                  />
                </div>
              }
            />

            {/* Cartões compactos por tema: ícone num ladrilho neutro, título
                16/600, descrição 13 e a lista de artigos. */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((cat) => (
                <div key={cat.title} className="rounded-lg border border-border bg-card p-5 shadow-sm transition-colors duration-150 hover:border-primary/40">
                  <span aria-hidden="true" className="mb-3 flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <cat.icon className="h-4 w-4" />
                  </span>
                  <h3 className="mb-1 text-lg font-semibold leading-6 text-foreground">{cat.title}</h3>
                  <p className="mb-4 text-sm text-muted-foreground">{cat.desc}</p>
                  <ul className="space-y-1.5">
                    {cat.articles.map((a) => (
                      <li key={a} className="flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground">
                        <span className="text-muted-foreground">›</span> {a}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {filtered.length === 0 && (
              <div className="rounded-lg border border-border bg-card shadow-sm">
                <EstadoVazio
                  icone={<Search />}
                  titulo="Nenhum resultado encontrado."
                  descricao="Tente termos mais amplos."
                />
              </div>
            )}

            {/* Contato — cartão alinhado à esquerda com os três caminhos. */}
            <div className="mt-8 flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-start">
              <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <MessageSquare className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="mb-1 text-lg font-semibold leading-6 text-foreground">Não encontrou o que procurava?</h3>
                <p className="mb-3 text-sm text-muted-foreground">
                  Nossa equipe de suporte está disponível de segunda a sexta, das 08h às 18h.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button type="button" onClick={() => navigate('/suporte')} className="rounded-md text-left text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Abrir chamado de suporte</button>
                  <span className="hidden text-muted-foreground sm:inline" aria-hidden="true">·</span>
                  <a href="mailto:suporte@praefectus.com.br" className="rounded-md text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">suporte@praefectus.com.br</a>
                  <span className="hidden text-muted-foreground sm:inline" aria-hidden="true">·</span>
                  <button type="button" onClick={() => navigate('/faq')} className="rounded-md text-left text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Consultar FAQ</button>
                </div>
              </div>
            </div>
          </div>
        </main>
        <LandingFooter />
      </div>
    </>
  );
}
