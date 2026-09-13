import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Code2, Copy, CheckCircle2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { toast } from 'sonner';

const BASE_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID || 'sbnlovigyifvrkgsoalj'}.supabase.co/functions/v1/api-integracao`;

const endpoints = [
  { method: 'GET', path: '/health', desc: 'Status da API e listagem de endpoints', auth: false },
  { method: 'GET', path: '/licitacoes', desc: 'Listar licitações (paginado: ?page=1&limit=50&status=...)', auth: true },
  { method: 'GET', path: '/licitacoes/:id', desc: 'Detalhe de uma licitação', auth: true },
  { method: 'POST', path: '/licitacoes', desc: 'Criar licitação', auth: true },
  { method: 'PUT', path: '/licitacoes/:id', desc: 'Atualizar licitação', auth: true },
  { method: 'DELETE', path: '/licitacoes/:id', desc: 'Excluir licitação', auth: true },
  { method: 'GET', path: '/empresas', desc: 'Listar empresas do usuário', auth: true },
  { method: 'GET', path: '/empresas/:id', desc: 'Detalhe de uma empresa', auth: true },
  { method: 'GET', path: '/documentos', desc: 'Listar documentos (?licitacao_id=...)', auth: true },
  { method: 'GET', path: '/kanban', desc: 'Listar tarefas do Kanban', auth: true },
  { method: 'PUT', path: '/kanban/:id', desc: 'Atualizar tarefa do Kanban', auth: true },
  { method: 'GET', path: '/catalogo', desc: 'Listar itens precificados do catálogo', auth: true },
];

// Verbo HTTP em família semântica do Badge: leitura verde, escrita neutra,
// atualização âmbar, remoção vermelha.
const methodVariant: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
  GET: 'success',
  POST: 'info',
  PUT: 'warning',
  DELETE: 'danger',
};

export default function ApiIntegracao() {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const copyExample = (idx: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    toast.success('Copiado!');
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const curlExample = `curl -X GET "${BASE_URL}/licitacoes?page=1&limit=10" \\
  -H "Authorization: Bearer SEU_TOKEN_JWT" \\
  -H "Content-Type: application/json"`;

  const postExample = `curl -X POST "${BASE_URL}/licitacoes" \\
  -H "Authorization: Bearer SEU_TOKEN_JWT" \\
  -H "Content-Type: application/json" \\
  -d '{
    "numero": "PE-001/2026",
    "objeto": "Aquisição de material de escritório",
    "orgao": "Prefeitura Municipal",
    "modalidade": "Pregão Eletrônico",
    "status": "Publicado"
  }'`;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl">
        <CabecalhoPagina
          icone={<Code2 />}
          titulo="API de Integração (ERP)"
          descricao="Endpoints REST para integrar com sistemas externos (ERPs, CRMs, etc.)"
        />

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-2">Autenticação</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Envie o token JWT do usuário no header <code className="bg-muted px-1 rounded-sm">Authorization: Bearer {'<token>'}</code>.
            O token é obtido ao fazer login na plataforma.
          </p>
          <div className="bg-muted rounded-lg p-4 text-sm font-mono relative overflow-x-auto">
            <pre className="whitespace-pre-wrap pr-10">{curlExample}</pre>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8"
              onClick={() => copyExample(-1, curlExample)}
              aria-label="Copiar exemplo de autenticação"
            >
              {copiedIdx === -1 ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Endpoints Disponíveis</h2>
          <div className="space-y-2">
            {endpoints.map((ep, idx) => (
              <div
                key={idx}
                className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted transition-colors"
              >
                <Badge variant={methodVariant[ep.method]} className="font-mono min-w-[60px] justify-center">
                  {ep.method}
                </Badge>
                <code className="text-sm font-mono text-foreground sm:min-w-[200px] break-all">{ep.path}</code>
                <span className="text-sm text-muted-foreground flex-1 min-w-[12rem]">{ep.desc}</span>
                {ep.auth && (
                  <Badge variant="muted" className="gap-1">
                    <Lock className="w-3 h-3" aria-hidden="true" /> Auth
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-2">Exemplo: Criar Licitação</h2>
          <div className="bg-muted rounded-lg p-4 text-sm font-mono relative overflow-x-auto">
            <pre className="whitespace-pre-wrap pr-10">{postExample}</pre>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8"
              onClick={() => copyExample(-2, postExample)}
              aria-label="Copiar exemplo de criação"
            >
              {copiedIdx === -2 ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-2">Base URL</h2>
          <div className="bg-muted rounded-lg p-4 text-sm font-mono flex items-center justify-between gap-2">
            <span className="min-w-0 break-all">{BASE_URL}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => copyExample(-3, BASE_URL)} aria-label="Copiar Base URL">
              {copiedIdx === -3 ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
