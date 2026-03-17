import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import {
  Key, Save, Loader2, CheckCircle2, AlertTriangle, ExternalLink, Shield, FileText
} from 'lucide-react';

export default function NuvemFiscalConfig() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [apiKey, setApiKey] = useState('');
  const [ambiente, setAmbiente] = useState('homologacao');
  const [ativo, setAtivo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !empresaAtiva) { setLoading(false); return; }
    loadConfig();
  }, [user, empresaAtiva]);

  const loadConfig = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('nuvem_fiscal_config')
      .select('*')
      .eq('user_id', user!.id)
      .eq('empresa_id', empresaAtiva!.id)
      .maybeSingle();

    if (data) {
      setApiKey(data.api_key_encrypted || '');
      setAmbiente(data.ambiente || 'homologacao');
      setAtivo(data.ativo || false);
      setExistingId(data.id);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!empresaAtiva) { toast.error('Selecione uma empresa ativa'); return; }
    if (!apiKey.trim()) { toast.error('Informe a chave da API'); return; }

    setSaving(true);
    const payload = {
      user_id: user!.id,
      empresa_id: empresaAtiva.id,
      api_key_encrypted: apiKey.trim(),
      ambiente,
      ativo,
    };

    let error;
    if (existingId) {
      ({ error } = await supabase.from('nuvem_fiscal_config').update(payload as any).eq('id', existingId));
    } else {
      ({ error } = await supabase.from('nuvem_fiscal_config').insert(payload as any));
    }

    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar configuração');
      console.error(error);
      return;
    }
    toast.success('Configuração fiscal salva!');
    loadConfig();
  };

  if (!empresaAtiva) {
    return (
      <Card className="p-6 text-center text-muted-foreground">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-warning" />
        <p className="text-sm">Selecione uma empresa ativa para configurar a emissão de NF.</p>
      </Card>
    );
  }

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="w-5 h-5 text-primary" />
        <h3 className="text-sm font-semibold">Configuração Fiscal — Nuvem Fiscal</h3>
        <Badge variant="outline" className="text-[10px]">{empresaAtiva.razao_social}</Badge>
      </div>

      <Card className="p-4 space-y-4">
        <div className="p-3 rounded-lg bg-muted/30 border text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> Requisitos:</p>
          <p>• Conta ativa na <a href="https://nuvemfiscal.com.br" target="_blank" rel="noopener" className="text-primary underline">Nuvem Fiscal</a></p>
          <p>• Certificado Digital A1 configurado na plataforma</p>
          <p>• Inscrição Municipal/Estadual da empresa cadastrada</p>
          <p>• A chave da API é armazenada de forma segura vinculada à sua empresa</p>
        </div>

        <div>
          <Label className="text-xs flex items-center gap-1"><Key className="w-3 h-3" /> Chave da API (API Key)</Label>
          <Input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="Insira a chave da API Nuvem Fiscal"
            className="font-mono text-xs"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Encontre em: Nuvem Fiscal → Configurações → API Keys
            <a href="https://app.nuvemfiscal.com.br/api-keys" target="_blank" rel="noopener" className="text-primary ml-1 inline-flex items-center gap-0.5">
              Acessar <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </p>
        </div>

        <div>
          <Label className="text-xs">Ambiente</Label>
          <Select value={ambiente} onValueChange={setAmbiente}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="homologacao">Homologação (Testes)</SelectItem>
              <SelectItem value="producao">Produção</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground mt-1">
            Use "Homologação" para testes. Mude para "Produção" quando estiver pronto para emitir NFs reais.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs">Emissão de NF Ativa</Label>
            <p className="text-[10px] text-muted-foreground">Habilite para permitir emissão de NFs a partir dos contratos</p>
          </div>
          <Switch checked={ativo} onCheckedChange={setAtivo} />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
            Salvar Configuração
          </Button>
          {existingId && ativo && (
            <Badge className="bg-success/10 text-success text-[10px]">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Configurada
            </Badge>
          )}
        </div>
      </Card>
    </div>
  );
}
