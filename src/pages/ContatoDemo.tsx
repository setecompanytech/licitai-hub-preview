import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingFooter from '@/components/landing/LandingFooter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Mail, Phone, MessageSquare, Clock, CheckCircle2 } from 'lucide-react';

const benefits = [
  'Apresentação personalizada dos módulos relevantes para sua operação',
  'Demonstração em ambiente controlado com dados simulados realistas',
  'Análise de aderência dos seus CNAEs e regiões de atuação',
  'Simulação de alertas, precificação e geração de propostas',
  'Esclarecimento técnico sobre segurança, compliance e integrações',
];

export default function ContatoDemo() {
  const { toast } = useToast();
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ nome: '', email: '', empresa: '', telefone: '', segmento: '', mensagem: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim() || !form.email.trim()) {
      toast({ title: 'Preencha nome e e-mail', variant: 'destructive' });
      return;
    }
    setSent(true);
    toast({ title: 'Solicitação enviada', description: 'Nossa equipe entrará em contato em até 24 horas úteis.' });
  };

  return (
    <>
      <Helmet>
        <title>Solicitar Demonstração | PRAEFECTUS</title>
        <meta name="description" content="Agende uma apresentação personalizada da plataforma PRAEFECTUS. Demonstração em ambiente controlado com dados simulados e análise de aderência." />
        <link rel="canonical" href="https://praefectus.com.br/contato" />
      </Helmet>
      <div className="min-h-screen bg-background">
        <LandingNavbar />
        <main className="pt-24 pb-20 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="mb-14 text-center">
              <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase mb-3">Demonstração Comercial</p>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Solicite uma apresentação personalizada
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Conheça na prática como a PRAEFECTUS pode otimizar sua operação licitatória. Sem compromisso — apresentação técnica conduzida por especialista.
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-12">
              {/* Form */}
              <div className="border border-border rounded-xl p-8 bg-card">
                {sent ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CheckCircle2 className="w-16 h-16 text-success mb-4" />
                    <h3 className="text-xl font-bold mb-2">Solicitação recebida</h3>
                    <p className="text-muted-foreground">Nossa equipe comercial entrará em contato em até 24 horas úteis para agendar sua demonstração.</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Nome completo *</label>
                      <Input value={form.nome} onChange={(e) => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Seu nome" maxLength={100} />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">E-mail corporativo *</label>
                      <Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} placeholder="seu@empresa.com.br" maxLength={255} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-1 block">Empresa</label>
                        <Input value={form.empresa} onChange={(e) => setForm(f => ({ ...f, empresa: e.target.value }))} placeholder="Razão Social" maxLength={200} />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1 block">Telefone</label>
                        <Input value={form.telefone} onChange={(e) => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(00) 00000-0000" maxLength={20} />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Segmento de atuação</label>
                      <Select value={form.segmento} onValueChange={(v) => setForm(f => ({ ...f, segmento: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fornecedor">Fornecedor / Distribuidor</SelectItem>
                          <SelectItem value="consultoria">Consultoria Licitatória</SelectItem>
                          <SelectItem value="industria">Indústria / Fabricante</SelectItem>
                          <SelectItem value="servicos">Prestador de Serviços</SelectItem>
                          <SelectItem value="engenharia">Engenharia / Obras</SelectItem>
                          <SelectItem value="ti">Tecnologia da Informação</SelectItem>
                          <SelectItem value="saude">Saúde / Medicamentos</SelectItem>
                          <SelectItem value="outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Mensagem (opcional)</label>
                      <Textarea value={form.mensagem} onChange={(e) => setForm(f => ({ ...f, mensagem: e.target.value }))} placeholder="Descreva suas principais necessidades ou dúvidas..." rows={4} maxLength={1000} />
                    </div>
                    <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold">
                      Solicitar Demonstração
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      Ao enviar, você concorda com nossa <a href="/politica-de-privacidade" className="underline">Política de Privacidade</a>.
                    </p>
                  </form>
                )}
              </div>

              {/* Benefits + Contact info */}
              <div className="space-y-8">
                <div>
                  <h2 className="text-lg font-bold mb-4">O que você verá na demonstração</h2>
                  <ul className="space-y-3">
                    {benefits.map((b) => (
                      <li key={b} className="flex items-start gap-3 text-sm text-muted-foreground">
                        <CheckCircle2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="border border-border rounded-xl p-6 bg-card space-y-4">
                  <h3 className="font-semibold">Canais de contato direto</h3>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-3"><Mail className="w-4 h-4 text-muted-foreground" /> contato@praefectus.com.br</div>
                    <div className="flex items-center gap-3"><Phone className="w-4 h-4 text-muted-foreground" /> (11) 0000-0000</div>
                    <div className="flex items-center gap-3"><MessageSquare className="w-4 h-4 text-muted-foreground" /> WhatsApp Comercial</div>
                    <div className="flex items-center gap-3"><Clock className="w-4 h-4 text-muted-foreground" /> Seg–Sex, 08h às 18h (Brasília)</div>
                  </div>
                </div>

                <div className="border border-border rounded-xl p-6 bg-card">
                  <h3 className="font-semibold mb-2">Ambiente de demonstração</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    A demonstração é conduzida em ambiente isolado com dados simulados realistas, completamente segregado do ambiente de produção. Nenhuma operação real de envio ou contratação é executada durante a apresentação.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
        <LandingFooter />
      </div>
    </>
  );
}
