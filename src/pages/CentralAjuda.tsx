import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingFooter from '@/components/landing/LandingFooter';
import { Search, BookOpen, MessageSquare, FileText, Shield, BarChart3, Gavel, Calculator, Bot, Mail } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';

const categories = [
  { icon: BookOpen, title: 'Primeiros Passos', desc: 'Cadastro, login, configuração de empresa e onboarding inicial.', articles: ['Como criar sua conta', 'Configurar perfil de monitoramento', 'Adicionar empresa e CNAEs', 'Entender o dashboard'] },
  { icon: Search, title: 'Monitoramento de Editais', desc: 'Filtros, alertas, perfis de busca e portais integrados.', articles: ['Configurar palavras-chave', 'Criar perfis de alerta', 'Filtrar por CNAE e região', 'Entender o score de aderência'] },
  { icon: Calculator, title: 'Precificação', desc: 'Composição de custos, cotações, BDI e regimes tributários.', articles: ['Criar composição de custo', 'Importar cotações de fornecedores', 'Calcular BDI por modalidade', 'Consultar Painel de Preços Gov'] },
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
        <main className="pt-24 pb-20 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="mb-10 text-center">
              <p className="text-xs font-semibold tracking-widest text-accent uppercase mb-3">Central de Ajuda</p>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Como podemos ajudar?</h1>
              <p className="text-muted-foreground mb-6">Encontre guias, tutoriais e respostas sobre todas as funcionalidades da plataforma.</p>
              <div className="max-w-md mx-auto relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar artigos, temas ou funcionalidades..."
                  className="pl-10"
                  maxLength={100}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((cat) => (
                <div key={cat.title} className="border border-border rounded-xl p-6 bg-card hover:border-accent/30 transition-colors">
                  <cat.icon className="w-6 h-6 text-accent mb-3" />
                  <h3 className="font-semibold mb-1">{cat.title}</h3>
                  <p className="text-xs text-muted-foreground mb-4">{cat.desc}</p>
                  <ul className="space-y-1.5">
                    {cat.articles.map((a) => (
                      <li key={a} className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center gap-1.5">
                        <span className="text-accent">›</span> {a}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {filtered.length === 0 && (
              <p className="text-center text-muted-foreground py-12">Nenhum resultado encontrado. Tente termos mais amplos.</p>
            )}

            <div className="mt-14 border border-border rounded-xl p-8 bg-card text-center">
              <MessageSquare className="w-8 h-8 text-accent mx-auto mb-3" />
              <h3 className="font-semibold text-lg mb-2">Não encontrou o que procurava?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Nossa equipe de suporte está disponível de segunda a sexta, das 08h às 18h.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button onClick={() => navigate('/suporte')} className="text-sm text-accent font-semibold hover:underline">Abrir chamado de suporte</button>
                <span className="hidden sm:inline text-muted-foreground">·</span>
                <a href="mailto:suporte@praefectus.com.br" className="text-sm text-accent font-semibold hover:underline">suporte@praefectus.com.br</a>
                <span className="hidden sm:inline text-muted-foreground">·</span>
                <button onClick={() => navigate('/faq')} className="text-sm text-accent font-semibold hover:underline">Consultar FAQ</button>
              </div>
            </div>
          </div>
        </main>
        <LandingFooter />
      </div>
    </>
  );
}
