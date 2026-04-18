import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2, MapPin, ShoppingBag, X, ChevronDown, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

const SEGMENTOS_DISPONIVEIS = [
  { id: 'generos_alimenticios', label: 'Gêneros Alimentícios', desc: 'Perecíveis, não perecíveis, cestas básicas, merenda escolar' },
  { id: 'informatica', label: 'Informática e Tecnologia', desc: 'Equipamentos, suprimentos, software, redes' },
  { id: 'higiene_limpeza', label: 'Higiene e Limpeza', desc: 'Materiais de limpeza, produtos químicos, descartáveis' },
  { id: 'descartaveis', label: 'Produtos Descartáveis', desc: 'Copos, pratos, talheres, embalagens' },
  { id: 'material_escritorio', label: 'Material de Escritório', desc: 'Papelaria, suprimentos de escritório' },
  { id: 'medicamentos', label: 'Medicamentos e Saúde', desc: 'Fármacos, insumos hospitalares, equipamentos médicos' },
  { id: 'construcao', label: 'Construção Civil', desc: 'Materiais de construção, obras, engenharia' },
  { id: 'veiculos', label: 'Veículos e Peças', desc: 'Automóveis, manutenção, combustíveis, peças' },
  { id: 'mobiliario', label: 'Mobiliário', desc: 'Móveis em geral, mobiliário escolar e hospitalar' },
  { id: 'uniformes', label: 'Uniformes e Vestuário', desc: 'Fardamentos, EPIs, calçados' },
  { id: 'servicos_gerais', label: 'Serviços Gerais', desc: 'Limpeza, vigilância, manutenção predial' },
  { id: 'servicos_ti', label: 'Serviços de TI', desc: 'Desenvolvimento, suporte, cloud, outsourcing' },
  { id: 'grafica', label: 'Gráfica e Impressos', desc: 'Serviços gráficos, impressão, material publicitário' },
  { id: 'eletroeletronicos', label: 'Eletroeletrônicos', desc: 'Ar-condicionado, eletrodomésticos, áudio/vídeo' },
  { id: 'equipamentos_industriais', label: 'Equipamentos Industriais', desc: 'Máquinas, ferramentas, equipamentos pesados' },
];

const UFS_BRASIL = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN',
  'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

