import { useEffect, useState } from 'react';
import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useAuthorization } from '@/hooks/useAuthorization';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ImageIcon, Loader2, Save, Eye } from 'lucide-react';
import { AJUSTES_PADRAO, aplicarTimbrado, carregarTimbrado, limparCacheTimbrado, type Timbrado } from '@/lib/timbrado/timbrado';

/**
 * Configurações → Timbrado: a identidade que TODO documento gerado veste —
 * recibo do kit, relatórios em PDF, cabeçalho impresso das telas — em
 * retrato e paisagem. Configura-se UMA vez; quem gera nunca mais pensa nisso.
 *
 * Só o Admin edita (identidade da empresa é decisão de identidade); todo
 * membro consome. Pré-visualização gera um PDF de amostra REAL, com o mesmo
 * código que os documentos usam — o que se vê é o que sai.
 */
export default function TimbradoConfig() {
  const { empresaAtiva } = useEmpresa();
  const { isCompanyAdmin } = useAuthorization();
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [cabecalho, setCabecalho] = useState('');
  const [rodape, setRodape] = useState('');
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoNovo, setLogoNovo] = useState<File | null>(null);

  useEffect(() => {
    if (!empresaAtiva?.id) return;
    let vivo = true;
    (async () => {
      setCarregando(true);
      const { data } = await (supabase.from('empresa_timbrado' as never) as any)
        .select('logo_path, cabecalho, rodape')
        .eq('empresa_id', empresaAtiva.id)
        .maybeSingle();
      if (!vivo) return;
      setCabecalho(data?.cabecalho ?? '');
      setRodape(data?.rodape ?? '');
      setLogoPath(data?.logo_path ?? null);
      if (data?.logo_path) {
        const { data: blob } = await supabase.storage.from('empresa-timbrado').download(data.logo_path);
        if (vivo && blob) setLogoPreview(URL.createObjectURL(blob));
      }
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, [empresaAtiva?.id]);

  const escolherLogo = (f: File | null) => {
    if (!f) return;
    if (!/^image\/(png|jpe?g)$/i.test(f.type)) {
      toast.error('O logotipo deve ser PNG ou JPG.');
      return;
    }
    setLogoNovo(f);
    setLogoPreview(URL.createObjectURL(f));
  };

  const salvar = async () => {
    if (!empresaAtiva?.id) return;
    setSalvando(true);
    try {
      let novoPath = logoPath;
      if (logoNovo) {
        const ext = /jpe?g/i.test(logoNovo.type) ? 'jpg' : 'png';
        novoPath = `${empresaAtiva.id}/logo.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('empresa-timbrado')
          .upload(novoPath, logoNovo, { upsert: true, contentType: logoNovo.type });
        if (upErr) { toast.error('O logotipo não subiu: ' + upErr.message); return; }
      }
      const { error } = await (supabase.from('empresa_timbrado' as never) as any).upsert({
        empresa_id: empresaAtiva.id,
        logo_path: novoPath,
        cabecalho: cabecalho.trim() || null,
        rodape: rodape.trim() || null,
        atualizado_em: new Date().toISOString(),
      });
      if (error) { toast.error('Não foi possível salvar: ' + error.message); return; }
      setLogoPath(novoPath);
      setLogoNovo(null);
      limparCacheTimbrado(empresaAtiva.id);
      toast.success('Timbrado salvo — todo documento gerado a partir de agora sai com ele.');
    } finally {
      setSalvando(false);
    }
  };

  /** Amostra REAL: o mesmo aplicador que recibo e relatórios usam. */
  const visualizar = async (orientacao: 'portrait' | 'landscape') => {
    if (!empresaAtiva?.id) return;
    limparCacheTimbrado(empresaAtiva.id);
    let t: Timbrado | null = await carregarTimbrado(empresaAtiva.id);
    // Antes de salvar, a prévia usa o que está NA TELA (rascunho).
    if (logoNovo || cabecalho.trim() || rodape.trim()) {
      const dataUrl = logoNovo
        ? await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(logoNovo); })
        : t?.logoDataUrl ?? null;
      let ratio = t?.logoRatio ?? 3;
      if (dataUrl) {
        ratio = await new Promise<number>((res) => {
          const img = new Image();
          img.onload = () => res(img.height > 0 ? img.width / img.height : 3);
          img.onerror = () => res(3);
          img.src = dataUrl;
        });
      }
      t = {
        logoDataUrl: dataUrl,
        logoRatio: ratio,
        cabecalho: cabecalho.trim() || null,
        rodape: rodape.trim() || null,
        cabecalhoImg: t?.cabecalhoImg ?? null,
        rodapeImg: t?.rodapeImg ?? null,
        ajustes: t?.ajustes ?? AJUSTES_PADRAO,
      };
    }
    if (!t) { toast.info('Preencha o cabeçalho, o rodapé ou o logotipo para pré-visualizar.'); return; }
    const doc = new jsPDF({ unit: 'mm', orientation: orientacao });
    const molde = aplicarTimbrado(doc, t);
    doc.setFont('times', 'bold').setFontSize(14);
    doc.text('DOCUMENTO DE AMOSTRA', doc.internal.pageSize.getWidth() / 2, molde.topoY + 12, { align: 'center' });
    doc.setFont('times', 'normal').setFontSize(11);
    doc.text(
      doc.splitTextToSize(
        'Este é o espaço útil do conteúdo: propostas, recibos, relatórios, planilhas de custos e peças jurídicas ocupam a área entre o cabeçalho e o rodapé do timbrado.',
        doc.internal.pageSize.getWidth() - 40,
      ),
      20,
      molde.topoY + 24,
    );
    window.open(URL.createObjectURL(doc.output('blob')), '_blank');
  };

  if (carregando) {
    return (
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm" role="status" aria-busy="true">
        <span className="sr-only">Carregando timbrado</span>
        <Skeleton className="mb-4 h-6 w-48" />
        <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
          <Skeleton className="h-24 w-full" />
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <ImageIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-foreground">Timbrado da empresa</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Logotipo, cabeçalho e rodapé que vestem <span className="font-medium text-foreground">todo documento gerado</span> —
        recibos, relatórios, planilhas e peças — em retrato e paisagem. Configura-se uma vez; quem gera
        nunca mais pensa nisso.
        {!isCompanyAdmin && ' Somente o Admin da empresa pode alterar.'}
      </p>

      <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
        <div>
          <Label htmlFor="timbrado-logo">Logotipo (PNG/JPG)</Label>
          <div className="mt-1 flex h-24 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted">
            {logoPreview
              ? <img src={logoPreview} alt="Logotipo" className="max-h-20 max-w-full object-contain" />
              : <span className="text-xs text-muted-foreground">sem logotipo</span>}
          </div>
          {isCompanyAdmin && (
            <Input id="timbrado-logo" type="file" accept="image/png,image/jpeg" className="mt-2"
              onChange={(e) => escolherLogo(e.target.files?.[0] ?? null)} />
          )}
        </div>
        <div className="space-y-4">
          <div>
            <Label htmlFor="timbrado-cabecalho">Cabeçalho — qualificação (razão social, CNPJ, IE, endereço…)</Label>
            <Textarea id="timbrado-cabecalho" value={cabecalho} onChange={(e) => setCabecalho(e.target.value)} rows={3}
              disabled={!isCompanyAdmin} className="mt-1"
              placeholder={'RAZÃO SOCIAL DA EMPRESA LTDA\nCNPJ 00.000.000/0000-00 · IE 00.000.000-0\nRua Exemplo, 100 · Bairro · Cidade/UF · CEP 00000-000'} />
          </div>
          <div>
            <Label htmlFor="timbrado-rodape">Rodapé — contatos (endereço, site, e-mail, telefones)</Label>
            <Textarea id="timbrado-rodape" value={rodape} onChange={(e) => setRodape(e.target.value)} rows={2}
              disabled={!isCompanyAdmin} className="mt-1"
              placeholder={'www.suaempresa.com.br · contato@suaempresa.com.br\n(00) 0000-0000 / 00000-0000'} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isCompanyAdmin && (
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
            Salvar timbrado
          </Button>
        )}
        <Button variant="outline" onClick={() => visualizar('portrait')}>
          <Eye aria-hidden="true" /> Prévia retrato
        </Button>
        <Button variant="outline" onClick={() => visualizar('landscape')}>
          <Eye aria-hidden="true" /> Prévia paisagem
        </Button>
      </div>
    </section>
  );
}
