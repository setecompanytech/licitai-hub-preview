import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Search, ArrowLeft, HelpCircle } from 'lucide-react';
import PraefectusLogo from '@/components/shared/PraefectusLogo';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

type FaqItem = { id: string; pergunta: string; resposta: string; categoria: string };

export default function FaqPage() {
  const navigate = useNavigate();
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [search, setSearch] = useState('');
  const [catAtiva, setCatAtiva] = useState('todas');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('faq').select('*').eq('ativo', true).order('ordem').then(({ data }) => {
      if (data) setFaqs(data);
    });
  }, []);

  const categorias = ['todas', ...Array.from(new Set(faqs.map(f => f.categoria)))];
  const filtered = faqs.filter(f => {
    const matchCat = catAtiva === 'todas' || f.categoria === catAtiva;
    const matchSearch = !search || f.pergunta.toLowerCase().includes(search.toLowerCase()) || f.resposta.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Topbar branca do padrão: sem vidro, só o fio embaixo. */}
      <nav className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-2 rounded-md text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Voltar ao início"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> <PraefectusLogo size="sm" />
          </button>
          <Button size="sm" onClick={() => navigate('/auth')}>Acessar Sistema</Button>
        </div>
      </nav>

      {/* Largura de leitura: cabeçalho padrão, busca larga, chips de categoria
          em botão tonal e a lista de perguntas em Accordion dentro de um cartão. */}
      <div className="mx-auto max-w-3xl px-6 py-8">
        <CabecalhoPagina
          titulo="Perguntas Frequentes"
          descricao="Encontre respostas para suas dúvidas sobre o PRAEFECTUS"
          icone={<HelpCircle />}
          filtros={
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input placeholder="Buscar perguntas..." aria-label="Buscar perguntas" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
          }
        />

        <div className="mb-6 flex flex-wrap gap-1">
          {categorias.map(c => (
            <Button
              key={c}
              type="button"
              size="sm"
              variant={catAtiva === c ? 'secondary' : 'ghost'}
              aria-pressed={catAtiva === c}
              onClick={() => setCatAtiva(c)}
              className="capitalize"
            >
              {c}
            </Button>
          ))}
        </div>

        <div className="rounded-lg border border-border bg-card px-5 shadow-sm">
          {filtered.length === 0 && (
            <EstadoVazio tamanho="compacto" icone={<Search />} titulo="Nenhuma pergunta encontrada." />
          )}
          <Accordion
            type="single"
            collapsible
            value={openId ?? ''}
            onValueChange={(v) => setOpenId(v || null)}
          >
            {filtered.map(faq => (
              <AccordionItem key={faq.id} value={faq.id} className="last:border-0">
                <AccordionTrigger className="py-4 text-base">{faq.pergunta}</AccordionTrigger>
                <AccordionContent className="text-sm leading-5 text-muted-foreground">{faq.resposta}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  );
}
