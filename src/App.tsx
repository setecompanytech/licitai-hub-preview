import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { EmpresaProvider } from "@/contexts/EmpresaContext";
import { PropostaCartProvider } from "@/contexts/PropostaCartContext";
import { ProcessoAtivoProvider } from "@/contexts/ProcessoAtivoContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import PlanGuard from "@/components/auth/PlanGuard";
import AdminGuard from "@/components/auth/AdminGuard";
import MaintenanceGuard from "@/components/auth/MaintenanceGuard";
import { Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { lazyImportWithRecovery } from "@/lib/chunk-recovery";

// Static imports — always needed immediately
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Index from "./pages/Index";
import LandingPage from "./pages/LandingPage";
import NotFound from "./pages/NotFound";
import CookieConsentBanner from "./components/shared/CookieConsentBanner";

// Lazy imports — loaded on demand
const lazyPage = (loader: () => Promise<any>) => lazy(() => lazyImportWithRecovery(loader));

const KanbanPage = lazyPage(() => import("./pages/KanbanPage"));
const RoboLances = lazyPage(() => import("./pages/RoboLances"));
const Concorrentes = lazyPage(() => import("./pages/Concorrentes"));
const Documentos = lazyPage(() => import("./pages/Documentos"));
const ApoioJuridico = lazyPage(() => import("./pages/ApoioJuridico"));
const ApoioContabil = lazyPage(() => import("./pages/ApoioContabil"));
const Precificacao = lazyPage(() => import("./pages/Precificacao"));
const AureliaPage = lazyPage(() => import("./pages/AureliaPage"));
const Analytics = lazyPage(() => import("./pages/Analytics"));
const MonitoramentoEditais = lazyPage(() => import("./pages/MonitoramentoEditais"));
const DiariosOficiais = lazyPage(() => import("./pages/DiariosOficiais"));
const Configuracoes = lazyPage(() => import("./pages/Configuracoes"));
const Empresas = lazyPage(() => import("./pages/Empresas"));
const AdminTemplates = lazyPage(() => import("./pages/AdminTemplates"));
const AdminMuralTelemetria = lazyPage(() => import("./pages/AdminMuralTelemetria"));
const Cadastro = lazyPage(() => import("./pages/Cadastro"));
const FaqPage = lazyPage(() => import("./pages/FaqPage"));
const Suporte = lazyPage(() => import("./pages/Suporte"));
const AdminFinanceiro = lazyPage(() => import("./pages/AdminFinanceiro"));
const AdminFontesFabricantes = lazyPage(() => import("./pages/AdminFontesFabricantes"));
const PainelDistribuicao = lazyPage(() => import("./pages/PainelDistribuicao"));
const MonitoramentoChat = lazyPage(() => import("./pages/MonitoramentoChat"));
const AnaliseMercado = lazyPage(() => import("./pages/AnaliseMercado"));
const LicitacoesEstrategicas = lazyPage(() => import("./pages/LicitacoesEstrategicas"));
const AssessoriaCadastral = lazyPage(() => import("./pages/AssessoriaCadastral"));
const Blog = lazyPage(() => import("./pages/Blog"));
const Boletins = lazyPage(() => import("./pages/Boletins"));
const Ebook = lazyPage(() => import("./pages/Ebook"));
const PropostaTecnica = lazyPage(() => import("./pages/PropostaTecnica"));
const HistoricoLicitacoes = lazyPage(() => import("./pages/HistoricoLicitacoes"));
const Ferramentas = lazyPage(() => import("./pages/Ferramentas"));
const GestaoContratos = lazyPage(() => import("./pages/GestaoContratos"));
const Financeiro = lazyPage(() => import("./pages/Financeiro"));
const AuditoriaBancos = lazyPage(() => import("./pages/AuditoriaBancos"));
const WhatsAppCRM = lazyPage(() => import("./pages/WhatsAppCRM"));
const Calendario = lazyPage(() => import("./pages/Calendario"));
const TermosDeUso = lazyPage(() => import("./pages/TermosDeUso"));
const PoliticaPrivacidade = lazyPage(() => import("./pages/PoliticaPrivacidade"));
const LgpdPage = lazyPage(() => import("./pages/LgpdPage"));
const TutorialPage = lazyPage(() => import("./pages/TutorialPage"));
const ApiIntegracao = lazyPage(() => import("./pages/ApiIntegracao"));
const IndicesRepactuacao = lazyPage(() => import("./pages/IndicesRepactuacao"));
const RelatorioContabil = lazyPage(() => import("./pages/RelatorioContabil"));
const AdminMarketing = lazyPage(() => import("./pages/AdminMarketing"));
const AuditoriaAdmin = lazyPage(() => import("./pages/AuditoriaAdmin"));
const MeusCompromissos = lazyPage(() => import("./pages/MeusCompromissos"));
const WorkflowIA = lazyPage(() => import("./pages/WorkflowIA"));
const EquipeColaboradores = lazyPage(() => import("./pages/EquipeColaboradores"));
const EquipePermissoes = lazyPage(() => import("./pages/EquipePermissoes"));
const AssistenteEspecializado = lazyPage(() => import("./pages/AssistenteEspecializado"));
const Unsubscribe = lazyPage(() => import("./pages/Unsubscribe"));
const CertificadoUpload = lazyPage(() => import("./pages/CertificadoUpload"));
const PerfisAlerta = lazyPage(() => import("./pages/PerfisAlerta"));
const SegurancaInformacao = lazyPage(() => import("./pages/SegurancaInformacao"));
const ComplianceGovernanca = lazyPage(() => import("./pages/ComplianceGovernanca"));
const StatusPlataforma = lazyPage(() => import("./pages/StatusPlataforma"));
const SobreEmpresa = lazyPage(() => import("./pages/SobreEmpresa"));
const ContatoDemo = lazyPage(() => import("./pages/ContatoDemo"));
const CentralAjuda = lazyPage(() => import("./pages/CentralAjuda"));
const PoliticaCookies = lazyPage(() => import("./pages/PoliticaCookies"));
const PoliticaSLA = lazyPage(() => import("./pages/PoliticaSLA"));
const Solucoes = lazyPage(() => import("./pages/Solucoes"));
const AvisoLegal = lazyPage(() => import("./pages/AvisoLegal"));
const DemoAmbiente = lazyPage(() => import("./pages/DemoAmbiente"));
const DpaPage = lazyPage(() => import("./pages/DpaPage"));
const AgentePage = lazyPage(() => import("./pages/AgentePage"));
const CentralAvisos = lazyPage(() => import("./pages/CentralAvisos"));
const PreferenciasAlertas = lazyPage(() => import("./pages/PreferenciasAlertas"));
const MetricasSaaS = lazyPage(() => import("./pages/MetricasSaaS"));
const Investidores = lazyPage(() => import("./pages/Investidores"));
const ProcessoWorkspace = lazyPage(() => import("./pages/ProcessoWorkspace"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 2 * 60 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: (failureCount, error: any) => {
        if (error?.status >= 400 && error?.status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

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
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <EmpresaProvider>
          <PropostaCartProvider>
            <ProcessoAtivoProvider>
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
              <Route path="/diarios-oficiais" element={<ProtectedPages><DiariosOficiais /></ProtectedPages>} />
              <Route path="/configuracoes" element={<ProtectedPages><Configuracoes /></ProtectedPages>} />
              <Route path="/empresas" element={<ProtectedPages><Empresas /></ProtectedPages>} />
              <Route path="/suporte" element={<ProtectedPages><Suporte /></ProtectedPages>} />
              <Route path="/admin/templates" element={<ProtectedPages><AdminGuard><AdminTemplates /></AdminGuard></ProtectedPages>} />
              <Route path="/admin/financeiro" element={<ProtectedPages><AdminGuard><AdminFinanceiro /></AdminGuard></ProtectedPages>} />
              <Route path="/admin/fontes-fabricantes" element={<ProtectedPages><AdminGuard><AdminFontesFabricantes /></AdminGuard></ProtectedPages>} />
              <Route path="/admin/marketing" element={<ProtectedPages><AdminGuard><AdminMarketing /></AdminGuard></ProtectedPages>} />
              <Route path="/admin/auditoria" element={<ProtectedPages><AdminGuard><AuditoriaAdmin /></AdminGuard></ProtectedPages>} />
              <Route path="/admin/distribuicao" element={<ProtectedPages><AdminGuard><PainelDistribuicao /></AdminGuard></ProtectedPages>} />
              <Route path="/admin/mural-telemetria" element={<ProtectedPages><AdminGuard><AdminMuralTelemetria /></AdminGuard></ProtectedPages>} />
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
              <Route path="/financeiro" element={<ProtectedPages><Financeiro /></ProtectedPages>} />
              <Route path="/auditoria-bancos" element={<ProtectedPages><AuditoriaBancos /></ProtectedPages>} />
              <Route path="/equipe" element={<PlanPages><EquipeColaboradores /></PlanPages>} />
              <Route path="/equipe/permissoes" element={<PlanPages><EquipePermissoes /></PlanPages>} />
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
              <Route path="/admin/metricas-saas" element={<ProtectedPages><AdminGuard><MetricasSaaS /></AdminGuard></ProtectedPages>} />
              <Route path="/investidores" element={<Investidores />} />
              <Route path="/processo/:id" element={<ProtectedPages><ProcessoWorkspace /></ProtectedPages>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            <CookieConsentBanner />
            </MaintenanceGuard>
            </ProcessoAtivoProvider>
          </PropostaCartProvider>
          </EmpresaProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
