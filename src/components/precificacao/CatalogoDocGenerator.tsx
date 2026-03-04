import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  FileText, BookOpen, Layout, Loader2, Download, Sparkles,
  Package, Image as ImageIcon, ClipboardList, RefreshCw, Palette,
  Eye, ChevronLeft, ChevronRight, Settings2
} from 'lucide-react';
import { toast } from 'sonner';
import { streamAIChat } from '@/lib/ai-stream';
import { supabase } from '@/integrations/supabase/client';
import jsPDF from 'jspdf';

// ─── Types ───
interface CatalogoItem {
  id: string;
  descricao: string;
  marca: string | null;
  fabricante: string | null;
  modelo: string | null;
  unidade: string;
  quantidade: number;
}

interface ProductSpec {
  nome: string;
  descricao_detalhada: string;
  especificacoes: { chave: string; valor: string }[];
  imagens: string[];
  marca: string;
  modelo: string;
  categoria: string;
  site_fabricante?: string;
}

type DocType = 'ficha' | 'folder' | 'catalogo';
type ColorTheme = 'corporate' | 'modern' | 'minimal' | 'bold';

interface CatalogoDocGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CatalogoItem[];
}

// ─── Template Definitions ───
const DOC_TYPES: Record<DocType, { label: string; icon: typeof FileText; desc: string }> = {
  ficha: { label: 'Ficha Técnica', icon: ClipboardList, desc: 'Especificações detalhadas individuais' },
  folder: { label: 'Folder Comercial', icon: Layout, desc: 'Material visual com destaques' },
  catalogo: { label: 'Catálogo Completo', icon: BookOpen, desc: 'Documento consolidado ABNT' },
};

const COLOR_THEMES: Record<ColorTheme, { label: string; primary: string; secondary: string; accent: string; bg: string }> = {
  corporate: { label: 'Corporativo', primary: '#1a365d', secondary: '#2b6cb0', accent: '#3182ce', bg: '#f7fafc' },
  modern: { label: 'Moderno', primary: '#1a202c', secondary: '#4a5568', accent: '#38b2ac', bg: '#f0fff4' },
  minimal: { label: 'Minimalista', primary: '#2d3748', secondary: '#718096', accent: '#667eea', bg: '#ffffff' },
  bold: { label: 'Impactante', primary: '#742a2a', secondary: '#9b2c2c', accent: '#e53e3e', bg: '#fff5f5' },
};

