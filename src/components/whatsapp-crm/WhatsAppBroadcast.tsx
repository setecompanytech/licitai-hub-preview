import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import EstadoVazio from '@/components/shared/EstadoVazio';
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

  // Status sempre com TEXTO — a cor é reforço, nunca a única pista.
  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: 'success' | 'info' | 'muted' }> = {
      rascunho: { label: 'Rascunho', variant: 'muted' },
      executada: { label: 'Executada', variant: 'success' },
      agendada: { label: 'Agendada', variant: 'info' },
    };
    const info = map[status] || { label: status, variant: 'muted' as const };
    return <Badge variant={info.variant}>{info.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Carregando as campanhas</span>
      </div>
    );
  }

  const dialogNovaCampanha = (
    <Dialog open={showNew} onOpenChange={setShowNew}>
      <DialogTrigger asChild>
        <Button><Plus aria-hidden="true" />Nova campanha</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nova campanha de disparo</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="campanha-nome">Nome da campanha</Label>
            <Input id="campanha-nome" value={newCampanha.nome} onChange={e => setNewCampanha(p => ({ ...p, nome: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="campanha-setor">Setor (opcional)</Label>
            <Select value={newCampanha.setor} onValueChange={v => setNewCampanha(p => ({ ...p, setor: v }))}>
              <SelectTrigger id="campanha-setor"><SelectValue placeholder="Todos os setores" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="licitações">Licitações</SelectItem>
                <SelectItem value="jurídico">Jurídico</SelectItem>
                <SelectItem value="financeiro">Financeiro</SelectItem>
                <SelectItem value="documentos">Documentos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {templates.length > 0 && (
            <div className="space-y-1.5">
              <Label>Usar modelo</Label>
              <div className="flex flex-wrap gap-2">
                {templates.map(t => (
                  <Button key={t.id} variant="outline" size="sm" onClick={() => applyTemplate(t)}>{t.nome}</Button>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="campanha-mensagem">Mensagem</Label>
            <Textarea id="campanha-mensagem" value={newCampanha.mensagem} onChange={e => setNewCampanha(p => ({ ...p, mensagem: e.target.value }))} rows={4} placeholder="Use {{nome}} para personalizar" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="campanha-destinatarios">Destinatários (telefone por linha, opcionalmente: telefone, nome)</Label>
            <Textarea id="campanha-destinatarios" value={newCampanha.destinatarios} onChange={e => setNewCampanha(p => ({ ...p, destinatarios: e.target.value }))} rows={4} className="font-mono text-sm" placeholder="11999999999, João&#10;11988888888, Maria" />
          </div>
          <Button onClick={handleCreate} className="w-full">Criar campanha</Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground tabular-nums">{campanhas.length} campanhas</p>
        {dialogNovaCampanha}
      </div>

      <div className="grid gap-4">
        {campanhas.length === 0 ? (
          <EstadoVazio
            icone={<Megaphone aria-hidden="true" />}
            titulo="Nenhuma campanha criada ainda"
            descricao="Monte uma lista de destinatários, escreva a mensagem e dispare de uma vez."
            acao={<Button onClick={() => setShowNew(true)}><Plus aria-hidden="true" />Nova campanha</Button>}
          />
        ) : (
          campanhas.map(c => (
            <Card key={c.id} className="p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-foreground">{c.nome}</h3>
                    {statusBadge(c.status)}
                    {c.setor && <Badge variant="muted" truncate>{c.setor}</Badge>}
                  </div>
                  <p className="mb-3 text-sm text-muted-foreground line-clamp-2">{c.mensagem}</p>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1 tabular-nums"><Users className="w-4 h-4" aria-hidden="true" />{c.total_destinatarios} destinatários</span>
                    {c.status === 'executada' && (
                      <>
                        <span className="flex items-center gap-1 tabular-nums text-success"><CheckCircle2 className="w-4 h-4" aria-hidden="true" />{c.enviados || c.total_destinatarios} enviados</span>
                        {c.erros > 0 && <span className="flex items-center gap-1 tabular-nums text-destructive"><XCircle className="w-4 h-4" aria-hidden="true" />{c.erros} erros</span>}
                      </>
                    )}
                    <span className="flex items-center gap-1 tabular-nums"><Clock className="w-4 h-4" aria-hidden="true" />{new Date(c.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
                <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                  {c.status === 'rascunho' && (
                    <Button size="sm" variant="outline" onClick={() => handleExecute(c.id)} disabled={sending === c.id}>
                      {sending === c.id
                        ? <Loader2 className="animate-spin" aria-hidden="true" />
                        : <Send aria-hidden="true" />}
                      Enviar
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(c.id)} aria-label={`Remover a campanha ${c.nome}`}>
                    <Trash2 className="text-destructive" aria-hidden="true" />
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
