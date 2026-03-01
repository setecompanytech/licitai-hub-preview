import AppLayout from '@/components/layout/AppLayout';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { Button } from '@/components/ui/button';
import { Building2, Plus, ShieldCheck, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import CadastroCertificado from '@/components/empresa/CadastroCertificado';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function Empresas() {
  const { empresas, empresaAtiva, todasSelecionadas, reloadEmpresas } = useEmpresa();
  const [showForm, setShowForm] = useState(false);

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
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Empresas</h1>
            <p className="text-sm text-muted-foreground mt-1">Gerencie suas empresas e certificados digitais</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Plus className="w-4 h-4 mr-2" />
            Nova Empresa
          </Button>
        </div>

        {showForm && (
          <section className="bg-card rounded-xl border border-border/50 p-5 shadow-sm mb-6">
            <CadastroCertificado onSuccess={() => setShowForm(false)} />
          </section>
        )}

        {empresas.length === 0 ? (
          <section className="bg-card rounded-xl border border-border/50 p-8 shadow-sm text-center">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold mb-1">Nenhuma empresa cadastrada</h3>
            <p className="text-sm text-muted-foreground mb-4">Cadastre sua primeira empresa via certificado digital para começar.</p>
            <Button onClick={() => setShowForm(true)} className="bg-accent hover:bg-accent/90 text-accent-foreground">
              <ShieldCheck className="w-4 h-4 mr-2" />
              Cadastrar com Certificado Digital
            </Button>
          </section>
        ) : (
          <div className="space-y-3">
            {empresas.map((m) => (
              <section
                key={m.empresa_id}
                className={`bg-card rounded-xl border p-5 shadow-sm transition-all ${
                  !todasSelecionadas && empresaAtiva?.id === m.empresa_id
                    ? 'border-accent/50 ring-1 ring-accent/20'
                    : 'border-border/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm">
                          {m.empresa.nome_fantasia || m.empresa.razao_social}
                        </h3>
                        <Badge variant="outline" className="text-[10px]">{m.papel}</Badge>
                        {m.empresa.regime_tributario && (
                          <Badge variant="secondary" className="text-[10px]">
                            {m.empresa.regime_tributario === 'simples_nacional' ? 'Simples Nacional' :
                             m.empresa.regime_tributario === 'lucro_presumido' ? 'Lucro Presumido' : 'Lucro Real'}
                          </Badge>
                        )}
                        {!todasSelecionadas && empresaAtiva?.id === m.empresa_id && (
                          <Badge className="bg-accent/15 text-accent text-[10px]">Ativa</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{m.empresa.cnpj}</p>
                      {m.empresa.razao_social !== m.empresa.nome_fantasia && m.empresa.nome_fantasia && (
                        <p className="text-xs text-muted-foreground">{m.empresa.razao_social}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.empresa.certificado_nome && (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        {m.empresa.certificado_nome}
                      </Badge>
                    )}
                    {m.papel === 'admin' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive/60 hover:text-destructive"
                        onClick={() => handleDelete(m.empresa_id, m.empresa.razao_social)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {m.empresa.certificado_validade && (
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Certificado válido até: {new Date(m.empresa.certificado_validade).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