export default function CatalogoDocGenerator({ open, onOpenChange, items }: CatalogoDocGeneratorProps) {
  const [docType, setDocType] = useState<DocType>('catalogo');
  const [colorTheme, setColorTheme] = useState<ColorTheme>('corporate');
  const [isGenerating, setIsGenerating] = useState(false);
  const [specs, setSpecs] = useState<ProductSpec[]>([]);
  const [step, setStep] = useState<'template' | 'customize' | 'preview'>('template');
  const [companyName, setCompanyName] = useState('');
  const [docTitle, setDocTitle] = useState('');
  const [docSubtitle, setDocSubtitle] = useState('');
  const [progressText, setProgressText] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);

  const resetState = () => {
    setSpecs([]);
    setStep('template');
    setProgressText('');
    setProgressPercent(0);
  };

  // ─── Image URL Validation ───
  const isValidImageUrl = (url: string): boolean => {
    if (!url || typeof url !== 'string') return false;
    const lower = url.toLowerCase();
    // Reject tracking pixels, ads, placeholders, data URIs, icons
    const blocked = [
      'doubleclick', 'adsense', 'googlesyndication', 'facebook.com/tr',
      'pixel', 'tracking', 'analytics', '1x1', 'spacer', 'blank.gif',
      'data:image', 'base64', 'favicon', '.ico', 'logo-', 'icon-',
      'banner', 'ad-', 'sprite', 'loader', 'spinner', 'placeholder',
      'no-image', 'sem-imagem', 'default-product', 'avatar',
    ];
    if (blocked.some(b => lower.includes(b))) return false;
    // Must be a proper image URL
    if (!lower.startsWith('http')) return false;
    // Prefer product images (larger dimensions hinted in URL)
    const hasImageExt = /\.(jpg|jpeg|png|webp)(\?|$)/i.test(lower);
    const hasImagePath = /\/(product|prod|img|image|foto|photo|media|upload|asset)/i.test(lower);
    return hasImageExt || hasImagePath || lower.includes('cdn');
  };

  // ─── Spec Search (Enhanced with manufacturer site + real images) ───
  const searchProductSpecs = useCallback(async (item: CatalogoItem): Promise<ProductSpec> => {
    const searchTerm = [item.descricao, item.marca, item.modelo].filter(Boolean).join(' ').substring(0, 150);
    const brandTerm = item.marca || item.fabricante || '';

    try {
      // === SEARCH 1: Technical specs from general sources ===
      const specSearchPromise = supabase.functions.invoke('firecrawl-search', {
        body: {
          query: `"${searchTerm}" especificações técnicas ficha técnica`,
          options: { limit: 3, lang: 'pt-br', country: 'BR', scrapeOptions: { formats: ['markdown'] } },
        },
      });

      // === SEARCH 2: Manufacturer site for authentic images ===
      const manufacturerSearchPromise = brandTerm
        ? supabase.functions.invoke('firecrawl-search', {
            body: {
              query: `site:${brandTerm.toLowerCase().replace(/\s+/g, '')}.com.br OR site:${brandTerm.toLowerCase().replace(/\s+/g, '')}.com "${item.descricao}" produto`,
              options: { limit: 2, lang: 'pt-br', country: 'BR', scrapeOptions: { formats: ['markdown', 'links'] } },
            },
          })
        : Promise.resolve({ data: null, error: null });

      // === SEARCH 3: Product images from marketplaces ===
      const imageSearchPromise = supabase.functions.invoke('firecrawl-search', {
        body: {
          query: `"${searchTerm}" foto produto imagem`,
          options: { limit: 3, lang: 'pt-br', country: 'BR', scrapeOptions: { formats: ['markdown'] } },
        },
      });

      // Run all searches in parallel
      const [specResult, mfgResult, imgResult] = await Promise.all([
        specSearchPromise, manufacturerSearchPromise, imageSearchPromise,
      ]);

      // Aggregate scraped content
      let scrapedContent = '';
      let collectedImages: string[] = [];
      let manufacturerUrl = '';

      // Process spec results
      if (!specResult.error && specResult.data?.success && specResult.data?.data?.length > 0) {
        scrapedContent = specResult.data.data
          .slice(0, 2)
          .map((r: any) => r.markdown || r.description || '')
          .join('\n\n')
          .substring(0, 10000);
      }

      // Process manufacturer results (prioritize these images)
      if (!mfgResult.error && mfgResult.data?.success && mfgResult.data?.data?.length > 0) {
        const mfgData = mfgResult.data.data;
        // Get manufacturer URL
        manufacturerUrl = mfgData[0]?.url || '';
        // Extract content and append
        const mfgContent = mfgData
          .slice(0, 1)
          .map((r: any) => r.markdown || '')
          .join('\n')
          .substring(0, 5000);
        if (mfgContent) {
          scrapedContent += '\n\n--- SITE DO FABRICANTE ---\n' + mfgContent;
        }
      }

      // Extract image URLs from all markdown content using regex
      const allContent = [
        specResult.data?.data,
        mfgResult.data?.data,
        imgResult.data?.data,
      ]
        .filter(Boolean)
        .flat();

      for (const result of allContent) {
        if (!result) continue;
        const md = result.markdown || result.description || '';
        // Extract markdown image patterns: ![alt](url) and plain URLs ending in image extensions
        const imgRegex = /(?:!\[[^\]]*\]\(([^)]+)\))|(?:https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>]*)?)/gi;
        let match;
        while ((match = imgRegex.exec(md)) !== null) {
          const url = match[1] || match[0];
          if (isValidImageUrl(url)) {
            collectedImages.push(url);
          }
        }
        // Also check metadata for images
        if (result.metadata?.ogImage) collectedImages.push(result.metadata.ogImage);
      }

      // Deduplicate images, prioritize manufacturer domain
      const seen = new Set<string>();
      const mfgDomain = brandTerm ? brandTerm.toLowerCase().replace(/\s+/g, '') : '';
      collectedImages = collectedImages
        .filter(url => {
          const key = url.split('?')[0].toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .sort((a, b) => {
          // Manufacturer images first
          const aIsMfg = mfgDomain && a.toLowerCase().includes(mfgDomain) ? -1 : 0;
          const bIsMfg = mfgDomain && b.toLowerCase().includes(mfgDomain) ? -1 : 0;
          return aIsMfg - bIsMfg;
        })
        .slice(0, 6);

      // === AI: Extract structured specs with image context ===
      let specJson = '';
      await streamAIChat({
        messages: [{ role: 'user', content: `Produto: ${searchTerm}\n\nConteúdo extraído:\n${scrapedContent.substring(0, 15000) || 'Sem conteúdo. Use conhecimento público.'}\n\nImagens encontradas na web:\n${collectedImages.slice(0, 6).join('\n') || 'Nenhuma'}` }],
        action: 'extrair-spec-produto',
        context: `Você é um especialista em especificações técnicas de produtos para licitações públicas.

TAREFA: Extraia especificações técnicas REAIS e FIÉIS do produto baseando-se no conteúdo fornecido.

REGRAS CRÍTICAS:
- APENAS dados REAIS encontrados no conteúdo ou de conhecimento público verificável
- NÃO invente especificações. Se não encontrar, coloque "Consultar fabricante"
- NÃO inclua preços, valores ou custos em NENHUM campo
- Para imagens: SELECIONE APENAS URLs que mostrem o PRODUTO REAL (não logos, banners ou ícones)
- Priorize imagens do site do fabricante quando disponíveis
- Inclua o site oficial do fabricante se identificável

Responda APENAS em JSON válido, sem markdown:
{
  "nome": "nome completo e correto do produto",
  "descricao_detalhada": "descrição técnica sem preços",
  "especificacoes": [
    {"chave": "Dimensões", "valor": "..."},
    {"chave": "Peso", "valor": "..."},
    {"chave": "Material", "valor": "..."},
    {"chave": "Cor/Acabamento", "valor": "..."},
    {"chave": "Voltagem/Potência", "valor": "..."},
    {"chave": "Garantia", "valor": "..."},
    {"chave": "Certificações", "valor": "..."},
    {"chave": "NCM/Código", "valor": "..."}
  ],
  "imagens": ["url_imagem_real_do_produto_1", "url_imagem_real_2"],
  "marca": "marca real verificada",
  "modelo": "modelo real verificado",
  "categoria": "categoria do produto",
  "site_fabricante": "https://www.fabricante.com.br/produto ou null"
}`,
        onDelta: (d) => { specJson += d; },
        onDone: () => {},
        onError: () => {},
      });

      let clean = specJson.trim();
      if (clean.startsWith('```')) clean = clean.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      const parsed = JSON.parse(clean) as ProductSpec;

      // Merge AI-selected images with our scraped images (AI first, then scraped fallbacks)
      const aiImages = (parsed.imagens || []).filter(isValidImageUrl);
      const finalImages = [...new Set([...aiImages, ...collectedImages])].slice(0, 6);
      parsed.imagens = finalImages;

      // Ensure manufacturer URL
      if (!parsed.site_fabricante && manufacturerUrl) {
        parsed.site_fabricante = manufacturerUrl;
      }

      return parsed;
    } catch (e) {
      console.error('Spec error:', searchTerm, e);
      return {
        nome: item.descricao,
        descricao_detalhada: item.descricao,
        especificacoes: [],
        imagens: [],
        marca: item.marca || '',
        modelo: item.modelo || '',
        categoria: 'Geral',
      };
    }
  }, []);

  // ─── Generate ───
  const handleGenerate = async () => {
    if (items.length === 0) { toast.error('Nenhum item selecionado.'); return; }

    setIsGenerating(true);
    setStep('preview');
    setSpecs([]);

    try {
      const total = Math.min(items.length, 10);
      for (let i = 0; i < total; i++) {
        setProgressText(`Pesquisando: ${items[i].descricao.substring(0, 50)}...`);
        setProgressPercent(Math.round(((i + 1) / total) * 100));
        const spec = await searchProductSpecs(items[i]);
        setSpecs(prev => [...prev, spec]);
      }

      setProgressText('Concluído!');
      toast.success(`${total} produto(s) processado(s)!`);
    } catch (e) {
      console.error('Generation error:', e);
      toast.error('Erro ao gerar documento.');
    }

    setIsGenerating(false);
  };

  // ─── ABNT PDF Generation ───
  const generateABNTPDF = () => {
    if (specs.length === 0) { toast.error('Nenhuma especificação disponível.'); return; }

    const theme = COLOR_THEMES[colorTheme];
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = 210;
    const pageH = 297;
    // ABNT NBR 14724 margins: top 3cm, bottom 2cm, left 3cm, right 2cm
    const mTop = 30;
    const mBottom = 20;
    const mLeft = 30;
    const mRight = 20;
    const contentW = pageW - mLeft - mRight;
    let y = mTop;
    let pageNum = 0;

    const hexToRgb = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return [r, g, b] as [number, number, number];
    };

    const addPageNumber = () => {
      pageNum++;
      doc.setFontSize(10);
      doc.setTextColor(150);
      // ABNT: page number top-right, 2cm from top edge
      doc.text(String(pageNum), pageW - mRight, 15, { align: 'right' });
      doc.setTextColor(0);
    };

    const checkNewPage = (needed: number) => {
      if (y + needed > pageH - mBottom) {
        doc.addPage();
        y = mTop;
        addPageNumber();
      }
    };

    const drawLine = (yPos: number, color = theme.primary) => {
      const [r, g, b] = hexToRgb(color);
      doc.setDrawColor(r, g, b);
      doc.setLineWidth(0.5);
      doc.line(mLeft, yPos, pageW - mRight, yPos);
    };

    const writeText = (text: string, fontSize: number, options?: { bold?: boolean; color?: string; maxWidth?: number; align?: 'left' | 'center' | 'right' }) => {
      const { bold = false, color = '#000000', maxWidth = contentW, align = 'left' } = options || {};
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      const [r, g, b] = hexToRgb(color);
      doc.setTextColor(r, g, b);
      const lines = doc.splitTextToSize(text, maxWidth);
      const lineHeight = fontSize * 0.45;
      
      for (const line of lines) {
        checkNewPage(lineHeight + 2);
        let xPos = mLeft;
        if (align === 'center') xPos = pageW / 2;
        else if (align === 'right') xPos = pageW - mRight;
        doc.text(line, xPos, y, { align });
        y += lineHeight;
      }
      return lines.length;
    };

    // ══════════════════════════════════════
    // COVER PAGE
    // ══════════════════════════════════════
    const [pr, pg, pb] = hexToRgb(theme.primary);
    doc.setFillColor(pr, pg, pb);
    doc.rect(0, 0, pageW, 100, 'F');

    const [ar, ag, ab] = hexToRgb(theme.accent);
    doc.setFillColor(ar, ag, ab);
    doc.rect(0, 100, pageW, 4, 'F');

    // Title on cover
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    const title = docTitle || DOC_TYPES[docType].label;
    doc.text(title, pageW / 2, 50, { align: 'center' });

    if (docSubtitle) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(220, 220, 220);
      doc.text(docSubtitle, pageW / 2, 62, { align: 'center' });
    }

    // Company name
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 200, 200);
    doc.text(companyName || 'Documento Técnico', pageW / 2, 80, { align: 'center' });

    // Metadata block
    y = 120;
    doc.setTextColor(0);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

    const metaLines = [
      `Data de emissão: ${dateStr}`,
      `Total de produtos: ${specs.length}`,
      `Tipo: ${DOC_TYPES[docType].label}`,
      `Norma: ABNT NBR 14724:2011`,
    ];
    metaLines.forEach(line => {
      doc.text(line, mLeft, y);
      y += 6;
    });

    // Legal notice at bottom
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text(
      'Documento gerado conforme ABNT NBR 14724:2011. Especificações técnicas extraídas de fontes públicas. Não inclui informações de preço.',
      pageW / 2,
      pageH - 15,
      { align: 'center', maxWidth: contentW }
    );

    // ══════════════════════════════════════
    // TABLE OF CONTENTS (ABNT requirement)
    // ══════════════════════════════════════
    doc.addPage();
    y = mTop;
    addPageNumber();

    writeText('SUMÁRIO', 16, { bold: true, color: theme.primary, align: 'center' });
    y += 10;
    drawLine(y, theme.accent);
    y += 8;

    specs.forEach((spec, i) => {
      checkNewPage(8);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0);
      const itemLabel = `${i + 1}. ${spec.nome.substring(0, 70)}`;
      doc.text(itemLabel, mLeft, y);
      y += 6;
    });

    // ══════════════════════════════════════
    // PRODUCT PAGES
    // ══════════════════════════════════════
    specs.forEach((spec, idx) => {
      doc.addPage();
      y = mTop;
      addPageNumber();

      // Section header bar
      const [spr, spg, spb] = hexToRgb(theme.primary);
      doc.setFillColor(spr, spg, spb);
      doc.rect(mLeft, y - 5, contentW, 12, 'F');
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(`${idx + 1}. ${spec.nome.substring(0, 60)}`, mLeft + 3, y + 2);
      y += 14;

      // Meta badges
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const [acr, acg, acb] = hexToRgb(theme.accent);

      if (spec.marca) {
        doc.setTextColor(acr, acg, acb);
        doc.text(`Marca: ${spec.marca}`, mLeft, y);
      }
      if (spec.modelo) {
        doc.text(`Modelo: ${spec.modelo}`, mLeft + 50, y);
      }
      if (spec.categoria) {
        doc.text(`Categoria: ${spec.categoria}`, mLeft + 100, y);
      }
      y += 8;

      drawLine(y, theme.secondary);
      y += 6;

      // Description
      if (docType !== 'folder') {
        writeText('DESCRIÇÃO TÉCNICA', 11, { bold: true, color: theme.primary });
        y += 2;
        writeText(spec.descricao_detalhada || 'Consultar fabricante.', 9, { color: '#333333' });
        y += 6;
      } else {
        // Folder style: highlight benefits
        writeText('DESTAQUES DO PRODUTO', 11, { bold: true, color: theme.primary });
        y += 2;
        writeText(spec.descricao_detalhada || 'Consultar fabricante.', 10, { color: '#333333' });
        y += 6;
      }

      // Specifications table
      if (spec.especificacoes.length > 0) {
        writeText('ESPECIFICAÇÕES TÉCNICAS', 11, { bold: true, color: theme.primary });
        y += 4;

        const colKey = contentW * 0.4;
        const colVal = contentW * 0.6;

        // Table header
        checkNewPage(10);
        doc.setFillColor(spr, spg, spb);
        doc.rect(mLeft, y - 4, contentW, 7, 'F');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('Característica', mLeft + 2, y);
        doc.text('Especificação', mLeft + colKey + 2, y);
        y += 5;

        // Table rows
        spec.especificacoes.forEach((e, ri) => {
          checkNewPage(7);
          if (ri % 2 === 0) {
            const [bgr, bgg, bgb] = hexToRgb(theme.bg);
            doc.setFillColor(bgr, bgg, bgb);
            doc.rect(mLeft, y - 3.5, contentW, 6, 'F');
          }
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(50, 50, 50);
          doc.setFontSize(8.5);
          doc.text(e.chave.substring(0, 40), mLeft + 2, y);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(80, 80, 80);
          doc.text(e.valor.substring(0, 60), mLeft + colKey + 2, y);
          y += 6;
        });

        y += 4;
      }

      // Manufacturer site
      if (spec.site_fabricante) {
        checkNewPage(8);
        writeText('SITE DO FABRICANTE', 10, { bold: true, color: theme.secondary });
        y += 2;
        doc.setFontSize(8.5);
        const [acr2, acg2, acb2] = hexToRgb(theme.accent);
        doc.setTextColor(acr2, acg2, acb2);
        doc.textWithLink(`🌐 ${spec.site_fabricante.substring(0, 90)}`, mLeft, y, { url: spec.site_fabricante });
        y += 6;
      }

      // Images section (URLs in PDF)
      if (spec.imagens.length > 0) {
        checkNewPage(16);
        writeText('REFERÊNCIAS VISUAIS DO PRODUTO', 10, { bold: true, color: theme.secondary });
        y += 2;
        doc.setFontSize(7.5);
        doc.setTextColor(100, 100, 100);
        doc.setFont('helvetica', 'italic');
        doc.text('Imagens autênticas extraídas de fontes públicas e sites de fabricantes:', mLeft, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        spec.imagens.slice(0, 5).forEach((url, imgIdx) => {
          checkNewPage(5);
          const label = url.toLowerCase().includes(spec.marca?.toLowerCase() || '___')
            ? `📷 [Fabricante] ${url.substring(0, 85)}`
            : `📷 [Fonte ${imgIdx + 1}] ${url.substring(0, 85)}`;
          doc.textWithLink(label, mLeft, y, { url });
          y += 4;
        });
        y += 4;
      }

      // Separator
      if (idx < specs.length - 1) {
        checkNewPage(6);
        drawLine(y, theme.accent);
        y += 4;
      }
    });

    // ══════════════════════════════════════
    // SUMMARY TABLE (last page)
    // ══════════════════════════════════════
    if (docType === 'catalogo' && specs.length > 1) {
      doc.addPage();
      y = mTop;
      addPageNumber();

      writeText('QUADRO RESUMO', 14, { bold: true, color: theme.primary, align: 'center' });
      y += 6;
      drawLine(y, theme.accent);
      y += 6;

      // Header
      const cols = [8, 70, 35, 30, 17];
      const [hpr, hpg, hpb] = hexToRgb(theme.primary);
      doc.setFillColor(hpr, hpg, hpb);
      doc.rect(mLeft, y - 4, contentW, 7, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      let xOff = mLeft + 2;
      ['Nº', 'Produto', 'Marca', 'Modelo', 'Cat.'].forEach((h, hi) => {
        doc.text(h, xOff, y);
        xOff += cols[hi];
      });
      y += 5;

      // Rows
      specs.forEach((spec, i) => {
        checkNewPage(7);
        if (i % 2 === 0) {
          doc.setFillColor(245, 245, 245);
          doc.rect(mLeft, y - 3.5, contentW, 6, 'F');
        }
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50, 50, 50);
        doc.setFontSize(7.5);
        xOff = mLeft + 2;
        [
          String(i + 1),
          spec.nome.substring(0, 45),
          (spec.marca || '—').substring(0, 20),
          (spec.modelo || '—').substring(0, 18),
          spec.categoria.substring(0, 10),
        ].forEach((val, vi) => {
          doc.text(val, xOff, y);
          xOff += cols[vi];
        });
        y += 6;
      });
    }

    // ══════════════════════════════════════
    // FOOTER (ABNT compliance note)
    // ══════════════════════════════════════
    doc.addPage();
    y = mTop;
    addPageNumber();
    writeText('INFORMAÇÕES COMPLEMENTARES', 14, { bold: true, color: theme.primary, align: 'center' });
    y += 10;
    writeText(
      'Este documento foi elaborado em conformidade com a ABNT NBR 14724:2011, que estabelece os princípios gerais para a elaboração de trabalhos acadêmicos e documentos técnicos.',
      9, { color: '#555555' }
    );
    y += 6;
    writeText(
      'As especificações técnicas apresentadas foram obtidas a partir de fontes públicas disponíveis na internet, incluindo sites de fabricantes, distribuidores e marketplaces. As informações são de natureza exclusivamente técnica e não contemplam valores comerciais ou de mercado.',
      9, { color: '#555555' }
    );
    y += 6;
    writeText(
      'Documento adequado para instrução de processos licitatórios conforme a Lei Federal nº 14.133/2021 (Nova Lei de Licitações e Contratos Administrativos).',
      9, { color: '#555555' }
    );
    y += 10;
    writeText(`Gerado em: ${now.toLocaleString('pt-BR')}`, 8, { color: '#999999' });

    // Save
    const filename = `${(docTitle || DOC_TYPES[docType].label).toLowerCase().replace(/\s+/g, '-')}-${now.toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
    toast.success('PDF ABNT baixado com sucesso!');
  };

  // ─── Template Card Component ───
  const TemplateCard = ({ type, selected, onClick }: { type: DocType; selected: boolean; onClick: () => void }) => {
    const info = DOC_TYPES[type];
    const Icon = info.icon;
    return (
      <button
        onClick={onClick}
        className={`relative flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all duration-200 hover:shadow-lg ${
          selected
            ? 'border-accent bg-accent/10 shadow-md ring-2 ring-accent/30'
            : 'border-border/50 bg-card hover:border-accent/40'
        }`}
      >
        {selected && (
          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
            <span className="text-accent-foreground text-[10px] font-bold">✓</span>
          </div>
        )}
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${selected ? 'bg-accent/20' : 'bg-muted/50'}`}>
          <Icon className={`w-7 h-7 ${selected ? 'text-accent' : 'text-muted-foreground'}`} />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold">{info.label}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{info.desc}</p>
        </div>
      </button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetState(); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] p-0 overflow-hidden">
        <ScrollArea className="max-h-[90vh]">
          <div className="p-6 space-y-5">
            {/* Header */}
            <DialogHeader>
              <DialogTitle className="text-base font-semibold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent" />
                Gerador de Documentos — Estilo Canva + ABNT
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Crie fichas técnicas, folders e catálogos profissionais com dados reais da internet. Conforme ABNT NBR 14724.
              </p>
            </DialogHeader>

            {/* Step indicator */}
            <div className="flex items-center gap-2">
              {(['template', 'customize', 'preview'] as const).map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    step === s ? 'bg-accent text-accent-foreground' :
                    (['template', 'customize', 'preview'].indexOf(step) > i) ? 'bg-accent/30 text-accent' : 'bg-muted text-muted-foreground'
                  }`}>
                    {i + 1}
                  </div>
                  <span className={`text-xs font-medium ${step === s ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {s === 'template' ? 'Modelo' : s === 'customize' ? 'Personalizar' : 'Gerar & Baixar'}
                  </span>
                  {i < 2 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                </div>
              ))}
            </div>

            {/* ═══ STEP 1: Template Selection ═══ */}
            {step === 'template' && (
              <div className="space-y-5">
                {/* Document type */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-3 block">ESCOLHA O TIPO DE DOCUMENTO</label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['ficha', 'folder', 'catalogo'] as DocType[]).map(t => (
                      <TemplateCard key={t} type={t} selected={docType === t} onClick={() => setDocType(t)} />
                    ))}
                  </div>
                </div>

                {/* Color theme */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5" /> PALETA DE CORES
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(Object.entries(COLOR_THEMES) as [ColorTheme, typeof COLOR_THEMES[ColorTheme]][]).map(([key, th]) => (
                      <button
                        key={key}
                        onClick={() => setColorTheme(key)}
                        className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                          colorTheme === key ? 'border-accent bg-accent/5' : 'border-border/40 hover:border-accent/30'
                        }`}
                      >
                        <div className="flex gap-0.5">
                          <div className="w-4 h-4 rounded-full" style={{ background: th.primary }} />
                          <div className="w-4 h-4 rounded-full" style={{ background: th.accent }} />
                        </div>
                        <span className="text-xs font-medium">{th.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Items preview */}
                <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-primary" />
                    <span className="text-xs font-semibold">{items.length} produto(s) selecionado(s)</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {items.slice(0, 8).map((item, i) => (
                      <Badge key={item.id} variant="outline" className="text-[9px] max-w-[200px] truncate">
                        {i + 1}. {item.descricao.substring(0, 35)}
                      </Badge>
                    ))}
                    {items.length > 8 && <Badge variant="secondary" className="text-[9px]">+{items.length - 8} mais</Badge>}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => setStep('customize')} disabled={items.length === 0}>
                    Próximo <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* ═══ STEP 2: Customize ═══ */}
            {step === 'customize' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold">Nome da Empresa (capa)</label>
                    <Input
                      placeholder="Sua Empresa LTDA"
                      value={companyName}
                      onChange={e => setCompanyName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold">Título do Documento</label>
                    <Input
                      placeholder={DOC_TYPES[docType].label}
                      value={docTitle}
                      onChange={e => setDocTitle(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold">Subtítulo (opcional)</label>
                  <Input
                    placeholder="Ex: Materiais de Informática — Pregão nº 001/2026"
                    value={docSubtitle}
                    onChange={e => setDocSubtitle(e.target.value)}
                  />
                </div>

                {/* Preview mockup */}
                <div className="border border-border/50 rounded-xl p-4">
                  <label className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" /> PRÉ-VISUALIZAÇÃO DA CAPA
                  </label>
                  <div className="w-full max-w-[280px] mx-auto aspect-[210/297] rounded-lg overflow-hidden shadow-lg border border-border/30">
                    <div className="h-[35%] flex flex-col items-center justify-center px-4" style={{ background: COLOR_THEMES[colorTheme].primary }}>
                      <p className="text-white text-sm font-bold text-center leading-tight">
                        {docTitle || DOC_TYPES[docType].label}
                      </p>
                      {docSubtitle && <p className="text-white/70 text-[8px] text-center mt-1">{docSubtitle}</p>}
                      <p className="text-white/50 text-[7px] mt-2">{companyName || 'Documento Técnico'}</p>
                    </div>
                    <div className="h-[2%]" style={{ background: COLOR_THEMES[colorTheme].accent }} />
                    <div className="h-[63%] bg-white p-3 flex flex-col justify-between">
                      <div className="space-y-1.5">
                        {[
                          `Data: ${new Date().toLocaleDateString('pt-BR')}`,
                          `Produtos: ${items.length}`,
                          `Tipo: ${DOC_TYPES[docType].label}`,
                          `Norma: ABNT NBR 14724`,
                        ].map((l, i) => (
                          <p key={i} className="text-[7px] text-gray-500">{l}</p>
                        ))}
                      </div>
                      <p className="text-[5px] text-gray-300 text-center">Conforme ABNT NBR 14724:2011</p>
                    </div>
                  </div>
                </div>

                <div className="bg-accent/5 border border-accent/20 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-semibold text-foreground">🔍 O que acontece ao gerar:</p>
                  <p>1. A IA pesquisa especificações técnicas reais na internet para cada produto</p>
                  <p>2. Extrai dados fiéis: dimensões, materiais, garantia, certificações</p>
                  <p>3. Monta o documento no formato escolhido, <strong>sem incluir preços</strong></p>
                  <p>4. Gera PDF conforme ABNT NBR 14724 (margens, paginação, sumário)</p>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep('template')}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
                  </Button>
                  <Button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="bg-accent hover:bg-accent/90 text-accent-foreground"
                  >
                    {isGenerating ? (
                      <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Gerando...</>
                    ) : (
                      <><Sparkles className="w-4 h-4 mr-1" /> Gerar Documento</>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* ═══ STEP 3: Preview & Download ═══ */}
            {step === 'preview' && (
              <div className="space-y-4">
                {/* Progress */}
                {isGenerating && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{progressText}</span>
                      <span className="font-semibold text-accent">{progressPercent}%</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Results */}
                {specs.length > 0 && (
                  <>
                    <div className="flex items-center justify-between">
                      <Badge className="bg-accent/15 text-accent border-accent/30">
                        {specs.length} produto(s) processado(s)
                      </Badge>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={resetState}>
                          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Novo
                        </Button>
                        <Button
                          size="sm"
                          onClick={generateABNTPDF}
                          disabled={isGenerating}
                          className="bg-accent hover:bg-accent/90 text-accent-foreground"
                        >
                          <Download className="w-3.5 h-3.5 mr-1" /> Baixar PDF (ABNT)
                        </Button>
                      </div>
                    </div>

                    {/* Product cards preview */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {specs.map((spec, i) => (
                        <div
                          key={i}
                          className="border border-border/40 rounded-xl p-4 bg-card hover:shadow-md transition-shadow"
                        >
                          {/* Image gallery */}
                          {spec.imagens.length > 0 && (
                            <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
                              {spec.imagens.slice(0, 4).map((img, imgIdx) => (
                                <div key={imgIdx} className="w-14 h-14 rounded-lg border border-border/30 overflow-hidden shrink-0 bg-muted/10">
                                  <img
                                    src={img}
                                    alt={`${spec.nome} ${imgIdx + 1}`}
                                    className="w-full h-full object-contain p-0.5"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                          {spec.imagens.length === 0 && (
                            <div className="w-full h-14 rounded-lg border border-border/30 flex items-center justify-center bg-muted/20 mb-3">
                              <Package className="w-5 h-5 text-muted-foreground/30" />
                              <span className="text-[9px] text-muted-foreground/50 ml-1.5">Sem imagens</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate">{spec.nome}</p>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {spec.marca && <Badge variant="outline" className="text-[8px]">{spec.marca}</Badge>}
                              {spec.modelo && <Badge variant="outline" className="text-[8px]">{spec.modelo}</Badge>}
                              <Badge variant="secondary" className="text-[8px]">{spec.categoria}</Badge>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{spec.descricao_detalhada}</p>
                            <div className="flex items-center gap-3 mt-1.5">
                              {spec.especificacoes.length > 0 && (
                                <span className="text-[9px] text-accent font-medium">
                                  {spec.especificacoes.length} especificações
                                </span>
                              )}
                              {spec.imagens.length > 0 && (
                                <span className="text-[9px] text-primary font-medium">
                                  📷 {spec.imagens.length} imagens
                                </span>
                              )}
                              {spec.site_fabricante && (
                                <a
                                  href={spec.site_fabricante}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[9px] text-accent underline hover:no-underline"
                                >
                                  🌐 Fabricante
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {!isGenerating && specs.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhuma especificação gerada.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
