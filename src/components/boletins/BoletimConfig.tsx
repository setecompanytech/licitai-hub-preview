import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import SeloPraefectusIA from '@/components/shared/SeloPraefectusIA';
import { Send, Loader2, MapPin, ShoppingBag, X, ChevronDown, Sparkles, AlertTriangle } from 'lucide-react';
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
      {/* Boletim IA — superfície da IA na tinta verde, selo Praefectus IA e o
          Sparkles em teal (Design System v3, §5 "IA"). */}
      <Card className="border-primary-line bg-primary-tint p-5">
        <div className="flex items-start gap-3">
          <div aria-hidden="true" className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-primary-line bg-card text-teal">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold leading-6 text-foreground">
              Boletim Inteligente AURÉLIA
              <SeloPraefectusIA />
              <Badge variant="secondary">Novo</Badge>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Resumo personalizado gerado por IA das oportunidades das últimas 24h, com score de
              alinhamento, justificativa e insights estratégicos. Enviado diariamente às 06h.
            </p>
            <Button
              className="mt-3"
              disabled={sending !== null}
              onClick={enviarBoletimIA}
            >
              {sending === 'ia' ? (
                <><Loader2 className="animate-spin" aria-hidden="true" /> Analisando…</>
              ) : (
                <><Sparkles aria-hidden="true" /> Testar agora</>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Horários de envio */}
      <Card className="space-y-4 p-5">
        <h2 className="text-lg font-semibold leading-6 text-foreground">Horários de envio</h2>
        <p className="text-sm text-muted-foreground">
          Configure quais boletins deseja receber no e-mail <strong>{user?.email}</strong>
        </p>

        <div className="space-y-3">
          {[
            { key: 'boletim_manha' as const, label: 'Boletim da Manhã (08:00)', desc: 'Novas licitações publicadas', tipo: 'manha' as const },
            { key: 'boletim_meiodia' as const, label: 'Boletim do Meio-dia (12:00)', desc: 'Alterações, suspensões e cancelamentos', tipo: 'meiodia' as const },
            { key: 'boletim_tarde' as const, label: 'Boletim da Tarde (17:00)', desc: 'Resultados e homologações do dia', tipo: 'tarde' as const },
            { key: 'notificacao_push' as const, label: 'Notificações Push', desc: 'Alertas em tempo real no navegador', tipo: null },
          ].map((item) => (
            <div key={item.key} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-secondary p-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <div className="flex items-center gap-2">
                {item.tipo && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={sending !== null}
                    onClick={() => enviarTeste(item.tipo!)}
                  >
                    {sending === item.tipo ? (
                      <Loader2 className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Send aria-hidden="true" />
                    )}
                    <span>Teste</span>
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
      <Card className="space-y-4 p-5">
        <Collapsible open={segmentosOpen} onOpenChange={setSegmentosOpen}>
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <div className="flex flex-wrap items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <h2 className="text-lg font-semibold leading-6 text-foreground">Segmentos de interesse</h2>
              {config.segmentos.length > 0 && (
                <Badge variant="secondary" className="tabular-nums">
                  {config.segmentos.length} selecionado(s)
                </Badge>
              )}
            </div>
            <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${segmentosOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <p className="mt-1 text-sm text-muted-foreground">
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
                      variant="muted"
                      className="cursor-pointer gap-1 pr-1 transition-colors hover:border-destructive-line hover:bg-destructive-tint hover:text-destructive-ink"
                      onClick={() => toggleSegmento(id)}
                    >
                      {seg?.label || id}
                      <X className="h-3 w-3" aria-hidden="true" />
                    </Badge>
                  );
                })}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1">
              {SEGMENTOS_DISPONIVEIS.map(seg => (
                <label
                  key={seg.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors duration-150 ${
                    config.segmentos.includes(seg.id)
                      ? 'border-primary bg-primary-tint'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  <Checkbox
                    checked={config.segmentos.includes(seg.id)}
                    onCheckedChange={() => toggleSegmento(seg.id)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-5 text-foreground">{seg.label}</p>
                    <p className="mt-0.5 text-xs leading-4 text-muted-foreground">{seg.desc}</p>
                  </div>
                </label>
              ))}
            </div>
            {config.segmentos.length === 0 && (
              <Alert variant="warning" className="mt-3">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                <AlertDescription>
                  Nenhum segmento selecionado — você receberá todos os avisos sem filtro de segmento.
                </AlertDescription>
              </Alert>
            )}
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* UFs de Interesse */}
      <Card className="space-y-4 p-5">
        <Collapsible open={ufsOpen} onOpenChange={setUfsOpen}>
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <div className="flex flex-wrap items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <h2 className="text-lg font-semibold leading-6 text-foreground">Estados de interesse</h2>
              {config.ufs_interesse.length > 0 && (
                <Badge variant="secondary" className="tabular-nums">
                  {config.ufs_interesse.length} UF(s)
                </Badge>
              )}
            </div>
            <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${ufsOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <p className="mt-1 text-sm text-muted-foreground">
            Selecione os estados onde deseja competir em licitações
          </p>
          <CollapsibleContent className="mt-3">
            {config.ufs_interesse.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {config.ufs_interesse.map(uf => (
                  <Badge
                    key={uf}
                    variant="muted"
                    className="cursor-pointer gap-1 pr-1 transition-colors hover:border-destructive-line hover:bg-destructive-tint hover:text-destructive-ink"
                    onClick={() => toggleUf(uf)}
                  >
                    {uf}
                    <X className="h-3 w-3" aria-hidden="true" />
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {UFS_BRASIL.map(uf => (
                <Button
                  key={uf}
                  type="button"
                  size="sm"
                  variant={config.ufs_interesse.includes(uf) ? 'default' : 'outline'}
                  aria-pressed={config.ufs_interesse.includes(uf)}
                  className="px-3"
                  onClick={() => toggleUf(uf)}
                >
                  {uf}
                </Button>
              ))}
            </div>
            {config.ufs_interesse.length === 0 && (
              <Alert variant="warning" className="mt-3">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                <AlertDescription>
                  Nenhuma UF selecionada — você receberá avisos de todos os estados.
                </AlertDescription>
              </Alert>
            )}
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Filtragem Inteligente */}
      <Card className="space-y-4 p-5">
        <h2 className="text-lg font-semibold leading-6 text-foreground">Filtragem inteligente</h2>
        <p className="text-sm text-muted-foreground">
          Configurações de filtragem automática baseadas nos dados da sua empresa
        </p>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-secondary p-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Filtrar alterações por CNPJ</p>
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

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-secondary p-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Resultados por participação</p>
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

      {/* Rodapé de ações alinhado à direita, como no formulário do Design System. */}
      <div className="flex justify-end">
        <Button
          onClick={saveConfig}
          disabled={saving}
        >
          {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Salvar Configuração
        </Button>
      </div>
    </div>
  );
}
