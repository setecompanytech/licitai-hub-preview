import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Plus, Phone, Building2, DollarSign, GripVertical, Loader2, Users } from 'lucide-react';
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
  { key: 'novo', label: 'Novo', color: 'bg-info' },
  { key: 'qualificado', label: 'Qualificado', color: 'bg-warning' },
  { key: 'proposta', label: 'Proposta', color: 'bg-info' },
  { key: 'negociacao', label: 'Negociação', color: 'bg-warning' },
  { key: 'ganho', label: 'Ganho', color: 'bg-success' },
  { key: 'perdido', label: 'Perdido', color: 'bg-destructive' },
];

const moeda = (valor: number) =>
  `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Carregando os leads</span>
      </div>
    );
  }

  const dialogNovoLead = (
    <Dialog open={showNew} onOpenChange={setShowNew}>
      <DialogTrigger asChild>
        <Button><Plus aria-hidden="true" />Novo lead</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo lead</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="novo-lead-nome">Nome</Label>
            <Input id="novo-lead-nome" value={newLead.nome} onChange={e => setNewLead(p => ({ ...p, nome: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="novo-lead-telefone">Telefone</Label>
            <Input id="novo-lead-telefone" value={newLead.telefone} onChange={e => setNewLead(p => ({ ...p, telefone: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="novo-lead-empresa">Empresa</Label>
            <Input id="novo-lead-empresa" value={newLead.empresa} onChange={e => setNewLead(p => ({ ...p, empresa: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="novo-lead-setor">Setor</Label>
            <Select value={newLead.setor} onValueChange={v => setNewLead(p => ({ ...p, setor: v }))}>
              <SelectTrigger id="novo-lead-setor"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="licitações">Licitações</SelectItem>
                <SelectItem value="jurídico">Jurídico</SelectItem>
                <SelectItem value="financeiro">Financeiro</SelectItem>
                <SelectItem value="documentos">Documentos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="novo-lead-valor">Valor estimado (R$)</Label>
            <MoneyInput id="novo-lead-valor" value={Number(newLead.valor_estimado) || 0} onValueChange={v => setNewLead(p => ({ ...p, valor_estimado: String(v) }))} />
          </div>
          <Button onClick={handleCreateLead} className="w-full">Criar lead</Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground tabular-nums">
          {leads.length} leads • Total: {moeda(leads.reduce((s, l) => s + (l.valor_estimado || 0), 0))}
        </p>
        {dialogNovoLead}
      </div>

      {leads.length === 0 ? (
        <EstadoVazio
          icone={<Users aria-hidden="true" />}
          titulo="Nenhum lead no funil"
          descricao="Cadastre o primeiro contato para acompanhar a negociação por etapa."
          acao={<Button onClick={() => setShowNew(true)}><Plus aria-hidden="true" />Novo lead</Button>}
        />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {ETAPAS.map(etapa => {
            const etapaLeads = getEtapaLeads(etapa.key);
            const total = getEtapaTotal(etapa.key);
            return (
              <section key={etapa.key} className="w-72 flex-shrink-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${etapa.color}`} aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-foreground">{etapa.label}</h3>
                  <Badge variant="muted" className="ml-auto">{etapaLeads.length}</Badge>
                </div>
                {total > 0 && (
                  <p className="text-xs text-muted-foreground tabular-nums mb-2">{moeda(total)}</p>
                )}
                <ScrollArea className="h-[calc(100vh-420px)] min-h-64">
                  <div className="space-y-2 pr-2">
                    {etapaLeads.map(lead => (
                      <Card key={lead.id} className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-sm font-semibold text-foreground truncate">{lead.nome}</p>
                          <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
                        </div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <p className="flex items-center gap-1"><Phone className="w-3 h-3" aria-hidden="true" />{lead.telefone}</p>
                          {lead.empresa && <p className="flex items-center gap-1 truncate"><Building2 className="w-3 h-3 shrink-0" aria-hidden="true" />{lead.empresa}</p>}
                          {lead.valor_estimado > 0 && (
                            <p className="flex items-center gap-1 text-success font-semibold tabular-nums">
                              <DollarSign className="w-3 h-3" aria-hidden="true" />{moeda(lead.valor_estimado)}
                            </p>
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {ETAPAS.filter(e => e.key !== etapa.key).map(e => (
                            <Button
                              key={e.key}
                              variant="outline"
                              size="sm"
                              onClick={() => moveEtapa(lead.id, e.key)}
                              aria-label={`Mover ${lead.nome} para ${e.label}`}
                            >
                              → {e.label}
                            </Button>
                          ))}
                        </div>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
