import { Skeleton } from '@/components/ui/skeleton';
import EstadoVazio from '@/components/shared/EstadoVazio';
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
  Key, Shield, Trash2, Eye, EyeOff, Loader2, FileKey2, Building2,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { PORTAIS_ROBO } from '@/lib/robo/portais';

// A lista era a TERCEIRA cópia dos portais no app, e a única que ninguém tinha
// migrado. Ela definia `compras-gov` com um `auth` e um nome próprios, enquanto
// o seletor de disputa dizia "Compras Governamentais" e o agente da VPS chamava
// o mesmo portal de `comprasgov`. Três nomes para uma coisa só.
//
// Agora vem de `src/lib/robo/portais.ts`, que guarda também o nome de cada
// portal no registro do agente — a tradução que faltava para o envio da sessão.
const PORTAIS = PORTAIS_ROBO;

/**
 * O que `credenciais-portal?action=list` devolve. Sem `senha_hash`: desde
 * 14/09/2026 o texto cifrado não sai do servidor, e `tem_senha` diz só se ele
 * existe.
 */
type CredencialListada = {
  id: string;
  portal_id: string;
  portal_nome: string;
  login: string | null;
  tem_senha: boolean;
  certificado_nome: string | null;
  certificado_tipo: string | null;
  validade_certificado: string | null;
  status: string | null;
};

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
      if (!user) return [] as CredencialListada[];
      const { data, error } = await supabase.functions.invoke('credenciais-portal?action=list', {
        method: 'GET',
      });
      if (error) throw error;
      return (data || []) as CredencialListada[];
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
    } catch (e) {
      toast.error((e as Error).message || 'Erro ao salvar credencial');
    } finally {
      setSaving(false);
    }
  };

  const portalJaCadastrado = (id: string) =>
    credenciais.some((c) => c.portal_id === id);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-lg font-semibold">Credenciais Cadastradas</h3>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Key className="w-4 h-4" aria-hidden="true" /> Adicionar Credencial
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileKey2 className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
                Cadastrar Credencial do Portal
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label htmlFor="credencial-portal">Portal *</Label>
                <Select value={portalId} onValueChange={setPortalId}>
                  <SelectTrigger id="credencial-portal" className="mt-1">
                    <SelectValue placeholder="Selecione o portal" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {PORTAIS.map((p) => (
                      <SelectItem key={p.id} value={p.id} disabled={portalJaCadastrado(p.id)}>
                        <span className="flex flex-wrap items-center gap-2">
                          {p.nome}
                          {p.auth === 'certificado' && <Badge variant="warning">Cert. Digital</Badge>}
                          {p.auth === 'login+cert' && <Badge variant="info">Login+Cert</Badge>}
                          {portalJaCadastrado(p.id) && <span className="text-muted-foreground">(já cadastrado)</span>}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isLicitacoesE && (
                <div className="border border-warning-line rounded-lg p-4 space-y-3 bg-warning-tint">
                  <p className="text-xs font-semibold text-warning-ink uppercase tracking-wider flex items-center gap-1">
                    <Building2 className="w-4 h-4" aria-hidden="true" />
                    Licitações-e — Banco do Brasil
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Suas credenciais são criptografadas com AES-256-GCM e nunca armazenadas em texto simples.
                  </p>
                  <div>
                    <Label>Versão do portal</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <Button
                        type="button"
                        variant={versaoPortal === 'v2' ? 'default' : 'outline'}
                        aria-pressed={versaoPortal === 'v2'}
                        className="flex-1"
                        onClick={() => setVersaoPortal('v2')}
                      >
                        Novo (licitacoes-e2) <Badge variant={versaoPortal === 'v2' ? 'muted' : 'success'}>recomendado</Badge>
                      </Button>
                      <Button
                        type="button"
                        variant={versaoPortal === 'v1' ? 'default' : 'outline'}
                        aria-pressed={versaoPortal === 'v1'}
                        className="flex-1"
                        onClick={() => setVersaoPortal('v1')}
                      >
                        Legado (licitacoes-e)
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="credencial-codigo-bb">Código de acesso BB (chave)</Label>
                    <Input
                      id="credencial-codigo-bb"
                      value={codigoBB}
                      onChange={(e) => setCodigoBB(e.target.value)}
                      placeholder="Ex: 1234567"
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Chave de acesso usada para login no licitacoes-e.com.br</p>
                  </div>
                  <div>
                    <Label htmlFor="credencial-senha-bb">Senha</Label>
                    <div className="relative mt-1">
                      <Input
                        id="credencial-senha-bb"
                        type={showPassword ? 'text' : 'password'}
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        placeholder="Sua senha do Licitações-e"
                        className="pr-12"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {!isLicitacoesE && (
              <div className="border border-border rounded-lg p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Login e Senha
                </p>
                <div>
                  <Label htmlFor="credencial-login">Login / Usuário</Label>
                  <Input
                    id="credencial-login"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    placeholder="CPF, CNPJ ou usuário"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="credencial-senha">Senha</Label>
                  <div className="relative mt-1">
                    <Input
                      id="credencial-senha"
                      type={showPassword ? 'text' : 'password'}
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="Senha do portal"
                      className="pr-12"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                    </Button>
                  </div>
                </div>
              </div>
              )}


              <div className="bg-success-tint border border-success-line rounded-lg p-4">
                <p className="text-sm text-success-ink flex items-start gap-2">
                  <Shield className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    Senhas criptografadas com AES-256-GCM no servidor. Certificados
                    digitais são gerenciados localmente (Agente ou extensão).
                  </span>
                </p>
              </div>

              <Button
                onClick={handleSave}
                disabled={!portalId || saving}
                className="w-full"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Key className="w-4 h-4" aria-hidden="true" />}
                Salvar Credencial Criptografada
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        /* Esqueleto com a forma da lista que vem — três linhas de credencial.
           O ponto girando não dizia o que estava chegando, e a caixa saltava
           de altura quando a lista aparecia. */
        <div className="space-y-2" role="status" aria-busy="true">
          <span className="sr-only">Carregando credenciais</span>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
              <Skeleton className="h-9 w-9 rounded-md shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-8 w-16 rounded-md shrink-0" />
            </div>
          ))}
        </div>
      ) : credenciais.length === 0 ? (
        <div className="rounded-lg border border-border bg-card shadow-sm">
          <EstadoVazio
            icone={<FileKey2 />}
            titulo="Nenhuma credencial cadastrada"
            descricao="Adicione suas credenciais dos portais para habilitar o acesso automático."
            tamanho="compacto"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {credenciais.map((cred) => (
            <div key={cred.id} className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h4 className="font-semibold text-base truncate">{cred.portal_nome}</h4>
                <Badge variant={cred.status === 'ativo' ? 'success' : 'muted'}>
                  {cred.status === 'ativo' ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>

              <div className="space-y-1 text-sm text-muted-foreground">
                {cred.login && (
                  <p>
                    <span className="font-medium text-foreground">Login:</span> {cred.login}
                  </p>
                )}
                {/* `tem_senha`, não `senha_hash`: a lista não traz mais o texto
                    cifrado ao navegador — só diz se ele existe. */}
                {cred.tem_senha && (
                  <p className="flex items-center gap-1">
                    <span className="font-medium text-foreground">Senha:</span> ••••••••
                    <span title="Criptografada AES-256"><Shield className="w-3 h-3 text-success ml-1" aria-hidden="true" /></span>
                  </p>
                )}
                {cred.certificado_nome && (
                  <p className="flex items-center gap-1">
                    <FileKey2 className="w-3 h-3" aria-hidden="true" />
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

              <div className="flex justify-end mt-3 pt-3 border-t border-border">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => deleteMutation.mutate(cred.id)}
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" /> Remover
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
