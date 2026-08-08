import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { usePreferenciasAlertas, useSegmentos } from '@/hooks/useAlertas';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  ShoppingBag, MapPin, Building2, Bell, Mail, MessageCircle,
  Loader2, Save, Check, X, Search
} from 'lucide-react';

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

export default function PreferenciasAlertas() {
  const { user } = useAuth();
  const { preferencias, loading, salvando, salvarPreferencias } = usePreferenciasAlertas();
  const { segmentos, categorias, loading: loadingSeg } = useSegmentos();

  const [form, setForm] = useState({
    segmentos: [] as string[],
    ufs: [] as string[],
    cnpj: '',
    razao_social: '',
    receber_editais: true,
    receber_alteracoes: true,
    receber_suspensoes: true,
    receber_cancelamentos: true,
    receber_homologacoes: true,
    canal_email: true,
    canal_whatsapp: false,
    canal_push: true,
    email_notificacao: '',
    whatsapp_notificacao: '',
    frequencia: 'imediato' as 'imediato' | 'diario' | 'semanal',
    ativo: true,
  });
  const [searchSeg, setSearchSeg] = useState('');
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);

  useEffect(() => {
    if (preferencias) {
      setForm({
        segmentos: preferencias.segmentos || [],
        ufs: preferencias.ufs || [],
        cnpj: preferencias.cnpj || '',
        razao_social: preferencias.razao_social || '',
        receber_editais: preferencias.receber_editais,
        receber_alteracoes: preferencias.receber_alteracoes,
        receber_suspensoes: preferencias.receber_suspensoes,
        receber_cancelamentos: preferencias.receber_cancelamentos,
        receber_homologacoes: preferencias.receber_homologacoes,
        canal_email: preferencias.canal_email,
        canal_whatsapp: preferencias.canal_whatsapp,
        canal_push: preferencias.canal_push,
        email_notificacao: preferencias.email_notificacao || user?.email || '',
        whatsapp_notificacao: (() => {
          const raw = (preferencias.whatsapp_notificacao || '').replace(/\D/g, '').slice(0, 11);
          if (raw.length > 7) return `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`;
          if (raw.length > 2) return `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
          return raw;
        })(),
        frequencia: preferencias.frequencia || 'imediato',
        ativo: preferencias.ativo,
      });
    } else if (user) {
      setForm(f => ({ ...f, email_notificacao: user.email || '' }));
    }
  }, [preferencias, user]);

  const toggleSeg = (codigo: string) => {
    setForm(f => ({
      ...f,
      segmentos: f.segmentos.includes(codigo)
        ? f.segmentos.filter(s => s !== codigo)
        : [...f.segmentos, codigo],
    }));
  };

  const toggleUf = (uf: string) => {
    setForm(f => ({
      ...f,
      ufs: f.ufs.includes(uf) ? f.ufs.filter(u => u !== uf) : [...f.ufs, uf],
    }));
  };

  const buscarCnpj = async () => {
    const cnpjLimpo = form.cnpj.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) { toast.error('CNPJ inválido'); return; }
    setBuscandoCnpj(true);
    try {
      const { data, error } = await supabase.functions.invoke('consulta-cnpj', {
        body: { cnpj: cnpjLimpo },
      });
      if (error) throw error;
      const razao = data?.razaoSocial || data?.razao_social;
      if (razao) {
        setForm(f => ({ ...f, razao_social: razao }));
        toast.success('Razão social preenchida automaticamente');
      } else if (data?.error) {
        toast.error(data.error);
      } else {
        toast.error('CNPJ não encontrado');
      }
    } catch {
      toast.error('Não foi possível consultar o CNPJ');
    } finally {
      setBuscandoCnpj(false);
    }
  };

  const formatCnpj = (v: string) => {
    const n = v.replace(/\D/g, '').slice(0, 14);
    return n.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
      .replace(/^(\d{2})(\d{3})(\d{3})(\d{4})/, '$1.$2.$3/$4')
      .replace(/^(\d{2})(\d{3})(\d{3})/, '$1.$2.$3')
      .replace(/^(\d{2})(\d{3})/, '$1.$2');
  };

  const handleSave = async () => {
    const ok = await salvarPreferencias(form);
    if (ok) toast.success('Preferências salvas com sucesso!');
    else toast.error('Erro ao salvar preferências');
  };

  const filteredSegmentos = segmentos.filter(s =>
    !searchSeg || s.nome.toLowerCase().includes(searchSeg.toLowerCase()) || s.descricao?.toLowerCase().includes(searchSeg.toLowerCase())
  );

  if (loading || loadingSeg) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Bell className="w-5 h-5 text-muted-foreground" />
            Preferências de Alertas
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Configure quais licitações monitorar, quais mudanças acompanhar e como receber os avisos
          </p>
        </div>

        {/* Counters */}
        <div className="flex gap-3 text-xs">
          <Badge variant="secondary">
            <ShoppingBag className="w-3 h-3 mr-1" />
            {form.segmentos.length} segmento(s)
          </Badge>
          <Badge variant="secondary">
            <MapPin className="w-3 h-3 mr-1" />
            {form.ufs.length} UF(s)
          </Badge>
        </div>

        <Tabs defaultValue="segmentos" className="space-y-4">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="segmentos">
              <ShoppingBag className="w-4 h-4 mr-1" /> Segmentos & UFs
            </TabsTrigger>
            <TabsTrigger value="empresa">
              <Building2 className="w-4 h-4 mr-1" /> CNPJ & Empresa
            </TabsTrigger>
            <TabsTrigger value="canais">
              <Mail className="w-4 h-4 mr-1" /> Canais
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Segmentos & UFs */}
          <TabsContent value="segmentos" className="space-y-4">
            <Card className="p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Quais licitações você quer monitorar?</h3>
                <p className="text-xs text-muted-foreground">Selecione os segmentos de mercado e os estados onde deseja competir</p>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar segmento..."
                  className="pl-9 h-8 text-xs"
                  value={searchSeg}
                  onChange={e => setSearchSeg(e.target.value)}
                />
              </div>

              {form.segmentos.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {form.segmentos.map(cod => {
                    const s = segmentos.find(sg => sg.codigo === cod);
                    return (
                      <Badge key={cod} variant="secondary" className="text-xs pr-1 cursor-pointer hover:bg-destructive/10" onClick={() => toggleSeg(cod)}>
                        {s?.nome || cod} <X className="w-3 h-3 ml-1" />
                      </Badge>
                    );
                  })}
                </div>
              )}

              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                {categorias.map(cat => {
                  const segs = filteredSegmentos.filter(s => s.categoria === cat);
                  if (segs.length === 0) return null;
                  return (
                    <div key={cat}>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{cat}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {segs.map(seg => (
                          <label
                            key={seg.codigo}
                            className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                              form.segmentos.includes(seg.codigo)
                                ? 'border-accent/50 bg-accent/5'
                                : 'border-border/50 hover:bg-muted/30'
                            }`}
                          >
                            <Checkbox
                              checked={form.segmentos.includes(seg.codigo)}
                              onCheckedChange={() => toggleSeg(seg.codigo)}
                              className="mt-0.5"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-medium leading-tight">{seg.nome}</p>
                              <p className="text-xs text-muted-foreground leading-tight mt-0.5">{seg.descricao}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {form.segmentos.length === 0 && (
                <p className="text-xs text-warning">⚠️ Nenhum segmento selecionado — você receberá todos os avisos sem filtro.</p>
              )}
            </Card>

            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    Estados em que deseja competir
                  </h3>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="text-xs h-6" onClick={() => setForm(f => ({ ...f, ufs: [...UFS] }))}>
                    Selecionar todos
                  </Button>
                  <Button size="sm" variant="ghost" className="text-xs h-6" onClick={() => setForm(f => ({ ...f, ufs: [] }))}>
                    Limpar
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {UFS.map(uf => (
                  <button
                    key={uf}
                    type="button"
                    className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                      form.ufs.includes(uf)
                        ? 'bg-accent text-accent-foreground border-accent'
                        : 'bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/50'
                    }`}
                    onClick={() => toggleUf(uf)}
                  >
                    {uf}
                  </button>
                ))}
              </div>

              {form.ufs.length === 0 && (
                <p className="text-xs text-warning">⚠️ Nenhuma UF selecionada — você receberá avisos de todos os estados.</p>
              )}
            </Card>
          </TabsContent>

          {/* TAB 2: CNPJ & Empresa */}
          <TabsContent value="empresa" className="space-y-4">
            <Card className="p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  Dados da sua empresa para monitoramento
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Usamos para buscar alterações, suspensões e homologações no DOU automaticamente
                </p>
              </div>

              <div className="grid gap-3">
                <div>
                  <Label className="text-xs">CNPJ</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="XX.XXX.XXX/XXXX-XX"
                      className="text-sm"
                      value={form.cnpj}
                      onChange={e => setForm(f => ({ ...f, cnpj: formatCnpj(e.target.value) }))}
                      onBlur={() => { if (form.cnpj.replace(/\D/g, '').length === 14) buscarCnpj(); }}
                    />
                    <Button size="sm" variant="outline" onClick={buscarCnpj} disabled={buscandoCnpj}>
                      {buscandoCnpj ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Razão Social</Label>
                  <Input
                    placeholder="Preenchido automaticamente pelo CNPJ"
                    className="text-sm"
                    value={form.razao_social}
                    onChange={e => setForm(f => ({ ...f, razao_social: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <p className="text-xs font-semibold">Monitoramento no Diário Oficial</p>
                {[
                  { key: 'receber_alteracoes' as const, label: 'Monitorar alterações de editais', desc: 'Retificações e mudanças em processos publicados' },
                  { key: 'receber_suspensoes' as const, label: 'Monitorar suspensões de processos', desc: 'Suspensões e adiamentos de licitações' },
                  { key: 'receber_cancelamentos' as const, label: 'Monitorar cancelamentos', desc: 'Cancelamentos e revogações de editais' },
                  { key: 'receber_homologacoes' as const, label: 'Monitorar homologações em que participei', desc: 'Resultados automáticos baseados no histórico de participação' },
                  { key: 'receber_editais' as const, label: 'Receber novos editais por segmento', desc: 'Editais novos filtrados pelos segmentos e UFs configurados' },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch
                      checked={form[item.key]}
                      onCheckedChange={v => setForm(f => ({ ...f, [item.key]: v }))}
                    />
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* TAB 3: Canais */}
          <TabsContent value="canais" className="space-y-4">
            <Card className="p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Como prefere receber os avisos?</h3>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-muted/30 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <p className="text-sm font-medium">E-mail</p>
                    </div>
                    <Switch checked={form.canal_email} onCheckedChange={v => setForm(f => ({ ...f, canal_email: v }))} />
                  </div>
                  {form.canal_email && (
                    <Input
                      placeholder="E-mail para notificações"
                      className="text-sm"
                      value={form.email_notificacao}
                      onChange={e => setForm(f => ({ ...f, email_notificacao: e.target.value }))}
                    />
                  )}
                </div>

                <div className="p-3 bg-muted/30 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-success" />
                      <p className="text-sm font-medium">WhatsApp</p>
                    </div>
                    <Switch checked={form.canal_whatsapp} onCheckedChange={v => setForm(f => ({ ...f, canal_whatsapp: v }))} />
                  </div>
                  {form.canal_whatsapp && (
                    <Input
                      placeholder="(XX) XXXXX-XXXX"
                      className="text-sm"
                      value={form.whatsapp_notificacao}
                      onChange={e => {
                        const raw = e.target.value.replace(/\D/g, '').slice(0, 11);
                        let formatted = raw;
                        if (raw.length > 2) formatted = `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
                        if (raw.length > 7) formatted = `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`;
                        setForm(f => ({ ...f, whatsapp_notificacao: formatted }));
                      }}
                    />
                  )}
                </div>

                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-info" />
                      <p className="text-sm font-medium">Notificações no sistema</p>
                    </div>
                    <Switch checked={form.canal_push} onCheckedChange={v => setForm(f => ({ ...f, canal_push: v }))} />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <p className="text-xs font-semibold mb-2">Frequência de envio</p>
                <RadioGroup value={form.frequencia} onValueChange={(v: any) => setForm(f => ({ ...f, frequencia: v }))}>
                  <div className="flex items-center space-x-2 p-2 rounded hover:bg-muted/30">
                    <RadioGroupItem value="imediato" id="freq-i" />
                    <Label htmlFor="freq-i" className="text-sm cursor-pointer">Imediato — assim que identificado</Label>
                  </div>
                  <div className="flex items-center space-x-2 p-2 rounded hover:bg-muted/30">
                    <RadioGroupItem value="diario" id="freq-d" />
                    <Label htmlFor="freq-d" className="text-sm cursor-pointer">Diário — resumo às 07h</Label>
                  </div>
                  <div className="flex items-center space-x-2 p-2 rounded hover:bg-muted/30">
                    <RadioGroupItem value="semanal" id="freq-s" />
                    <Label htmlFor="freq-s" className="text-sm cursor-pointer">Semanal — toda segunda-feira às 08h</Label>
                  </div>
                </RadioGroup>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        <Button
          className="bg-accent hover:bg-accent/90 text-accent-foreground w-full"
          onClick={handleSave}
          disabled={salvando}
        >
          {salvando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar Preferências
        </Button>
      </div>
    </AppLayout>
  );
}
