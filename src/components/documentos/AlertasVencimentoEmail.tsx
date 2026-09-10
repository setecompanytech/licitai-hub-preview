import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
    return <Card className="p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></Card>;
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <BellRing className="w-5 h-5 text-muted-foreground mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold">Alertas de vencimento por e-mail</h3>
            <p className="text-xs text-muted-foreground max-w-xl">
              Disparo diário (7h) para assessorias contábeis e setores cadastrados. A cor esquenta
              conforme o prazo aperta; documento <b>vencido</b> repete todos os dias — e o alerta
              cessa sozinho quando o documento renovado é anexado no sistema (a validade nova o
              tira da janela). WhatsApp: aguarda contratação de provedor; por ora, e-mail.
            </p>
          </div>
        </div>
        <div className="flex items-end gap-3 shrink-0">
          <div>
            <Label className="text-xs">Antecedência (dias)</Label>
            <Input type="number" min={5} max={120} value={antecedencia}
              onChange={e => setAntecedencia(e.target.value)}
              onBlur={() => ativo && salvarConfig(true)}
              className="h-8 w-24" />
          </div>
          <div className="flex items-center gap-2 pb-1">
            <Switch checked={ativo} disabled={salvando} onCheckedChange={salvarConfig} id="alertas-docs" />
            <Label htmlFor="alertas-docs" className="text-sm">{ativo ? 'Ligado' : 'Desligado'}</Label>
          </div>
        </div>
      </div>

      {/* Cadastro de destinatários */}
      <div className="rounded-md border p-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_180px_auto] gap-2 items-end">
          <div>
            <Label className="text-xs">Nome</Label>
            <Input value={novo.nome} onChange={e => setNovo(n => ({ ...n, nome: e.target.value }))}
              placeholder="Ex.: Contabilidade XYZ" className="h-9" />
          </div>
          <div>
            <Label className="text-xs">E-mail</Label>
            <Input type="email" value={novo.email} onChange={e => setNovo(n => ({ ...n, email: e.target.value }))}
              placeholder="alertas@contabilidade.com.br" className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={novo.tipo} onValueChange={(v: Destinatario['tipo']) => setNovo(n => ({ ...n, tipo: v }))}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="assessoria_contabil">Assessoria contábil</SelectItem>
                <SelectItem value="interno">Setor interno</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={adicionar} disabled={salvando}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
          </Button>
        </div>

        {destinatarios.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            Nenhum destinatário — cadastre o e-mail da assessoria e dos setores que devem ser avisados.
          </p>
        ) : (
          <div className="space-y-1">
            {destinatarios.map(d => (
              <div key={d.id} className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 ${d.ativo ? '' : 'opacity-50'}`}>
                <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{d.nome}</span>
                  <span className="text-xs text-muted-foreground ml-2">{d.email}</span>
                </div>
                <Badge variant="outline" className="text-xs font-normal">{TIPO_LABEL[d.tipo]}</Badge>
                <Switch checked={d.ativo} onCheckedChange={() => alternarDestinatario(d)} />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remover(d)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {trilha.length > 0 && (
        <div className="rounded-md border p-3">
          <p className="text-xs font-semibold mb-1.5">Últimos disparos</p>
          {trilha.map((t, i) => (
            <p key={i} className="text-xs text-muted-foreground truncate">
              {new Date(t.enviado_em).toLocaleString('pt-BR')} · {t.destinatario_email} ·{' '}
              {t.docs_no_digest} doc{t.docs_no_digest === 1 ? '' : 's'}
              {t.vencidos > 0 && <span className="text-destructive font-medium"> ({t.vencidos} vencido{t.vencidos === 1 ? '' : 's'})</span>}
            </p>
          ))}
        </div>
      )}
    </Card>
  );
}
