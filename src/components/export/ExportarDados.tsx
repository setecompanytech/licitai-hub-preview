import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const TABLES = [
  { key: 'empresas', label: 'Empresas' },
  { key: 'licitacoes', label: 'Licitações' },
  { key: 'documentos', label: 'Documentos' },
  { key: 'contratos', label: 'Contratos' },
  { key: 'contrato_aditivos', label: 'Aditivos de Contrato' },
  { key: 'kanban_tasks', label: 'Kanban' },
  { key: 'catalogo_itens_precificados', label: 'Catálogo de Preços' },
  { key: 'composicoes_custo', label: 'Composições de Custo' },
  { key: 'apoio_juridico', label: 'Apoio Jurídico' },
  { key: 'apoio_contabil', label: 'Apoio Contábil' },
  { key: 'base_juridica', label: 'Base Jurídica' },
  { key: 'base_contabil', label: 'Base Contábil' },
  { key: 'concorrentes', label: 'Concorrentes' },
  { key: 'editais_favoritos', label: 'Editais Favoritos' },
  { key: 'configuracoes', label: 'Configurações' },
  { key: 'lances', label: 'Lances' },
] as const;

export default function ExportarDados({ variant = 'button' }: { variant?: 'button' | 'menu-item' }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const result: Record<string, unknown[]> = {};
      
      await Promise.all(
        TABLES.map(async ({ key }) => {
          const query = (supabase.from(key as any) as any).select('*');
          // Tables with user_id filter
          if (key !== 'empresas') {
            query.eq('user_id', user.id);
          }
          const { data } = await query.limit(5000);
          if (data && data.length > 0) {
            result[key] = data;
          }
        })
      );

      // For empresas, filter by membership
      const { data: memberships } = await supabase
        .from('empresa_membros')
        .select('empresa_id')
        .eq('user_id', user.id);
      
      if (memberships && memberships.length > 0) {
        const ids = memberships.map((m) => m.empresa_id);
        const { data: empresas } = await supabase
          .from('empresas')
          .select('*')
          .in('id', ids);
        if (empresas) result.empresas = empresas;
      }

      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `praefectus-dados-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Dados exportados com sucesso!');
    } catch {
      toast.error('Erro ao exportar dados.');
    } finally {
      setLoading(false);
    }
  };

  if (variant === 'menu-item') {
    return (
      <button
        className="w-full flex items-center gap-3 px-5 py-2 text-[13px] text-foreground hover:bg-muted transition-colors text-left"
        onClick={handleExport}
        disabled={loading}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <Download className="w-4 h-4 text-muted-foreground shrink-0" />}
        <span>Exportar Meus Dados</span>
      </button>
    );
  }

  return (
    <Button onClick={handleExport} disabled={loading} variant="outline" className="gap-2">
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      Exportar Meus Dados
    </Button>
  );
}
