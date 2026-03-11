import { useNavigate } from 'react-router-dom';
import { GraduationCap, BookOpen, Video, Award, Clock, Users, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

const cursos = [
  {
    icon: BookOpen,
    badge: 'Gratuito',
    badgeColor: 'bg-success/8 text-success border-success/20',
    title: 'Fundamentos de Licitações',
    desc: 'Entenda a Lei 14.133/2021, modalidades, fases do processo e como se preparar.',
    duracao: '4h',
    aulas: 12,
    topicos: ['Lei 14.133/2021', 'Modalidades', 'Habilitação', 'Documentação'],
  },
  {
    icon: GraduationCap,
    badge: 'Popular',
    badgeColor: 'bg-accent/8 text-accent border-accent/20',
    title: 'Masterclass: Pregão Eletrônico',
    desc: 'Domine o pregão eletrônico — da análise do edital ao lance final vencedor.',
    duracao: '8h',
    aulas: 24,
    topicos: ['Análise de Editais', 'Estratégia de Lance', 'Robô de Lances', 'Recursos'],
  },
  {
    icon: Video,
    badge: 'Avançado',
    badgeColor: 'bg-primary/8 text-primary border-primary/20',
    title: 'IA Aplicada a Licitações',
    desc: 'Use IA para gerar propostas, analisar concorrentes e automatizar processos.',
    duracao: '6h',
    aulas: 18,
    topicos: ['Assistente IA', 'Propostas ABNT', 'Precificação', 'Automação'],
  },
  {
    icon: Award,
    badge: 'Certificação',
    badgeColor: 'bg-warning/8 text-warning border-warning/20',
    title: 'Certificação PRAEFECTUS Expert',
    desc: 'Certificação completa com avaliação prática e certificado reconhecido.',
    duracao: '20h',
    aulas: 48,
    topicos: ['Todos os módulos', 'Casos práticos', 'Avaliação final', 'Certificado'],
  },
];

export default function TreinamentosSection() {
  const navigate = useNavigate();

  return (
    <section id="treinamentos" className="py-20 md:py-28 px-6 bg-muted/30">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent mb-4">Capacitação</p>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Aprenda com quem <span className="text-accent">domina o mercado</span>
            </h2>
            <p className="text-base text-muted-foreground max-w-xl mx-auto mt-4">
              Cursos exclusivos para especialistas em licitações com IA.
            </p>
          </motion.div>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-5">
          {cursos.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="group bg-card rounded-lg border border-border/50 p-6 flex flex-col hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center group-hover:bg-accent/10 transition-colors">
                  <c.icon className="w-5 h-5 text-accent" />
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${c.badgeColor}`}>
                  {c.badge}
                </span>
              </div>

              <h3 className="text-sm font-bold mb-1.5">{c.title}</h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed mb-4 flex-1">{c.desc}</p>

              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {c.duracao}</span>
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {c.aulas} aulas</span>
              </div>

              <div className="space-y-1.5 mb-5">
                {c.topicos.map((t) => (
                  <div key={t} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="w-3 h-3 text-accent flex-shrink-0" />
                    <span>{t}</span>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full rounded-md text-[12px] font-semibold"
                onClick={() => navigate('/auth')}
              >
                Acessar Curso <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 rounded-lg border border-border bg-card p-8 md:p-10 flex flex-col md:flex-row items-center gap-8"
        >
          <div className="flex-1">
            <h3 className="text-xl font-extrabold mb-2">E-book Gratuito: Guia Completo Praefectus</h3>
            <p className="text-muted-foreground text-[14px]">
              10 capítulos com capturas de tela e fundamentação na Lei 14.133/2021.
            </p>
          </div>
          <Button
            className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-md px-6 shrink-0 font-bold"
            onClick={() => navigate('/ebook')}
          >
            <BookOpen className="w-4 h-4 mr-2" /> Baixar E-book
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