export default function BoletimConfig() {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [segmentosOpen, setSegmentosOpen] = useState(false);
  const [ufsOpen, setUfsOpen] = useState(false);
  const [config, setConfig] = useState({
    boletim_manha: true,
    boletim_meiodia: true,
    boletim_tarde: true,
    notificacao_push: true,
    segmentos: [] as string[],
    ufs_interesse: [] as string[],
    filtrar_alteracoes_por_cnpj: true,
    filtrar_resultados_por_participacao: true,
  });

  useEffect(() => {
    if (user) loadConfig();
  }, [user]);

  const loadConfig = async () => {
    const { data } = await supabase
      .from('boletim_preferencias')
      .select('*')
      .eq('user_id', user!.id)
      .maybeSingle();

    if (data) {
      setConfig({
        boletim_manha: data.boletim_manha,
        boletim_meiodia: data.boletim_meiodia,
        boletim_tarde: data.boletim_tarde,
        notificacao_push: data.notificacao_push,
        segmentos: (data as any).segmentos || [],
        ufs_interesse: (data as any).ufs_interesse || [],
        filtrar_alteracoes_por_cnpj: (data as any).filtrar_alteracoes_por_cnpj ?? true,
        filtrar_resultados_por_participacao: (data as any).filtrar_resultados_por_participacao ?? true,
      });
    }
  };

  const toggleSegmento = (id: string) => {
    setConfig(prev => ({
      ...prev,
      segmentos: prev.segmentos.includes(id)
        ? prev.segmentos.filter(s => s !== id)
        : [...prev.segmentos, id],
    }));
  };

  const toggleUf = (uf: string) => {
    setConfig(prev => ({
      ...prev,
      ufs_interesse: prev.ufs_interesse.includes(uf)
        ? prev.ufs_interesse.filter(u => u !== uf)
        : [...prev.ufs_interesse, uf],
    }));
  };

  const saveConfig = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const payload = {
        boletim_manha: config.boletim_manha,
        boletim_meiodia: config.boletim_meiodia,
        boletim_tarde: config.boletim_tarde,
        notificacao_push: config.notificacao_push,
        segmentos: config.segmentos,
        ufs_interesse: config.ufs_interesse,
        filtrar_alteracoes_por_cnpj: config.filtrar_alteracoes_por_cnpj,
        filtrar_resultados_por_participacao: config.filtrar_resultados_por_participacao,
      };

      const { data: existing } = await supabase
        .from('boletim_preferencias')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('boletim_preferencias')
          .update(payload as any)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('boletim_preferencias')
          .insert({ user_id: user.id, email: user.email!, ...payload } as any);
      }
      toast.success('Preferências salvas com sucesso!');
    } catch {
      toast.error('Erro ao salvar preferências');
    } finally {
      setSaving(false);
    }
  };

  const enviarTeste = async (tipo: 'manha' | 'meiodia' | 'tarde') => {
    if (!user) return;
    setSending(tipo);
    try {
      const { data: existing } = await supabase
        .from('boletim_preferencias')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!existing) {
        await supabase
          .from('boletim_preferencias')
          .insert({ user_id: user.id, email: user.email!, ...config } as any);
      }

      const { error } = await supabase.functions.invoke('envio-boletim', {
        body: { tipo, user_id: user.id },
      });

      if (error) throw error;
      toast.success(`Boletim de teste enviado para ${user.email}!`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar boletim de teste');
    } finally {
      setSending(null);
    }
  };

  const enviarBoletimIA = async () => {
    if (!user) return;
    setSending('ia');
    try {
      // Garante preferências salvas
      const { data: existing } = await supabase
        .from('boletim_preferencias').select('id').eq('user_id', user.id).maybeSingle();
      if (!existing) {
        await supabase.from('boletim_preferencias')
          .insert({ user_id: user.id, email: user.email!, ...config } as any);
      }
      const { data, error } = await supabase.functions.invoke('boletim-ia-diario', {
        body: { test_mode: true, user_id: user.id },
      });
      if (error) throw error;
      const r = data?.result;
      toast.success(
        `🎯 Boletim IA enviado! ${r?.total || 0} editais analisados, ${r?.destaques || 0} destaques.`,
        { duration: 6000 }
      );
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar boletim IA');
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Boletim IA — destaque Fase 2 */}
      <Card className="p-5 bg-gradient-to-br from-accent/5 to-accent/10 border-accent/30">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              Boletim Inteligente AURÉLIA
              <Badge variant="secondary" className="text-[9px] uppercase">Novo</Badge>
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Resumo personalizado gerado por IA das oportunidades das últimas 24h, com score de
              alinhamento, justificativa e insights estratégicos. Enviado diariamente às 06h.
            </p>
            <Button
              size="sm"
              className="mt-3 bg-accent hover:bg-accent/90 text-accent-foreground"
              disabled={sending !== null}
              onClick={enviarBoletimIA}
            >
              {sending === 'ia' ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Analisando…</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5 mr-1.5" /> Testar agora</>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Horários de envio */}
      <Card className="p-5 space-y-4">
        <h3 className="text-sm font-semibold">Horários de Envio</h3>
        <p className="text-xs text-muted-foreground">
          Configure quais boletins deseja receber no e-mail <strong>{user?.email}</strong>
        </p>

        <div className="space-y-3">
          {[
            { key: 'boletim_manha' as const, label: 'Boletim da Manhã (08:00)', desc: 'Novas licitações publicadas', tipo: 'manha' as const },
            { key: 'boletim_meiodia' as const, label: 'Boletim do Meio-dia (12:00)', desc: 'Alterações, suspensões e cancelamentos', tipo: 'meiodia' as const },
            { key: 'boletim_tarde' as const, label: 'Boletim da Tarde (17:00)', desc: 'Resultados e homologações do dia', tipo: 'tarde' as const },
            { key: 'notificacao_push' as const, label: 'Notificações Push', desc: 'Alertas em tempo real no navegador', tipo: null },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <div className="flex items-center gap-2">
                {item.tipo && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-7 px-2"
                    disabled={sending !== null}
                    onClick={() => enviarTeste(item.tipo!)}
                  >
                    {sending === item.tipo ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Send className="w-3 h-3" />
                    )}
                    <span className="ml-1">Teste</span>
                  </Button>
                )}
                <Switch
                  checked={config[item.key]}
                  onCheckedChange={(v) => setConfig({ ...config, [item.key]: v })}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Segmentos de Interesse */}
      <Card className="p-5 space-y-4">
        <Collapsible open={segmentosOpen} onOpenChange={setSegmentosOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-semibold">Segmentos de Interesse</h3>
              {config.segmentos.length > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  {config.segmentos.length} selecionado(s)
                </Badge>
              )}
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${segmentosOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <p className="text-xs text-muted-foreground mt-1">
            Selecione os segmentos para receber apenas licitações relevantes ao seu negócio
          </p>
          <CollapsibleContent className="mt-3">
            {config.segmentos.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {config.segmentos.map(id => {
                  const seg = SEGMENTOS_DISPONIVEIS.find(s => s.id === id);
                  return (
                    <Badge
                      key={id}
                      variant="secondary"
                      className="text-[10px] pr-1 cursor-pointer hover:bg-destructive/10"
                      onClick={() => toggleSegmento(id)}
                    >
                      {seg?.label || id}
                      <X className="w-3 h-3 ml-1" />
                    </Badge>
                  );
                })}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1">
              {SEGMENTOS_DISPONIVEIS.map(seg => (
                <label
                  key={seg.id}
                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    config.segmentos.includes(seg.id)
                      ? 'border-accent/50 bg-accent/5'
                      : 'border-border/50 hover:bg-muted/30'
                  }`}
                >
                  <Checkbox
                    checked={config.segmentos.includes(seg.id)}
                    onCheckedChange={() => toggleSegmento(seg.id)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium leading-tight">{seg.label}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{seg.desc}</p>
                  </div>
                </label>
              ))}
            </div>
            {config.segmentos.length === 0 && (
              <p className="text-[10px] text-warning mt-2">
                ⚠️ Nenhum segmento selecionado — você receberá todos os avisos sem filtro de segmento.
              </p>
            )}
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* UFs de Interesse */}
      <Card className="p-5 space-y-4">
        <Collapsible open={ufsOpen} onOpenChange={setUfsOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-semibold">Estados de Interesse</h3>
              {config.ufs_interesse.length > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  {config.ufs_interesse.length} UF(s)
                </Badge>
              )}
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${ufsOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <p className="text-xs text-muted-foreground mt-1">
            Selecione os estados onde deseja competir em licitações
          </p>
          <CollapsibleContent className="mt-3">
            {config.ufs_interesse.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {config.ufs_interesse.map(uf => (
                  <Badge
                    key={uf}
                    variant="secondary"
                    className="text-[10px] pr-1 cursor-pointer hover:bg-destructive/10"
                    onClick={() => toggleUf(uf)}
                  >
                    {uf}
                    <X className="w-3 h-3 ml-1" />
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {UFS_BRASIL.map(uf => (
                <button
                  key={uf}
                  type="button"
                  className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                    config.ufs_interesse.includes(uf)
                      ? 'bg-accent text-accent-foreground border-accent'
                      : 'bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/50'
                  }`}
                  onClick={() => toggleUf(uf)}
                >
                  {uf}
                </button>
              ))}
            </div>
            {config.ufs_interesse.length === 0 && (
              <p className="text-[10px] text-warning mt-2">
                ⚠️ Nenhuma UF selecionada — você receberá avisos de todos os estados.
              </p>
            )}
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Filtragem Inteligente */}
      <Card className="p-5 space-y-4">
        <h3 className="text-sm font-semibold">Filtragem Inteligente</h3>
        <p className="text-xs text-muted-foreground">
          Configurações de filtragem automática baseadas nos dados da sua empresa
        </p>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="flex-1">
              <p className="text-sm font-medium">Filtrar alterações por CNPJ</p>
              <p className="text-xs text-muted-foreground">
                O boletim do meio-dia mostrará apenas alterações, suspensões e cancelamentos
                de processos em que sua empresa está envolvida (busca por CNPJ e razão social nos Diários Oficiais)
              </p>
            </div>
            <Switch
              checked={config.filtrar_alteracoes_por_cnpj}
              onCheckedChange={(v) => setConfig({ ...config, filtrar_alteracoes_por_cnpj: v })}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="flex-1">
              <p className="text-sm font-medium">Resultados por participação</p>
              <p className="text-xs text-muted-foreground">
                O boletim da tarde mostrará apenas homologações e resultados de processos licitatórios
                em que você participou (extraído automaticamente do histórico do sistema)
              </p>
            </div>
            <Switch
              checked={config.filtrar_resultados_por_participacao}
              onCheckedChange={(v) => setConfig({ ...config, filtrar_resultados_por_participacao: v })}
            />
          </div>
        </div>
      </Card>

      <Button
        className="bg-accent hover:bg-accent/90 text-accent-foreground w-full"
        onClick={saveConfig}
        disabled={saving}
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Salvar Configuração
      </Button>
    </div>
  );
}
