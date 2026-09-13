import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Save, Search } from 'lucide-react';
import TimbradoUploader from '@/components/proposta/TimbradoUploader';
import { Separator } from '@/components/ui/separator';

type Empresa = {
  id: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnae_principal: string | null;
  cnaes_secundarios?: string[] | null;
  uf: string | null;
  municipio: string | null;
  endereco?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cep?: string | null;
  telefone?: string | null;
  email?: string | null;
  regime_tributario: string | null;
  inscricao_estadual?: string | null;
  inscricao_municipal?: string | null;
};

type Props = {
  empresa: Empresa | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

export default function EditEmpresaDialog({ empresa, open, onOpenChange, onSuccess }: Props) {
  const [razaoSocial, setRazaoSocial] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [cnaePrincipal, setCnaePrincipal] = useState('');
  const [uf, setUf] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [endereco, setEndereco] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cep, setCep] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [regimeTributario, setRegimeTributario] = useState('');
  const [inscricaoEstadual, setInscricaoEstadual] = useState('');
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState('');
  const [cnaesSecundarios, setCnaesSecundarios] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [timbradoUrl, setTimbradoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (empresa) {
      setRazaoSocial(empresa.razao_social || '');
      setNomeFantasia(empresa.nome_fantasia || '');
      setCnaePrincipal(empresa.cnae_principal || '');
      setUf(empresa.uf || '');
      setMunicipio(empresa.municipio || '');
      setEndereco(empresa.endereco || '');
      setComplemento(empresa.complemento || '');
      setBairro(empresa.bairro || '');
      setCep(empresa.cep || '');
      setTelefone(empresa.telefone || '');
      setEmail(empresa.email || '');
      setRegimeTributario(empresa.regime_tributario || '');
      setInscricaoEstadual(empresa.inscricao_estadual || '');
      setInscricaoMunicipal(empresa.inscricao_municipal || '');
      setCnaesSecundarios(empresa.cnaes_secundarios || []);
    }
  }, [empresa]);

  const handleBuscarCNPJ = async () => {
    if (!empresa) return;
    const cnpjLimpo = empresa.cnpj.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) return;

    setBuscando(true);
    try {
      const { data, error } = await supabase.functions.invoke('consulta-cnpj', {
        body: { cnpj: cnpjLimpo },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }

      setRazaoSocial(data.razaoSocial || razaoSocial);
      setNomeFantasia(data.nomeFantasia || nomeFantasia);
      setCnaePrincipal(data.cnaePrincipal || cnaePrincipal);
      setUf(data.uf || uf);
      setMunicipio(data.municipio || municipio);
      setEndereco(data.endereco || endereco);
      setComplemento(data.complemento || '');
      setBairro(data.bairro || '');
      setCep(data.cep || cep);
      setTelefone(data.telefone || telefone);
      if (data.email && data.email.trim()) setEmail(data.email.trim());
      if (data.inscricaoEstadual) setInscricaoEstadual(data.inscricaoEstadual);
      setCnaesSecundarios(Array.isArray(data.cnaesSecundarios) ? data.cnaesSecundarios : []);
      if (data.simples) setRegimeTributario('simples_nacional');

      const sources = ['Receita Federal'];
      if (data.inscricaoEstadual) sources.push('SINTEGRA');
      if (data.email) sources.push('E-mail');
      toast.success(`Dados reais obtidos via ${sources.join(' + ')}!`);

      // If IE wasn't found in main query, try standalone SINTEGRA
      if (!data.inscricaoEstadual && data.uf) {
        try {
          const { data: sintegra } = await supabase.functions.invoke('consulta-sintegra', {
            body: { cnpj: cnpjLimpo, uf: data.uf },
          });
          if (sintegra?.inscricaoEstadual) {
            setInscricaoEstadual(sintegra.inscricaoEstadual);
            toast.success('Inscrição Estadual obtida via SINTEGRA!');
          }
        } catch { /* silent */ }
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao consultar CNPJ');
    } finally {
      setBuscando(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresa) return;

    if (!razaoSocial.trim() || !regimeTributario) {
      toast.error('Razão Social e Regime Tributário são obrigatórios.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('empresas')
        .update({
          razao_social: razaoSocial.trim(),
          nome_fantasia: nomeFantasia.trim() || null,
          cnae_principal: cnaePrincipal.trim() || null,
          cnaes_secundarios: cnaesSecundarios,
          uf: uf.trim() || null,
          municipio: municipio.trim() || null,
          endereco: endereco.trim() || null,
          complemento: complemento.trim() || null,
          bairro: bairro.trim() || null,
          cep: cep.trim() || null,
          telefone: telefone.trim() || null,
          email: email.trim() || null,
          regime_tributario: regimeTributario,
          inscricao_estadual: inscricaoEstadual.trim() || null,
          inscricao_municipal: inscricaoMunicipal.trim() || null,
        })
        .eq('id', empresa.id);

      if (error) throw error;

      toast.success('Empresa atualizada com sucesso!');
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar empresa');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Empresa — {empresa?.cnpj}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          <div className="flex flex-wrap justify-end">
            <Button type="button" variant="outline" onClick={handleBuscarCNPJ} disabled={buscando}>
              {buscando ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Search aria-hidden="true" />}
              Atualizar via Receita Federal
            </Button>
          </div>
          <div>
            <Label htmlFor="edit-razao">Razão Social *</Label>
            <Input id="edit-razao" value={razaoSocial} onChange={e => setRazaoSocial(e.target.value)} className="mt-1" required />
          </div>
          <div>
            <Label htmlFor="edit-fantasia">Nome Fantasia</Label>
            <Input id="edit-fantasia" value={nomeFantasia} onChange={e => setNomeFantasia(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="edit-regime">Regime Tributário *</Label>
            <Select value={regimeTributario} onValueChange={setRegimeTributario}>
              <SelectTrigger id="edit-regime" className="mt-1">
                <SelectValue placeholder="Selecione o regime tributário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                <SelectItem value="lucro_real">Lucro Real</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="edit-cnae">CNAE Principal</Label>
            <Input id="edit-cnae" value={cnaePrincipal} onChange={e => setCnaePrincipal(e.target.value)} className="mt-1" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="edit-telefone">Telefone</Label>
              <Input id="edit-telefone" value={telefone} onChange={e => setTelefone(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="edit-email">E-mail</Label>
              <Input id="edit-email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="edit-cep">CEP</Label>
              <Input id="edit-cep" value={cep} onChange={e => setCep(e.target.value)} className="mt-1" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="edit-endereco">Endereço</Label>
              <Input id="edit-endereco" value={endereco} onChange={e => setEndereco(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="edit-complemento">Complemento</Label>
              <Input id="edit-complemento" value={complemento} onChange={e => setComplemento(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="edit-bairro">Bairro</Label>
              <Input id="edit-bairro" value={bairro} onChange={e => setBairro(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="edit-uf">UF</Label>
              <Input id="edit-uf" value={uf} onChange={e => setUf(e.target.value)} className="mt-1" maxLength={2} />
            </div>
          </div>
          <div>
            <Label htmlFor="edit-municipio">Município</Label>
            <Input id="edit-municipio" value={municipio} onChange={e => setMunicipio(e.target.value)} className="mt-1" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="edit-ie">Inscrição Estadual</Label>
              <Input id="edit-ie" value={inscricaoEstadual} onChange={e => setInscricaoEstadual(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="edit-im">Inscrição Municipal</Label>
              <Input id="edit-im" value={inscricaoMunicipal} onChange={e => setInscricaoMunicipal(e.target.value)} className="mt-1" />
            </div>
          </div>

          <Separator className="my-2" />

          <TimbradoUploader
            empresaId={empresa?.id}
            timbradoUrl={timbradoUrl}
            setTimbradoUrl={setTimbradoUrl}
          />

          <Separator className="my-2" />

          <Button type="submit" disabled={loading || !regimeTributario} className="w-full">
            {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
            Salvar Alterações
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
