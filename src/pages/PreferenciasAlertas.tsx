import SkeletonPagina from '@/components/shared/SkeletonPagina';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { usePreferenciasAlertas, useSegmentos } from '@/hooks/useAlertas';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  ShoppingBag, MapPin, Building2, Bell, Mail, MessageCircle,
  Loader2, Save, X, Search, AlertTriangle
} from 'lucide-react';

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

/** Chaves de monitoramento no DOU — rótulo visível e o texto que explica cada uma. */
const MONITORAMENTOS = [
  { key: 'receber_alteracoes' as const, label: 'Monitorar alterações de editais', desc: 'Retificações e mudanças em processos publicados' },
  { key: 'receber_suspensoes' as const, label: 'Monitorar suspensões de processos', desc: 'Suspensões e adiamentos de licitações' },
  { key: 'receber_cancelamentos' as const, label: 'Monitorar cancelamentos', desc: 'Cancelamentos e revogações de editais' },
  { key: 'receber_homologacoes' as const, label: 'Monitorar homologações em que participei', desc: 'Resultados automáticos baseados no histórico de participação' },
  { key: 'receber_editais' as const, label: 'Receber novos editais por segmento', desc: 'Editais novos filtrados pelos segmentos e UFs configurados' },
];

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
        <SkeletonPagina moldura={false} cartoes={2} />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl">
        <Tabs defaultValue="segmentos" className="w-full">
          {/* Item de menu: título, descrição, ícone e trilha vêm do registro
              `lib/navegacao/paginas.ts` — a tela não os repete. */}
          <CabecalhoPagina
            acoes={
              <Button onClick={handleSave} disabled={salvando}>
                {salvando ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
                Salvar preferências
              </Button>
            }
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted" className="gap-1">
                <ShoppingBag className="h-3 w-3" aria-hidden="true" />
                {form.segmentos.length} segmento(s)
              </Badge>
              <Badge variant="muted" className="gap-1">
                <MapPin className="h-3 w-3" aria-hidden="true" />
                {form.ufs.length} UF(s)
              </Badge>
            </div>

            <TabsList>
              <TabsTrigger value="segmentos" className="gap-2">
                <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                Segmentos
              </TabsTrigger>
              <TabsTrigger value="empresa" className="gap-2">
                <Building2 className="h-4 w-4" aria-hidden="true" />
                Empresa
              </TabsTrigger>
              <TabsTrigger value="canais" className="gap-2">
                <Mail className="h-4 w-4" aria-hidden="true" />
                Canais
              </TabsTrigger>
            </TabsList>
          </CabecalhoPagina>

          {/* ── Aba: Segmentos & UFs ───────────────────────────────────── */}
          <TabsContent value="segmentos" className="space-y-4">
            <Card className="space-y-4 p-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Quais licitações você quer monitorar?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Selecione os segmentos de mercado e os estados onde deseja competir
                </p>
              </div>

              <div>
                <Label htmlFor="busca-segmento" className="mb-2 block text-sm">Buscar segmento</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="busca-segmento"
                    placeholder="Buscar segmento..."
                    className="pl-9"
                    value={searchSeg}
                    onChange={e => setSearchSeg(e.target.value)}
                  />
                </div>
              </div>

              {form.segmentos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.segmentos.map(cod => {
                    const s = segmentos.find(sg => sg.codigo === cod);
                    return (
                      <button
                        key={cod}
                        type="button"
                        onClick={() => toggleSeg(cod)}
                        aria-label={`Remover ${s?.nome || cod}`}
                        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <Badge variant="muted" className="gap-1">
                          {s?.nome || cod}
                          <X className="h-3 w-3" aria-hidden="true" />
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="max-h-96 space-y-4 overflow-y-auto pr-1">
                {categorias.map(cat => {
                  const segs = filteredSegmentos.filter(s => s.categoria === cat);
                  if (segs.length === 0) return null;
                  return (
                    <div key={cat}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{cat}</p>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        {segs.map(seg => (
                          <label
                            key={seg.codigo}
                            className={cn(
                              'flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors',
                              form.segmentos.includes(seg.codigo)
                                ? 'border-primary bg-primary-tint'
                                : 'border-border hover:bg-muted',
                            )}
                          >
                            <Checkbox
                              checked={form.segmentos.includes(seg.codigo)}
                              onCheckedChange={() => toggleSeg(seg.codigo)}
                              className="mt-0.5"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground">{seg.nome}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">{seg.descricao}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {form.segmentos.length === 0 && (
                <Alert variant="warning">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  <AlertDescription>
                    Nenhum segmento selecionado — você receberá todos os avisos sem filtro.
                  </AlertDescription>
                </Alert>
              )}
            </Card>

            <Card className="space-y-4 p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                  <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Estados em que deseja competir
                </h2>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setForm(f => ({ ...f, ufs: [...UFS] }))}>
                    Selecionar todos
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setForm(f => ({ ...f, ufs: [] }))}>
                    Limpar
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {UFS.map(uf => (
                  <button
                    key={uf}
                    type="button"
                    aria-pressed={form.ufs.includes(uf)}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      form.ufs.includes(uf)
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-foreground hover:bg-muted',
                    )}
                    onClick={() => toggleUf(uf)}
                  >
                    {uf}
                  </button>
                ))}
              </div>

              {form.ufs.length === 0 && (
                <Alert variant="warning">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  <AlertDescription>
                    Nenhuma UF selecionada — você receberá avisos de todos os estados.
                  </AlertDescription>
                </Alert>
              )}
            </Card>
          </TabsContent>

          {/* ── Aba: CNPJ & Empresa ────────────────────────────────────── */}
          <TabsContent value="empresa" className="space-y-4">
            <Card className="space-y-4 p-6">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                  <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Dados da sua empresa para monitoramento
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Usamos para buscar alterações, suspensões e homologações no DOU automaticamente
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="pref-cnpj" className="mb-2 block text-sm">CNPJ</Label>
                  <div className="flex gap-2">
                    <Input
                      id="pref-cnpj"
                      placeholder="XX.XXX.XXX/XXXX-XX"
                      value={form.cnpj}
                      onChange={e => setForm(f => ({ ...f, cnpj: formatCnpj(e.target.value) }))}
                      onBlur={() => { if (form.cnpj.replace(/\D/g, '').length === 14) buscarCnpj(); }}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-11 w-11 shrink-0"
                      aria-label="Buscar razão social pelo CNPJ"
                      onClick={buscarCnpj}
                      disabled={buscandoCnpj}
                    >
                      {buscandoCnpj ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Search aria-hidden="true" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="pref-razao" className="mb-2 block text-sm">Razão social</Label>
                  <Input
                    id="pref-razao"
                    placeholder="Preenchido automaticamente pelo CNPJ"
                    value={form.razao_social}
                    onChange={e => setForm(f => ({ ...f, razao_social: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <h3 className="text-base font-semibold text-foreground">Monitoramento no Diário Oficial</h3>
                {MONITORAMENTOS.map(item => (
                  <div key={item.key} className="flex items-center justify-between gap-4 rounded-md border border-border bg-muted p-3">
                    <div className="min-w-0">
                      <Label htmlFor={`mon-${item.key}`} className="text-sm font-medium">{item.label}</Label>
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch
                      id={`mon-${item.key}`}
                      checked={form[item.key]}
                      onCheckedChange={v => setForm(f => ({ ...f, [item.key]: v }))}
                    />
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* ── Aba: Canais ────────────────────────────────────────────── */}
          <TabsContent value="canais" className="space-y-4">
            <Card className="space-y-4 p-6">
              <h2 className="text-lg font-semibold text-foreground">Como prefere receber os avisos?</h2>

              <div className="space-y-3">
                <div className="space-y-3 rounded-md border border-border bg-muted p-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <Label htmlFor="canal-email" className="text-sm font-medium">E-mail</Label>
                    </div>
                    <Switch id="canal-email" checked={form.canal_email} onCheckedChange={v => setForm(f => ({ ...f, canal_email: v }))} />
                  </div>
                  {form.canal_email && (
                    <div>
                      <Label htmlFor="email-notificacao" className="mb-2 block text-sm">E-mail para notificações</Label>
                      <Input
                        id="email-notificacao"
                        type="email"
                        placeholder="voce@empresa.com.br"
                        value={form.email_notificacao}
                        onChange={e => setForm(f => ({ ...f, email_notificacao: e.target.value }))}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-3 rounded-md border border-border bg-muted p-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-success" aria-hidden="true" />
                      <Label htmlFor="canal-whatsapp" className="text-sm font-medium">WhatsApp</Label>
                    </div>
                    <Switch id="canal-whatsapp" checked={form.canal_whatsapp} onCheckedChange={v => setForm(f => ({ ...f, canal_whatsapp: v }))} />
                  </div>
                  {form.canal_whatsapp && (
                    <div>
                      <Label htmlFor="whatsapp-notificacao" className="mb-2 block text-sm">WhatsApp para notificações</Label>
                      <Input
                        id="whatsapp-notificacao"
                        inputMode="tel"
                        placeholder="(XX) XXXXX-XXXX"
                        value={form.whatsapp_notificacao}
                        onChange={e => {
                          const raw = e.target.value.replace(/\D/g, '').slice(0, 11);
                          let formatted = raw;
                          if (raw.length > 2) formatted = `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
                          if (raw.length > 7) formatted = `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`;
                          setForm(f => ({ ...f, whatsapp_notificacao: formatted }));
                        }}
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-muted p-3">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <Label htmlFor="canal-push" className="text-sm font-medium">Notificações no sistema</Label>
                  </div>
                  <Switch id="canal-push" checked={form.canal_push} onCheckedChange={v => setForm(f => ({ ...f, canal_push: v }))} />
                </div>
              </div>

              <div className="pt-2">
                <h3 id="rotulo-frequencia" className="mb-2 text-base font-semibold text-foreground">Frequência de envio</h3>
                <RadioGroup
                  aria-labelledby="rotulo-frequencia"
                  value={form.frequencia}
                  onValueChange={v => setForm(f => ({ ...f, frequencia: v as typeof f.frequencia }))}
                >
                  <div className="flex items-center gap-2 rounded-md p-2 hover:bg-muted">
                    <RadioGroupItem value="imediato" id="freq-i" />
                    <Label htmlFor="freq-i" className="cursor-pointer text-sm">Imediato — assim que identificado</Label>
                  </div>
                  <div className="flex items-center gap-2 rounded-md p-2 hover:bg-muted">
                    <RadioGroupItem value="diario" id="freq-d" />
                    <Label htmlFor="freq-d" className="cursor-pointer text-sm">Diário — resumo às 07h</Label>
                  </div>
                  <div className="flex items-center gap-2 rounded-md p-2 hover:bg-muted">
                    <RadioGroupItem value="semanal" id="freq-s" />
                    <Label htmlFor="freq-s" className="cursor-pointer text-sm">Semanal — toda segunda-feira às 08h</Label>
                  </div>
                </RadioGroup>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
