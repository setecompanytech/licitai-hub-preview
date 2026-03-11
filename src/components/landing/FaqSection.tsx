import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ChevronDown, ArrowRight, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

type FaqItem = { id: string; pergunta: string; resposta: string };

export default function FaqSection() {
  const navigate = useNavigate();
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('faq').select('*').eq('ativo', true).order('ordem').limit(6).then(({ data }) => {
      if (data) setFaqs(data);
    });
  }, []);

  return (
    <section id="faq" className="py-20 md:py-28 px-6 bg-muted/20">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent mb-4">FAQ</p>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Perguntas Frequentes</h2>
            <p className="text-base text-muted-foreground mx-auto mt-4">Tire suas dúvidas sobre a plataforma</p>
          </motion.div>
        </div>

        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <motion.div
              key={faq.id}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
              className="bg-card rounded-lg border border-border/40 overflow-hidden"
            >
              <button
                onClick={() => setOpenFaq(openFaq === faq.id ? null : faq.id)}
                className="w-full flex items-center justify-between p-5 text-left group"
              >
                <span className="font-semibold text-[14px] pr-4 group-hover:text-accent transition-colors">{faq.pergunta}</span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${openFaq === faq.id ? 'rotate-180' : ''}`} />
              </button>
              {openFaq === faq.id && (
                <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed border-t border-border/20 pt-4">
                  {faq.resposta}
                </div>
              )}
            </motion.div>
          ))}
        </div>

        <div className="text-center mt-8">
          <Button variant="outline" size="sm" className="rounded-md text-[13px] font-semibold" onClick={() => navigate('/faq')}>
            <HelpCircle className="w-4 h-4 mr-2" /> Ver todas as perguntas <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </section>
  );
}
