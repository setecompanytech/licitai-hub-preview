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
    desc: 'Entenda a Lei 14.133/2021, modalidades, fases do processo e como se preparar.',
    duracao: '4h',
    aulas: 12,
    topicos: ['Lei 14.133/2021', 'Modalidades', 'Habilitação', 'Documentação'],
  },
  {
    icon: GraduationCap,
    badge: 'Popular',
    badgeColor: 'bg-accent/10 text-accent border-accent/20',
    title: 'Masterclass: Pregão Eletrônico',
    desc: 'Domine o pregão eletrônico — da análise do edital ao lance final vencedor.',
    duracao: '8h',
    aulas: 24,
    topicos: ['Análise de Editais', 'Estratégia de Lance', 'Robô de Lances', 'Recursos'],
  },
  {
    icon: Video,
    badge: 'Avançado',
    badgeColor: 'bg-primary/10 text-primary border-primary/20',
    title: 'IA Aplicada a Licitações',
    desc: 'Use IA para gerar propostas, analisar concorrentes e automatizar processos.',
    duracao: '6h',
    aulas: 18,
    topicos: ['Assistente IA', 'Propostas ABNT', 'Precificação', 'Automação'],
  },
  {
    icon: Award,
    badge: 'Certificação',
    badgeColor: 'bg-warning/10 text-warning border-warning/20',
    title: 'Certificação LicitIA Expert',
    desc: 'Certificação completa com avaliação prática e certificado reconhecido.',
    duracao: '20h',
    aulas: 48,
    topicos: ['Todos os módulos', 'Casos práticos', 'Avaliação final', 'Certificado'],
  },
];

export default function TreinamentosSection() {
  const navigate = useNavigate();

  return (
    <section id="treinamentos" className="landing-section bg-muted/20">
      <div className="landing-container">
        <div className="text-center mb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="section-label">Capacitação</span>
            <h2 className="section-title">
              Aprenda com quem <span className="gradient-text">domina o mercado</span>
            </h2>
            <p className="section-subtitle mx-auto">
              Cursos exclusivos para transformar sua equipe em especialistas em licitações com IA.
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
              transition={{ delay: i * 0.08 }}
              className="group bg-card rounded-2xl border border-border/30 p-6 flex flex-col hover:border-accent/25 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="flex items-center justify-between mb-5">
                <div className="w-12 h-12 rounded-xl bg-accent/8 flex items-center justify-center group-hover:bg-accent/15 transition-colors">
                  <c.icon className="w-5 h-5 text-accent" />
                </div>
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${c.badgeColor}`}>
                  {c.badge}
                </span>
              </div>

              <h3 className="text-base font-bold mb-2">{c.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5 flex-1">{c.desc}</p>

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
                className="w-full rounded-xl text-[13px] font-semibold group-hover:bg-accent group-hover:text-accent-foreground group-hover:border-accent transition-all"
                onClick={() => navigate('/auth')}
              >
                Acessar Curso <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-14 rounded-2xl border border-accent/20 p-8 md:p-12 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden"
          style={{ background: 'var(--gradient-accent-subtle)' }}
        >
          <div className="flex-1">
            <h3 className="text-2xl font-extrabold mb-2">E-book Gratuito: Guia Completo LicitIA</h3>
            <p className="text-muted-foreground text-[15px]">
              10 capítulos, capturas de tela e fundamentação na Lei 14.133/2021. Para iniciantes e profissionais.
            </p>
          </div>
          <Button
            size="lg"
            className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl px-8 shrink-0 font-bold"
            style={{ boxShadow: 'var(--shadow-glow-sm)' }}
            onClick={() => navigate('/ebook')}
          >
            <BookOpen className="w-5 h-5 mr-2" /> Baixar E-book
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
