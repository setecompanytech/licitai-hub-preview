import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Copy, CheckCircle2, Lock } from 'lucide-react';
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
      <div className="max-w-5xl space-y-6">
        {/* Título, descrição e ícone vêm de `lib/navegacao/paginas.ts` —
            /api-integracao é item de menu. O "(ERP)" que estava no h1 virou
            a primeira linha do bloco de endpoints, onde o leitor precisa
            dele. */}
        <CabecalhoPagina />

        {/* Cartões do DS v3: p-5, título 16/24, descrição 13. Chaves, exemplos
            e endpoints em blocos `bg-secondary rounded-md font-mono text-sm`;
            o botão de copiar é só-ícone (`icon-sm`) com aria-label. */}
        <Card className="p-5">
          <h2 className="text-lg font-semibold leading-6 text-foreground">Autenticação</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Envie o token JWT do usuário no header <code className="rounded-sm bg-secondary px-1 font-mono text-foreground">Authorization: Bearer {'<token>'}</code>.
            O token é obtido ao fazer login na plataforma.
          </p>
          <div className="relative mt-4 overflow-x-auto rounded-md bg-secondary p-4 font-mono text-sm text-foreground">
            <pre className="whitespace-pre-wrap pr-12">{curlExample}</pre>
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute right-2 top-2"
              onClick={() => copyExample(-1, curlExample)}
              aria-label="Copiar exemplo de autenticação"
            >
              {copiedIdx === -1 ? <CheckCircle2 className="text-success-ink" aria-hidden="true" /> : <Copy aria-hidden="true" />}
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-lg font-semibold leading-6 text-foreground">Endpoints disponíveis</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            REST em JSON, para integrar com sistemas externos — ERPs, CRMs e afins.
          </p>
          {/* Uma linha por endpoint, separadas por um fio; o caminho vai num
              bloco mono rebaixado e embrulha no celular sem vazar. */}
          <div className="mt-4 divide-y divide-border rounded-lg border border-border">
            {endpoints.map((ep, idx) => (
              <div
                key={idx}
                className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-muted/60"
              >
                <Badge variant={methodVariant[ep.method]} className="min-w-16 justify-center font-mono">
                  {ep.method}
                </Badge>
                <code className="rounded-md bg-secondary px-2 py-1 font-mono text-sm text-foreground [overflow-wrap:anywhere] sm:min-w-48">{ep.path}</code>
                <span className="min-w-48 flex-1 text-sm text-muted-foreground">{ep.desc}</span>
                {ep.auth && (
                  <Badge variant="muted" className="gap-1">
                    <Lock className="h-3 w-3" aria-hidden="true" /> Requer token
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-lg font-semibold leading-6 text-foreground">Exemplo: criar licitação</h2>
          <div className="relative mt-4 overflow-x-auto rounded-md bg-secondary p-4 font-mono text-sm text-foreground">
            <pre className="whitespace-pre-wrap pr-12">{postExample}</pre>
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute right-2 top-2"
              onClick={() => copyExample(-2, postExample)}
              aria-label="Copiar exemplo de criação"
            >
              {copiedIdx === -2 ? <CheckCircle2 className="text-success-ink" aria-hidden="true" /> : <Copy aria-hidden="true" />}
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-lg font-semibold leading-6 text-foreground">Base URL</h2>
          <div className="mt-4 flex items-center justify-between gap-2 rounded-md bg-secondary p-4 font-mono text-sm text-foreground">
            <span className="min-w-0 [overflow-wrap:anywhere]">{BASE_URL}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              className="shrink-0"
              onClick={() => copyExample(-3, BASE_URL)}
              aria-label="Copiar Base URL"
            >
              {copiedIdx === -3 ? <CheckCircle2 className="text-success-ink" aria-hidden="true" /> : <Copy aria-hidden="true" />}
            </Button>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
