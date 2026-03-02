import { useNavigate } from 'react-router-dom';
import { GraduationCap, BookOpen, Video, Award, Clock, Users, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

const cursos = [
  {
    icon: BookOpen,
    badge: 'Gratuito',
    badgeColor: 'bg-success/10 text-success border-success/20',
    title: 'Fundamentos de Licitações',
    desc: 'Entenda a Lei 14.133/2021, modalidades, fases do processo e como se preparar para competir.',
    duracao: '4h',
    aulas: 12,
    topicos: ['Lei 14.133/2021', 'Modalidades', 'Habilitação', 'Documentação'],
  },
  {
    icon: GraduationCap,
    badge: 'Popular',
    badgeColor: 'bg-accent/10 text-accent border-accent/20',
    title: 'Masterclass: Pregão Eletrônico',
    desc: 'Domine o pregão eletrônico do início ao fim — da análise do edital ao lance final vencedor.',
    duracao: '8h',
    aulas: 24,
    topicos: ['Análise de Editais', 'Estratégia de Lance', 'Robô de Lances', 'Recursos'],
  },
  {
    icon: Video,
    badge: 'Avançado',
    badgeColor: 'bg-primary/10 text-primary border-primary/20',
    title: 'IA Aplicada a Licitações',
    desc: 'Aprenda a usar o assistente IA para gerar propostas, analisar concorrentes e automatizar processos.',
    duracao: '6h',
    aulas: 18,
    topicos: ['Assistente IA', 'Propostas ABNT', 'Precificação', 'Automação'],
  },
  {
    icon: Award,
    badge: 'Certificação',
    badgeColor: 'bg-warning/10 text-warning border-warning/20',
    title: 'Certificação LicitIA Expert',
    desc: 'Certificação completa com avaliação prática. Torne-se um especialista reconhecido no mercado.',
    duracao: '20h',
    aulas: 48,
    topicos: ['Todos os módulos', 'Casos práticos', 'Avaliação final', 'Certificado'],
  },
];

export default function TreinamentosSection() {
  const navigate = useNavigate();

  return (
    <section id="treinamentos" className="py-24 px-6 bg-muted/20">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="text-sm font-semibold text-accent uppercase tracking-widest mb-3">Capacitação & Treinamentos</p>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">
              Aprenda com quem <span className="gradient-text">domina o mercado</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Cursos exclusivos, do básico ao avançado, para transformar sua equipe em especialistas em licitações com IA.
            </p>
          </motion.div>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
          {cursos.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group bg-card rounded-2xl border border-border/40 p-6 flex flex-col hover:border-accent/30 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                  <c.icon className="w-5 h-5 text-accent" />
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${c.badgeColor}`}>
                  {c.badge}
                </span>
              </div>

              <h3 className="text-lg font-bold mb-2">{c.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">{c.desc}</p>

              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {c.duracao}</span>
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {c.aulas} aulas</span>
              </div>

              <div className="space-y-2 mb-6">
                {c.topicos.map((t) => (
                  <div key={t} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                    <span>{t}</span>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                className="w-full rounded-xl group-hover:bg-accent group-hover:text-accent-foreground group-hover:border-accent transition-all"
                onClick={() => navigate('/auth')}
              >
                Acessar Curso <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-12 bg-card rounded-2xl border border-accent/20 p-8 md:p-12 flex flex-col md:flex-row items-center gap-8"
          style={{ boxShadow: 'var(--shadow-glow)' }}
        >
          <div className="flex-1">
            <h3 className="text-2xl font-extrabold mb-2">E-book Gratuito: Guia Completo LicitIA</h3>
            <p className="text-muted-foreground">
              Baixe nosso guia ABNT com 10 capítulos, capturas de tela didáticas e fundamentação na Lei 14.133/2021. Ideal para iniciantes e profissionais.
            </p>
          </div>
          <Button
            size="lg"
            className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl px-8 shrink-0"
            onClick={() => navigate('/ebook')}
          >
            <BookOpen className="w-5 h-5 mr-2" /> Baixar E-book Grátis
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
