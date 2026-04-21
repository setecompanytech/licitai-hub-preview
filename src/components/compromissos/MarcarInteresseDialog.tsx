import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Building2, Bell, Mail, MessageSquare, CalendarDays, Zap, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';

interface EditalData {
  numero: string;
  orgao: string;
  objeto: string;
  modalidade?: string;
  valor_estimado?: number | null;
  uf?: string | null;
  municipio?: string | null;
  data_encerramento?: string | null;
  portal?: string | null;
  url?: string | null;
}

interface MarcarInteresseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  edital: EditalData;
  onSuccess?: () => void;
}

export default function MarcarInteresseDialog({ open, onOpenChange, edital, onSuccess }: MarcarInteresseDialogProps) {
  const { user } = useAuth();
  const { empresas, empresaAtiva } = useEmpresa();
  const [empresaId, setEmpresaId] = useState(empresaAtiva?.id || '');
  const [alertaEmail, setAlertaEmail] = useState(true);
  const [alertaWhatsapp, setAlertaWhatsapp] = useState(false);
  const [alertaSistema, setAlertaSistema] = useState(true);
  const [autoCadastro, setAutoCadastro] = useState(false);
  const [notas, setNotas] = useState('');
  const [salvando, setSalvando] = useState(false);

  const handleSalvar = async () => {
    if (!user) return;
    if (!empresaId) {
      toast.error('Selecione uma empresa para participar.');
      return;
    }

    setSalvando(true);
    try {
      const { data: interesseRow, error } = await supabase.from('processos_interesse').insert({
        user_id: user.id,
        empresa_id: empresaId,
        numero: edital.numero,
        orgao: edital.orgao,
        objeto: edital.objeto,
        modalidade: edital.modalidade || 'Pregão Eletrônico',
        valor_estimado: edital.valor_estimado,
        uf: edital.uf,
        municipio: edital.municipio,
        data_abertura: edital.data_encerramento,
        data_encerramento: edital.data_encerramento,
        portal: edital.portal,
        url: edital.url,
        alerta_email: alertaEmail,
        alerta_whatsapp: alertaWhatsapp,
        alerta_sistema: alertaSistema,
        auto_cadastro: autoCadastro,
        notas,
      }).select('licitacao_id').maybeSingle();

      if (error) throw error;

      // 🔄 Gatilho: prepara automaticamente a Pasta do Processo (download PDF + extração itens)
      const lid = interesseRow?.licitacao_id;
      if (lid) {
        supabase.functions
          .invoke('processo-auto-prepare', { body: { licitacao_id: lid } })
          .then(({ error: prepErr }) => {
            if (prepErr) console.warn('[auto-prepare] background:', prepErr);
          });
      }

      toast.success('Processo adicionado. Estamos preparando a pasta automaticamente…');
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao marcar interesse.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-success" />
            Marcar Interesse no Processo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Edital info */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-1">
            <p className="text-sm font-semibold">{edital.numero}</p>
            <p className="text-xs text-muted-foreground">{edital.orgao}</p>
            <p className="text-xs text-muted-foreground line-clamp-2">{edital.objeto}</p>
            {edital.valor_estimado && (
              <Badge variant="outline" className="text-xs mt-1">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(edital.valor_estimado)}
              </Badge>
            )}
          </div>

          {/* Empresa selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Empresa participante
            </Label>
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent>
                {empresas.map((mem) => (
                  <SelectItem key={mem.empresa_id} value={mem.empresa_id}>
                    {mem.empresa.nome_fantasia || mem.empresa.razao_social} ({mem.empresa.cnpj})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Alert channels */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Canais de Alerta (7, 3 e 1 dia antes)
            </Label>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm flex items-center gap-2">
                  <Bell className="w-3.5 h-3.5 text-accent" /> Notificação no sistema
                </span>
                <Switch checked={alertaSistema} onCheckedChange={setAlertaSistema} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-info" /> E-mail
                </span>
                <Switch checked={alertaEmail} onCheckedChange={setAlertaEmail} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-success" /> WhatsApp
                </span>
                <Switch checked={alertaWhatsapp} onCheckedChange={setAlertaWhatsapp} />
              </div>
            </div>
          </div>

          {/* Auto-cadastro */}
          <div className="flex items-center justify-between bg-accent/5 rounded-lg p-3 border border-accent/20">
            <div>
              <p className="text-sm font-medium flex items-center gap-2">
                <Zap className="w-4 h-4 text-accent" /> Cadastro automático
              </p>
              <p className="text-xs text-muted-foreground">
                IA valida preços e cadastra automaticamente no portal
              </p>
            </div>
            <Switch checked={autoCadastro} onCheckedChange={setAutoCadastro} />
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label>Observações (opcional)</Label>
            <Textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Notas sobre o processo..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={salvando} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            {salvando ? 'Salvando...' : 'Confirmar Interesse'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
