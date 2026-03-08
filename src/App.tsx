import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { EmpresaProvider } from "@/contexts/EmpresaContext";
import { PropostaCartProvider } from "@/contexts/PropostaCartContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
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

import WhatsAppSetores from "./pages/WhatsAppSetores";
import Calendario from "./pages/Calendario";
import TermosDeUso from "./pages/TermosDeUso";
import PoliticaPrivacidade from "./pages/PoliticaPrivacidade";
import LgpdPage from "./pages/LgpdPage";
import TutorialPage from "./pages/TutorialPage";
import NotFound from "./pages/NotFound";
import ApiIntegracao from "./pages/ApiIntegracao";

const queryClient = new QueryClient();

const ProtectedPages = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>{children}</ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <EmpresaProvider>
          <PropostaCartProvider>
            <Routes>
              <Route path="/landing" element={<LandingPage />} />
              <Route path="/faq" element={<FaqPage />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/" element={<ProtectedPages><Index /></ProtectedPages>} />
              <Route path="/licitacoes" element={<Navigate to="/monitoramento-editais" replace />} />
              <Route path="/kanban" element={<ProtectedPages><KanbanPage /></ProtectedPages>} />
              <Route path="/robo-lances" element={<ProtectedPages><RoboLances /></ProtectedPages>} />
              <Route path="/concorrentes" element={<ProtectedPages><Concorrentes /></ProtectedPages>} />
              <Route path="/documentos" element={<ProtectedPages><Documentos /></ProtectedPages>} />
              <Route path="/apoio-juridico" element={<ProtectedPages><ApoioJuridico /></ProtectedPages>} />
              <Route path="/apoio-contabil" element={<ProtectedPages><ApoioContabil /></ProtectedPages>} />
              <Route path="/precificacao" element={<ProtectedPages><Precificacao /></ProtectedPages>} />
              <Route path="/assistente" element={<ProtectedPages><Assistente /></ProtectedPages>} />
              <Route path="/analytics" element={<ProtectedPages><Analytics /></ProtectedPages>} />
              <Route path="/monitoramento-editais" element={<ProtectedPages><MonitoramentoEditais /></ProtectedPages>} />
              <Route path="/configuracoes" element={<ProtectedPages><Configuracoes /></ProtectedPages>} />
              <Route path="/empresas" element={<ProtectedPages><Empresas /></ProtectedPages>} />
              <Route path="/suporte" element={<ProtectedPages><Suporte /></ProtectedPages>} />
              <Route path="/admin/templates" element={<ProtectedPages><AdminTemplates /></ProtectedPages>} />
              <Route path="/admin/financeiro" element={<ProtectedPages><AdminFinanceiro /></ProtectedPages>} />
              <Route path="/admin/fontes-fabricantes" element={<ProtectedPages><AdminFontesFabricantes /></ProtectedPages>} />
              <Route path="/monitoramento-chat" element={<ProtectedPages><MonitoramentoChat /></ProtectedPages>} />
              <Route path="/analise-mercado" element={<ProtectedPages><AnaliseMercado /></ProtectedPages>} />
              <Route path="/licitacoes-estrategicas" element={<ProtectedPages><LicitacoesEstrategicas /></ProtectedPages>} />
              <Route path="/assessoria-cadastral" element={<ProtectedPages><AssessoriaCadastral /></ProtectedPages>} />
              <Route path="/blog" element={<ProtectedPages><Blog /></ProtectedPages>} />
              <Route path="/boletins" element={<ProtectedPages><Boletins /></ProtectedPages>} />
              <Route path="/ebook" element={<ProtectedPages><Ebook /></ProtectedPages>} />
              <Route path="/proposta-tecnica" element={<ProtectedPages><PropostaTecnica /></ProtectedPages>} />
              <Route path="/historico-licitacoes" element={<ProtectedPages><HistoricoLicitacoes /></ProtectedPages>} />
              <Route path="/ferramentas" element={<ProtectedPages><Ferramentas /></ProtectedPages>} />
              <Route path="/busca-inteligente" element={<Navigate to="/monitoramento-editais" replace />} />
              <Route path="/comprasgov-envio" element={<Navigate to="/proposta-tecnica" replace />} />
              <Route path="/whatsapp-setores" element={<ProtectedPages><WhatsAppSetores /></ProtectedPages>} />
              <Route path="/calendario" element={<ProtectedPages><Calendario /></ProtectedPages>} />
              <Route path="/tutorial" element={<ProtectedPages><TutorialPage /></ProtectedPages>} />
              <Route path="/api-integracao" element={<ProtectedPages><ApiIntegracao /></ProtectedPages>} />
              <Route path="/indices-repactuacao" element={<ProtectedPages><IndicesRepactuacao /></ProtectedPages>} />
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
  </QueryClientProvider>
);

export default App;
