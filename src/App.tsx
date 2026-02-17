import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Licitacoes from "./pages/Licitacoes";
import KanbanPage from "./pages/KanbanPage";
import RoboLances from "./pages/RoboLances";
import Concorrentes from "./pages/Concorrentes";
import Documentos from "./pages/Documentos";
import ApoioJuridico from "./pages/ApoioJuridico";
import Precificacao from "./pages/Precificacao";
import Assistente from "./pages/Assistente";
import Analytics from "./pages/Analytics";
import Configuracoes from "./pages/Configuracoes";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/licitacoes" element={<Licitacoes />} />
          <Route path="/kanban" element={<KanbanPage />} />
          <Route path="/robo-lances" element={<RoboLances />} />
          <Route path="/concorrentes" element={<Concorrentes />} />
          <Route path="/documentos" element={<Documentos />} />
          <Route path="/apoio-juridico" element={<ApoioJuridico />} />
          <Route path="/precificacao" element={<Precificacao />} />
          <Route path="/assistente" element={<Assistente />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
