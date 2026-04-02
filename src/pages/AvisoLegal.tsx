import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PraefectusLogo from '@/components/shared/PraefectusLogo';

export default function AvisoLegal() {
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
          <AlertTriangle className="w-6 h-6 text-accent" />
          <h1 className="text-3xl font-bold tracking-tight">Aviso Legal</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-8">Última atualização: 02 de abril de 2026</p>

        <div className="prose prose-sm max-w-none text-foreground space-y-8 leading-relaxed">

          {/* 1 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">1. NATUREZA DA PLATAFORMA</h2>
            <p className="text-sm text-muted-foreground">
              1.1. A plataforma <strong>PRAEFECTUS</strong> ("Plataforma"), de propriedade e operação da <strong>PRAEFECTUS DADOS E CORPORATIVO LTDA</strong> ("PRAEFECTUS"), constitui uma <strong>ferramenta tecnológica de apoio à decisão</strong>, fornecida sob o modelo <em>Software as a Service</em> (SaaS), destinada a auxiliar empresas fornecedoras na gestão e participação em processos licitatórios públicos.<br /><br />

              1.2. As funcionalidades oferecidas pela Plataforma — incluindo monitoramento de editais, elaboração de propostas, precificação, apoio jurídico, apoio contábil, automação de lances e gestão de contratos — possuem caráter <strong>meramente orientativo, informativo e auxiliar</strong>.<br /><br />

              1.3. A Plataforma <strong>não constitui</strong> escritório de advocacia, escritório de contabilidade, consultoria financeira, consultoria tributária, órgão de assessoria técnica ou qualquer outra entidade prestadora de serviço profissional regulamentado. As informações, análises e documentos gerados pela Plataforma, inclusive por meio de inteligência artificial, são produzidos de forma automatizada e não substituem o julgamento, a análise e a validação por profissionais habilitados.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">2. LIMITAÇÃO — NÃO SUBSTITUIÇÃO DE ANÁLISE PROFISSIONAL</h2>
            <p className="text-sm text-muted-foreground">
              2.1. As funcionalidades de <strong>apoio jurídico</strong> da Plataforma — tais como análise de editais, geração de impugnações, recursos administrativos, pareceres e minutas — são produzidas por algoritmos de inteligência artificial com base em modelos de linguagem e bases normativas. Esses conteúdos <strong>não constituem parecer jurídico</strong>, não configuram prestação de serviço advocatício e não dispensam a consulta a advogado devidamente inscrito na <strong>Ordem dos Advogados do Brasil (OAB)</strong>, nos termos do <strong>Art. 1º da Lei nº 8.906/1994</strong> (Estatuto da Advocacia).<br /><br />

              2.2. As funcionalidades de <strong>apoio contábil</strong> — incluindo análise de balanços, composições de custo e cálculos tributários — possuem caráter estimativo e auxiliar. <strong>Não substituem</strong> a atuação de contador devidamente registrado no <strong>Conselho Regional de Contabilidade (CRC)</strong>, nos termos do <strong>Decreto-Lei nº 9.295/1946</strong>.<br /><br />

              2.3. As funcionalidades de <strong>precificação</strong> — incluindo pesquisa de preços, cotações e composições de custo — utilizam fontes públicas e algoritmos estatísticos. Os resultados são <strong>referenciais</strong> e devem ser validados pelo USUÁRIO antes de sua utilização em propostas comerciais ou processos licitatórios.<br /><br />

              2.4. O USUÁRIO reconhece que a <strong>responsabilidade final</strong> pela revisão, validação e utilização de quaisquer documentos, análises ou informações geradas pela Plataforma é exclusivamente sua.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">3. ISENÇÃO RELATIVA DE RESPONSABILIDADE</h2>
            <p className="text-sm text-muted-foreground">
              3.1. A PRAEFECTUS <strong>não será responsabilizada</strong> por danos, perdas ou prejuízos decorrentes de decisões tomadas pelo USUÁRIO com base nas informações, análises, documentos ou sugestões geradas pela Plataforma, incluindo, sem limitação:<br /><br />

              a) Resultados desfavoráveis em processos licitatórios;<br />
              b) Inabilitação, desclassificação ou penalidades aplicadas por órgãos públicos;<br />
              c) Prejuízos financeiros decorrentes de precificação inadequada;<br />
              d) Consequências jurídicas decorrentes do uso de documentos gerados sem revisão profissional.<br /><br />

              3.2. As decisões sobre participação em licitações, valores de propostas, estratégias de lances, documentação apresentada e demais ações no âmbito de processos licitatórios são de <strong>exclusiva responsabilidade do USUÁRIO</strong>, que deve exercer seu próprio julgamento profissional e buscar assessoria especializada quando necessário.<br /><br />

              3.3. A presente isenção <strong>não exclui</strong> a responsabilidade da PRAEFECTUS por:<br /><br />

              a) Dolo ou culpa grave na prestação do serviço;<br />
              b) Defeitos comprovados no funcionamento da Plataforma que causem dano direto e demonstrável ao USUÁRIO;<br />
              c) Violação de obrigações legais inafastáveis, incluindo as disposições da LGPD e do Código de Defesa do Consumidor, quando aplicáveis.<br /><br />

              3.4. A limitação de responsabilidade da PRAEFECTUS observa os parâmetros estabelecidos nos <a href="/termos-de-uso" className="text-primary hover:underline">Termos de Uso</a>.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">4. ATUALIZAÇÃO DE INFORMAÇÕES E DEPENDÊNCIA DE FONTES EXTERNAS</h2>
            <p className="text-sm text-muted-foreground">
              4.1. A Plataforma utiliza informações provenientes de <strong>fontes públicas e externas</strong>, incluindo, de forma não exaustiva: Portal Nacional de Contratações Públicas (PNCP), portais de compras governamentais (federais, estaduais e municipais), diários oficiais, bases da Receita Federal, portais de transparência e APIs de terceiros.<br /><br />

              4.2. A PRAEFECTUS envidará esforços razoáveis para manter as informações atualizadas e precisas. Entretanto, <strong>não garante</strong> a exatidão, a completude, a tempestividade ou a disponibilidade das informações provenientes de fontes externas, considerando que:<br /><br />

              a) Os portais governamentais podem apresentar indisponibilidades, atrasos na publicação ou inconsistências em seus dados;<br />
              b) As APIs de terceiros podem sofrer alterações, descontinuação ou limitações de acesso sem aviso prévio;<br />
              c) A legislação, a jurisprudência e as normas regulamentares estão sujeitas a alterações frequentes que podem não ser refletidas instantaneamente na Plataforma.<br /><br />

              4.3. O USUÁRIO deve sempre <strong>verificar as informações</strong> obtidas por meio da Plataforma junto às fontes oficiais antes de utilizá-las em processos licitatórios, propostas comerciais ou decisões empresariais.<br /><br />

              4.4. A PRAEFECTUS <strong>não se responsabiliza</strong> por prejuízos decorrentes de informações desatualizadas, incompletas ou imprecisas provenientes de fontes externas, ressalvada a hipótese de falha comprovada nos mecanismos próprios de atualização da Plataforma.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">5. LEGISLAÇÃO APLICÁVEL</h2>
            <p className="text-sm text-muted-foreground">
              O presente Aviso Legal é regido pela legislação brasileira, em especial:<br /><br />

              • <strong>Lei nº 10.406/2002</strong> – Código Civil Brasileiro<br />
              • <strong>Lei nº 13.709/2018</strong> – Lei Geral de Proteção de Dados (LGPD)<br />
              • <strong>Lei nº 8.906/1994</strong> – Estatuto da Advocacia e da OAB<br />
              • <strong>Decreto-Lei nº 9.295/1946</strong> – Regulamentação da Profissão de Contador<br />
              • <strong>Lei nº 14.133/2021</strong> – Nova Lei de Licitações e Contratos Administrativos<br /><br />

              Para informações detalhadas sobre condições contratuais, consulte os <a href="/termos-de-uso" className="text-primary hover:underline">Termos de Uso</a> e a <a href="/politica-de-privacidade" className="text-primary hover:underline">Política de Privacidade</a>.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
