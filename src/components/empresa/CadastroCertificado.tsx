import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import { Upload, ShieldCheck, Loader2, Building2 } from 'lucide-react';

type Props = {
  onSuccess?: () => void;
  mode?: 'login' | 'cadastro';
};

export default function CadastroCertificado({ onSuccess, mode = 'cadastro' }: Props) {
  const { user } = useAuth();
  const { addEmpresa } = useEmpresa();
  const [file, setFile] = useState<File | null>(null);
  const [tipo, setTipo] = useState<'e-cnpj' | 'e-cpf'>('e-cnpj');
  const [cnpj, setCnpj] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [validade, setValidade] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      const ext = f.name.split('.').pop()?.toLowerCase();
      if (!['pfx', 'p12', 'cer', 'crt', 'pem'].includes(ext || '')) {
        toast.error('Formato inválido. Use .pfx, .p12, .cer, .crt ou .pem');
        return;
      }
      if (f.size > 10 * 1024 * 1024) {
        toast.error('Arquivo muito grande. Máximo 10MB.');
        return;
      }
      setFile(f);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !file || !cnpj.trim() || !razaoSocial.trim()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      // Upload certificate
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('certificados')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create empresa
      const empresa = await addEmpresa({
        cnpj: cnpj.trim(),
        razao_social: razaoSocial.trim(),
        nome_fantasia: nomeFantasia.trim() || undefined,
        certificado_path: filePath,
        certificado_nome: file.name,
        certificado_tipo: tipo,
        certificado_validade: validade || undefined,
      });

      if (!empresa) throw new Error('Erro ao cadastrar empresa');

      toast.success(`Empresa ${razaoSocial} cadastrada com sucesso!`);
      setCnpj(''); setRazaoSocial(''); setNomeFantasia(''); setValidade(''); setFile(null);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao cadastrar empresa');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck className="w-5 h-5 text-accent" />
        <h3 className="text-sm font-semibold">
          {mode === 'login' ? 'Acessar com Certificado Digital' : 'Cadastrar Empresa via Certificado'}
        </h3>
      </div>

      <div>
        <Label className="text-xs">Tipo de Certificado</Label>
        <Select value={tipo} onValueChange={(v: 'e-cnpj' | 'e-cpf') => setTipo(v)}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="e-cnpj">e-CNPJ (Pessoa Jurídica)</SelectItem>
            <SelectItem value="e-cpf">e-CPF (Pessoa Física)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs">Certificado Digital (.pfx, .p12, .cer)</Label>
        <div className="mt-1">
          <label className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-border hover:border-accent/50 cursor-pointer transition-colors bg-muted/30">
            <Upload className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {file ? file.name : 'Clique para selecionar o certificado'}
            </span>
            <input type="file" accept=".pfx,.p12,.cer,.crt,.pem" onChange={handleFileChange} className="hidden" />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">CNPJ / CPF *</Label>
          <Input value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="00.000.000/0001-00" className="mt-1" required />
        </div>
        <div>
          <Label className="text-xs">Validade do Certificado</Label>
          <Input type="date" value={validade} onChange={e => setValidade(e.target.value)} className="mt-1" />
        </div>
      </div>

      <div>
        <Label className="text-xs">Razão Social *</Label>
        <Input value={razaoSocial} onChange={e => setRazaoSocial(e.target.value)} placeholder="Nome da empresa" className="mt-1" required />
      </div>

      <div>
        <Label className="text-xs">Nome Fantasia</Label>
        <Input value={nomeFantasia} onChange={e => setNomeFantasia(e.target.value)} placeholder="Nome fantasia (opcional)" className="mt-1" />
      </div>

      <Button type="submit" disabled={loading || !file} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Building2 className="w-4 h-4 mr-2" />}
        {mode === 'login' ? 'Acessar' : 'Cadastrar Empresa'}
      </Button>
    </form>
  );
}
