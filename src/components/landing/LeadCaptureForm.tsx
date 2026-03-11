import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { getStoredUtm, trackLeadConversion } from '@/lib/tracking';
import { toast } from 'sonner';
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
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
    } catch {
      toast.error('Erro ao enviar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <motion.section
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="py-20 px-6"
      >
        <div className="max-w-lg mx-auto text-center bg-card rounded-xl border border-border p-12">
          <div className="w-16 h-16 rounded-full bg-accent/15 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-accent" />
          </div>
          <h3 className="text-2xl font-bold mb-3">Cadastro Recebido!</h3>
          <p className="text-muted-foreground">
            Em breve nossa equipe entrará em contato para liberar seu acesso gratuito.
          </p>
        </div>
      </motion.section>
    );
  }

  return (
    <section id="lead-form" className="py-20 md:py-28 px-6 bg-muted/30">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="max-w-7xl mx-auto"
      >
        <div className="max-w-2xl mx-auto bg-card rounded-xl border border-border p-8 md:p-12 shadow-sm">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-3">
              Teste o Praefectus Gratuitamente
            </h2>
            <p className="text-muted-foreground text-[15px]">
              Preencha seus dados e receba acesso de 7 dias ao plano Profissional.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <Input
              placeholder="Nome completo *"
              value={form.nome}
              onChange={(e) => setForm(f => ({ ...f, nome: e.target.value }))}
              className="h-11"
              required maxLength={100}
            />
            <Input
              type="email"
              placeholder="E-mail corporativo *"
              value={form.email}
              onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
              className="h-11"
              required maxLength={255}
            />
            <Input
              placeholder="Telefone / WhatsApp"
              value={form.telefone}
              onChange={(e) => setForm(f => ({ ...f, telefone: e.target.value }))}
              className="h-11"
              maxLength={20}
            />
            <Input
              placeholder="Empresa"
              value={form.empresa}
              onChange={(e) => setForm(f => ({ ...f, empresa: e.target.value }))}
              className="h-11"
              maxLength={100}
            />
            <div className="sm:col-span-2">
              <Select value={form.uf} onValueChange={(v) => setForm(f => ({ ...f, uf: v }))}>
                <SelectTrigger className="h-11">
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
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground text-base py-5 rounded-md font-bold"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                Quero Testar Grátis <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
            <p className="sm:col-span-2 text-center text-xs text-muted-foreground">
              Ao enviar, você concorda com nossos{' '}
              <a href="/termos-de-uso" className="underline hover:text-foreground">Termos de Uso</a> e{' '}
              <a href="/politica-de-privacidade" className="underline hover:text-foreground">Política de Privacidade</a>.
            </p>
          </form>
        </div>
      </motion.div>
    </section>
  );
}
