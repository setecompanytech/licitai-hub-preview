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
import MaintenanceGuard from "@/components/auth/MaintenanceGuard";
import { Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

// Static imports — always needed immediately
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Index from "./pages/Index";
import LandingPage from "./pages/LandingPage";
import NotFound from "./pages/NotFound";
import CookieConsentBanner from "./components/shared/CookieConsentBanner";

// Lazy imports — loaded on demand
const KanbanPage = lazy(() => import("./pages/KanbanPage"));
const RoboLances = lazy(() => import("./pages/RoboLances"));
const Concorrentes = lazy(() => import("./pages/Concorrentes"));
const Documentos = lazy(() => import("./pages/Documentos"));
const ApoioJuridico = lazy(() => import("./pages/ApoioJuridico"));
const ApoioContabil = lazy(() => import("./pages/ApoioContabil"));
const Precificacao = lazy(() => import("./pages/Precificacao"));
const AureliaPage = lazy(() => import("./pages/AureliaPage"));
const Analytics = lazy(() => import("./pages/Analytics"));
const MonitoramentoEditais = lazy(() => import("./pages/MonitoramentoEditais"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const Empresas = lazy(() => import("./pages/Empresas"));
const AdminTemplates = lazy(() => import("./pages/AdminTemplates"));
const Cadastro = lazy(() => import("./pages/Cadastro"));
const FaqPage = lazy(() => import("./pages/FaqPage"));
const Suporte = lazy(() => import("./pages/Suporte"));
const AdminFinanceiro = lazy(() => import("./pages/AdminFinanceiro"));
const AdminFontesFabricantes = lazy(() => import("./pages/AdminFontesFabricantes"));
const PainelDistribuicao = lazy(() => import("./pages/PainelDistribuicao"));
const MonitoramentoChat = lazy(() => import("./pages/MonitoramentoChat"));
const AnaliseMercado = lazy(() => import("./pages/AnaliseMercado"));
const LicitacoesEstrategicas = lazy(() => import("./pages/LicitacoesEstrategicas"));
const AssessoriaCadastral = lazy(() => import("./pages/AssessoriaCadastral"));
const Blog = lazy(() => import("./pages/Blog"));
const Boletins = lazy(() => import("./pages/Boletins"));
const Ebook = lazy(() => import("./pages/Ebook"));
const PropostaTecnica = lazy(() => import("./pages/PropostaTecnica"));
const HistoricoLicitacoes = lazy(() => import("./pages/HistoricoLicitacoes"));
const Ferramentas = lazy(() => import("./pages/Ferramentas"));
const GestaoContratos = lazy(() => import("./pages/GestaoContratos"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const WhatsAppCRM = lazy(() => import("./pages/WhatsAppCRM"));
const Calendario = lazy(() => import("./pages/Calendario"));
const TermosDeUso = lazy(() => import("./pages/TermosDeUso"));
const PoliticaPrivacidade = lazy(() => import("./pages/PoliticaPrivacidade"));
const LgpdPage = lazy(() => import("./pages/LgpdPage"));
const TutorialPage = lazy(() => import("./pages/TutorialPage"));
const ApiIntegracao = lazy(() => import("./pages/ApiIntegracao"));
const IndicesRepactuacao = lazy(() => import("./pages/IndicesRepactuacao"));
const RelatorioContabil = lazy(() => import("./pages/RelatorioContabil"));
const AdminMarketing = lazy(() => import("./pages/AdminMarketing"));
const AuditoriaAdmin = lazy(() => import("./pages/AuditoriaAdmin"));
const MeusCompromissos = lazy(() => import("./pages/MeusCompromissos"));
const WorkflowIA = lazy(() => import("./pages/WorkflowIA"));
const EquipeColaboradores = lazy(() => import("./pages/EquipeColaboradores"));
const AssistenteEspecializado = lazy(() => import("./pages/AssistenteEspecializado"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const CertificadoUpload = lazy(() => import("./pages/CertificadoUpload"));
const PerfisAlerta = lazy(() => import("./pages/PerfisAlerta"));
const SegurancaInformacao = lazy(() => import("./pages/SegurancaInformacao"));
const ComplianceGovernanca = lazy(() => import("./pages/ComplianceGovernanca"));
const StatusPlataforma = lazy(() => import("./pages/StatusPlataforma"));
const SobreEmpresa = lazy(() => import("./pages/SobreEmpresa"));
const ContatoDemo = lazy(() => import("./pages/ContatoDemo"));
const CentralAjuda = lazy(() => import("./pages/CentralAjuda"));
const PoliticaCookies = lazy(() => import("./pages/PoliticaCookies"));
const PoliticaSLA = lazy(() => import("./pages/PoliticaSLA"));
const Solucoes = lazy(() => import("./pages/Solucoes"));
const AvisoLegal = lazy(() => import("./pages/AvisoLegal"));
const DemoAmbiente = lazy(() => import("./pages/DemoAmbiente"));
const DpaPage = lazy(() => import("./pages/DpaPage"));
const AgentePage = lazy(() => import("./pages/AgentePage"));
const CentralAvisos = lazy(() => import("./pages/CentralAvisos"));
const PreferenciasAlertas = lazy(() => import("./pages/PreferenciasAlertas"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="flex items-center justify-center h-screen bg-background">
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <span className="text-sm text-muted-foreground">Carregando módulo...</span>
    </div>
  </div>
);

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
            <MaintenanceGuard>
            <Suspense fallback={<PageLoader />}>
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
              <Route path="/assistente" element={<Navigate to="/aurelia" replace />} />
              <Route path="/aurelia" element={<PlanPages><AureliaPage /></PlanPages>} />
              <Route path="/analytics" element={<PlanPages><Analytics /></PlanPages>} />
              <Route path="/monitoramento-editais" element={<ProtectedPages><MonitoramentoEditais /></ProtectedPages>} />
              <Route path="/configuracoes" element={<ProtectedPages><Configuracoes /></ProtectedPages>} />
              <Route path="/empresas" element={<ProtectedPages><Empresas /></ProtectedPages>} />
              <Route path="/suporte" element={<ProtectedPages><Suporte /></ProtectedPages>} />
              <Route path="/admin/templates" element={<ProtectedPages><AdminTemplates /></ProtectedPages>} />
              <Route path="/admin/financeiro" element={<ProtectedPages><AdminFinanceiro /></ProtectedPages>} />
              <Route path="/admin/fontes-fabricantes" element={<ProtectedPages><AdminFontesFabricantes /></ProtectedPages>} />
              <Route path="/admin/marketing" element={<ProtectedPages><AdminMarketing /></ProtectedPages>} />
              <Route path="/admin/auditoria" element={<ProtectedPages><AdminGuard><AuditoriaAdmin /></AdminGuard></ProtectedPages>} />
              <Route path="/admin/distribuicao" element={<ProtectedPages><AdminGuard><PainelDistribuicao /></AdminGuard></ProtectedPages>} />
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
              <Route path="/unsubscribe" element={<Unsubscribe />} />
              <Route path="/perfis-alerta" element={<ProtectedPages><PerfisAlerta /></ProtectedPages>} />
              <Route path="/certificado-upload" element={<CertificadoUpload />} />
              <Route path="/seguranca-informacao" element={<SegurancaInformacao />} />
              <Route path="/compliance" element={<ComplianceGovernanca />} />
              <Route path="/status" element={<StatusPlataforma />} />
              <Route path="/sobre" element={<SobreEmpresa />} />
              <Route path="/contato" element={<ContatoDemo />} />
              <Route path="/ajuda" element={<CentralAjuda />} />
              <Route path="/politica-cookies" element={<PoliticaCookies />} />
              <Route path="/politica-sla" element={<PoliticaSLA />} />
              <Route path="/aviso-legal" element={<AvisoLegal />} />
              <Route path="/solucoes" element={<Solucoes />} />
              <Route path="/demo" element={<DemoAmbiente />} />
              <Route path="/dpa" element={<DpaPage />} />
              <Route path="/agente" element={<PlanPages><AgentePage /></PlanPages>} />
              <Route path="/avisos" element={<ProtectedPages><CentralAvisos /></ProtectedPages>} />
              <Route path="/configuracoes/alertas" element={<ProtectedPages><PreferenciasAlertas /></ProtectedPages>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            <CookieConsentBanner />
            </MaintenanceGuard>
          </PropostaCartProvider>
          </EmpresaProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
