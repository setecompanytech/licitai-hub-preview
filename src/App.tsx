import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { EmpresaProvider } from "@/contexts/EmpresaContext";
import { PropostaCartProvider } from "@/contexts/PropostaCartContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import PlanGuard from "@/components/auth/PlanGuard";
import AdminGuard from "@/components/auth/AdminGuard";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Index from "./pages/Index";
import { Navigate } from "react-router-dom";
import KanbanPage from "./pages/KanbanPage";
import RoboLances from "./pages/RoboLances";
import Concorrentes from "./pages/Concorrentes";
import Documentos from "./pages/Documentos";
import ApoioJuridico from "./pages/ApoioJuridico";
import ApoioContabil from "./pages/ApoioContabil";
import Precificacao from "./pages/Precificacao";
import Assistente from "./pages/Assistente";
import Analytics from "./pages/Analytics";
import MonitoramentoEditais from "./pages/MonitoramentoEditais";
import Configuracoes from "./pages/Configuracoes";
import Empresas from "./pages/Empresas";
import AdminTemplates from "./pages/AdminTemplates";
import LandingPage from "./pages/LandingPage";
import Cadastro from "./pages/Cadastro";
import FaqPage from "./pages/FaqPage";
import Suporte from "./pages/Suporte";
import AdminFinanceiro from "./pages/AdminFinanceiro";
import AdminFontesFabricantes from "./pages/AdminFontesFabricantes";
import MonitoramentoChat from "./pages/MonitoramentoChat";
import AnaliseMercado from "./pages/AnaliseMercado";
import LicitacoesEstrategicas from "./pages/LicitacoesEstrategicas";
import AssessoriaCadastral from "./pages/AssessoriaCadastral";
import Blog from "./pages/Blog";
import Boletins from "./pages/Boletins";
import Ebook from "./pages/Ebook";
import PropostaTecnica from "./pages/PropostaTecnica";
import HistoricoLicitacoes from "./pages/HistoricoLicitacoes";
import Ferramentas from "./pages/Ferramentas";
import GestaoContratos from "./pages/GestaoContratos";
import Financeiro from "./pages/Financeiro";


import WhatsAppCRM from "./pages/WhatsAppCRM";
import Calendario from "./pages/Calendario";
import TermosDeUso from "./pages/TermosDeUso";
import PoliticaPrivacidade from "./pages/PoliticaPrivacidade";
import LgpdPage from "./pages/LgpdPage";
import TutorialPage from "./pages/TutorialPage";
import NotFound from "./pages/NotFound";
import ApiIntegracao from "./pages/ApiIntegracao";
import IndicesRepactuacao from "./pages/IndicesRepactuacao";
import RelatorioContabil from "./pages/RelatorioContabil";
import AdminMarketing from "./pages/AdminMarketing";
import MeusCompromissos from "./pages/MeusCompromissos";
import WorkflowIA from "./pages/WorkflowIA";
import EquipeColaboradores from "./pages/EquipeColaboradores";
import AssistenteEspecializado from "./pages/AssistenteEspecializado";
import Unsubscribe from "./pages/Unsubscribe";
const queryClient = new QueryClient();

const ProtectedPages = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>{children}</ProtectedRoute>
);

