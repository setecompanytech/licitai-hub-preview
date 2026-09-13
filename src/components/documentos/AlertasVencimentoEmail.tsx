import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import { BellRing, Loader2, Mail, Plus, Trash2 } from 'lucide-react';

type Destinatario = {
  id: string; nome: string; email: string;
  tipo: 'assessoria_contabil' | 'interno' | 'outro'; ativo: boolean;
};
type LogRow = { destinatario_email: string; docs_no_digest: number; vencidos: number; enviado_em: string };

const TIPO_LABEL: Record<Destinatario['tipo'], string> = {
  assessoria_contabil: 'Assessoria contábil',
  interno: 'Setor interno',
  outro: 'Outro',
};

/**
 * Alertas de vencimento por E-MAIL — o braço externo do lembrete in-app.
 *
 * O sistema já sabia avisar quem está logado; a assessoria contábil não
 * loga. Aqui cadastram-se os e-mails (assessoria + setores), liga-se o
 * disparo diário (07h) e a régua é a mesma da lib de lembretes: janela de
 * antecedência, cores esquentando conforme o prazo, VENCIDO repete todo
 * dia — e cessa sozinho quando o documento renovado sobe, porque a nova
 * validade tira o doc da janela.
 */
export default function AlertasVencimentoEmail() {
  const { empresaAtiva } = useEmpresa();
  const [ativo, setAtivo] = useState(false);
  const [antecedencia, setAntecedencia] = useState('30');
  const [destinatarios, setDestinatarios] = useState<Destinatario[]>([]);
  const [trilha, setTrilha] = useState<LogRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [novo, setNovo] = useState({ nome: '', email: '', tipo: 'assessoria_contabil' as Destinatario['tipo'] });

  const carregar = async () => {
    if (!empresaAtiva?.id) return;
    setCarregando(true);
    const [cfgRes, destRes, logRes] = await Promise.all([
      (supabase.from('documentos_alertas_config' as never) as any)
        .select('ativo, antecedencia_dias').eq('empresa_id', empresaAtiva.id).maybeSingle(),
      (supabase.from('documentos_alertas_destinatarios' as never) as any)
        .select('id, nome, email, tipo, ativo').eq('empresa_id', empresaAtiva.id).order('created_at'),
      (supabase.from('documentos_alertas_log' as never) as any)
        .select('destinatario_email, docs_no_digest, vencidos, enviado_em')
        .eq('empresa_id', empresaAtiva.id).order('enviado_em', { ascending: false }).limit(8),
    ]);
    const cfg = cfgRes.data as { ativo: boolean; antecedencia_dias: number } | null;
    setAtivo(!!cfg?.ativo);
    setAntecedencia(String(cfg?.antecedencia_dias ?? 30));
    setDestinatarios((destRes.data as Destinatario[]) || []);
    setTrilha((logRes.data as LogRow[]) || []);
    setCarregando(false);
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaAtiva?.id]);

  const salvarConfig = async (novoAtivo: boolean) => {
    if (!empresaAtiva?.id) return;
    if (novoAtivo && destinatarios.filter(d => d.ativo).length === 0) {
      toast.error('Cadastre ao menos um destinatário antes de ligar os alertas.');
      return;
    }
    setSalvando(true);
    const { error } = await (supabase.from('documentos_alertas_config' as never) as any).upsert({
      empresa_id: empresaAtiva.id,
      ativo: novoAtivo,
      antecedencia_dias: Math.min(120, Math.max(5, parseInt(antecedencia) || 30)),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'empresa_id' });
    setSalvando(false);
    if (error) { toast.error('Não foi possível salvar', { description: error.message }); return; }
    setAtivo(novoAtivo);
    toast.success(novoAtivo
      ? 'Alertas ligados — disparo diário às 7h para os e-mails cadastrados.'
      : 'Alertas por e-mail desligados.');
  };

  const adicionar = async () => {
    if (!empresaAtiva?.id) return;
    const email = novo.email.trim().toLowerCase();
    if (!novo.nome.trim()) { toast.error('Informe o nome.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { toast.error('E-mail inválido.'); return; }
    setSalvando(true);
    const { error } = await (supabase.from('documentos_alertas_destinatarios' as never) as any).insert({
      empresa_id: empresaAtiva.id, nome: novo.nome.trim(), email, tipo: novo.tipo,
    });
    setSalvando(false);
    if (error) {
      toast.error('Não foi possível cadastrar', {
        description: error.message.includes('duplicate') ? 'Este e-mail já está cadastrado.' : error.message,
      });
      return;
    }
    toast.success(`${email} passará a receber os alertas.`);
    setNovo({ nome: '', email: '', tipo: 'assessoria_contabil' });
    carregar();
  };

  const alternarDestinatario = async (d: Destinatario) => {
    const { error } = await (supabase.from('documentos_alertas_destinatarios' as never) as any)
      .update({ ativo: !d.ativo }).eq('id', d.id);
    if (error) { toast.error('Não foi possível alterar', { description: error.message }); return; }
    carregar();
  };

  const remover = async (d: Destinatario) => {
    const { error } = await (supabase.from('documentos_alertas_destinatarios' as never) as any)
      .delete().eq('id', d.id);
    if (error) { toast.error('Não foi possível remover', { description: error.message }); return; }
    toast.success(`${d.email} removido dos alertas.`);
    carregar();
  };

  if (carregando) {
    return (
      <Card className="flex justify-center p-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Carregando alertas de vencimento…</span>
      </Card>
    );
  }

  return (
    <Card className="space-y-6 p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="flex items-start gap-3">
          <BellRing className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0">
            <h3 className="text-lg font-semibold">Alertas de vencimento por e-mail</h3>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Disparo diário (7h) para assessorias contábeis e setores cadastrados. A cor esquenta
              conforme o prazo aperta; documento <b>vencido</b> repete todos os dias — e o alerta
              cessa sozinho quando o documento renovado é anexado no sistema (a validade nova o
              tira da janela). WhatsApp: aguarda contratação de provedor; por ora, e-mail.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-4 sm:shrink-0">
          <div className="space-y-2">
            <Label htmlFor="alertas-docs-antecedencia" className="text-sm">Antecedência (dias)</Label>
            <Input
              id="alertas-docs-antecedencia"
              type="number"
              min={5}
              max={120}
              value={antecedencia}
              onChange={e => setAntecedencia(e.target.value)}
              onBlur={() => ativo && salvarConfig(true)}
              className="w-28 tabular-nums"
            />
          </div>
          <div className="flex items-center gap-2 pb-3">
            <Switch checked={ativo} disabled={salvando} onCheckedChange={salvarConfig} id="alertas-docs" />
            <Label htmlFor="alertas-docs" className="text-sm">{ativo ? 'Ligado' : 'Desligado'}</Label>
          </div>
        </div>
      </div>

      {/* Cadastro de destinatários */}
      <div className="space-y-4 rounded-lg border border-border p-4">
        <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_1fr_180px_auto]">
          <div className="space-y-2">
            <Label htmlFor="alertas-docs-nome" className="text-sm">Nome</Label>
            <Input id="alertas-docs-nome" value={novo.nome} onChange={e => setNovo(n => ({ ...n, nome: e.target.value }))}
              placeholder="Ex.: Contabilidade XYZ" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="alertas-docs-email" className="text-sm">E-mail</Label>
            <Input id="alertas-docs-email" type="email" value={novo.email} onChange={e => setNovo(n => ({ ...n, email: e.target.value }))}
              placeholder="alertas@contabilidade.com.br" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="alertas-docs-tipo" className="text-sm">Tipo</Label>
            <Select value={novo.tipo} onValueChange={(v: Destinatario['tipo']) => setNovo(n => ({ ...n, tipo: v }))}>
              <SelectTrigger id="alertas-docs-tipo"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="assessoria_contabil">Assessoria contábil</SelectItem>
                <SelectItem value="interno">Setor interno</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={adicionar} disabled={salvando}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Adicionar
          </Button>
        </div>

        {destinatarios.length === 0 ? (
          <EstadoVazio
            tamanho="compacto"
            icone={<Mail />}
            titulo="Nenhum destinatário"
            descricao="Cadastre o e-mail da assessoria e dos setores que devem ser avisados."
          />
        ) : (
          <div className="space-y-2">
            {destinatarios.map(d => (
              <div key={d.id} className={`flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2 ${d.ativo ? '' : 'opacity-50'}`}>
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium">{d.nome}</span>
                  <span className="ml-2 text-sm text-muted-foreground">{d.email}</span>
                </div>
                <Badge variant="muted">{TIPO_LABEL[d.tipo]}</Badge>
                <Switch
                  checked={d.ativo}
                  onCheckedChange={() => alternarDestinatario(d)}
                  aria-label={`${d.ativo ? 'Desativar' : 'Ativar'} os alertas para ${d.email}`}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => remover(d)}
                  className="text-destructive-ink hover:bg-destructive-tint hover:text-destructive-ink"
                  title="Remover destinatário"
                  aria-label={`Remover ${d.email} dos alertas`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {trilha.length > 0 && (
        <div className="rounded-lg border border-border p-4">
          <p className="mb-2 text-sm font-semibold">Últimos disparos</p>
          <div className="space-y-1">
            {trilha.map((t, i) => (
              <p key={i} className="truncate text-xs text-muted-foreground">
                {new Date(t.enviado_em).toLocaleString('pt-BR')} · {t.destinatario_email} ·{' '}
                {t.docs_no_digest} doc{t.docs_no_digest === 1 ? '' : 's'}
                {t.vencidos > 0 && <span className="font-medium text-destructive-ink"> ({t.vencidos} vencido{t.vencidos === 1 ? '' : 's'})</span>}
              </p>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
