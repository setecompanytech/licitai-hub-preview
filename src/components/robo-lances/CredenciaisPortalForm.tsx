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
  Key, Shield, Trash2, Eye, EyeOff, Loader2, FileKey2,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const PORTAIS = [
  { id: 'compras-gov', nome: 'Compras.gov.br', auth: 'certificado', prioridade: 1 },
  { id: 'bll', nome: 'BLL Compras', auth: 'login', prioridade: 2 },
  { id: 'licitacoes-e', nome: 'Licitações-e (BB)', auth: 'login-bb', prioridade: 3 },
  { id: 'bnc', nome: 'Bolsa Nacional de Compras', auth: 'login', prioridade: 4 },
  { id: 'portal-compras', nome: 'Portal de Compras Públicas', auth: 'login', prioridade: 5 },
  { id: 'bec-sp', nome: 'BEC/SP', auth: 'login+cert', prioridade: 6 },
  { id: 'banparanet', nome: 'Banparanet (PA)', auth: 'login+cert', prioridade: 7 },
  { id: 'pncp', nome: 'PNCP', auth: 'certificado', prioridade: 8 },
  { id: 'licitanet', nome: 'Licitanet', auth: 'login', prioridade: 9 },
  { id: 'bbmnet', nome: 'BBMNet', auth: 'login+cert', prioridade: 10 },
  { id: 'comprasbr', nome: 'ComprasBR', auth: 'login', prioridade: 11 },
  { id: 'licitar-digital', nome: 'Licitar Digital', auth: 'login', prioridade: 12 },
  { id: 'compras-rj', nome: 'Compras Públicas RJ', auth: 'login', prioridade: 13 },
  { id: 'comprasnet-ba', nome: 'ComprasNet BA', auth: 'login', prioridade: 14 },
  { id: 'comprasnet-go', nome: 'ComprasNet GO', auth: 'login', prioridade: 15 },
  { id: 'compras-mg', nome: 'Compras MG', auth: 'login', prioridade: 16 },
  { id: 'compras-pe', nome: 'PE Integrado', auth: 'login', prioridade: 17 },
  { id: 'compras-pr', nome: 'Compras PR', auth: 'login', prioridade: 18 },
  { id: 'compras-rs', nome: 'Compras RS', auth: 'login', prioridade: 19 },
  { id: 'compras-sc', nome: 'Compras SC', auth: 'login', prioridade: 20 },
  { id: 'compras-df', nome: 'e-Compras DF', auth: 'login', prioridade: 21 },
  { id: 'e-compras-am', nome: 'e-Compras AM', auth: 'login', prioridade: 22 },
  { id: 'portal-compras-ce', nome: 'Portal Compras CE', auth: 'login', prioridade: 23 },
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
  const [codigoBB, setCodigoBB] = useState('');
  const [versaoPortal, setVersaoPortal] = useState<'v1' | 'v2'>('v2');

  const isLicitacoesE = portalId === 'licitacoes-e';
  const { data: credenciais = [], isLoading } = useQuery({
    queryKey: ['credenciais-portais', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.functions.invoke('credenciais-portal?action=list', {
        method: 'GET',
      });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.functions.invoke('credenciais-portal?action=delete', {
        method: 'DELETE',
        body: { id },
      });
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
    setCodigoBB('');
    setVersaoPortal('v2');
  };

  const handleSave = async () => {
    if (!user || !portalId) return;
    setSaving(true);

    try {
      const portal = PORTAIS.find((p) => p.id === portalId);

      const { error } = await supabase.functions.invoke('credenciais-portal?action=save', {
        body: {
          portal_id: portalId,
          portal_nome: portal?.nome || portalId,
          login: isLicitacoesE ? (codigoBB || login || null) : (login || null),
          senha: senha || null,
          metadata: isLicitacoesE ? { codigo_bb: codigoBB, versao_portal: versaoPortal } : undefined,
        },
      });
      if (error) throw error;

      toast.success('Credencial salva com criptografia AES-256');
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
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
                  <SelectContent className="max-h-72">
                    {PORTAIS.map((p) => (
                      <SelectItem key={p.id} value={p.id} disabled={portalJaCadastrado(p.id)}>
                        <span className="flex items-center gap-2">
                          {p.nome}
                          {p.auth === 'certificado' && <Badge variant="outline" className="text-[9px] scale-75 bg-warning/10 text-warning border-warning/30">Cert. Digital</Badge>}
                          {p.auth === 'login+cert' && <Badge variant="outline" className="text-[9px] scale-75 bg-info/10 text-info border-info/30">Login+Cert</Badge>}
                          {portalJaCadastrado(p.id) && <span className="text-muted-foreground">(já cadastrado)</span>}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isLicitacoesE && (
                <div className="border border-warning/30 rounded-lg p-4 space-y-3 bg-warning/5">
                  <p className="text-xs font-semibold text-warning uppercase tracking-wider flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" />
                    Licitações-e — Banco do Brasil
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Suas credenciais são criptografadas com AES-256-GCM e nunca armazenadas em texto simples.
                  </p>
                  <div>
                    <Label className="text-xs">Versão do portal</Label>
                    <div className="flex gap-2 mt-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={versaoPortal === 'v2' ? 'default' : 'outline'}
                        className={`text-xs flex-1 ${versaoPortal === 'v2' ? 'bg-accent text-accent-foreground' : ''}`}
                        onClick={() => setVersaoPortal('v2')}
                      >
                        Novo (licitacoes-e2) <Badge variant="outline" className="ml-1 text-[8px] scale-75">recomendado</Badge>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={versaoPortal === 'v1' ? 'default' : 'outline'}
                        className="text-xs flex-1"
                        onClick={() => setVersaoPortal('v1')}
                      >
                        Legado (licitacoes-e)
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Código de acesso BB (chave)</Label>
                    <Input
                      value={codigoBB}
                      onChange={(e) => setCodigoBB(e.target.value)}
                      placeholder="Ex: 1234567"
                      className="mt-1"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">Chave de acesso usada para login no licitacoes-e.com.br</p>
                  </div>
                  <div>
                    <Label className="text-xs">Senha</Label>
                    <div className="relative mt-1">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        placeholder="Sua senha do Licitações-e"
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
              )}

              {!isLicitacoesE && (
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
              )

              <div className="bg-success/10 border border-success/20 rounded-lg p-3">
                <p className="text-xs text-success flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Senhas criptografadas com AES-256-GCM no servidor. Certificados
                  digitais são gerenciados localmente (Agente ou extensão).
                </p>
              </div>

              <Button
                onClick={handleSave}
                disabled={!portalId || saving}
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Key className="w-4 h-4 mr-1" />}
                Salvar Credencial Criptografada
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
                  <p className="flex items-center gap-1">
                    <span className="font-medium text-foreground">Senha:</span> ••••••••
                    <span title="Criptografada AES-256"><Shield className="w-3 h-3 text-success ml-1" /></span>
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