/** Rota protegida + restrição por plano */
const PlanPages = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute><PlanGuard>{children}</PlanGuard></ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <EmpresaProvider>
          <PropostaCartProvider>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/landing" element={<Navigate to="/" replace />} />
              <Route path="/index" element={<Navigate to="/dashboard" replace />} />
              <Route path="/faq" element={<FaqPage />} />
              <Route path="/cadastro" element={<Cadastro />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/dashboard" element={<ProtectedPages><Index /></ProtectedPages>} />
              <Route path="/licitacoes" element={<Navigate to="/monitoramento-editais" replace />} />
              <Route path="/kanban" element={<ProtectedPages><KanbanPage /></ProtectedPages>} />
              <Route path="/robo-lances" element={<PlanPages><RoboLances /></PlanPages>} />
              <Route path="/concorrentes" element={<PlanPages><Concorrentes /></PlanPages>} />
              <Route path="/documentos" element={<ProtectedPages><Documentos /></ProtectedPages>} />
              <Route path="/apoio-juridico" element={<PlanPages><ApoioJuridico /></PlanPages>} />
              <Route path="/apoio-contabil" element={<PlanPages><ApoioContabil /></PlanPages>} />
              <Route path="/precificacao" element={<PlanPages><Precificacao /></PlanPages>} />
              <Route path="/assistente" element={<PlanPages><Assistente /></PlanPages>} />
              <Route path="/analytics" element={<PlanPages><Analytics /></PlanPages>} />
              <Route path="/monitoramento-editais" element={<ProtectedPages><MonitoramentoEditais /></ProtectedPages>} />
              <Route path="/configuracoes" element={<ProtectedPages><Configuracoes /></ProtectedPages>} />
              <Route path="/empresas" element={<ProtectedPages><Empresas /></ProtectedPages>} />
              <Route path="/suporte" element={<ProtectedPages><Suporte /></ProtectedPages>} />
              <Route path="/admin/templates" element={<ProtectedPages><AdminTemplates /></ProtectedPages>} />
              <Route path="/admin/financeiro" element={<ProtectedPages><AdminFinanceiro /></ProtectedPages>} />
              <Route path="/admin/fontes-fabricantes" element={<ProtectedPages><AdminFontesFabricantes /></ProtectedPages>} />
              <Route path="/admin/marketing" element={<ProtectedPages><AdminMarketing /></ProtectedPages>} />
              <Route path="/monitoramento-chat" element={<ProtectedPages><MonitoramentoChat /></ProtectedPages>} />
              <Route path="/analise-mercado" element={<PlanPages><AnaliseMercado /></PlanPages>} />
              <Route path="/licitacoes-estrategicas" element={<ProtectedPages><LicitacoesEstrategicas /></ProtectedPages>} />
              <Route path="/assessoria-cadastral" element={<ProtectedPages><AssessoriaCadastral /></ProtectedPages>} />
              <Route path="/blog" element={<ProtectedPages><Blog /></ProtectedPages>} />
              <Route path="/boletins" element={<ProtectedPages><Boletins /></ProtectedPages>} />
              <Route path="/ebook" element={<ProtectedPages><Ebook /></ProtectedPages>} />
              <Route path="/proposta-tecnica" element={<PlanPages><PropostaTecnica /></PlanPages>} />
              <Route path="/historico-licitacoes" element={<ProtectedPages><HistoricoLicitacoes /></ProtectedPages>} />
              <Route path="/ferramentas" element={<ProtectedPages><Ferramentas /></ProtectedPages>} />
              <Route path="/busca-inteligente" element={<Navigate to="/monitoramento-editais" replace />} />
              <Route path="/comprasgov-envio" element={<Navigate to="/proposta-tecnica" replace />} />
              <Route path="/whatsapp-setores" element={<Navigate to="/whatsapp-crm" replace />} />
              <Route path="/whatsapp-crm" element={<PlanPages><WhatsAppCRM /></PlanPages>} />
              <Route path="/calendario" element={<ProtectedPages><Calendario /></ProtectedPages>} />
              <Route path="/meus-compromissos" element={<ProtectedPages><MeusCompromissos /></ProtectedPages>} />
              <Route path="/workflow-ia" element={<PlanPages><WorkflowIA /></PlanPages>} />
              <Route path="/tutorial" element={<ProtectedPages><TutorialPage /></ProtectedPages>} />
              <Route path="/api-integracao" element={<PlanPages><ApiIntegracao /></PlanPages>} />
              <Route path="/indices-repactuacao" element={<PlanPages><IndicesRepactuacao /></PlanPages>} />
              <Route path="/relatorio-contabil" element={<ProtectedPages><RelatorioContabil /></ProtectedPages>} />
              <Route path="/gestao-contratos" element={<PlanPages><GestaoContratos /></PlanPages>} />
              <Route path="/financeiro" element={<ProtectedPages><AdminGuard><Financeiro /></AdminGuard></ProtectedPages>} />
              <Route path="/equipe" element={<PlanPages><EquipeColaboradores /></PlanPages>} />
              <Route path="/assistente-especializado" element={<PlanPages><AssistenteEspecializado /></PlanPages>} />
              <Route path="/termos-de-uso" element={<TermosDeUso />} />
              <Route path="/politica-de-privacidade" element={<PoliticaPrivacidade />} />
              <Route path="/lgpd" element={<LgpdPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </PropostaCartProvider>
          </EmpresaProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
