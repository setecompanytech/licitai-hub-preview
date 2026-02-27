import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle2, Building2, RefreshCw, Sparkles } from 'lucide-react';
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

const ALL_UFS = [
  { sigla: 'AC', nome: 'Acre' },
  { sigla: 'AL', nome: 'Alagoas' },
  { sigla: 'AP', nome: 'Amapá' },
  { sigla: 'AM', nome: 'Amazonas' },
  { sigla: 'BA', nome: 'Bahia' },
  { sigla: 'CE', nome: 'Ceará' },
  { sigla: 'DF', nome: 'Distrito Federal' },
  { sigla: 'ES', nome: 'Espírito Santo' },
  { sigla: 'GO', nome: 'Goiás' },
  { sigla: 'MA', nome: 'Maranhão' },
  { sigla: 'MT', nome: 'Mato Grosso' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul' },
  { sigla: 'MG', nome: 'Minas Gerais' },
  { sigla: 'PA', nome: 'Pará' },
  { sigla: 'PB', nome: 'Paraíba' },
  { sigla: 'PR', nome: 'Paraná' },
  { sigla: 'PE', nome: 'Pernambuco' },
  { sigla: 'PI', nome: 'Piauí' },
  { sigla: 'RJ', nome: 'Rio de Janeiro' },
  { sigla: 'RN', nome: 'Rio Grande do Norte' },
  { sigla: 'RS', nome: 'Rio Grande do Sul' },
  { sigla: 'RO', nome: 'Rondônia' },
  { sigla: 'RR', nome: 'Roraima' },
  { sigla: 'SC', nome: 'Santa Catarina' },
  { sigla: 'SP', nome: 'São Paulo' },
  { sigla: 'SE', nome: 'Sergipe' },
  { sigla: 'TO', nome: 'Tocantins' },
];

// Stop-words to filter out from CNAE descriptions
const STOP_WORDS = new Set([
  'de', 'do', 'da', 'dos', 'das', 'e', 'em', 'para', 'por', 'com', 'sem', 'não',
  'ou', 'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas', 'que', 'se', 'na', 'no',
  'nas', 'nos', 'ao', 'aos', 'à', 'às', 'etc', 'n.e.', 'n.e', 'ne', 'outros',
  'outras', 'outro', 'outra', 'inclusive', 'exceto', 'quando', 'sob', 'sobre',
]);

function extractKeywordsFromCnaes(cnaePrincipal: string | null, cnaesSecundarios: string[]): string[] {
  const allDescriptions: string[] = [];

  // Extract description part after the code (e.g. "42.11-1 - Construção de rodovias" -> "Construção de rodovias")
  const extractDesc = (cnae: string) => {
    const parts = cnae.split(/[-–]\s*/);
    // Take everything after the first code-like segment
    if (parts.length >= 2) {
      // Skip the first part if it looks like a code
      const codePattern = /^\d/;
      const descParts = parts.filter((p, i) => i > 0 || !codePattern.test(p.trim()));
      return descParts.join(' ').trim();
    }
    return cnae;
  };

  if (cnaePrincipal) allDescriptions.push(extractDesc(cnaePrincipal));
  cnaesSecundarios.forEach(c => allDescriptions.push(extractDesc(c)));

  const keywords = new Set<string>();
  allDescriptions.forEach(desc => {
    desc
      .toLowerCase()
      .replace(/[^a-záàâãéèêíïóôõúüç\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w))
      .forEach(w => keywords.add(w));
  });

  return Array.from(keywords).sort();
}

export default function ConfiguracaoPesquisaTab() {
  const { empresaAtiva } = useEmpresa();
  const { user } = useAuth();
  const [cnaesSecundarios, setCnaesSecundarios] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedUfs, setSelectedUfs] = useState<Set<string>>(new Set(ALL_UFS.map(u => u.sigla)));
  const [palavrasChave, setPalavrasChave] = useState<string[]>([]);
  const [palavraManual, setPalavraManual] = useState('');
  const [valorMinimo, setValorMinimo] = useState('');
  const [valorMaximo, setValorMaximo] = useState('');

  // Load config from DB
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
        if (data.ufs_interesse && data.ufs_interesse.length > 0) {
          setSelectedUfs(new Set(data.ufs_interesse));
        }
        if (data.palavras_chave) setPalavrasChave(data.palavras_chave);
        setValorMinimo(data.valor_minimo?.toString() || '');
        setValorMaximo(data.valor_maximo?.toString() || '');
        setCnaesSecundarios(data.cnaes_monitorados || []);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const toggleUf = (sigla: string) => {
    setSelectedUfs(prev => {
      const next = new Set(prev);
      if (next.has(sigla)) next.delete(sigla); else next.add(sigla);
      return next;
    });
  };

  const selectAllUfs = () => setSelectedUfs(new Set(ALL_UFS.map(u => u.sigla)));
  const deselectAllUfs = () => setSelectedUfs(new Set());

  // Extract keywords from CNAEs
  const handleExtractKeywords = () => {
    const extracted = extractKeywordsFromCnaes(empresaAtiva?.cnae_principal || null, cnaesSecundarios);
    if (extracted.length === 0) {
      toast.info('Nenhuma palavra-chave extraída. Sincronize os CNAEs primeiro.');
      return;
    }
    // Merge with existing, avoiding duplicates
    const merged = new Set([...palavrasChave, ...extracted]);
    setPalavrasChave(Array.from(merged));
    toast.success(`${extracted.length} palavras-chave extraídas dos CNAEs`);
  };

  const addPalavraManual = () => {
    const words = palavraManual.split(',').map(w => w.trim().toLowerCase()).filter(w => w.length > 1);
    if (words.length === 0) return;
    setPalavrasChave(prev => Array.from(new Set([...prev, ...words])));
    setPalavraManual('');
  };

  const removePalavra = (word: string) => {
    setPalavrasChave(prev => prev.filter(w => w !== word));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const payload = {
      user_id: user.id,
      palavras_chave: palavrasChave,
      ufs_interesse: Array.from(selectedUfs),
      valor_minimo: valorMinimo ? parseFloat(valorMinimo.replace(/\./g, '').replace(',', '.')) : null,
      valor_maximo: valorMaximo ? parseFloat(valorMaximo.replace(/\./g, '').replace(',', '.')) : null,
      cnaes_monitorados: cnaesSecundarios,
      updated_at: new Date().toISOString(),
    };

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

    toast.info('Buscando CNAEs do CNPJ...');

    try {
      const { data, error } = await supabase.functions.invoke('consulta-cnpj', {
        body: { cnpj: empresaAtiva.cnpj.replace(/\D/g, '') },
      });

      if (error) throw error;

      // Sync CNAE Principal
      const cnaePrincipal = data?.cnaePrincipal || (data?.cnae_fiscal
        ? `${data.cnae_fiscal} - ${data.cnae_fiscal_descricao || ''}`
        : null);

      if (cnaePrincipal && cnaePrincipal !== empresaAtiva.cnae_principal) {
        await supabase.from('empresas').update({ cnae_principal: cnaePrincipal }).eq('id', empresaAtiva.id);
        toast.success(`CNAE Principal atualizado: ${cnaePrincipal.length > 50 ? cnaePrincipal.slice(0, 50) + '…' : cnaePrincipal}`);
      } else if (empresaAtiva.cnae_principal) {
        toast.info('CNAE Principal já está atualizado');
      }

      // Sync CNAEs Secundários
      const secundarios: string[] = [];
      const rawSecundarios = data?.cnaesSecundarios || data?.cnaes_secundarios || [];
      if (Array.isArray(rawSecundarios)) {
        rawSecundarios.forEach((c: any) => {
          if (typeof c === 'string') {
            secundarios.push(c);
          } else {
            const code = c.codigo?.toString() || '';
            const desc = c.descricao || '';
            if (code) secundarios.push(`${code} - ${desc}`.trim());
          }
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
    <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm space-y-5">
      <h3 className="text-sm font-semibold">Configuração de Pesquisa Automática</h3>

      <div className="grid grid-cols-2 gap-4">
        {/* CNAE Principal */}
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
        </div>
      </div>

      {/* Palavras-chave */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-muted-foreground">
            Palavras-chave ({palavrasChave.length})
          </label>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExtractKeywords}
            disabled={!empresaAtiva && cnaesSecundarios.length === 0}
            className="h-7 text-xs"
          >
            <Sparkles className="w-3 h-3 mr-1" />
            Extrair dos CNAEs
          </Button>
        </div>
        <div className="p-2 rounded-lg border border-border/50 min-h-[38px] max-h-28 overflow-y-auto flex flex-wrap gap-1.5 mb-2">
          {palavrasChave.length > 0 ? (
            palavrasChave.map((word) => (
              <Badge
                key={word}
                variant="outline"
                className="bg-accent/10 text-accent border-accent/20 text-[10px] pr-1 cursor-pointer hover:bg-destructive/10"
                onClick={() => removePalavra(word)}
                title="Clique para remover"
              >
                {word}
                <span className="ml-1 text-destructive">×</span>
              </Badge>
            ))
          ) : (
            <p className="text-[10px] text-muted-foreground italic">
              Extraia dos CNAEs ou adicione manualmente
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            value={palavraManual}
            onChange={(e) => setPalavraManual(e.target.value)}
            placeholder="Adicionar palavra-chave (separe por vírgula)"
            className="flex-1 h-8 text-xs"
            onKeyDown={(e) => e.key === 'Enter' && addPalavraManual()}
          />
          <Button size="sm" variant="outline" onClick={addPalavraManual} className="h-8 text-xs">
            Adicionar
          </Button>
        </div>
      </div>

      {/* UFs Monitoradas */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-muted-foreground">
            UFs monitoradas ({selectedUfs.size} de {ALL_UFS.length})
          </label>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={selectAllUfs} className="h-6 text-[10px] px-2">
              Selecionar todas
            </Button>
            <Button size="sm" variant="ghost" onClick={deselectAllUfs} className="h-6 text-[10px] px-2">
              Limpar
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-9 gap-1.5 p-3 rounded-lg border border-border/50 bg-muted/20">
          {ALL_UFS.map((uf) => (
            <label
              key={uf.sigla}
              className={`flex items-center gap-1.5 p-1.5 rounded-md cursor-pointer transition-colors text-xs
                ${selectedUfs.has(uf.sigla)
                  ? 'bg-accent/15 text-accent border border-accent/30'
                  : 'bg-card border border-border/30 text-muted-foreground hover:border-accent/50'
                }`}
              title={uf.nome}
            >
              <Checkbox
                checked={selectedUfs.has(uf.sigla)}
                onCheckedChange={() => toggleUf(uf.sigla)}
                className="h-3 w-3"
              />
              <span className="font-medium">{uf.sigla}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-muted-foreground">Frequência de busca</label>
          <Input value="A cada 30 minutos" className="mt-1" readOnly />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Valor mínimo (R$)</label>
          <Input
            value={valorMinimo}
            onChange={(e) => setValorMinimo(e.target.value)}
            placeholder="500.000"
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Valor máximo (R$)</label>
          <Input
            value={valorMaximo}
            onChange={(e) => setValorMaximo(e.target.value)}
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
