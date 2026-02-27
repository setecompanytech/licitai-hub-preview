import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Building2, RefreshCw } from 'lucide-react';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const tipoLabels: Record<string, string> = {
  edital: 'Edital',
  aviso: 'Aviso de Licitação',
  cancelamento: 'Cancelado',
  suspenso: 'Suspenso',
  adiado: 'Adiado',
  aditivado: 'Aditivado',
  adjudicado: 'Adjudicado',
  homologado: 'Homologado',
};

const tipoColors: Record<string, string> = {
  edital: 'bg-info/15 text-info border-info/30',
  aviso: 'bg-accent/15 text-accent border-accent/30',
  cancelamento: 'bg-destructive/15 text-destructive border-destructive/30',
  suspenso: 'bg-warning/15 text-warning border-warning/30',
  adiado: 'bg-warning/15 text-warning border-warning/30',
  aditivado: 'bg-primary/15 text-primary border-primary/30',
  adjudicado: 'bg-success/15 text-success border-success/30',
  homologado: 'bg-success/15 text-success border-success/30',
};

type ConfigData = {
  palavras_chave: string;
  ufs_interesse: string;
  valor_minimo: string;
  valor_maximo: string;
  frequencia: string;
};

export default function ConfiguracaoPesquisaTab() {
  const { empresaAtiva } = useEmpresa();
  const { user } = useAuth();
  const [cnaesSecundarios, setCnaesSecundarios] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<ConfigData>({
    palavras_chave: '',
    ufs_interesse: 'AC, AL, AP, AM, BA, CE, DF, ES, GO, MA, MT, MS, MG, PA, PB, PR, PE, PI, RJ, RN, RS, RO, RR, SC, SP, SE, TO',
    valor_minimo: '',
    valor_maximo: '',
    frequencia: 'A cada 30 minutos',
  });

  // Load config + CNAEs from DB
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('configuracoes')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setConfig({
          palavras_chave: (data.palavras_chave || []).join(', '),
          ufs_interesse: (data.ufs_interesse || []).join(', '),
          valor_minimo: data.valor_minimo?.toString() || '',
          valor_maximo: data.valor_maximo?.toString() || '',
          frequencia: 'A cada 30 minutos',
        });
        setCnaesSecundarios(data.cnaes_monitorados || []);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const payload = {
      user_id: user.id,
      palavras_chave: config.palavras_chave.split(',').map(s => s.trim()).filter(Boolean),
      ufs_interesse: config.ufs_interesse.split(',').map(s => s.trim()).filter(Boolean),
      valor_minimo: config.valor_minimo ? parseFloat(config.valor_minimo.replace(/\./g, '').replace(',', '.')) : null,
      valor_maximo: config.valor_maximo ? parseFloat(config.valor_maximo.replace(/\./g, '').replace(',', '.')) : null,
      cnaes_monitorados: cnaesSecundarios,
      updated_at: new Date().toISOString(),
    };

    // Upsert
    const { data: existing } = await supabase
      .from('configuracoes')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      await supabase.from('configuracoes').update(payload).eq('id', existing.id);
    } else {
      await supabase.from('configuracoes').insert(payload);
    }

    toast.success('Configuração salva com sucesso!');
    setSaving(false);
  };

  // Sync CNAEs from empresa ativa
  const handleSyncFromEmpresa = async () => {
    if (!empresaAtiva) {
      toast.error('Nenhuma empresa ativa selecionada');
      return;
    }

    // The CNAE principal comes from empresa. For secondary CNAEs,
    // we can also check the consulta-cnpj endpoint for full data.
    toast.info('Buscando CNAEs do CNPJ...');

    try {
      const { data, error } = await supabase.functions.invoke('consulta-cnpj', {
        body: { cnpj: empresaAtiva.cnpj.replace(/\D/g, '') },
      });

      if (error) throw error;

      const cnaePrincipal = data?.cnae_fiscal
        ? `${data.cnae_fiscal} - ${data.cnae_fiscal_descricao || ''}`
        : empresaAtiva.cnae_principal;

      // Update empresa cnae_principal if different
      if (cnaePrincipal && cnaePrincipal !== empresaAtiva.cnae_principal) {
        await supabase.from('empresas').update({ cnae_principal: cnaePrincipal }).eq('id', empresaAtiva.id);
      }

      // Extract secondary CNAEs
      const secundarios: string[] = [];
      if (data?.cnaes_secundarios && Array.isArray(data.cnaes_secundarios)) {
        data.cnaes_secundarios.forEach((c: any) => {
          const code = c.codigo?.toString() || '';
          const desc = c.descricao || '';
          if (code) secundarios.push(`${code} - ${desc}`.trim());
        });
      }

      if (secundarios.length > 0) {
        setCnaesSecundarios(secundarios);
        toast.success(`${secundarios.length} CNAEs secundários importados do CNPJ`);
      } else {
        toast.info('Nenhum CNAE secundário encontrado no CNPJ');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao consultar CNPJ: ' + (err.message || 'tente novamente'));
    }
  };

  const removeCnae = (idx: number) => {
    setCnaesSecundarios(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm space-y-4">
      <h3 className="text-sm font-semibold">Configuração de Pesquisa Automática</h3>

      <div className="grid grid-cols-2 gap-4">
        {/* CNAE Principal - from empresa */}
        <div>
          <label className="text-xs text-muted-foreground">CNAE Principal</label>
          <div className="flex gap-2 mt-1">
            <Input
              value={empresaAtiva?.cnae_principal || 'Nenhuma empresa selecionada'}
              readOnly
              className="flex-1"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleSyncFromEmpresa}
              disabled={!empresaAtiva}
              title="Buscar CNAEs diretamente do CNPJ da empresa"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Sincronizar CNPJ
            </Button>
          </div>
          {empresaAtiva && (
            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              {empresaAtiva.razao_social} – CNPJ: {empresaAtiva.cnpj}
            </p>
          )}
        </div>

        {/* CNAEs Secundários */}
        <div>
          <label className="text-xs text-muted-foreground">
            CNAEs Secundários ({cnaesSecundarios.length} cadastrados)
          </label>
          <div className="mt-1 p-2 rounded-lg border border-border/50 min-h-[38px] max-h-32 overflow-y-auto flex flex-wrap gap-1">
            {cnaesSecundarios.length > 0 ? (
              cnaesSecundarios.map((cnae, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className="bg-primary/10 text-primary border-primary/20 text-[10px] pr-1 cursor-pointer hover:bg-destructive/10"
                  onClick={() => removeCnae(idx)}
                  title="Clique para remover"
                >
                  {cnae.length > 40 ? cnae.slice(0, 40) + '…' : cnae}
                  <span className="ml-1 text-destructive">×</span>
                </Badge>
              ))
            ) : (
              <p className="text-[10px] text-muted-foreground italic">
                Clique em "Sincronizar CNPJ" para importar
              </p>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Clique em "Sincronizar CNPJ" para buscar automaticamente ou gerencie em Configurações → CNAEs Secundários
          </p>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Palavras-chave</label>
          <Input
            value={config.palavras_chave}
            onChange={(e) => setConfig({ ...config, palavras_chave: e.target.value })}
            placeholder="construção, pavimentação, obra, reforma"
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">UFs monitoradas</label>
          <Input
            value={config.ufs_interesse}
            onChange={(e) => setConfig({ ...config, ufs_interesse: e.target.value })}
            placeholder="PA, MA, AP, TO"
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Frequência de busca</label>
          <Input value={config.frequencia} className="mt-1" readOnly />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Valor mínimo (R$)</label>
          <Input
            value={config.valor_minimo}
            onChange={(e) => setConfig({ ...config, valor_minimo: e.target.value })}
            placeholder="500.000"
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Valor máximo (R$)</label>
          <Input
            value={config.valor_maximo}
            onChange={(e) => setConfig({ ...config, valor_maximo: e.target.value })}
            placeholder="100.000.000"
            className="mt-1"
          />
        </div>
      </div>

      <div className="pt-2">
        <h4 className="text-xs font-semibold mb-2 text-muted-foreground">Tipos de documento para buscar</h4>
        <div className="flex flex-wrap gap-2">
          {Object.keys(tipoLabels).map((tipo) => (
            <Badge key={tipo} variant="outline" className={(tipoColors[tipo] || '') + ' cursor-pointer'}>
              <CheckCircle2 className="w-3 h-3 mr-1" /> {tipoLabels[tipo]}
            </Badge>
          ))}
        </div>
      </div>

      <Button
        onClick={handleSave}
        disabled={saving}
        className="bg-accent hover:bg-accent/90 text-accent-foreground"
      >
        {saving ? 'Salvando...' : 'Salvar Configuração'}
      </Button>
    </div>
  );
}
