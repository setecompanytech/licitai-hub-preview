import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import { Upload, ShieldCheck, Loader2, Building2, Search } from 'lucide-react';

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
  const [cnaePrincipal, setCnaePrincipal] = useState('');
  const [uf, setUf] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [endereco, setEndereco] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cep, setCep] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [inscricaoEstadual, setInscricaoEstadual] = useState('');
  const [validade, setValidade] = useState('');
  const [regimeTributario, setRegimeTributario] = useState('');
  const [senhaCertificado, setSenhaCertificado] = useState('');
  const [loading, setLoading] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [buscandoSintegra, setBuscandoSintegra] = useState(false);

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

  const handleBuscarCNPJ = async () => {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) {
      toast.error('Informe um CNPJ válido com 14 dígitos');
      return;
    }

    setBuscando(true);
    try {
      const { data, error } = await supabase.functions.invoke('consulta-cnpj', {
        body: { cnpj: cnpjLimpo },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setRazaoSocial(data.razaoSocial || '');
      setNomeFantasia(data.nomeFantasia || '');
      setCnaePrincipal(data.cnaePrincipal || '');
      setUf(data.uf || '');
      setMunicipio(data.municipio || '');
      setEndereco(data.endereco || '');
      setComplemento(data.complemento || '');
      setBairro(data.bairro || '');
      setCep(data.cep || '');
      setTelefone(data.telefone || '');
      setEmail(data.email || '');
      setCnpj(data.cnpj || cnpj);
      if (data.simples) setRegimeTributario('simples_nacional');
      toast.success('Dados da Receita Federal preenchidos automaticamente!');

      // Auto-trigger SINTEGRA for IE
      if (data.uf) {
        await handleBuscarSintegra(cnpjLimpo, data.uf);
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao consultar CNPJ');
    } finally {
      setBuscando(false);
    }
  };

  const handleBuscarSintegra = async (cnpjParam?: string, ufParam?: string) => {
    const cnpjLimpo = (cnpjParam || cnpj).replace(/\D/g, '');
    const ufValue = ufParam || uf;
    if (cnpjLimpo.length !== 14 || !ufValue) return;

    setBuscandoSintegra(true);
    try {
      const { data, error } = await supabase.functions.invoke('consulta-sintegra', {
        body: { cnpj: cnpjLimpo, uf: ufValue },
      });
      if (error) throw error;
      if (data?.inscricaoEstadual && data.inscricaoEstadual !== 'ISENTO') {
        setInscricaoEstadual(data.inscricaoEstadual);
        toast.success('Inscrição Estadual obtida via SINTEGRA!');
      } else {
        setInscricaoEstadual(data?.inscricaoEstadual || 'ISENTO');
      }
    } catch {
      // Silently fail — SINTEGRA is complementary
    } finally {
      setBuscandoSintegra(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !file || !cnpj.trim() || !razaoSocial.trim() || !regimeTributario || !senhaCertificado.trim()) {
      toast.error('Preencha todos os campos obrigatórios (incluindo senha do certificado e regime tributário)');
      return;
    }

    setLoading(true);
    try {
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('certificados')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error(`Erro ao enviar certificado: ${uploadError.message}`);
        setLoading(false);
        return;
      }

      const empresa = await addEmpresa({
        cnpj: cnpj.trim(),
        razao_social: razaoSocial.trim(),
        nome_fantasia: nomeFantasia.trim() || undefined,
        cnae_principal: cnaePrincipal.trim() || undefined,
        uf: uf.trim() || undefined,
        municipio: municipio.trim() || undefined,
        endereco: endereco.trim() || undefined,
        complemento: complemento.trim() || undefined,
        bairro: bairro.trim() || undefined,
        cep: cep.trim() || undefined,
        telefone: telefone.trim() || undefined,
        email: email.trim() || undefined,
        inscricao_estadual: inscricaoEstadual.trim() || undefined,
        certificado_path: filePath,
        certificado_nome: file.name,
        certificado_tipo: tipo,
        certificado_validade: validade || undefined,
        regime_tributario: regimeTributario,
      });

      if (!empresa) {
        toast.error('Erro ao cadastrar empresa. Verifique os dados e tente novamente.');
        setLoading(false);
        return;
      }

      toast.success(`Empresa ${razaoSocial} cadastrada com sucesso!`);
      setCnpj(''); setRazaoSocial(''); setNomeFantasia(''); setValidade('');
      setCnaePrincipal(''); setUf(''); setMunicipio(''); setEndereco('');
      setRegimeTributario(''); setSenhaCertificado(''); setTelefone('');
      setEmail(''); setInscricaoEstadual(''); setComplemento('');
      setBairro(''); setCep('');
      setFile(null);
      onSuccess?.();
    } catch (err: any) {
      console.error('Cadastro error:', err);
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

      <div>
        <Label className="text-xs">Senha do Certificado Digital *</Label>
        <Input
          type="password"
          value={senhaCertificado}
          onChange={e => setSenhaCertificado(e.target.value)}
          placeholder="Digite a senha do certificado"
          className="mt-1"
          required
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          A senha é necessária para validar o certificado. Ela não será armazenada.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">CNPJ / CPF *</Label>
          <div className="flex gap-2 mt-1">
            <Input
              value={cnpj}
              onChange={e => setCnpj(e.target.value)}
              placeholder="00.000.000/0001-00"
              required
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleBuscarCNPJ}
              disabled={buscando || cnpj.replace(/\D/g, '').length < 14}
              title="Buscar dados na Receita Federal e SINTEGRA"
              className="shrink-0"
            >
              {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {buscandoSintegra ? 'Consultando SINTEGRA...' : 'Clique na lupa para preencher automaticamente via Receita Federal + SINTEGRA'}
          </p>
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

      <div>
        <Label className="text-xs">CNAE Principal</Label>
        <Input value={cnaePrincipal} onChange={e => setCnaePrincipal(e.target.value)} placeholder="Ex: 6201500 - Desenvolvimento de software" className="mt-1" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Telefone</Label>
          <Input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(XX) XXXXX-XXXX" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">E-mail</Label>
          <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="contato@empresa.com" className="mt-1" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label className="text-xs">CEP</Label>
          <Input value={cep} onChange={e => setCep(e.target.value)} placeholder="00000-000" className="mt-1" />
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Endereço (Logradouro, Nº)</Label>
          <Input value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Rua, nº - Bairro" className="mt-1" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label className="text-xs">Complemento</Label>
          <Input value={complemento} onChange={e => setComplemento(e.target.value)} placeholder="Sala, Andar, etc." className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Bairro</Label>
          <Input value={bairro} onChange={e => setBairro(e.target.value)} placeholder="Bairro" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Inscrição Estadual</Label>
          <Input value={inscricaoEstadual} onChange={e => setInscricaoEstadual(e.target.value)} placeholder="ISENTO ou nº" className="mt-1" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Município</Label>
          <Input value={municipio} onChange={e => setMunicipio(e.target.value)} placeholder="São Paulo" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">UF</Label>
          <Input value={uf} onChange={e => setUf(e.target.value)} placeholder="SP" className="mt-1" maxLength={2} />
        </div>
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

      <Button type="submit" disabled={loading || !file || !regimeTributario || !senhaCertificado.trim()} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Building2 className="w-4 h-4 mr-2" />}
        {mode === 'login' ? 'Acessar' : 'Cadastrar Empresa'}
      </Button>
    </form>
  );
}
