import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, Building2, RefreshCw, Sparkles, Bell, Mail, MessageCircle, MapPin, Plus, X } from 'lucide-react';
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
  { sigla: 'AC', nome: 'Acre' }, { sigla: 'AL', nome: 'Alagoas' }, { sigla: 'AP', nome: 'Amapá' },
  { sigla: 'AM', nome: 'Amazonas' }, { sigla: 'BA', nome: 'Bahia' }, { sigla: 'CE', nome: 'Ceará' },
  { sigla: 'DF', nome: 'Distrito Federal' }, { sigla: 'ES', nome: 'Espírito Santo' },
  { sigla: 'GO', nome: 'Goiás' }, { sigla: 'MA', nome: 'Maranhão' }, { sigla: 'MT', nome: 'Mato Grosso' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul' }, { sigla: 'MG', nome: 'Minas Gerais' },
  { sigla: 'PA', nome: 'Pará' }, { sigla: 'PB', nome: 'Paraíba' }, { sigla: 'PR', nome: 'Paraná' },
  { sigla: 'PE', nome: 'Pernambuco' }, { sigla: 'PI', nome: 'Piauí' }, { sigla: 'RJ', nome: 'Rio de Janeiro' },
  { sigla: 'RN', nome: 'Rio Grande do Norte' }, { sigla: 'RS', nome: 'Rio Grande do Sul' },
  { sigla: 'RO', nome: 'Rondônia' }, { sigla: 'RR', nome: 'Roraima' }, { sigla: 'SC', nome: 'Santa Catarina' },
  { sigla: 'SP', nome: 'São Paulo' }, { sigla: 'SE', nome: 'Sergipe' }, { sigla: 'TO', nome: 'Tocantins' },
];

const STOP_WORDS = new Set([
  'de', 'do', 'da', 'dos', 'das', 'e', 'em', 'para', 'por', 'com', 'sem', 'não',
  'ou', 'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas', 'que', 'se', 'na', 'no',
  'nas', 'nos', 'ao', 'aos', 'à', 'às', 'etc', 'n.e.', 'n.e', 'ne', 'outros',
  'outras', 'outro', 'outra', 'inclusive', 'exceto', 'quando', 'sob', 'sobre',
]);

const SEGMENTOS_SUGERIDOS = [
  'Tecnologia da Informação', 'Material Hospitalar', 'Construção Civil', 'Alimentação',
  'Serviços de Limpeza', 'Segurança', 'Transporte', 'Mobiliário', 'Equipamentos',
  'Engenharia', 'Consultoria', 'Capacitação', 'Pavimentação', 'Saneamento',
  'Material de Escritório', 'Combustíveis', 'Uniformes', 'Medicamentos',
];

