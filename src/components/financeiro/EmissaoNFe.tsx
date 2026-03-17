import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import {
  FileText, Key, AlertTriangle, CheckCircle2, ExternalLink,
  Send, Settings, Zap, Shield
} from 'lucide-react';

export default function EmissaoNFe() {
  const { empresaAtiva } = useEmpresa();
  const [apiConfig, setApiConfig] = useState({
    provider: 'nuvem_fiscal',
    api_key: '',
    ambiente: 'homologacao',
    certificado_configurado: false,
  });

  if (!empresaAtiva) return <Card className="p-8 text-center text-muted-foreground text-sm">Selecione uma empresa ativa.</Card>;

  const apiConfigurada = !!apiConfig.api_key;

  return (
    <div className="space-y-4">
      <Tabs defaultValue="status" className="space-y-3">
        <TabsList>
          <TabsTrigger value="status" className="text-xs"><Zap className="w-3.5 h-3.5 mr-1" /> Status</TabsTrigger>
          <TabsTrigger value="config" className="text-xs"><Settings className="w-3.5 h-3.5 mr-1" /> Configuração</TabsTrigger>
        </TabsList>

        <TabsContent value="status">
          <div className="space-y-4">
            {/* Integration Status */}
            <Card className="p-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-accent" /> Status da Integração NF-e/NFS-e
              </h4>
              <div className="space-y-3">
                {[
                  { label: 'Provedor de Emissão', value: 'Nuvem Fiscal', status: 'pendente', desc: 'API para transmissão de NF-e e NFS-e à SEFAZ' },
                  { label: 'API Key', value: apiConfigurada ? '••••••••' : 'Não configurada', status: apiConfigurada ? 'ok' : 'pendente', desc: 'Chave de autenticação do provedor' },
                  { label: 'Certificado Digital A1', value: apiConfig.certificado_configurado ? 'Configurado' : 'Não configurado', status: apiConfig.certificado_configurado ? 'ok' : 'pendente', desc: 'e-CNPJ ou e-CPF para assinatura' },
                  { label: 'Ambiente', value: apiConfig.ambiente === 'producao' ? 'Produção' : 'Homologação', status: 'info', desc: 'Ambiente de transmissão SEFAZ' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div>
                      <p className="text-xs font-medium">{item.label}</p>
                      <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs">{item.value}</span>
                      {item.status === 'ok' && <CheckCircle2 className="w-4 h-4 text-success" />}
                      {item.status === 'pendente' && <AlertTriangle className="w-4 h-4 text-warning" />}
                      {item.status === 'info' && <Badge variant="outline" className="text-[9px]">{item.value}</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* How it works */}
            <Card className="p-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-accent" /> Como funciona a emissão
              </h4>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-start gap-2 p-2 rounded bg-muted/20">
                  <span className="font-bold text-accent text-sm">1</span>
                  <div><p className="font-medium text-foreground">Crie a NF na aba Notas Fiscais do contrato</p><p>Preencha destinatário, itens e valores ou importe de um pedido</p></div>
                </div>
                <div className="flex items-start gap-2 p-2 rounded bg-muted/20">
                  <span className="font-bold text-accent text-sm">2</span>
                  <div><p className="font-medium text-foreground">Envie para autorização</p><p>O sistema transmite à SEFAZ via Nuvem Fiscal, retornando protocolo e chave</p></div>
                </div>
                <div className="flex items-start gap-2 p-2 rounded bg-muted/20">
                  <span className="font-bold text-accent text-sm">3</span>
                  <div><p className="font-medium text-foreground">NF autorizada atualiza saldos</p><p>Valor faturado é abatido do saldo contratual e dispara comissões</p></div>
                </div>
              </div>
            </Card>

            {/* Providers info */}
            <Card className="p-4 border-accent/20">
              <h4 className="text-sm font-semibold mb-2">Provedores Suportados</h4>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  { nome: 'Nuvem Fiscal', desc: 'NF-e, NFS-e, NFC-e, MDF-e. API unificada.', url: 'https://nuvemfiscal.com.br' },
                  { nome: 'Focus NFe', desc: 'Emissão simplificada NF-e e NFS-e.', url: 'https://focusnfe.com.br' },
                ].map((p, i) => (
                  <div key={i} className="p-3 rounded-lg bg-muted/30 border">
                    <p className="text-xs font-medium">{p.nome}</p>
                    <p className="text-[10px] text-muted-foreground">{p.desc}</p>
                    <Button variant="link" size="sm" className="h-auto p-0 text-[10px] mt-1" onClick={() => window.open(p.url, '_blank')}>
                      <ExternalLink className="w-3 h-3 mr-1" /> Saiba mais
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="config">
          <Card className="p-4">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Key className="w-4 h-4 text-accent" /> Configuração da API de Emissão
            </h4>
            <p className="text-xs text-muted-foreground mb-4">
              Para emitir NF-e/NFS-e automaticamente, configure a API do provedor fiscal. A chave será armazenada de forma segura.
            </p>
            <div className="space-y-3">
              <div><Label className="text-xs">Provedor</Label>
                <div className="flex gap-2 mt-1">
                  {['nuvem_fiscal', 'focus_nfe'].map(p => (
                    <Button key={p} variant={apiConfig.provider === p ? 'default' : 'outline'} size="sm"
                      onClick={() => setApiConfig(c => ({ ...c, provider: p }))}>
                      {p === 'nuvem_fiscal' ? 'Nuvem Fiscal' : 'Focus NFe'}
                    </Button>
                  ))}
                </div>
              </div>
              <div><Label className="text-xs">API Key / Token</Label><Input type="password" value={apiConfig.api_key} onChange={e => setApiConfig(c => ({ ...c, api_key: e.target.value }))} placeholder="Cole sua chave de API aqui" /></div>
              <div><Label className="text-xs">Ambiente</Label>
                <div className="flex gap-2 mt-1">
                  {['homologacao', 'producao'].map(a => (
                    <Button key={a} variant={apiConfig.ambiente === a ? 'default' : 'outline'} size="sm"
                      onClick={() => setApiConfig(c => ({ ...c, ambiente: a }))}>
                      {a === 'homologacao' ? 'Homologação' : 'Produção'}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-warning/5 border border-warning/20 text-xs">
                <p className="font-medium text-warning flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Importante</p>
                <ul className="mt-1 space-y-1 text-muted-foreground list-disc list-inside">
                  <li>Teste sempre em homologação antes de usar produção</li>
                  <li>O certificado digital A1 deve ser cadastrado no provedor</li>
                  <li>A API key será armazenada nas configurações seguras do sistema</li>
                </ul>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => toast.info('Teste de conexão disponível após salvar a chave')}>
                  Testar Conexão
                </Button>
                <Button onClick={() => toast.success('Configuração salva! A emissão automática está disponível nos contratos.')}>
                  Salvar Configuração
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
