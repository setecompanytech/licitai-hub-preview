import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Check, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

type Plano = {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  preco_mensal: number;
  preco_anual: number | null;
  recursos: string[];
  destaque: boolean;
};

export default function PlanosSection() {
  const navigate = useNavigate();
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [anual, setAnual] = useState(false);

  useEffect(() => {
    supabase.from('planos').select('*').eq('ativo', true).order('preco_mensal').then(({ data }) => {
      if (data) setPlanos(data.map(p => ({ ...p, recursos: (p.recursos as any) || [] })));
    });
  }, []);

  return (
    <section id="planos" className="py-24 px-6 bg-muted/20">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="text-sm font-semibold text-accent uppercase tracking-widest mb-3">Planos & Preços</p>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">
              Invista no seu <span className="gradient-text">sucesso</span>
            </h2>
            <p className="text-muted-foreground text-lg mb-8">Escolha o plano ideal para o tamanho da sua operação</p>

            <div className="inline-flex items-center gap-1 bg-card rounded-full p-1 border border-border/50">
              <button
                onClick={() => setAnual(false)}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${!anual ? 'bg-accent text-accent-foreground shadow-sm' : 'text-muted-foreground'}`}
              >
                Mensal
              </button>
              <button
                onClick={() => setAnual(true)}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${anual ? 'bg-accent text-accent-foreground shadow-sm' : 'text-muted-foreground'}`}
              >
                Anual <span className="text-xs opacity-80 ml-1">(-17%)</span>
              </button>
            </div>
          </motion.div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {planos.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`relative bg-card rounded-2xl border p-8 flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                p.destaque ? 'border-accent ring-2 ring-accent/20' : 'border-border/40'
              }`}
              style={p.destaque ? { boxShadow: 'var(--shadow-glow)' } : undefined}
            >
              {p.destaque && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-5 py-1 bg-accent text-accent-foreground text-xs font-extrabold rounded-full tracking-wide">
                  MAIS POPULAR
                </div>
              )}
              <h3 className="text-xl font-extrabold mb-1">{p.nome}</h3>
              <p className="text-sm text-muted-foreground mb-6">{p.descricao}</p>
              <div className="mb-6">
                <span className="text-4xl font-extrabold">
                  R$ {anual && p.preco_anual ? Math.round(p.preco_anual / 12) : p.preco_mensal}
                </span>
                <span className="text-muted-foreground text-sm">/mês</span>
                {anual && p.preco_anual && (
                  <p className="text-xs text-muted-foreground mt-1">Cobrado R$ {p.preco_anual}/ano</p>
                )}
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {p.recursos.map((r: string) => (
                  <li key={r} className="flex items-start gap-2.5 text-sm">
                    <Check className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
              <Button
                className={`w-full rounded-xl ${p.destaque ? 'bg-accent hover:bg-accent/90 text-accent-foreground' : ''}`}
                variant={p.destaque ? 'default' : 'outline'}
                onClick={() => navigate('/auth')}
              >
                Começar Agora <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
