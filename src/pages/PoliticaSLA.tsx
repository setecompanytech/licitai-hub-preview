import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Headphones } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PraefectusLogo from '@/components/shared/PraefectusLogo';

export default function PoliticaSLA() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> <PraefectusLogo size="sm" />
          </button>
          <Button size="sm" onClick={() => navigate('/auth')}>Acessar Sistema</Button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex items-center gap-3 mb-6">
          <Headphones className="w-6 h-6 text-accent" />
          <h1 className="text-3xl font-bold tracking-tight">Política de Suporte e Nível de Serviço (SLA)</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-8">Última atualização: 02 de abril de 2026</p>

        <div className="prose prose-sm max-w-none text-foreground space-y-8 leading-relaxed">

          {/* 1 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">1. CANAIS DE ATENDIMENTO</h2>
            <p className="text-sm text-muted-foreground">
              1.1. A <strong>PRAEFECTUS DADOS E CORPORATIVO LTDA</strong> ("CONTRATADA") disponibiliza os seguintes canais de atendimento ao USUÁRIO para abertura de chamados, esclarecimento de dúvidas e comunicação de incidentes:<br /><br />

              a) <strong>Sistema interno de suporte:</strong> módulo de chamados integrado à Plataforma, acessível por meio do menu "Suporte" após autenticação. Este é o canal prioritário e preferencial para todas as solicitações, garantindo rastreabilidade, classificação automatizada e acompanhamento do histórico de atendimento;<br /><br />

              b) <strong>E-mail:</strong> <a href="mailto:suporte@praefectus.com.br" className="text-primary hover:underline">suporte@praefectus.com.br</a>, para solicitações que não possam ser registradas pelo sistema interno ou para comunicações que exijam envio de anexos volumosos.<br /><br />

              1.2. A CONTRATADA poderá, a seu exclusivo critério, disponibilizar canais complementares de atendimento (chat, telefone, WhatsApp), sem que sua eventual indisponibilidade configure descumprimento desta Política.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">2. HORÁRIO DE ATENDIMENTO</h2>
            <p className="text-sm text-muted-foreground">
              2.1. O atendimento técnico será prestado em <strong>dias úteis</strong> (segunda a sexta-feira, excluídos feriados nacionais), no horário de <strong>08h00 às 18h00</strong> (horário de Brasília – UTC-3).<br /><br />

              2.2. Chamados registrados fora do horário de atendimento serão processados no primeiro dia útil subsequente, respeitando a ordem de chegada e a classificação de prioridade.<br /><br />

              2.3. Incidentes classificados como <strong>críticos</strong> (Seção 3.1, alínea "a") poderão receber atenção fora do horário regular, a critério da equipe técnica da CONTRATADA, sem que isso constitua obrigação de atendimento ininterrupto.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">3. CLASSIFICAÇÃO DE CHAMADOS</h2>
            <p className="text-sm text-muted-foreground">
              3.1. Os chamados serão classificados pela equipe de suporte conforme os seguintes níveis de prioridade, com base no impacto e na abrangência do problema reportado:<br /><br />

              a) <strong>Crítico:</strong> indisponibilidade total da Plataforma ou de funcionalidade essencial que impeça o USUÁRIO de operar, sem alternativa viável (<em>workaround</em>). Exemplos: impossibilidade de autenticação generalizada, perda de acesso a dados, falha que comprometa a integridade das informações;<br /><br />

              b) <strong>Alto:</strong> funcionalidade essencial com desempenho severamente degradado ou parcialmente indisponível, com impacto significativo nas operações do USUÁRIO, mas com alternativa viável disponível. Exemplos: lentidão crítica no envio de propostas, falha intermitente em módulo de precificação;<br /><br />

              c) <strong>Médio:</strong> funcionalidade não essencial indisponível ou com comportamento inesperado, com impacto moderado e sem comprometimento das operações principais. Exemplos: erro em relatório específico, falha na exportação de documento em formato alternativo;<br /><br />

              d) <strong>Baixo:</strong> dúvidas operacionais, solicitações de informação, sugestões de melhoria ou problemas cosméticos sem impacto funcional. Exemplos: dúvida sobre configuração, solicitação de ajuste visual, sugestão de nova funcionalidade.<br /><br />

              3.2. A classificação inicial poderá ser reclassificada pela equipe técnica da CONTRATADA com base na análise do chamado, mediante justificativa registrada no histórico do atendimento.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">4. PRAZOS DE RESPOSTA</h2>
            <p className="text-sm text-muted-foreground">
              4.1. A CONTRATADA envidará <strong>esforços razoáveis</strong> para responder aos chamados dentro dos seguintes prazos, contados a partir do registro do chamado em dia e horário úteis:<br /><br />

              a) <strong>Crítico:</strong> primeira resposta em até <strong>2 (duas) horas úteis</strong>;<br />
              b) <strong>Alto:</strong> primeira resposta em até <strong>4 (quatro) horas úteis</strong>;<br />
              c) <strong>Médio:</strong> primeira resposta em até <strong>8 (oito) horas úteis</strong>;<br />
              d) <strong>Baixo:</strong> primeira resposta em até <strong>24 (vinte e quatro) horas úteis</strong>.<br /><br />

              4.2. Os prazos acima referem-se à <strong>primeira resposta</strong> (reconhecimento do chamado e início da análise), não à resolução definitiva do problema, cuja complexidade pode demandar prazo superior.<br /><br />

              4.3. Os prazos indicados constituem <strong>metas operacionais</strong> e não obrigações de resultado. A CONTRATADA <strong>não garante</strong> o cumprimento absoluto dos prazos em todas as circunstâncias, especialmente em casos de alta demanda simultânea, complexidade técnica excepcional ou dependência de terceiros.<br /><br />

              4.4. Planos de assinatura de nível superior poderão contemplar prazos de resposta diferenciados, conforme condições vigentes no momento da contratação.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">5. LIMITAÇÕES DO SUPORTE</h2>
            <p className="text-sm text-muted-foreground">
              5.1. O suporte técnico da CONTRATADA é restrito a questões relacionadas ao funcionamento, à configuração e à operação da Plataforma. <strong>Não estão incluídos</strong> no escopo do suporte:<br /><br />

              a) <strong>Consultoria jurídica:</strong> análise, interpretação ou elaboração de pareceres jurídicos sobre editais, contratos, impugnações, recursos administrativos ou quaisquer questões de natureza jurídica. As ferramentas de apoio jurídico da Plataforma possuem caráter meramente orientativo e auxiliar, conforme disposto nos <a href="/termos-de-uso" className="text-primary hover:underline">Termos de Uso</a>;<br /><br />

              b) <strong>Consultoria contábil ou financeira:</strong> elaboração de demonstrativos contábeis, cálculos tributários definitivos ou pareceres fiscais. As ferramentas de apoio contábil da Plataforma são auxiliares e não substituem a atuação de profissional habilitado;<br /><br />

              c) <strong>Operação do cliente:</strong> execução de tarefas operacionais em nome do USUÁRIO, como preenchimento de propostas, cadastro de licitações, envio de documentos a portais governamentais ou gestão de processos licitatórios;<br /><br />

              d) <strong>Treinamento individualizado:</strong> capacitação individual ou em grupo sobre a Plataforma, salvo quando previsto no plano contratado. A CONTRATADA disponibiliza tutoriais, documentação e central de ajuda como recursos de autoatendimento;<br /><br />

              e) <strong>Suporte a equipamentos ou software de terceiros:</strong> problemas relacionados ao ambiente local do USUÁRIO (hardware, sistema operacional, navegador, conexão de internet, certificados digitais emitidos por autoridades certificadoras, portais governamentais ou outros sistemas não controlados pela CONTRATADA).
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">6. DISPONIBILIDADE DO SISTEMA</h2>
            <p className="text-sm text-muted-foreground">
              6.1. A CONTRATADA envidará <strong>esforços razoáveis</strong> para manter a Plataforma disponível e operacional. A CONTRATADA <strong>não garante disponibilidade ininterrupta</strong> (<em>uptime</em> de 100%), reconhecendo que interrupções podem ocorrer em decorrência de fatores técnicos, operacionais ou externos, nos termos do <strong>Art. 393 do Código Civil (Lei nº 10.406/2002)</strong>.<br /><br />

              6.2. <strong>Manutenção programada:</strong> a CONTRATADA poderá realizar manutenções programadas na Plataforma, preferencialmente em horários de menor utilização (entre 22h00 e 06h00, horário de Brasília). Manutenções programadas que possam impactar a disponibilidade serão comunicadas ao USUÁRIO com antecedência mínima de <strong>24 (vinte e quatro) horas</strong>, por meio de notificação na Plataforma ou por e-mail.<br /><br />

              6.3. <strong>Manutenção emergencial:</strong> em situações que demandem intervenção imediata para preservar a segurança, a integridade dos dados ou a estabilidade da Plataforma, a CONTRATADA poderá realizar manutenções sem aviso prévio, comunicando o USUÁRIO assim que possível.<br /><br />

              6.4. <strong>Exclusões de disponibilidade:</strong> não serão consideradas como indisponibilidade para fins desta Política:<br /><br />

              a) Períodos de manutenção programada ou emergencial;<br />
              b) Indisponibilidade de portais governamentais, APIs de terceiros ou serviços externos não controlados pela CONTRATADA;<br />
              c) Interrupções decorrentes de caso fortuito, força maior, desastres naturais, ataques cibernéticos de terceiros, falhas de infraestrutura de internet ou decisões de autoridades públicas;<br />
              d) Problemas decorrentes do ambiente local do USUÁRIO (conexão, hardware, software, navegador).<br /><br />

              6.5. O status de disponibilidade da Plataforma pode ser acompanhado em tempo real na página <a href="/status" className="text-primary hover:underline">Status da Plataforma</a>.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">7. RESPONSABILIDADES DO CLIENTE</h2>
            <p className="text-sm text-muted-foreground">
              Para o adequado funcionamento do suporte técnico, o USUÁRIO compromete-se a:<br /><br />

              a) Descrever o problema de forma clara e detalhada ao registrar o chamado, incluindo: funcionalidade afetada, passos para reprodução, mensagens de erro exibidas e capturas de tela, quando aplicável;<br /><br />

              b) Responder às solicitações de informações complementares da equipe de suporte em prazo razoável. Chamados sem resposta do USUÁRIO por período superior a <strong>5 (cinco) dias úteis</strong> poderão ser encerrados automaticamente, sem prejuízo da possibilidade de reabertura;<br /><br />

              c) Manter seus dados cadastrais e informações de contato atualizados para recebimento de comunicações;<br /><br />

              d) Utilizar a Plataforma em conformidade com os <a href="/termos-de-uso" className="text-primary hover:underline">Termos de Uso</a>, a <a href="/politica-de-privacidade" className="text-primary hover:underline">Política de Privacidade</a> e a documentação disponível;<br /><br />

              e) Manter seu ambiente local (navegador, conexão de internet, sistema operacional) em condições adequadas para a utilização da Plataforma;<br /><br />

              f) Não utilizar o canal de suporte para finalidades estranhas ao seu objeto, incluindo solicitações de consultoria jurídica, contábil ou operacional.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">8. ESCALONAMENTO</h2>
            <p className="text-sm text-muted-foreground">
              8.1. Caso o USUÁRIO considere que o atendimento recebido não foi satisfatório ou que o prazo de resposta foi inadequado, poderá solicitar o <strong>escalonamento</strong> do chamado, que será direcionado para análise por nível técnico ou gerencial superior.<br /><br />

              8.2. O escalonamento poderá ser solicitado:<br /><br />

              a) <strong>Nível 1 → Nível 2 (técnico):</strong> quando a solução apresentada pelo suporte de primeiro nível não resolver o problema ou quando a complexidade técnica exigir análise especializada;<br /><br />

              b) <strong>Nível 2 → Nível 3 (gerencial):</strong> quando, após análise técnica aprofundada, o USUÁRIO entender que a questão demanda decisão gerencial, revisão de política ou tratamento excepcional.<br /><br />

              8.3. Solicitações de escalonamento devem ser registradas no próprio chamado original, garantindo a preservação do histórico e da rastreabilidade do atendimento.<br /><br />

              8.4. Em situações excepcionais, o USUÁRIO poderá dirigir comunicações diretamente ao Encarregado de Proteção de Dados (DPO), por meio do e-mail <a href="mailto:dpo@praefectus.com.br" className="text-primary hover:underline">dpo@praefectus.com.br</a>, especialmente para questões relacionadas a incidentes de segurança ou exercício de direitos do titular de dados.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">9. EXCLUSÕES</h2>
            <p className="text-sm text-muted-foreground">
              9.1. A CONTRATADA <strong>não será responsabilizada</strong> por falhas no atendimento, atrasos ou impossibilidade de resolução nas seguintes hipóteses:<br /><br />

              a) Problemas decorrentes de uso indevido da Plataforma, em desconformidade com os <a href="/termos-de-uso" className="text-primary hover:underline">Termos de Uso</a>;<br /><br />

              b) Falhas originadas em sistemas, portais ou serviços de terceiros não controlados pela CONTRATADA, incluindo portais de compras governamentais, APIs externas, provedores de e-mail e autoridades certificadoras;<br /><br />

              c) Problemas decorrentes do ambiente local do USUÁRIO, incluindo hardware, software, navegador, sistema operacional, certificados digitais ou conexão de internet;<br /><br />

              d) Solicitações que extrapolem o escopo do suporte técnico, conforme definido na Seção 5;<br /><br />

              e) Chamados cujas informações fornecidas pelo USUÁRIO sejam insuficientes para diagnóstico, após solicitação de complementação não atendida;<br /><br />

              f) Caso fortuito ou força maior, nos termos do <strong>Art. 393 do Código Civil</strong>.<br /><br />

              9.2. A presente Política integra os <a href="/termos-de-uso" className="text-primary hover:underline">Termos de Uso</a> da Plataforma para todos os fins de direito. As disposições sobre limitação de responsabilidade, foro e legislação aplicável previstas nos Termos de Uso aplicam-se integralmente a esta Política.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
