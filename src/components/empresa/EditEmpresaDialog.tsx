import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';

type Empresa = {
  id: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnae_principal: string | null;
  uf: string | null;
  municipio: string | null;
  endereco?: string | null;
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
  const [regimeTributario, setRegimeTributario] = useState('');
  const [inscricaoEstadual, setInscricaoEstadual] = useState('');
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (empresa) {
      setRazaoSocial(empresa.razao_social || '');
      setNomeFantasia(empresa.nome_fantasia || '');
      setCnaePrincipal(empresa.cnae_principal || '');
      setUf(empresa.uf || '');
      setMunicipio(empresa.municipio || '');
      setEndereco(empresa.endereco || '');
      setRegimeTributario(empresa.regime_tributario || '');
      setInscricaoEstadual(empresa.inscricao_estadual || '');
      setInscricaoMunicipal(empresa.inscricao_municipal || '');
    }
  }, [empresa]);

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
          uf: uf.trim() || null,
          municipio: municipio.trim() || null,
          endereco: endereco.trim() || null,
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Editar Empresa — {empresa?.cnpj}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <Label className="text-xs">Razão Social *</Label>
            <Input value={razaoSocial} onChange={e => setRazaoSocial(e.target.value)} className="mt-1" required />
          </div>
          <div>
            <Label className="text-xs">Nome Fantasia</Label>
            <Input value={nomeFantasia} onChange={e => setNomeFantasia(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Regime Tributário *</Label>
            <Select value={regimeTributario} onValueChange={setRegimeTributario}>
              <SelectTrigger className="mt-1">
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
            <Label className="text-xs">CNAE Principal</Label>
            <Input value={cnaePrincipal} onChange={e => setCnaePrincipal(e.target.value)} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">UF</Label>
              <Input value={uf} onChange={e => setUf(e.target.value)} className="mt-1" maxLength={2} />
            </div>
            <div>
              <Label className="text-xs">Município</Label>
              <Input value={municipio} onChange={e => setMunicipio(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Endereço</Label>
            <Input value={endereco} onChange={e => setEndereco(e.target.value)} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Inscrição Estadual</Label>
              <Input value={inscricaoEstadual} onChange={e => setInscricaoEstadual(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Inscrição Municipal</Label>
              <Input value={inscricaoMunicipal} onChange={e => setInscricaoMunicipal(e.target.value)} className="mt-1" />
            </div>
          </div>
          <Button type="submit" disabled={loading || !regimeTributario} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar Alterações
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
