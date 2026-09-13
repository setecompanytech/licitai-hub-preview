import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { Button } from '@/components/ui/button';
import { Building2, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import CadastroCertificado from '@/components/empresa/CadastroCertificado';
import EditEmpresaDialog from '@/components/empresa/EditEmpresaDialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function Empresas() {
  const { empresas, empresaAtiva, todasSelecionadas, reloadEmpresas } = useEmpresa();
  const [showForm, setShowForm] = useState(false);
  const [editEmpresa, setEditEmpresa] = useState<any>(null);

  const handleDelete = async (empresaId: string, razaoSocial: string) => {
    if (!confirm(`Remover a empresa "${razaoSocial}"? Essa ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from('empresas').delete().eq('id', empresaId);
    if (error) {
      toast.error('Erro ao remover empresa');
    } else {
      toast.success('Empresa removida');
      reloadEmpresas();
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl">
        <CabecalhoPagina
          acoes={
            <Button onClick={() => setShowForm(!showForm)} aria-expanded={showForm}>
              <Plus aria-hidden="true" />
              Nova empresa
            </Button>
          }
        />

        {showForm && (
          <section className="mb-6 rounded-lg border border-border bg-card p-6 shadow-sm">
            <CadastroCertificado onSuccess={() => setShowForm(false)} />
          </section>
        )}

        {empresas.length === 0 ? (
          <section className="rounded-lg border border-border bg-card shadow-sm">
            <EstadoVazio
              icone={<Building2 />}
              titulo="Nenhuma empresa cadastrada"
              descricao="Cadastre sua primeira empresa via certificado digital para começar."
              acao={
                <Button onClick={() => setShowForm(true)}>
                  <ShieldCheck aria-hidden="true" />
                  Cadastrar com Certificado Digital
                </Button>
              }
            />
          </section>
        ) : (
          <div className="space-y-3">
            {empresas.map((m) => {
              const ativa = !todasSelecionadas && empresaAtiva?.id === m.empresa_id;
              return (
                <section
                  key={m.empresa_id}
                  className={cn(
                    'rounded-lg border bg-card p-6 shadow-sm transition-colors',
                    ativa ? 'border-primary' : 'border-border',
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-tint text-primary">
                        <Building2 className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-foreground">
                            {m.empresa.nome_fantasia || m.empresa.razao_social}
                          </h3>
                          <Badge variant="info">{m.papel}</Badge>
                          {m.empresa.regime_tributario && (
                            <Badge variant="muted">
                              {m.empresa.regime_tributario === 'simples_nacional' ? 'Simples Nacional' :
                               m.empresa.regime_tributario === 'lucro_presumido' ? 'Lucro Presumido' : 'Lucro Real'}
                            </Badge>
                          )}
                          {ativa && (
                            <Badge variant="success">Ativa</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{m.empresa.cnpj}</p>
                        {m.empresa.razao_social !== m.empresa.nome_fantasia && m.empresa.nome_fantasia && (
                          <p className="text-sm text-muted-foreground">{m.empresa.razao_social}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {m.empresa.certificado_nome && (
                        <Badge variant="muted" className="gap-1" truncate>
                          <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                          {m.empresa.certificado_nome}
                        </Badge>
                      )}
                      {m.papel === 'admin' && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-primary"
                            onClick={() => setEditEmpresa(m.empresa)}
                            title="Editar empresa"
                            aria-label="Editar empresa"
                          >
                            <Pencil aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(m.empresa_id, m.empresa.razao_social)}
                            title="Remover empresa"
                            aria-label="Remover empresa"
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  {m.empresa.certificado_validade && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Certificado válido até: {new Date(m.empresa.certificado_validade).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </section>
              );
            })}
          </div>
        )}

        <EditEmpresaDialog
          empresa={editEmpresa}
          open={!!editEmpresa}
          onOpenChange={(open) => { if (!open) setEditEmpresa(null); }}
          onSuccess={() => { reloadEmpresas(); setEditEmpresa(null); }}
        />
      </div>
    </AppLayout>
  );
}