function extractKeywordsFromCnaes(cnaePrincipal: string | null, cnaesSecundarios: string[]): string[] {
  const allDescriptions: string[] = [];
  const extractDesc = (cnae: string) => {
    const parts = cnae.split(/[-–]\s*/);
    if (parts.length >= 2) {
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
    desc.toLowerCase().replace(/[^a-záàâãéèêíïóôõúüç\s]/g, ' ').split(/\s+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w)).forEach(w => keywords.add(w));
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
  // New: priority preferences
  const [segmentos, setSegmentos] = useState<string[]>([]);
  const [segmentoInput, setSegmentoInput] = useState('');
  const [alertaSistema, setAlertaSistema] = useState(true);
  const [alertaEmail, setAlertaEmail] = useState(true);
  const [alertaWhatsapp, setAlertaWhatsapp] = useState(false);
  const [priorizarRegiaoSede, setPriorizarRegiaoSede] = useState(true);

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
        if (data.ufs_interesse && data.ufs_interesse.length > 0) setSelectedUfs(new Set(data.ufs_interesse));
        if (data.palavras_chave) setPalavrasChave(data.palavras_chave);
        setValorMinimo(data.valor_minimo?.toString() || '');
        setValorMaximo(data.valor_maximo?.toString() || '');
        setCnaesSecundarios(data.cnaes_monitorados || []);
        // Load new fields
        setSegmentos((data as any).segmentos_prioridade || []);
        setAlertaSistema((data as any).alerta_sistema ?? true);
        setAlertaEmail((data as any).alerta_email ?? true);
        setAlertaWhatsapp((data as any).alerta_whatsapp ?? false);
        setPriorizarRegiaoSede((data as any).priorizar_regiao_sede ?? true);
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

  const handleExtractKeywords = () => {
    const extracted = extractKeywordsFromCnaes(empresaAtiva?.cnae_principal || null, cnaesSecundarios);
    if (extracted.length === 0) { toast.info('Nenhuma palavra-chave extraída.'); return; }
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

  const removePalavra = (word: string) => setPalavrasChave(prev => prev.filter(w => w !== word));

  const addSegmento = (seg?: string) => {
    const value = (seg || segmentoInput).trim();
    if (!value || segmentos.includes(value)) return;
    setSegmentos(prev => [...prev, value]);
    setSegmentoInput('');
  };

  const removeSegmento = (seg: string) => setSegmentos(prev => prev.filter(s => s !== seg));

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const payload: any = {
      user_id: user.id,
      palavras_chave: palavrasChave,
      ufs_interesse: Array.from(selectedUfs),
      valor_minimo: valorMinimo ? parseFloat(valorMinimo.replace(/\./g, '').replace(',', '.')) : null,
      valor_maximo: valorMaximo ? parseFloat(valorMaximo.replace(/\./g, '').replace(',', '.')) : null,
      cnaes_monitorados: cnaesSecundarios,
      segmentos_prioridade: segmentos,
      alerta_sistema: alertaSistema,
      alerta_email: alertaEmail,
      alerta_whatsapp: alertaWhatsapp,
      uf_sede: empresaAtiva?.uf || null,
      municipio_sede: empresaAtiva?.municipio || null,
      priorizar_regiao_sede: priorizarRegiaoSede,
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

  const handleSyncFromEmpresa = async () => {
    if (!empresaAtiva) { toast.error('Nenhuma empresa ativa selecionada'); return; }
    toast.info('Buscando CNAEs do CNPJ...');
    try {
      const { data, error } = await supabase.functions.invoke('consulta-cnpj', {
        body: { cnpj: empresaAtiva.cnpj.replace(/\D/g, '') },
      });
      if (error) throw error;
      const cnaePrincipal = data?.cnaePrincipal || (data?.cnae_fiscal
        ? `${data.cnae_fiscal} - ${data.cnae_fiscal_descricao || ''}` : null);
      if (cnaePrincipal && cnaePrincipal !== empresaAtiva.cnae_principal) {
        await supabase.from('empresas').update({ cnae_principal: cnaePrincipal }).eq('id', empresaAtiva.id);
        toast.success(`CNAE Principal atualizado`);
      }
      const secundarios: string[] = [];
      const rawSecundarios = data?.cnaesSecundarios || data?.cnaes_secundarios || [];
      if (Array.isArray(rawSecundarios)) {
        rawSecundarios.forEach((c: any) => {
          if (typeof c === 'string') secundarios.push(c);
          else { const code = c.codigo?.toString() || ''; const desc = c.descricao || '';
            if (code) secundarios.push(`${code} - ${desc}`.trim()); }
        });
      }
      if (secundarios.length > 0) { setCnaesSecundarios(secundarios); toast.success(`${secundarios.length} CNAEs secundários importados`); }
      else toast.info('Nenhum CNAE secundário encontrado');
    } catch (err: any) {
      toast.error('Erro ao consultar CNPJ: ' + (err.message || 'tente novamente'));
    }
  };

  const removeCnae = (idx: number) => setCnaesSecundarios(prev => prev.filter((_, i) => i !== idx));

  return (
    <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm space-y-6">
      <h3 className="text-sm font-semibold">Configuração de Pesquisa Automática</h3>

      {/* ── Localização Sede ── */}
      <div className="rounded-lg border border-accent/30 bg-accent/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-accent" />
          <h4 className="text-sm font-semibold text-accent">Prioridade por Localização (Sede)</h4>
        </div>
        <p className="text-xs text-muted-foreground">
          O sistema prioriza editais na região metropolitana da sede da sua empresa, conforme endereço do CNPJ.
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">UF da Sede</label>
            <Input value={empresaAtiva?.uf || 'N/I'} readOnly className="mt-1 bg-muted/30" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Município</label>
            <Input value={empresaAtiva?.municipio || 'N/I'} readOnly className="mt-1 bg-muted/30" />
          </div>
          <div className="flex items-end">
            <div className="flex items-center gap-2">
              <Switch checked={priorizarRegiaoSede} onCheckedChange={setPriorizarRegiaoSede} />
              <Label className="text-xs">Priorizar região da sede</Label>
            </div>
          </div>
        </div>
      </div>

      {/* ── Segmentos/Ramos de Prioridade ── */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-semibold text-primary">Segmentos Prioritários</h4>
        </div>
        <p className="text-xs text-muted-foreground">
          Defina os ramos/segmentos que deseja priorizar. O sistema enviará alertas quando editais compatíveis forem publicados.
        </p>
        <div className="flex flex-wrap gap-1.5 min-h-[32px]">
          {segmentos.map(seg => (
            <Badge key={seg} variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs pr-1 cursor-pointer hover:bg-destructive/10" onClick={() => removeSegmento(seg)}>
              {seg} <X className="w-3 h-3 ml-1 text-destructive" />
            </Badge>
          ))}
          {segmentos.length === 0 && <p className="text-[10px] text-muted-foreground italic">Nenhum segmento cadastrado</p>}
        </div>
        <div className="flex gap-2">
          <Input value={segmentoInput} onChange={e => setSegmentoInput(e.target.value)} placeholder="Ex: Material Hospitalar, TI, Construção Civil"
            className="flex-1 h-8 text-xs" onKeyDown={e => e.key === 'Enter' && addSegmento()} />
          <Button size="sm" variant="outline" onClick={() => addSegmento()} className="h-8 text-xs">
            <Plus className="w-3 h-3 mr-1" /> Adicionar
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SEGMENTOS_SUGERIDOS.filter(s => !segmentos.includes(s)).slice(0, 10).map(s => (
            <Badge key={s} variant="outline" className="bg-muted/30 text-muted-foreground border-border/50 text-[10px] cursor-pointer hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
              onClick={() => addSegmento(s)}>
              + {s}
            </Badge>
          ))}
        </div>
      </div>

      {/* ── Canais de Alerta ── */}
      <div className="rounded-lg border border-info/30 bg-info/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-info" />
          <h4 className="text-sm font-semibold text-info">Canais de Alerta de Licitações</h4>
        </div>
        <p className="text-xs text-muted-foreground">
          Escolha como deseja receber avisos quando forem encontrados editais compatíveis com seus segmentos e CNAEs.
        </p>
        <div className="grid grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card">
            <Bell className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <Label className="text-xs font-medium">Sistema</Label>
              <p className="text-[10px] text-muted-foreground">Notificações no app</p>
            </div>
            <Switch checked={alertaSistema} onCheckedChange={setAlertaSistema} />
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card">
            <Mail className="w-5 h-5 text-accent" />
            <div className="flex-1">
              <Label className="text-xs font-medium">E-mail</Label>
              <p className="text-[10px] text-muted-foreground">Alertas por e-mail</p>
            </div>
            <Switch checked={alertaEmail} onCheckedChange={setAlertaEmail} />
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card">
            <MessageCircle className="w-5 h-5 text-success" />
            <div className="flex-1">
              <Label className="text-xs font-medium">WhatsApp</Label>
              <p className="text-[10px] text-muted-foreground">Alertas via WhatsApp</p>
            </div>
            <Switch checked={alertaWhatsapp} onCheckedChange={setAlertaWhatsapp} />
          </div>
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-muted-foreground">CNAE Principal</label>
          <div className="flex gap-2 mt-1">
            <Input value={empresaAtiva?.cnae_principal || 'Nenhuma empresa selecionada'} readOnly className="flex-1" />
            <Button size="sm" variant="outline" onClick={handleSyncFromEmpresa} disabled={!empresaAtiva}>
              <RefreshCw className="w-4 h-4 mr-1" /> Sincronizar CNPJ
            </Button>
          </div>
          {empresaAtiva && (
            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
              <Building2 className="w-3 h-3" /> {empresaAtiva.razao_social} – CNPJ: {empresaAtiva.cnpj}
            </p>
          )}
        </div>
        <div>
          <label className="text-xs text-muted-foreground">CNAEs Secundários ({cnaesSecundarios.length})</label>
          <div className="mt-1 p-2 rounded-lg border border-border/50 min-h-[38px] max-h-32 overflow-y-auto flex flex-wrap gap-1">
            {cnaesSecundarios.length > 0 ? cnaesSecundarios.map((cnae, idx) => (
              <Badge key={idx} variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] pr-1 cursor-pointer hover:bg-destructive/10"
                onClick={() => removeCnae(idx)} title="Remover">
                {cnae.length > 40 ? cnae.slice(0, 40) + '…' : cnae} <span className="ml-1 text-destructive">×</span>
              </Badge>
            )) : <p className="text-[10px] text-muted-foreground italic">Clique em "Sincronizar CNPJ"</p>}
          </div>
        </div>
      </div>

      {/* Palavras-chave */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-muted-foreground">Palavras-chave ({palavrasChave.length})</label>
          <Button size="sm" variant="outline" onClick={handleExtractKeywords} disabled={!empresaAtiva && cnaesSecundarios.length === 0} className="h-7 text-xs">
            <Sparkles className="w-3 h-3 mr-1" /> Extrair dos CNAEs
          </Button>
        </div>
        <div className="p-2 rounded-lg border border-border/50 min-h-[38px] max-h-28 overflow-y-auto flex flex-wrap gap-1.5 mb-2">
          {palavrasChave.length > 0 ? palavrasChave.map(word => (
            <Badge key={word} variant="outline" className="bg-accent/10 text-accent border-accent/20 text-[10px] pr-1 cursor-pointer hover:bg-destructive/10"
              onClick={() => removePalavra(word)} title="Remover">
              {word} <span className="ml-1 text-destructive">×</span>
            </Badge>
          )) : <p className="text-[10px] text-muted-foreground italic">Extraia dos CNAEs ou adicione manualmente</p>}
        </div>
        <div className="flex gap-2">
          <Input value={palavraManual} onChange={e => setPalavraManual(e.target.value)}
            placeholder="Adicionar palavra-chave (separe por vírgula)" className="flex-1 h-8 text-xs"
            onKeyDown={e => e.key === 'Enter' && addPalavraManual()} />
          <Button size="sm" variant="outline" onClick={addPalavraManual} className="h-8 text-xs">Adicionar</Button>
        </div>
      </div>

      {/* UFs */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-muted-foreground">UFs monitoradas ({selectedUfs.size}/{ALL_UFS.length})</label>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={selectAllUfs} className="h-6 text-[10px] px-2">Selecionar todas</Button>
            <Button size="sm" variant="ghost" onClick={deselectAllUfs} className="h-6 text-[10px] px-2">Limpar</Button>
          </div>
        </div>
        <div className="grid grid-cols-9 gap-1.5 p-3 rounded-lg border border-border/50 bg-muted/20">
          {ALL_UFS.map(uf => (
            <label key={uf.sigla} className={`flex items-center gap-1.5 p-1.5 rounded-md cursor-pointer transition-colors text-xs
              ${selectedUfs.has(uf.sigla)
                ? 'bg-accent/15 text-accent border border-accent/30'
                : 'bg-card border border-border/30 text-muted-foreground hover:border-accent/50'}`} title={uf.nome}>
              <Checkbox checked={selectedUfs.has(uf.sigla)} onCheckedChange={() => toggleUf(uf.sigla)} className="h-3 w-3" />
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
          <Input value={valorMinimo} onChange={e => setValorMinimo(e.target.value)} placeholder="500.000" className="mt-1" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Valor máximo (R$)</label>
          <Input value={valorMaximo} onChange={e => setValorMaximo(e.target.value)} placeholder="100.000.000" className="mt-1" />
        </div>
      </div>

      <div className="pt-2">
        <h4 className="text-xs font-semibold mb-2 text-muted-foreground">Tipos de documento para buscar</h4>
        <div className="flex flex-wrap gap-2">
          {Object.keys(tipoLabels).map(tipo => (
            <Badge key={tipo} variant="outline" className={(tipoColors[tipo] || '') + ' cursor-pointer'}>
              <CheckCircle2 className="w-3 h-3 mr-1" /> {tipoLabels[tipo]}
            </Badge>
          ))}
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="bg-accent hover:bg-accent/90 text-accent-foreground">
        {saving ? 'Salvando...' : 'Salvar Configuração'}
      </Button>
    </div>
  );
}
