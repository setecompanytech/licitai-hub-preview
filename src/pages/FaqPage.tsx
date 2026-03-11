import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ChevronRight, Search, Zap, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

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
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate('/landing')} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> <Zap className="w-5 h-5 text-accent" /> <span className="font-brand font-bold tracking-widest uppercase">PRAEFECTUS</span>
          </button>
          <Button size="sm" onClick={() => navigate('/auth')}>Acessar Sistema</Button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Perguntas Frequentes</h1>
        <p className="text-muted-foreground mb-8">Encontre respostas para suas dúvidas sobre o Praefectus</p>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar perguntas..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>

        <div className="flex gap-2 flex-wrap mb-8">
          {categorias.map(c => (
            <button
              key={c}
              onClick={() => setCatAtiva(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize ${catAtiva === c ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-12">Nenhuma pergunta encontrada.</p>}
          {filtered.map(faq => (
            <div key={faq.id} className="bg-card rounded-xl border border-border/50 overflow-hidden">
              <button onClick={() => setOpenId(openId === faq.id ? null : faq.id)} className="w-full flex items-center justify-between p-5 text-left">
                <span className="font-medium pr-4">{faq.pergunta}</span>
                <ChevronRight className={`w-5 h-5 text-muted-foreground flex-shrink-0 transition-transform ${openId === faq.id ? 'rotate-90' : ''}`} />
              </button>
              {openId === faq.id && (
                <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed border-t border-border/50 pt-4">{faq.resposta}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
