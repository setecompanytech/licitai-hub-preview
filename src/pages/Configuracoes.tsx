import AppLayout from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Building2, Bell, Globe, Shield, Newspaper } from 'lucide-react';
import CnaesSecundarios from '@/components/configuracoes/CnaesSecundarios';
import PlanoAssinatura from '@/components/configuracoes/PlanoAssinatura';

export default function Configuracoes() {
  return (
    <AppLayout>
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
          <p className="text-sm text-muted-foreground mt-1">Personalize a plataforma para sua empresa</p>
        </div>

        <div className="space-y-6">
          {/* Empresa */}
          <section className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-semibold">Dados da Empresa</h2>
            </div>
            <div className="grid gap-4">
              <div>
                <Label className="text-xs">Razão Social</Label>
                <Input defaultValue="Minha Construtora Ltda." className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">CNPJ</Label>
                  <Input defaultValue="12.345.678/0001-99" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">CNAE Principal</Label>
                  <Input defaultValue="42.11-1" className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Cidade</Label>
                  <Input defaultValue="Belém" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">UF</Label>
                  <Input defaultValue="PA" className="mt-1" />
                </div>
              </div>
            </div>
          </section>

          {/* Notificações */}
          <section className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-semibold">Notificações</h2>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Novos editais compatíveis', desc: 'Alerta ao detectar licitação com CNAE compatível', default: true },
                { label: 'Prazos próximos', desc: 'Aviso 48h antes do encerramento', default: true },
                { label: 'Atividade de concorrentes', desc: 'Notificação sobre novos lances de concorrentes monitorados', default: false },
                { label: 'Relatórios semanais', desc: 'Resumo por e-mail toda segunda-feira', default: true },
              ].map((n) => (
                <div key={n.label} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{n.label}</p>
                    <p className="text-xs text-muted-foreground">{n.desc}</p>
                  </div>
                  <Switch defaultChecked={n.default} />
                </div>
              ))}
            </div>
          </section>

          {/* Integrações */}
          <section className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-semibold">Portais Monitorados</h2>
            </div>
            <div className="space-y-3">
              {['Compras Governamentais', 'PNCP', 'BEC/SP', 'Licitações-e (BB)', 'Bolsa Nacional de Compras', 'Banparanet (PA)', 'Compras Públicas RJ', 'BLL Compras', 'Licitanet', 'Portal de Compras Públicas'].map((portal) => (
                <div key={portal} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <span className="text-sm font-medium">{portal}</span>
                  <Switch defaultChecked={portal !== 'BEC/SP'} />
                </div>
              ))}
            </div>
          </section>

          {/* Diários Oficiais */}
          <section className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Newspaper className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-semibold">Diários Oficiais Monitorados</h2>
            </div>
            <div className="space-y-3">
              {[
                'DOU (Federal)',
                'IOEPA (Estadual)',
                'TCMPA (Municípios)',
                'DOE/SP',
                'IOERJ',
                'DODF.e (Distrito Federal)',
              ].map((fonte) => (
                <div key={fonte} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <span className="text-sm font-medium">{fonte}</span>
                  <Switch defaultChecked />
                </div>
              ))}
            </div>
          </section>

          {/* Plano & Assinatura */}
          <PlanoAssinatura />

          {/* CNAEs Secundários */}
          <CnaesSecundarios />

          <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
            Salvar Configurações
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
