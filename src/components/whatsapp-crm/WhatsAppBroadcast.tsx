import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Plus, Send, Loader2, Users, Clock, CheckCircle2, XCircle, Megaphone, Trash2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';

interface Campanha {
  id: string;
  nome: string;
  mensagem: string;
  setor: string | null;
  status: string;
  total_destinatarios: number;
  enviados: number;
  erros: number;
  created_at: string;
  executado_em: string | null;
}

interface Template {
  id: string;
  nome: string;
  conteudo: string;
  categoria: string;
}

export default function WhatsAppBroadcast() {
  const { user } = useAuth();
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [newCampanha, setNewCampanha] = useState({
    nome: '', mensagem: '', setor: '', destinatarios: '',
  });

  useEffect(() => { if (user) { loadCampanhas(); loadTemplates(); } }, [user]);

  const loadCampanhas = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('whatsapp_campanhas')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });
    if (data) setCampanhas(data as Campanha[]);
    setLoading(false);
  };

  const loadTemplates = async () => {
    const { data } = await supabase
      .from('whatsapp_templates')
      .select('id, nome, conteudo, categoria')
      .eq('user_id', user!.id)
      .eq('ativo', true);
    if (data) setTemplates(data as Template[]);
  };

  const handleCreate = async () => {
    if (!newCampanha.nome || !newCampanha.mensagem) {
      toast.error('Nome e mensagem são obrigatórios');
      return;
    }
    const phones = newCampanha.destinatarios
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    const { data: campanha, error } = await supabase.from('whatsapp_campanhas').insert({
      user_id: user!.id,
      nome: newCampanha.nome,
      mensagem: newCampanha.mensagem,
      setor: newCampanha.setor || null,
      total_destinatarios: phones.length,
    }).select('id').single();

    if (error || !campanha) { toast.error('Erro ao criar campanha'); return; }

    if (phones.length > 0) {
      const rows = phones.map(p => {
        const parts = p.split(',');
        return {
          user_id: user!.id,
          campanha_id: campanha.id,
          telefone: (parts[0] || '').replace(/\D/g, ''),
          nome: parts[1]?.trim() || null,
        };
      });
      await supabase.from('whatsapp_campanha_destinatarios').insert(rows);
    }

    toast.success('Campanha criada!');
    setShowNew(false);
    setNewCampanha({ nome: '', mensagem: '', setor: '', destinatarios: '' });
    loadCampanhas();
  };

  const handleExecute = async (campanhaId: string) => {
    setSending(campanhaId);
    // Simulate sending
    await supabase.from('whatsapp_campanhas').update({
      status: 'executada',
      executado_em: new Date().toISOString(),
    }).eq('id', campanhaId);

    await supabase.from('whatsapp_campanha_destinatarios')
      .update({ status: 'simulado', enviado_em: new Date().toISOString() })
      .eq('campanha_id', campanhaId);

    toast.success('Campanha executada (modo simulado)');
    setSending(null);
    loadCampanhas();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('whatsapp_campanhas').delete().eq('id', id);
    toast.success('Campanha removida');
    loadCampanhas();
  };

  const applyTemplate = (template: Template) => {
    setNewCampanha(prev => ({ ...prev, mensagem: template.conteudo }));
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      rascunho: { label: 'Rascunho', variant: 'outline' },
      executada: { label: 'Executada', variant: 'default' },
      agendada: { label: 'Agendada', variant: 'secondary' },
    };
    const info = map[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={info.variant} className="text-xs">{info.label}</Badge>;
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{campanhas.length} campanhas</p>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="w-4 h-4" />Nova Campanha</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nova Campanha de Envio em Massa</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">Nome da Campanha</Label><Input value={newCampanha.nome} onChange={e => setNewCampanha(p => ({ ...p, nome: e.target.value }))} className="mt-1" /></div>
              <div>
                <Label className="text-xs">Setor (opcional)</Label>
                <Select value={newCampanha.setor} onValueChange={v => setNewCampanha(p => ({ ...p, setor: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Todos os setores" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="licitações">Licitações</SelectItem>
                    <SelectItem value="jurídico">Jurídico</SelectItem>
                    <SelectItem value="financeiro">Financeiro</SelectItem>
                    <SelectItem value="documentos">Documentos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {templates.length > 0 && (
                <div>
                  <Label className="text-xs">Usar Template</Label>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {templates.map(t => (
                      <Button key={t.id} variant="outline" size="sm" className="text-xs h-7" onClick={() => applyTemplate(t)}>{t.nome}</Button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <Label className="text-xs">Mensagem</Label>
                <Textarea value={newCampanha.mensagem} onChange={e => setNewCampanha(p => ({ ...p, mensagem: e.target.value }))} rows={4} className="mt-1" placeholder="Use {{nome}} para personalizar" />
              </div>
              <div>
                <Label className="text-xs">Destinatários (telefone por linha, opcionalmente: telefone, nome)</Label>
                <Textarea value={newCampanha.destinatarios} onChange={e => setNewCampanha(p => ({ ...p, destinatarios: e.target.value }))} rows={4} className="mt-1 font-mono text-xs" placeholder="11999999999, João&#10;11988888888, Maria" />
              </div>
              <Button onClick={handleCreate} className="w-full">Criar Campanha</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {campanhas.length === 0 ? (
          <Card className="p-10 text-center">
            <Megaphone className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Nenhuma campanha criada ainda</p>
          </Card>
        ) : (
          campanhas.map(c => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold">{c.nome}</p>
                    {statusBadge(c.status)}
                    {c.setor && <Badge variant="outline" className="text-xs">{c.setor}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{c.mensagem}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{c.total_destinatarios} destinatários</span>
                    {c.status === 'executada' && (
                      <>
                        <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-3 h-3" />{c.enviados || c.total_destinatarios} enviados</span>
                        {c.erros > 0 && <span className="flex items-center gap-1 text-destructive"><XCircle className="w-3 h-3" />{c.erros} erros</span>}
                      </>
                    )}
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(c.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-3">
                  {c.status === 'rascunho' && (
                    <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => handleExecute(c.id)} disabled={sending === c.id}>
                      {sending === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      Enviar
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDelete(c.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
