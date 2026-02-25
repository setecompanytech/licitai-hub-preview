import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Send, Upload, FileText, CheckCircle2, AlertTriangle,
  Loader2, Globe, Shield, Package, DollarSign, Clock,
  Eye, Plus, Trash2
} from 'lucide-react';
import { toast } from 'sonner';

export default function EnvioProposta() {
  const [tab, setTab] = useState('declaracoes');
  const [numeroPregao, setNumeroPregao] = useState('');
  const [portal, setPortal] = useState('comprasgov');
  const [declaracoes, setDeclaracoes] = useState({
    meEpp: false,
    inexistenciaFato: false,
    menorAprendiz: false,
    elaboracaoIndep: false,
    reservadoMeEpp: false,
  });
  const [enviando, setEnviando] = useState(false);

  const handleEnviar = async () => {
    if (!numeroPregao.trim()) {
      toast.error('Informe o número do pregão');
      return;
    }

    setEnviando(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setEnviando(false);
    toast.success('Proposta preparada com sucesso! Os dados estão prontos para envio no portal.');
    setTab('revisao');
  };

  return (
    <div className="space-y-4">
      {/* Portal selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={portal} onValueChange={setPortal}>
          <SelectTrigger className="w-[220px]">
            <Globe className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="comprasgov">Compras.gov.br</SelectItem>
            <SelectItem value="pncp">PNCP</SelectItem>
            <SelectItem value="bec">BEC/SP</SelectItem>
            <SelectItem value="bll">BLL Compras</SelectItem>
            <SelectItem value="licitacoes-e">Licitações-e (BB)</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Número do Pregão (ex: PE-001/2026)"
          value={numeroPregao}
          onChange={e => setNumeroPregao(e.target.value)}
          className="w-[280px]"
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="declaracoes" className="flex items-center gap-1">
            <Shield className="w-4 h-4" /> Declarações
          </TabsTrigger>
          <TabsTrigger value="anexos" className="flex items-center gap-1">
            <FileText className="w-4 h-4" /> Anexos
          </TabsTrigger>
          <TabsTrigger value="revisao" className="flex items-center gap-1">
            <Eye className="w-4 h-4" /> Revisão & Envio
          </TabsTrigger>
        </TabsList>

        <TabsContent value="declaracoes" className="space-y-3">
          <Card className="p-5 space-y-4">
            <h3 className="font-semibold text-sm mb-2">Declarações obrigatórias</h3>
            {[
              { key: 'meEpp', label: 'Declaração de enquadramento como ME/EPP', desc: 'Conforme LC 123/2006' },
              { key: 'inexistenciaFato', label: 'Inexistência de fato impeditivo', desc: 'Art. 63, §1º da Lei 14.133/2021' },
              { key: 'menorAprendiz', label: 'Não emprego de menor', desc: 'Art. 68, VI da Lei 14.133/2021' },
              { key: 'elaboracaoIndep', label: 'Elaboração independente de proposta', desc: 'Instrução Normativa nº 01/2009' },
              { key: 'reservadoMeEpp', label: 'Ciência de item reservado para ME/EPP', desc: 'Quando aplicável' },
            ].map(decl => (
              <label key={decl.key} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={(declaracoes as any)[decl.key]}
                  onChange={e => setDeclaracoes(prev => ({ ...prev, [decl.key]: e.target.checked }))}
                  className="mt-0.5 w-4 h-4 accent-accent"
                />
                <div>
                  <p className="text-sm font-medium">{decl.label}</p>
                  <p className="text-xs text-muted-foreground">{decl.desc}</p>
                </div>
              </label>
            ))}
          </Card>
        </TabsContent>

        <TabsContent value="anexos" className="space-y-3">
          <Card className="p-5">
            <h3 className="font-semibold text-sm mb-4">Anexos da Proposta</h3>
            <label className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-border/60 rounded-xl cursor-pointer hover:border-accent/50 hover:bg-accent/5 transition-colors">
              <Upload className="w-8 h-8 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">Arraste documentos ou clique para selecionar</span>
              <span className="text-xs text-muted-foreground/60 mt-1">Proposta comercial, planilhas, atestados, certidões</span>
              <input type="file" multiple className="hidden" />
            </label>
          </Card>
        </TabsContent>

        <TabsContent value="revisao" className="space-y-4">
          <Card className="p-5 space-y-4">
            <h3 className="font-semibold text-sm">Resumo da Proposta</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <Globe className="w-5 h-5 mx-auto mb-1 text-accent" />
                <p className="text-xs text-muted-foreground">Portal</p>
                <p className="text-sm font-semibold capitalize">{portal === 'comprasgov' ? 'Compras.gov.br' : portal.toUpperCase()}</p>
              </div>
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <Shield className="w-5 h-5 mx-auto mb-1 text-accent" />
                <p className="text-xs text-muted-foreground">Declarações</p>
                <p className="text-sm font-semibold">{Object.values(declaracoes).filter(Boolean).length}/5</p>
              </div>
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <FileText className="w-5 h-5 mx-auto mb-1 text-accent" />
                <p className="text-xs text-muted-foreground">Pregão</p>
                <p className="text-sm font-semibold">{numeroPregao || '—'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-accent/10 border border-accent/30 rounded-lg text-sm text-muted-foreground">
              <Clock className="w-4 h-4 flex-shrink-0" />
              A proposta será preparada para envio. Você precisará confirmar no portal oficial.
            </div>

            <Button onClick={handleEnviar} disabled={enviando} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
              {enviando ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Preparando envio...</>
              ) : (
                <><Send className="w-4 h-4 mr-2" /> Preparar Proposta para Envio</>
              )}
            </Button>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
