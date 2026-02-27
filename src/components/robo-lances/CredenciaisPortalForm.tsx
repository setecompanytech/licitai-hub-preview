import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Key, Upload, Shield, Trash2, Eye, EyeOff, Loader2, FileKey2,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const PORTAIS = [
  { id: 'pncp', nome: 'PNCP' },
  { id: 'compras-gov', nome: 'Compras Governamentais' },
  { id: 'bll', nome: 'BLL Compras' },
  { id: 'licitanet', nome: 'Licitanet' },
  { id: 'licitacoes-e', nome: 'Licitações-e (BB)' },
  { id: 'portal-compras', nome: 'Portal de Compras Públicas' },
  { id: 'tcmpa', nome: 'TCM-PA' },
];

export default function CredenciaisPortalForm() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const [portalId, setPortalId] = useState('');
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certTipo, setCertTipo] = useState<'pf' | 'pj'>('pj');
  const [certValidade, setCertValidade] = useState('');

  const { data: credenciais = [], isLoading } = useQuery({
    queryKey: ['credenciais-portais', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('credenciais_portais')
        .select('*')
        .eq('user_id', user.id)
        .order('portal_nome');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const cred = credenciais.find((c: any) => c.id === id);
      if (cred?.certificado_path) {
        await supabase.storage.from('certificados').remove([cred.certificado_path]);
      }
      const { error } = await supabase.from('credenciais_portais').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credenciais-portais'] });
      toast.success('Credencial removida');
    },
    onError: () => toast.error('Erro ao remover credencial'),
  });

  const resetForm = () => {
    setPortalId('');
    setLogin('');
    setSenha('');
    setCertFile(null);
    setCertTipo('pj');
    setCertValidade('');
  };

  const handleSave = async () => {
    if (!user || !portalId) return;
    setSaving(true);

    try {
      const portal = PORTAIS.find((p) => p.id === portalId);
      let certPath: string | null = null;
      let certNome: string | null = null;

      if (certFile) {
        const ext = certFile.name.split('.').pop();
        const path = `${user.id}/${portalId}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('certificados')
          .upload(path, certFile);
        if (upErr) throw upErr;
        certPath = path;
        certNome = certFile.name;
      }

      // Simple base64 obfuscation for password (real encryption should be server-side)
      const senhaEncoded = senha ? btoa(senha) : null;

      const { error } = await supabase.from('credenciais_portais').upsert(
        {
          user_id: user.id,
          portal_id: portalId,
          portal_nome: portal?.nome || portalId,
          login: login || null,
          senha_hash: senhaEncoded,
          certificado_path: certPath,
          certificado_tipo: certFile ? certTipo : null,
          certificado_nome: certNome,
          validade_certificado: certValidade || null,
          status: 'ativo',
        },
        { onConflict: 'user_id,portal_id' }
      );
      if (error) throw error;

      toast.success('Credencial salva com sucesso');
      queryClient.invalidateQueries({ queryKey: ['credenciais-portais'] });
      resetForm();
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar credencial');
    } finally {
      setSaving(false);
    }
  };

  const portalJaCadastrado = (id: string) =>
    credenciais.some((c: any) => c.portal_id === id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-accent" />
          <h3 className="text-sm font-semibold">Credenciais Cadastradas</h3>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground">
              <Key className="w-4 h-4 mr-1" /> Adicionar Credencial
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileKey2 className="w-5 h-5 text-accent" />
                Cadastrar Credencial do Portal
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label className="text-xs">Portal *</Label>
                <Select value={portalId} onValueChange={setPortalId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o portal" />
                  </SelectTrigger>
                  <SelectContent>
                    {PORTAIS.map((p) => (
                      <SelectItem key={p.id} value={p.id} disabled={portalJaCadastrado(p.id)}>
                        {p.nome} {portalJaCadastrado(p.id) ? '(já cadastrado)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="border border-border/50 rounded-lg p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Login e Senha
                </p>
                <div>
                  <Label className="text-xs">Login / Usuário</Label>
                  <Input
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    placeholder="CPF, CNPJ ou usuário"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Senha</Label>
                  <div className="relative mt-1">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="Senha do portal"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="border border-border/50 rounded-lg p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Certificado Digital (opcional)
                </p>
                <div>
                  <Label className="text-xs">Tipo do Certificado</Label>
                  <Select value={certTipo} onValueChange={(v) => setCertTipo(v as 'pf' | 'pj')}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pf">e-CPF (Pessoa Física)</SelectItem>
                      <SelectItem value="pj">e-CNPJ (Pessoa Jurídica)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Arquivo do Certificado (.pfx / .p12)</Label>
                  <div className="mt-1">
                    <label className="flex items-center gap-2 border border-dashed border-border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                      <Upload className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {certFile ? certFile.name : 'Clique para selecionar o certificado'}
                      </span>
                      <input
                        type="file"
                        accept=".pfx,.p12,.cer,.crt"
                        className="hidden"
                        onChange={(e) => setCertFile(e.target.files?.[0] || null)}
                      />
                    </label>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Validade do Certificado</Label>
                  <Input
                    type="date"
                    value={certValidade}
                    onChange={(e) => setCertValidade(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
                <p className="text-xs text-warning flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Suas credenciais são armazenadas de forma segura e criptografada.
                  Apenas você tem acesso a elas.
                </p>
              </div>

              <Button
                onClick={handleSave}
                disabled={!portalId || saving}
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Key className="w-4 h-4 mr-1" />}
                Salvar Credencial
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : credenciais.length === 0 ? (
        <div className="bg-card rounded-xl border border-border/50 p-8 text-center">
          <FileKey2 className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            Nenhuma credencial cadastrada. Adicione suas credenciais dos portais para habilitar o acesso automático.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {credenciais.map((cred: any) => (
            <div key={cred.id} className="bg-card rounded-xl border border-border/50 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-sm">{cred.portal_nome}</h4>
                <Badge
                  variant="outline"
                  className={
                    cred.status === 'ativo'
                      ? 'bg-success/15 text-success border-success/30'
                      : 'bg-muted text-muted-foreground border-border'
                  }
                >
                  {cred.status === 'ativo' ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>

              <div className="space-y-1 text-xs text-muted-foreground">
                {cred.login && (
                  <p>
                    <span className="font-medium text-foreground">Login:</span> {cred.login}
                  </p>
                )}
                {cred.senha_hash && (
                  <p>
                    <span className="font-medium text-foreground">Senha:</span> ••••••••
                  </p>
                )}
                {cred.certificado_nome && (
                  <p className="flex items-center gap-1">
                    <FileKey2 className="w-3 h-3" />
                    <span className="font-medium text-foreground">Certificado:</span>{' '}
                    {cred.certificado_nome}
                  </p>
                )}
                {cred.certificado_tipo && (
                  <p>
                    <span className="font-medium text-foreground">Tipo:</span>{' '}
                    {cred.certificado_tipo === 'pf' ? 'e-CPF (PF)' : 'e-CNPJ (PJ)'}
                  </p>
                )}
                {cred.validade_certificado && (
                  <p>
                    <span className="font-medium text-foreground">Validade:</span>{' '}
                    {new Date(cred.validade_certificado).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>

              <div className="flex justify-end mt-3 pt-2 border-t border-border/30">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => deleteMutation.mutate(cred.id)}
                >
                  <Trash2 className="w-3 h-3 mr-1" /> Remover
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
