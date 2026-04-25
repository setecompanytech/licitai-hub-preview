import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';

export default function Financeiro() {
  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Módulo Financeiro PRAEFECTUS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              O novo módulo financeiro foi inicializado. O schema do banco está pronto
              (14 tabelas <code>financeiro_*</code>, RLS por empresa, materialized views
              de DRE e fluxo de caixa, plano de contas brasileiro disponível via
              <code> seed_plano_contas_padrao(empresa_id)</code>).
            </p>
            <p>
              As próximas entregas (Dashboard, Conciliação, CRUD de lançamentos,
              edge functions OFX/Pluggy/SEFAZ) serão construídas nas próximas mensagens
              conforme o roadmap dos 6 sprints.
            </p>
            <p className="text-xs">
              Bibliotecas já disponíveis: <code>@/lib/financeiro/formatters</code>,
              {' '}<code>@/lib/financeiro/ofx-parser</code>.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
