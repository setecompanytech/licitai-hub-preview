import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { getStoredUtm, trackLeadConversion } from '@/lib/tracking';
import { toast } from 'sonner';
import { ArrowRight, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

const UF_LIST = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

export default function LeadCaptureForm() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ nome: '', email: '', telefone: '', empresa: '', uf: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim() || !form.email.trim()) {
      toast.error('Preencha nome e e-mail');
      return;
    }
    setLoading(true);
    try {
      const utm = getStoredUtm();
      const { error } = await supabase.from('leads').insert({
        nome: form.nome.trim(),
        email: form.email.trim().toLowerCase(),
        telefone: form.telefone.trim() || null,
        empresa: form.empresa.trim() || null,
        uf: form.uf || null,
        origem: 'landing',
        interesse: 'trial',
        utm_source: utm.utm_source,
        utm_medium: utm.utm_medium,
        utm_campaign: utm.utm_campaign,
        utm_term: utm.utm_term,
        utm_content: utm.utm_content,
        referrer: utm.referrer || null,
        user_agent: navigator.userAgent,
      } as any);
      if (error) throw error;
      trackLeadConversion({ email: form.email });
      setSubmitted(true);
      toast.success('Solicitação enviada com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao enviar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-12"
      >
        <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-accent" />
        </div>
        <h3 className="text-2xl font-bold text-white mb-3">Cadastro Recebido!</h3>
        <p className="text-white/60 max-w-md mx-auto">
          Em breve nossa equipe entrará em contato para liberar seu acesso gratuito ao LicitIA.
        </p>
      </motion.div>
    );
  }

  return (
    <section id="lead-form" className="landing-section">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="landing-container"
      >
        <div className="relative rounded-[2rem] p-8 md:p-16 overflow-hidden" style={{ background: 'var(--gradient-hero)' }}>
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'linear-gradient(hsl(174 72% 50%) 1px, transparent 1px), linear-gradient(90deg, hsl(174 72% 50%) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />
          <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full opacity-15 blur-[100px]" style={{ background: 'hsl(174 72% 45%)' }} />

          <div className="relative max-w-2xl mx-auto">
            <div className="text-center mb-10">
              <div className="w-14 h-14 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto mb-6 backdrop-blur-sm border border-accent/20">
                <Sparkles className="w-7 h-7 text-accent" />
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-tight">
                Teste o LicitIA Gratuitamente
              </h2>
              <p className="text-white/50 text-base md:text-lg max-w-lg mx-auto">
                Preencha seus dados e receba acesso de 7 dias ao plano Profissional — sem cartão de crédito.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <Input
                placeholder="Nome completo *"
                value={form.nome}
                onChange={(e) => setForm(f => ({ ...f, nome: e.target.value }))}
                className="bg-white/10 border-white/15 text-white placeholder:text-white/40 h-12 rounded-xl"
                required
                maxLength={100}
              />
              <Input
                type="email"
                placeholder="E-mail corporativo *"
                value={form.email}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                className="bg-white/10 border-white/15 text-white placeholder:text-white/40 h-12 rounded-xl"
                required
                maxLength={255}
              />
              <Input
                placeholder="Telefone / WhatsApp"
                value={form.telefone}
                onChange={(e) => setForm(f => ({ ...f, telefone: e.target.value }))}
                className="bg-white/10 border-white/15 text-white placeholder:text-white/40 h-12 rounded-xl"
                maxLength={20}
              />
              <Input
                placeholder="Empresa"
                value={form.empresa}
                onChange={(e) => setForm(f => ({ ...f, empresa: e.target.value }))}
                className="bg-white/10 border-white/15 text-white placeholder:text-white/40 h-12 rounded-xl"
                maxLength={100}
              />
              <div className="sm:col-span-2">
                <Select value={form.uf} onValueChange={(v) => setForm(f => ({ ...f, uf: v }))}>
                  <SelectTrigger className="bg-white/10 border-white/15 text-white h-12 rounded-xl [&>span]:text-white/40">
                    <SelectValue placeholder="Estado (UF)" />
                  </SelectTrigger>
                  <SelectContent>
                    {UF_LIST.map((uf) => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Button
                  type="submit"
                  disabled={loading}
                  size="lg"
                  className="w-full bg-accent hover:bg-accent/90 text-accent-foreground text-base py-6 rounded-xl font-bold shadow-lg"
                  style={{ boxShadow: 'var(--shadow-glow)' }}
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                  Quero Testar Grátis <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
              <p className="sm:col-span-2 text-center text-xs text-white/30">
                Ao enviar, você concorda com nossos{' '}
                <a href="/termos-de-uso" className="underline hover:text-white/50">Termos de Uso</a> e{' '}
                <a href="/politica-de-privacidade" className="underline hover:text-white/50">Política de Privacidade</a>.
              </p>
            </form>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
