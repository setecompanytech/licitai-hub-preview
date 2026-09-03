import { useEffect, useState } from 'react';
import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useAuthorization } from '@/hooks/useAuthorization';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
    return <div className="flex items-center gap-2 text-sm text-muted-foreground p-4"><Loader2 className="w-4 h-4 animate-spin" /> Carregando timbrado…</div>;
  }

  return (
    <section className="bg-card rounded-xl border border-border/50 p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <ImageIcon className="w-5 h-5 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Timbrado da empresa</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Logotipo, cabeçalho e rodapé que vestem <span className="font-medium">todo documento gerado</span> —
        recibos, relatórios, planilhas e peças — em retrato e paisagem. Configura-se uma vez; quem gera
        nunca mais pensa nisso.
        {!isCompanyAdmin && ' Somente o Admin da empresa pode alterar.'}
      </p>

      <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
        <div>
          <Label className="text-xs">Logotipo (PNG/JPG)</Label>
          <div className="mt-1 border border-dashed border-border rounded-lg h-24 flex items-center justify-center overflow-hidden bg-muted/20">
            {logoPreview
              ? <img src={logoPreview} alt="Logotipo" className="max-h-20 max-w-full object-contain" />
              : <span className="text-xs text-muted-foreground">sem logotipo</span>}
          </div>
          {isCompanyAdmin && (
            <Input type="file" accept="image/png,image/jpeg" className="mt-2 h-8 text-xs"
              onChange={(e) => escolherLogo(e.target.files?.[0] ?? null)} />
          )}
        </div>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Cabeçalho — qualificação (razão social, CNPJ, IE, endereço…)</Label>
            <Textarea value={cabecalho} onChange={(e) => setCabecalho(e.target.value)} rows={3}
              disabled={!isCompanyAdmin} className="mt-1 text-xs"
              placeholder={'SANTA ROSA COMÉRCIO, DISTRIBUIDORA E REPRESENTAÇÕES LTDA\nCNPJ 24.687.187/0001-01 · IE 15.522.993-1\nRua Tenente Bezerra, 93-A · Mangueirão · Belém/PA · CEP 66640-085'} />
          </div>
          <div>
            <Label className="text-xs">Rodapé — contatos (endereço, site, e-mail, telefones)</Label>
            <Textarea value={rodape} onChange={(e) => setRodape(e.target.value)} rows={2}
              disabled={!isCompanyAdmin} className="mt-1 text-xs"
              placeholder={'www.gruposantarosa.com.br · comercial@gruposantarosa.com.br\n(91) 3225-2678 / 99225-7448'} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {isCompanyAdmin && (
          <Button size="sm" onClick={salvar} disabled={salvando}>
            {salvando ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
            Salvar timbrado
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => visualizar('portrait')}>
          <Eye className="w-3.5 h-3.5 mr-1.5" /> Prévia retrato
        </Button>
        <Button size="sm" variant="outline" onClick={() => visualizar('landscape')}>
          <Eye className="w-3.5 h-3.5 mr-1.5" /> Prévia paisagem
        </Button>
      </div>
    </section>
  );
}
