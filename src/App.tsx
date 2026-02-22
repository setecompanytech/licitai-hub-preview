import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
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
import Precificacao from "./pages/Precificacao";
import Assistente from "./pages/Assistente";
import Analytics from "./pages/Analytics";
import MonitoramentoEditais from "./pages/MonitoramentoEditais";
import Configuracoes from "./pages/Configuracoes";
import NotFound from "./pages/NotFound";

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
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={<ProtectedPages><Index /></ProtectedPages>} />
            <Route path="/licitacoes" element={<Navigate to="/monitoramento-editais" replace />} />
            <Route path="/kanban" element={<ProtectedPages><KanbanPage /></ProtectedPages>} />
            <Route path="/robo-lances" element={<ProtectedPages><RoboLances /></ProtectedPages>} />
            <Route path="/concorrentes" element={<ProtectedPages><Concorrentes /></ProtectedPages>} />
            <Route path="/documentos" element={<ProtectedPages><Documentos /></ProtectedPages>} />
            <Route path="/apoio-juridico" element={<ProtectedPages><ApoioJuridico /></ProtectedPages>} />
            <Route path="/precificacao" element={<ProtectedPages><Precificacao /></ProtectedPages>} />
            <Route path="/assistente" element={<ProtectedPages><Assistente /></ProtectedPages>} />
            <Route path="/analytics" element={<ProtectedPages><Analytics /></ProtectedPages>} />
            <Route path="/monitoramento-editais" element={<ProtectedPages><MonitoramentoEditais /></ProtectedPages>} />
            <Route path="/configuracoes" element={<ProtectedPages><Configuracoes /></ProtectedPages>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
