import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Plus, Phone, Building2, DollarSign, GripVertical, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';

interface Lead {
  id: string;
  nome: string;
  telefone: string;
  empresa: string | null;
  setor: string;
  etapa: string;
  valor_estimado: number;
  origem: string;
  notas: string | null;
  created_at: string;
}

const ETAPAS = [
  { key: 'novo', label: 'Novo', color: 'bg-blue-500' },
  { key: 'qualificado', label: 'Qualificado', color: 'bg-amber-500' },
  { key: 'proposta', label: 'Proposta', color: 'bg-purple-500' },
  { key: 'negociacao', label: 'Negociação', color: 'bg-orange-500' },
  { key: 'ganho', label: 'Ganho', color: 'bg-emerald-500' },
  { key: 'perdido', label: 'Perdido', color: 'bg-red-500' },
];

export default function WhatsAppPipeline() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newLead, setNewLead] = useState({ nome: '', telefone: '', empresa: '', setor: 'licitações', valor_estimado: '' });

  useEffect(() => { if (user) loadLeads(); }, [user]);

  const loadLeads = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('whatsapp_leads')
      .select('*')
      .eq('user_id', user!.id)
      .order('ordem', { ascending: true });
    if (data) setLeads(data as Lead[]);
    setLoading(false);
  };

  const handleCreateLead = async () => {
    if (!newLead.nome || !newLead.telefone) { toast.error('Nome e telefone são obrigatórios'); return; }
    const { error } = await supabase.from('whatsapp_leads').insert({
      user_id: user!.id,
      nome: newLead.nome,
      telefone: newLead.telefone.replace(/\D/g, ''),
      empresa: newLead.empresa || null,
      setor: newLead.setor,
      valor_estimado: parseFloat(newLead.valor_estimado) || 0,
    });
    if (error) toast.error('Erro ao criar lead');
    else {
      toast.success('Lead adicionado!');
      setShowNew(false);
      setNewLead({ nome: '', telefone: '', empresa: '', setor: 'licitações', valor_estimado: '' });
      loadLeads();
    }
  };

  const moveEtapa = async (leadId: string, novaEtapa: string) => {
    const { error } = await supabase.from('whatsapp_leads').update({ etapa: novaEtapa }).eq('id', leadId);
    if (!error) loadLeads();
  };

  const getEtapaLeads = (etapa: string) => leads.filter(l => l.etapa === etapa);
  const getEtapaTotal = (etapa: string) => getEtapaLeads(etapa).reduce((sum, l) => sum + (l.valor_estimado || 0), 0);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <p className="text-sm text-muted-foreground">
            {leads.length} leads • Total: R$ {leads.reduce((s, l) => s + (l.valor_estimado || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="w-4 h-4" />Novo Lead</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Lead</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">Nome</Label><Input value={newLead.nome} onChange={e => setNewLead(p => ({ ...p, nome: e.target.value }))} className="mt-1" /></div>
              <div><Label className="text-xs">Telefone</Label><Input value={newLead.telefone} onChange={e => setNewLead(p => ({ ...p, telefone: e.target.value }))} className="mt-1" /></div>
              <div><Label className="text-xs">Empresa</Label><Input value={newLead.empresa} onChange={e => setNewLead(p => ({ ...p, empresa: e.target.value }))} className="mt-1" /></div>
              <div>
                <Label className="text-xs">Setor</Label>
                <Select value={newLead.setor} onValueChange={v => setNewLead(p => ({ ...p, setor: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="licitações">Licitações</SelectItem>
                    <SelectItem value="jurídico">Jurídico</SelectItem>
                    <SelectItem value="financeiro">Financeiro</SelectItem>
                    <SelectItem value="documentos">Documentos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Valor Estimado (R$)</Label><MoneyInput value={Number(newLead.valor_estimado) || 0} onValueChange={v => setNewLead(p => ({ ...p, valor_estimado: String(v) }))} className="mt-1" /></div>
              <Button onClick={handleCreateLead} className="w-full">Criar Lead</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {ETAPAS.map(etapa => {
          const etapaLeads = getEtapaLeads(etapa.key);
          const total = getEtapaTotal(etapa.key);
          return (
            <div key={etapa.key} className="min-w-[260px] w-[260px] flex-shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2.5 h-2.5 rounded-full ${etapa.color}`} />
                <span className="text-sm font-semibold">{etapa.label}</span>
                <Badge variant="secondary" className="text-xs ml-auto">{etapaLeads.length}</Badge>
              </div>
              {total > 0 && (
                <p className="text-xs text-muted-foreground mb-2">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              )}
              <ScrollArea className="h-[calc(100vh-380px)]">
                <div className="space-y-2">
                  {etapaLeads.map(lead => (
                    <Card key={lead.id} className="p-3 cursor-grab hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-1">
                        <p className="text-sm font-medium truncate">{lead.nome}</p>
                        <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.telefone}</p>
                        {lead.empresa && <p className="flex items-center gap-1"><Building2 className="w-3 h-3" />{lead.empresa}</p>}
                        {lead.valor_estimado > 0 && (
                          <p className="flex items-center gap-1 text-emerald-600 font-medium">
                            <DollarSign className="w-3 h-3" />R$ {lead.valor_estimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {ETAPAS.filter(e => e.key !== etapa.key).map(e => (
                          <Button key={e.key} variant="ghost" size="sm" className="text-[10px] h-6 px-1.5" onClick={() => moveEtapa(lead.id, e.key)}>
                            → {e.label}
                          </Button>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          );
        })}
      </div>
    </div>
  );
}
