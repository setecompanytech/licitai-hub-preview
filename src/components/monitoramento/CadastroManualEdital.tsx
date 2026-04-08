import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Upload, Link2, Loader2, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const UFS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'
];

const MODALIDADES_OPCOES = [
  { value: '6', label: 'Pregão Eletrônico' },
  { value: '7', label: 'Pregão Presencial' },
  { value: '4', label: 'Concorrência Eletrônica' },
  { value: '5', label: 'Concorrência Presencial' },
  { value: '8', label: 'Dispensa de Licitação' },
  { value: '9', label: 'Inexigibilidade' },
  { value: '12', label: 'Credenciamento' },
  { value: '1', label: 'Leilão Eletrônico' },
];

interface CadastroManualEditalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function CadastroManualEdital({ open, onOpenChange, onSuccess }: CadastroManualEditalProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [tab, setTab] = useState<string>('link');
  const [linkEdital, setLinkEdital] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [extraindo, setExtraindo] = useState(false);
  const [extraido, setExtraido] = useState(false);

  // Edital fields (filled manually or by extraction)
  const [objeto, setObjeto] = useState('');
  const [orgao, setOrgao] = useState('');
  const [numeroCompra, setNumeroCompra] = useState('');
  const [modalidadeId, setModalidadeId] = useState('');
  const [uf, setUf] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [valorEstimado, setValorEstimado] = useState('');
  const [dataAbertura, setDataAbertura] = useState('');
  const [urlEdital, setUrlEdital] = useState('');

  const [salvando, setSalvando] = useState(false);

  const resetForm = () => {
    setLinkEdital('');
    setArquivo(null);
    setExtraido(false);
    setObjeto('');
    setOrgao('');
    setNumeroCompra('');
    setModalidadeId('');
    setUf('');
    setMunicipio('');
    setValorEstimado('');
    setDataAbertura('');
    setUrlEdital('');
  };

  const handleExtrairDoLink = async () => {
    const term = linkEdital.trim();
    if (!term) return;

    // Try PNCP URL parse
    const urlMatch = term.match(/pncp\.gov\.br\/app\/editais\/(\d{11,14})\/(\d{4})\/(\d+)/);
    const manualMatch = !urlMatch ? term.match(/^(\d{11,14})[\/\-](\d{4})[\/\-](\d+)$/) : null;
    const match = urlMatch || manualMatch;

    if (match) {
      const [, cnpj, ano, seq] = match;
      setExtraindo(true);
      try {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/detalhe-licitacao-pncp`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ cnpjOrgao: cnpj, anoCompra: ano, sequencialCompra: seq }),
          }
        );
        if (!resp.ok) throw new Error(`Erro ${resp.status}`);
        const data = await resp.json();
        if (!data.success) throw new Error(data.error || 'Não encontrado');

        setObjeto(data.objeto || '');
        setOrgao(data.orgao || '');
        setNumeroCompra(data.numero_compra || '');
        setUf(data.uf || '');
        setMunicipio(data.municipio || '');
        setValorEstimado(data.valor_total_estimado ? String(data.valor_total_estimado) : '');
        setDataAbertura(data.data_abertura_proposta ? data.data_abertura_proposta.split('T')[0] : '');
        setUrlEdital(data.url_pncp || term);
        setExtraido(true);

        // Map modalidade
        const modalMap: Record<string, string> = {
          'Pregão Eletrônico': '6', 'Pregão - Eletrônico': '6',
          'Concorrência Eletrônica': '4', 'Concorrência - Eletrônica': '4',
          'Dispensa de Licitação': '8', 'Inexigibilidade': '9',
          'Credenciamento': '12',
        };
        const mod = data.modalidade || '';
        const foundMod = Object.entries(modalMap).find(([k]) => mod.toLowerCase().includes(k.toLowerCase()));
        if (foundMod) setModalidadeId(foundMod[1]);

        toast.success('Dados extraídos do PNCP com sucesso!');
      } catch (err: any) {
        toast.error(`Falha ao extrair: ${err.message}`);
      } finally {
        setExtraindo(false);
      }
    } else {
      // Not a PNCP link — just set the URL and let user fill manually
      setUrlEdital(term);
      toast.info('Link salvo. Preencha os dados do edital manualmente.');
    }
  };

  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setArquivo(file);
      toast.info('Arquivo selecionado. Preencha os dados abaixo ou extraia automaticamente.');
    }
  };

  const handleExtrairDoPDF = async () => {
    if (!arquivo || !user) return;
    setExtraindo(true);

    try {
      // Upload to storage
      const filePath = `editais-manuais/${user.id}/${Date.now()}-${arquivo.name}`;
      const { error: uploadErr } = await supabase.storage
        .from('documentos')
        .upload(filePath, arquivo);
      if (uploadErr) throw uploadErr;

      // Get signed URL
      const { data: urlData } = await supabase.storage
        .from('documentos')
        .createSignedUrl(filePath, 3600);

      setUrlEdital(urlData?.signedUrl || '');
      toast.success('PDF enviado! Preencha os campos com os dados do edital.');
      setExtraido(true);
    } catch (err: any) {
      toast.error(`Falha no upload: ${err.message}`);
    } finally {
      setExtraindo(false);
    }
  };

  const handleSalvar = async () => {
    if (!user) return;
    if (!objeto.trim()) {
      toast.error('Informe o objeto da licitação.');
      return;
    }
    if (!orgao.trim()) {
      toast.error('Informe o órgão licitante.');
      return;
    }

    setSalvando(true);
    try {
      const modNome = MODALIDADES_OPCOES.find(m => m.value === modalidadeId)?.label || null;
      const pncpId = `manual-${user.id}-${Date.now()}`;

      const { error } = await supabase.from('pncp_editais_cache').insert({
        pncp_id: pncpId,
        fonte: 'Manual',
        fonte_id: pncpId,
        objeto: objeto.trim(),
        orgao: orgao.trim(),
        numero_compra: numeroCompra.trim() || null,
        modalidade_id: modalidadeId ? parseInt(modalidadeId) : null,
        modalidade_nome: modNome,
        uf: uf || null,
        municipio: municipio.trim() || null,
        valor_total_estimado: valorEstimado ? parseFloat(valorEstimado.replace(/[^\d.,]/g, '').replace(',', '.')) : null,
        data_abertura_proposta: dataAbertura || null,
        data_publicacao_pncp: new Date().toISOString(),
        link_sistema_origem: urlEdital || null,
        url_pncp: urlEdital || null,
        situacao: 'Publicado',
      });

      if (error) throw error;

      toast.success('Edital cadastrado com sucesso! Disponível no Mural.');
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message}`);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-accent" />
            Cadastro Manual de Edital
          </DialogTitle>
          <DialogDescription>
            Cadastre um edital manualmente via link (PNCP, Compras.gov, etc.) ou upload de PDF quando a busca automática não localizar o processo.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-2">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="link" className="gap-1.5">
              <Link2 className="w-3.5 h-3.5" /> Via Link / URL
            </TabsTrigger>
            <TabsTrigger value="upload" className="gap-1.5">
              <Upload className="w-3.5 h-3.5" /> Via Upload PDF
            </TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="space-y-3 mt-3">
            <div>
              <Label className="text-xs">URL do Edital (PNCP, Compras.gov, portal estadual, etc.)</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  placeholder="https://pncp.gov.br/app/editais/05054937000163/2026/17"
                  value={linkEdital}
                  onChange={e => setLinkEdital(e.target.value)}
                  className="text-xs"
                />
                <Button
                  size="sm"
                  onClick={handleExtrairDoLink}
                  disabled={!linkEdital.trim() || extraindo}
                  className="whitespace-nowrap"
                >
                  {extraindo ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Extrair Dados'}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Para links PNCP, os dados serão extraídos automaticamente. Para outros portais, preencha manualmente abaixo.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="upload" className="space-y-3 mt-3">
            <div>
              <Label className="text-xs">Arquivo do Edital (PDF)</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-1.5"
                >
                  <FileText className="w-4 h-4" />
                  {arquivo ? arquivo.name : 'Selecionar PDF'}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleUploadFile}
                />
                {arquivo && (
                  <Button
                    size="sm"
                    onClick={handleExtrairDoPDF}
                    disabled={extraindo}
                  >
                    {extraindo ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar PDF'}
                  </Button>
                )}
              </div>
              {arquivo && (
                <Badge variant="outline" className="mt-1.5 text-[10px]">
                  {(arquivo.size / 1024 / 1024).toFixed(1)} MB
                </Badge>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Extraction feedback */}
        {extraido && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-success/10 border border-success/20 text-xs">
            <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
            <span>Dados extraídos/enviados. Confira e complete os campos abaixo.</span>
          </div>
        )}

        {/* Manual fields */}
        <div className="space-y-3 mt-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Campos com * são obrigatórios</span>
          </div>

          <div>
            <Label className="text-xs">Objeto da Licitação *</Label>
            <Textarea
              placeholder="Descrição do objeto..."
              value={objeto}
              onChange={e => setObjeto(e.target.value)}
              className="text-xs mt-1 min-h-[60px]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Órgão Licitante *</Label>
              <Input
                placeholder="Ex: Prefeitura Municipal de..."
                value={orgao}
                onChange={e => setOrgao(e.target.value)}
                className="text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Nº Compra / Pregão</Label>
              <Input
                placeholder="Ex: 00017/2026"
                value={numeroCompra}
                onChange={e => setNumeroCompra(e.target.value)}
                className="text-xs mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Modalidade</Label>
              <Select value={modalidadeId} onValueChange={setModalidadeId}>
                <SelectTrigger className="text-xs mt-1">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {MODALIDADES_OPCOES.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">UF</Label>
              <Select value={uf} onValueChange={setUf}>
                <SelectTrigger className="text-xs mt-1">
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent>
                  {UFS.map(u => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Município</Label>
              <Input
                placeholder="Município"
                value={municipio}
                onChange={e => setMunicipio(e.target.value)}
                className="text-xs mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Valor Estimado (R$)</Label>
              <Input
                placeholder="0,00"
                value={valorEstimado}
                onChange={e => setValorEstimado(e.target.value)}
                className="text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Data de Abertura</Label>
              <Input
                type="date"
                value={dataAbertura}
                onChange={e => setDataAbertura(e.target.value)}
                className="text-xs mt-1"
              />
            </div>
          </div>

          {urlEdital && (
            <div>
              <Label className="text-xs">URL do Edital</Label>
              <Input value={urlEdital} readOnly className="text-xs mt-1 bg-muted/30" />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
          <Button variant="outline" size="sm" onClick={() => { resetForm(); onOpenChange(false); }}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSalvar}
            disabled={salvando || !objeto.trim() || !orgao.trim()}
            className="bg-accent hover:bg-accent/90 text-accent-foreground gap-1.5"
          >
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Cadastrar Edital
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
