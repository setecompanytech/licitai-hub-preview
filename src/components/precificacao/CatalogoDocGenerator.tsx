import { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import EstadoVazio from '@/components/shared/EstadoVazio';
import SeloPraefectusIA from '@/components/shared/SeloPraefectusIA';
import {
  FileText, BookOpen, Layout, Loader2, Download, Sparkles,
  Package, Image as ImageIcon, ClipboardList, RefreshCw, Palette,
  Eye, ChevronLeft, ChevronRight, Settings2, Factory
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

// ─── Admin-managed manufacturer sources type ───
interface FonteFabricante {
  id: string;
  nome: string;
  url_base: string;
  categoria: string;
  palavras_chave: string[];
  prioridade: number;
}

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
  const [fontesFabricantes, setFontesFabricantes] = useState<FonteFabricante[]>([]);

  // Load admin-managed manufacturer sources
  useEffect(() => {
    if (open) {
      supabase
        .from('fontes_fabricantes')
        .select('id, nome, url_base, categoria, palavras_chave, prioridade')
        .eq('ativo', true)
        .order('prioridade', { ascending: false })
        .then(({ data }) => {
          setFontesFabricantes((data || []) as unknown as FonteFabricante[]);
        });
    }
  }, [open]);

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

  // ─── Spec Search (Enhanced with admin sources + manufacturer site + real images) ───
  const searchProductSpecs = useCallback(async (item: CatalogoItem): Promise<ProductSpec> => {
    const searchTerm = [item.descricao, item.marca, item.modelo].filter(Boolean).join(' ').substring(0, 150);
    const brandTerm = item.marca || item.fabricante || '';
    const descLower = item.descricao.toLowerCase();

    // Find matching admin-managed sources by brand name or keywords
    const matchedSources = fontesFabricantes.filter(f => {
      const nameMatch = brandTerm && f.nome.toLowerCase().includes(brandTerm.toLowerCase());
      const kwMatch = (f.palavras_chave || []).some(kw => descLower.includes(kw.toLowerCase()));
      return nameMatch || kwMatch;
    }).sort((a, b) => b.prioridade - a.prioridade);

    try {
      // === SEARCH 1: Technical specs from general sources ===
      const specSearchPromise = supabase.functions.invoke('firecrawl-search', {
        body: {
          query: `"${searchTerm}" especificações técnicas ficha técnica`,
          options: { limit: 3, lang: 'pt-br', country: 'BR', scrapeOptions: { formats: ['markdown'] } },
        },
      });

      // === SEARCH 2: Admin-managed manufacturer sources (priority) OR brand fallback ===
      let manufacturerSearchPromise: Promise<any>;
      if (matchedSources.length > 0) {
        // Use admin-configured sources — search directly on their domains
        const siteQueries = matchedSources.slice(0, 3).map(s => {
          const domain = s.url_base.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
          return `site:${domain}`;
        }).join(' OR ');
        manufacturerSearchPromise = supabase.functions.invoke('firecrawl-search', {
          body: {
            query: `(${siteQueries}) "${item.descricao}" produto`,
            options: { limit: 3, lang: 'pt-br', country: 'BR', scrapeOptions: { formats: ['markdown', 'links'] } },
          },
        });
      } else if (brandTerm) {
        manufacturerSearchPromise = supabase.functions.invoke('firecrawl-search', {
          body: {
            query: `site:${brandTerm.toLowerCase().replace(/\s+/g, '')}.com.br OR site:${brandTerm.toLowerCase().replace(/\s+/g, '')}.com "${item.descricao}" produto`,
            options: { limit: 2, lang: 'pt-br', country: 'BR', scrapeOptions: { formats: ['markdown', 'links'] } },
          },
        });
      } else {
        manufacturerSearchPromise = Promise.resolve({ data: null, error: null });
      }

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

      // Ensure manufacturer URL from admin sources or scraped data
      if (!parsed.site_fabricante) {
        if (matchedSources.length > 0) {
          parsed.site_fabricante = matchedSources[0].url_base;
        } else if (manufacturerUrl) {
          parsed.site_fabricante = manufacturerUrl;
        }
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
  }, [fontesFabricantes]);

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
      /* Cartão de escolha: raio 10px, borda de 1px; o escolhido acende a
         tinta da ação com um anel fino (não `border-2` nem sombra pesada). */
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        className={`relative flex flex-col items-center gap-3 rounded-lg border p-5 transition-[border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          selected
            ? 'border-primary bg-primary-tint ring-1 ring-primary/30'
            : 'border-border bg-card shadow-sm hover:border-primary/40 hover:shadow-md'
        }`}
      >
        {selected && (
          <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-sm bg-primary" aria-hidden="true">
            <span className="text-xs font-semibold text-primary-foreground">✓</span>
          </div>
        )}
        <div className={`flex h-14 w-14 items-center justify-center rounded-md ${selected ? 'bg-card' : 'bg-muted'}`}>
          <Icon className={`h-7 w-7 ${selected ? 'text-primary' : 'text-muted-foreground'}`} aria-hidden="true" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">{info.label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{info.desc}</p>
        </div>
      </button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetState(); }}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden p-0">
        <ScrollArea className="max-h-[90vh]">
          <div className="space-y-5 p-6">
            {/* Header — gerador com IA: leva o selo "Praefectus IA". */}
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                <Sparkles className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                Gerador de Documentos — Estilo Canva + ABNT
                <SeloPraefectusIA />
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                Crie fichas técnicas, folders e catálogos profissionais com dados reais da internet. Conforme ABNT NBR 14724.
              </p>
            </DialogHeader>

            {/* Step indicator */}
            <div className="flex flex-wrap items-center gap-2">
              {(['template', 'customize', 'preview'] as const).map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold transition-colors ${
                    step === s ? 'bg-primary text-primary-foreground' :
                    (['template', 'customize', 'preview'].indexOf(step) > i) ? 'bg-primary-tint text-primary' : 'bg-muted text-muted-foreground'
                  }`} aria-current={step === s ? 'step' : undefined}>
                    {i + 1}
                  </div>
                  <span className={`text-sm font-medium ${step === s ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {s === 'template' ? 'Modelo' : s === 'customize' ? 'Personalizar' : 'Gerar & Baixar'}
                  </span>
                  {i < 2 && <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                </div>
              ))}
            </div>

            {/* ═══ STEP 1: Template Selection ═══ */}
            {step === 'template' && (
              <div className="space-y-5">
                {/* Document type */}
                <div>
                  <p className="mb-3 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">ESCOLHA O TIPO DE DOCUMENTO</p>
                  <div className="grid gap-3 sm:grid-cols-3" role="group" aria-label="Tipo de documento">
                    {(['ficha', 'folder', 'catalogo'] as DocType[]).map(t => (
                      <TemplateCard key={t} type={t} selected={docType === t} onClick={() => setDocType(t)} />
                    ))}
                  </div>
                </div>

                {/* Color theme — as amostras são as cores do DOCUMENTO gerado
                    (papel), por isso continuam vindo do tema, não de token. */}
                <div>
                  <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Palette className="h-3.5 w-3.5" aria-hidden="true" /> PALETA DE CORES
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Paleta de cores do documento">
                    {(Object.entries(COLOR_THEMES) as [ColorTheme, typeof COLOR_THEMES[ColorTheme]][]).map(([key, th]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setColorTheme(key)}
                        aria-pressed={colorTheme === key}
                        className={`flex items-center gap-2 rounded-md border p-3 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          colorTheme === key ? 'border-primary bg-primary-tint' : 'border-border bg-card hover:border-primary/40'
                        }`}
                      >
                        <div className="flex gap-0.5" aria-hidden="true">
                          <div className="h-4 w-4 rounded-full" style={{ background: th.primary }} />
                          <div className="h-4 w-4 rounded-full" style={{ background: th.accent }} />
                        </div>
                        <span className="text-sm font-medium text-foreground">{th.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Items preview */}
                <div className="space-y-2 rounded-md border border-border bg-secondary p-4">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <span className="text-sm font-semibold text-foreground tabular-nums">{items.length} produto(s) selecionado(s)</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {items.slice(0, 8).map((item, i) => (
                      <Badge key={item.id} variant="outline" className="max-w-[200px]" truncate>
                        {i + 1}. {item.descricao.substring(0, 35)}
                      </Badge>
                    ))}
                    {items.length > 8 && <Badge variant="secondary" className="tabular-nums">+{items.length - 8} mais</Badge>}
                  </div>
                </div>

                {/* Admin sources indicator */}
                {fontesFabricantes.length > 0 && (
                  <div className="space-y-1 rounded-md border border-primary-line bg-primary-tint p-3 text-sm">
                    <p className="flex items-center gap-1.5 font-semibold text-foreground">
                      <Factory className="h-4 w-4 text-primary" aria-hidden="true" />
                      {fontesFabricantes.length} fonte(s) de fabricantes configuradas
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {fontesFabricantes.slice(0, 10).map(f => (
                        <Badge key={f.id} variant="outline">{f.nome}</Badge>
                      ))}
                      {fontesFabricantes.length > 10 && (
                        <Badge variant="secondary" className="tabular-nums">+{fontesFabricantes.length - 10}</Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground">A IA priorizará buscas nos sites oficiais destes fabricantes.</p>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button onClick={() => setStep('customize')} disabled={items.length === 0}>
                    Próximo <ChevronRight aria-hidden="true" />
                  </Button>
                </div>
              </div>
            )}

            {/* ═══ STEP 2: Customize — rótulo acima, campos de 40px, grade que colapsa. ═══ */}
            {step === 'customize' && (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="catdoc-empresa">Nome da Empresa (capa)</Label>
                    <Input
                      id="catdoc-empresa"
                      placeholder="Sua Empresa LTDA"
                      value={companyName}
                      onChange={e => setCompanyName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="catdoc-titulo">Título do Documento</Label>
                    <Input
                      id="catdoc-titulo"
                      placeholder={DOC_TYPES[docType].label}
                      value={docTitle}
                      onChange={e => setDocTitle(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="catdoc-subtitulo">Subtítulo (opcional)</Label>
                  <Input
                    id="catdoc-subtitulo"
                    placeholder="Ex: Materiais de Informática — Pregão nº 001/2026"
                    value={docSubtitle}
                    onChange={e => setDocSubtitle(e.target.value)}
                  />
                </div>

                {/* Preview mockup — a capa é o DOCUMENTO (papel): as cores dela
                    ficam como estão; só a moldura da tela entra no padrão. */}
                <div className="rounded-lg border border-border p-4">
                  <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" /> PRÉ-VISUALIZAÇÃO DA CAPA
                  </p>
                  <div className="w-full max-w-[280px] mx-auto aspect-[210/297] rounded-lg overflow-hidden shadow-lg border border-border/30">
                    <div className="h-[35%] flex flex-col items-center justify-center px-4" style={{ background: COLOR_THEMES[colorTheme].primary }}>
                      <p className="text-white text-sm font-bold text-center leading-tight">
                        {docTitle || DOC_TYPES[docType].label}
                      </p>
                      {docSubtitle && <p className="text-white/70 text-xs text-center mt-1">{docSubtitle}</p>}
                      <p className="text-white/50 text-xs mt-2">{companyName || 'Documento Técnico'}</p>
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
                          <p key={i} className="text-xs text-gray-500">{l}</p>
                        ))}
                      </div>
                      <p className="text-[5px] text-gray-300 text-center">Conforme ABNT NBR 14724:2011</p>
                    </div>
                  </div>
                </div>

                {/* Bloco de IA: superfície tingida da ação. */}
                <div className="space-y-1 rounded-md border border-primary-line bg-primary-tint p-3 text-sm text-muted-foreground">
                  <p className="font-semibold text-foreground">🔍 O que acontece ao gerar:</p>
                  <p>1. A IA pesquisa especificações técnicas reais na internet para cada produto</p>
                  <p>2. Extrai dados fiéis: dimensões, materiais, garantia, certificações</p>
                  <p>3. Monta o documento no formato escolhido, <strong>sem incluir preços</strong></p>
                  <p>4. Gera PDF conforme ABNT NBR 14724 (margens, paginação, sumário)</p>
                </div>

                <div className="flex flex-wrap justify-between gap-2">
                  <Button variant="outline" onClick={() => setStep('template')}>
                    <ChevronLeft aria-hidden="true" /> Voltar
                  </Button>
                  <Button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <><Loader2 className="animate-spin" aria-hidden="true" /> Gerando...</>
                    ) : (
                      <><Sparkles aria-hidden="true" /> Gerar Documento</>
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
                  <div className="space-y-2" role="status" aria-live="polite">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{progressText}</span>
                      <span className="font-semibold tabular-nums text-primary">{progressPercent}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-sm bg-muted">
                      <div
                        className="h-full rounded-sm bg-primary transition-[width] duration-500"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Results */}
                {specs.length > 0 && (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge variant="success" className="tabular-nums">
                        {specs.length} produto(s) processado(s)
                      </Badge>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={resetState}>
                          <RefreshCw aria-hidden="true" /> Novo
                        </Button>
                        <Button
                          size="sm"
                          onClick={generateABNTPDF}
                          disabled={isGenerating}
                        >
                          <Download aria-hidden="true" /> Baixar PDF (ABNT)
                        </Button>
                      </div>
                    </div>

                    {/* Product cards preview — cartões compactos do DS. */}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {specs.map((spec, i) => (
                        <div
                          key={i}
                          className="rounded-lg border border-border bg-card p-4 shadow-sm"
                        >
                          {/* Image gallery */}
                          {spec.imagens.length > 0 && (
                            <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
                              {spec.imagens.slice(0, 4).map((img, imgIdx) => (
                                <div key={imgIdx} className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border bg-secondary">
                                  <img
                                    src={img}
                                    alt={`${spec.nome} ${imgIdx + 1}`}
                                    className="h-full w-full object-contain p-0.5"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                          {spec.imagens.length === 0 && (
                            <div className="mb-3 flex h-14 w-full items-center justify-center rounded-md border border-dashed border-border bg-secondary">
                              <Package className="h-5 w-5 text-foreground-tertiary" aria-hidden="true" />
                              <span className="ml-1.5 text-xs text-muted-foreground">Sem imagens</span>
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">{spec.nome}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              {spec.marca && <Badge variant="outline">{spec.marca}</Badge>}
                              {spec.modelo && <Badge variant="outline">{spec.modelo}</Badge>}
                              <Badge variant="secondary">{spec.categoria}</Badge>
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{spec.descricao_detalhada}</p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-3">
                              {spec.especificacoes.length > 0 && (
                                <span className="text-xs font-medium text-muted-foreground tabular-nums">
                                  {spec.especificacoes.length} especificações
                                </span>
                              )}
                              {spec.imagens.length > 0 && (
                                <span className="text-xs font-medium text-muted-foreground tabular-nums">
                                  📷 {spec.imagens.length} imagens
                                </span>
                              )}
                              {spec.site_fabricante && (
                                <a
                                  href={spec.site_fabricante}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded-sm text-xs text-primary underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                  <EstadoVazio tamanho="compacto" icone={<Package />} titulo="Nenhuma especificação gerada." />
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
