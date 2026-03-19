import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Globe, CheckCircle2, XCircle, Loader2, Building2 } from 'lucide-react';

const PORTAIS_CONHECIDOS = [
  { id: 'compras-gov', nome: 'Compras.gov.br', categoria: 'federal' },
  { id: 'pncp', nome: 'PNCP', categoria: 'federal' },
  { id: 'bll', nome: 'BLL Compras', categoria: 'privado' },
  { id: 'licitacoes-e', nome: 'Licitações-e (BB)', categoria: 'privado' },
  { id: 'bnc', nome: 'Bolsa Nacional de Compras', categoria: 'privado' },
  { id: 'portal-compras', nome: 'Portal de Compras Públicas', categoria: 'privado' },
  { id: 'licitanet', nome: 'Licitanet', categoria: 'privado' },
  { id: 'bbmnet', nome: 'BBMNet', categoria: 'privado' },
  { id: 'comprasbr', nome: 'ComprasBR', categoria: 'privado' },
  { id: 'licitar-digital', nome: 'Licitar Digital', categoria: 'privado' },
  { id: 'bec-sp', nome: 'BEC/SP', categoria: 'estadual' },
  { id: 'banparanet', nome: 'Banparanet (PA)', categoria: 'estadual' },
  { id: 'comprasnet-ba', nome: 'ComprasNet BA', categoria: 'estadual' },
  { id: 'comprasnet-go', nome: 'ComprasNet GO', categoria: 'estadual' },
  { id: 'compras-mg', nome: 'Compras MG', categoria: 'estadual' },
  { id: 'compras-pe', nome: 'PE Integrado', categoria: 'estadual' },
  { id: 'compras-rj', nome: 'Compras RJ', categoria: 'estadual' },
  { id: 'compras-pr', nome: 'Compras PR', categoria: 'estadual' },
  { id: 'compras-rs', nome: 'Compras RS', categoria: 'estadual' },
  { id: 'compras-sc', nome: 'Compras SC', categoria: 'estadual' },
  { id: 'compras-df', nome: 'e-Compras DF', categoria: 'estadual' },
  { id: 'e-compras-am', nome: 'e-Compras AM', categoria: 'estadual' },
  { id: 'portal-compras-ce', nome: 'Portal Compras CE', categoria: 'estadual' },
];

type PortalStatus = {
  id: string;
  nome: string;
  temCredencial: boolean;
  temCertificado: boolean;
};

export default function DeteccaoPortais() {
  const { user } = useAuth();
  const [portais, setPortais] = useState<PortalStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [empresaNome, setEmpresaNome] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const carregar = async () => {
      setLoading(true);

      // Load credentials and empresa info in parallel
      const [credResp, profileResp] = await Promise.all([
        supabase
          .from('credenciais_portais')
          .select('portal_id, login, certificado_path')
          .eq('user_id', user.id),
        supabase
          .from('profiles')
          .select('empresa, cnpj, empresa_ativa_id')
          .eq('user_id', user.id)
          .single(),
      ]);

      const credenciais = credResp.data || [];
      const profile = profileResp.data;

      // If has empresa_ativa_id, get empresa name
      if (profile?.empresa_ativa_id) {
        const { data: empresa } = await supabase
          .from('empresas')
          .select('razao_social, nome_fantasia')
          .eq('id', profile.empresa_ativa_id)
          .single();
        setEmpresaNome(empresa?.nome_fantasia || empresa?.razao_social || null);
      } else {
        setEmpresaNome(profile?.empresa || null);
      }

      const result: PortalStatus[] = PORTAIS_CONHECIDOS.map((p) => {
        const cred = credenciais.find((c) => c.portal_id === p.id);
        return {
          id: p.id,
          nome: p.nome,
          temCredencial: !!cred?.login,
          temCertificado: !!cred?.certificado_path,
        };
      });

      setPortais(result);
      setLoading(false);
    };

    carregar();
  }, [user]);

  const comCredencial = portais.filter((p) => p.temCredencial).length;
  const comCertificado = portais.filter((p) => p.temCertificado).length;

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Building2 className="w-4 h-4 text-accent" />
          Análise de Portais da Empresa
          {empresaNome && (
            <span className="text-xs text-muted-foreground font-normal">— {empresaNome}</span>
          )}
        </h3>
        <div className="flex gap-2">
          <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-[10px]">
            {comCredencial} com login
          </Badge>
          <Badge variant="outline" className="bg-info/10 text-info border-info/30 text-[10px]">
            {comCertificado} com certificado
          </Badge>
        </div>
      </div>

      {['federal', 'privado', 'estadual'].map(cat => {
        const portalsCat = portais.filter(p => {
          const config = PORTAIS_CONHECIDOS.find(pk => pk.id === p.id);
          return config?.categoria === cat;
        });
        if (portalsCat.length === 0) return null;
        const catLabel = cat === 'federal' ? '🏛️ Federais' : cat === 'privado' ? '🏢 Bolsas Eletrônicas' : '🗺️ Estaduais';
        return (
          <div key={cat} className="space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{catLabel}</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {portalsCat.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-2 rounded-lg border p-2.5 text-xs ${
                    p.temCredencial
                      ? 'border-success/30 bg-success/5'
                      : 'border-border/50 bg-muted/30'
                  }`}
                >
                  {p.temCredencial ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium truncate">{p.nome}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {p.temCredencial
                        ? p.temCertificado
                          ? 'Login + Cert.'
                          : 'Apenas login'
                        : 'Sem credencial'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {comCredencial === 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Nenhuma credencial cadastrada. Vá em <strong>"Portais Conectados"</strong> para adicionar seus acessos.
        </p>
      )}
    </div>
  );
}
