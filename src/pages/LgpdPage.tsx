import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PraefectusLogo from '@/components/shared/PraefectusLogo';

export default function LgpdPage() {
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
          <Lock className="w-6 h-6 text-muted-foreground" />
          <h1 className="text-3xl font-bold tracking-tight">Conformidade com a LGPD</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-8">Lei Geral de Proteção de Dados Pessoais — Lei nº 13.709/2018 | Última atualização: 03 de março de 2026</p>

        <div className="prose prose-sm max-w-none text-foreground space-y-6 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">1. COMPROMISSO COM A LGPD</h2>
            <p className="text-sm text-muted-foreground">
               A <strong>PRAEFECTUS DADOS E CORPORATIVO LTDA</strong>, por meio da plataforma <strong>PRAEFECTUS</strong>, está comprometida com a proteção dos dados pessoais de seus USUÁRIOS, em total conformidade com a <strong>Lei nº 13.709/2018</strong> (Lei Geral de Proteção de Dados Pessoais – LGPD), regulamentada pela Autoridade Nacional de Proteção de Dados (ANPD). Este documento descreve as práticas, mecanismos e garantias adotadas pela Plataforma para assegurar o tratamento lícito, adequado e transparente dos dados pessoais.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">2. PRINCÍPIOS ADOTADOS (Art. 6º da LGPD)</h2>
            <p className="text-sm text-muted-foreground">
              O tratamento de dados pessoais pela Plataforma observa rigorosamente os seguintes princípios:<br /><br />
              <strong>I — Finalidade:</strong> os dados são coletados para propósitos legítimos, específicos, explícitos e informados ao titular, sem possibilidade de tratamento posterior de forma incompatível com essas finalidades.<br /><br />
              <strong>II — Adequação:</strong> o tratamento é compatível com as finalidades informadas, conforme o contexto dos serviços de gestão de licitações.<br /><br />
              <strong>III — Necessidade:</strong> limitação do tratamento ao mínimo necessário para a realização de suas finalidades, abrangendo dados pertinentes, proporcionais e não excessivos.<br /><br />
              <strong>IV — Livre Acesso:</strong> garantia de consulta facilitada e gratuita sobre a forma e a duração do tratamento, bem como sobre a integralidade dos dados pessoais.<br /><br />
              <strong>V — Qualidade dos Dados:</strong> garantia de exatidão, clareza, relevância e atualização dos dados.<br /><br />
              <strong>VI — Transparência:</strong> garantia de informações claras, precisas e facilmente acessíveis sobre o tratamento.<br /><br />
              <strong>VII — Segurança:</strong> utilização de medidas técnicas e administrativas aptas a proteger os dados pessoais.<br /><br />
              <strong>VIII — Prevenção:</strong> adoção de medidas para prevenir a ocorrência de danos em virtude do tratamento de dados pessoais.<br /><br />
              <strong>IX — Não Discriminação:</strong> impossibilidade de realização do tratamento para fins discriminatórios ilícitos ou abusivos.<br /><br />
              <strong>X — Responsabilização e Prestação de Contas:</strong> demonstração de adoção de medidas eficazes e capazes de comprovar a observância e o cumprimento das normas de proteção de dados pessoais.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">3. BASES LEGAIS PARA TRATAMENTO (Art. 7º da LGPD)</h2>
            <p className="text-sm text-muted-foreground">
              O tratamento de dados pessoais pela Plataforma está fundamentado nas seguintes hipóteses legais:<br /><br />
              <strong>a) Consentimento do titular</strong> (Art. 7º, I): para envio de comunicações, boletins informativos e materiais promocionais, mediante manifestação livre, informada e inequívoca do USUÁRIO.<br /><br />
              <strong>b) Execução de contrato</strong> (Art. 7º, V): para prestação dos serviços contratados, incluindo análise de editais, elaboração de propostas, monitoramento de licitações e funcionalidades de inteligência artificial.<br /><br />
              <strong>c) Exercício regular de direitos</strong> (Art. 7º, VI): em processo judicial, administrativo ou arbitral, nos termos da Lei nº 9.307/1996.<br /><br />
              <strong>d) Legítimo interesse</strong> (Art. 7º, IX): para melhoria dos serviços, análises estatísticas agregadas, prevenção a fraudes e garantia da segurança da Plataforma, sempre respeitando os direitos e liberdades fundamentais do titular.<br /><br />
              <strong>e) Cumprimento de obrigação legal ou regulatória</strong> (Art. 7º, II): para atendimento a determinações de autoridades competentes, obrigações fiscais e regulatórias.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">4. DIREITOS DO TITULAR (Art. 18 da LGPD)</h2>
            <p className="text-sm text-muted-foreground">
              O USUÁRIO titular dos dados pessoais pode, a qualquer momento, exercer os seguintes direitos mediante requisição à Plataforma:<br /><br />
              <strong>I.</strong> Confirmação da existência de tratamento de dados pessoais;<br />
              <strong>II.</strong> Acesso aos dados pessoais mantidos pela Plataforma;<br />
              <strong>III.</strong> Correção de dados incompletos, inexatos ou desatualizados;<br />
              <strong>IV.</strong> Anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade com a LGPD;<br />
              <strong>V.</strong> Portabilidade dos dados a outro fornecedor de serviço ou produto, mediante requisição expressa, nos termos da regulamentação da ANPD;<br />
              <strong>VI.</strong> Eliminação dos dados pessoais tratados com base no consentimento, exceto nas hipóteses previstas no Art. 16 da LGPD;<br />
              <strong>VII.</strong> Informação das entidades públicas e privadas com as quais a Plataforma realizou compartilhamento de dados;<br />
              <strong>VIII.</strong> Informação sobre a possibilidade de não fornecer consentimento e sobre as consequências da negativa;<br />
              <strong>IX.</strong> Revogação do consentimento, nos termos do § 5º do Art. 8º da LGPD.<br /><br />
              As requisições devem ser realizadas através dos canais de suporte disponíveis na Plataforma e serão atendidas no prazo de até <strong>15 (quinze) dias</strong>, conforme Art. 18, § 5º da LGPD.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">5. MEDIDAS DE SEGURANÇA (Art. 46 da LGPD)</h2>
            <p className="text-sm text-muted-foreground">
              A Plataforma adota medidas de segurança técnicas e administrativas aptas a proteger os dados pessoais de acessos não autorizados e de situações acidentais ou ilícitas de destruição, perda, alteração, comunicação ou difusão, incluindo:<br /><br />
              <strong>a) Criptografia:</strong> dados em trânsito protegidos por TLS 1.3 e dados em repouso criptografados com AES-256;<br /><br />
              <strong>b) Controle de Acesso:</strong> autenticação multifator (MFA), controle de acesso baseado em papéis (RBAC) e políticas de segurança em nível de linha (RLS);<br /><br />
              <strong>c) Monitoramento:</strong> sistema de detecção de intrusão, logs de auditoria e monitoramento contínuo de acessos;<br /><br />
              <strong>d) Gestão de Incidentes:</strong> plano de resposta a incidentes de segurança com procedimentos documentados para contenção, erradicação e comunicação;<br /><br />
              <strong>e) Backups:</strong> cópias de segurança criptografadas com retenção conforme política interna;<br /><br />
              <strong>f) Certificados Digitais:</strong> certificados A1/e-CNPJ são processados exclusivamente em memória para as funcionalidades da Plataforma e <strong>não são armazenados</strong> em disco, conforme Art. 11 da LGPD.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">6. INCIDENTES DE SEGURANÇA (Art. 48 da LGPD)</h2>
            <p className="text-sm text-muted-foreground">
              Em caso de incidente de segurança que possa acarretar risco ou dano relevante aos titulares, a Plataforma compromete-se a:<br /><br />
              <strong>I.</strong> Comunicar à Autoridade Nacional de Proteção de Dados (ANPD) em prazo razoável, conforme definido em regulamentação;<br />
              <strong>II.</strong> Comunicar ao titular dos dados afetados;<br />
              <strong>III.</strong> Informar a natureza dos dados pessoais afetados, as medidas técnicas e de segurança utilizadas para a proteção dos dados, os riscos relacionados ao incidente, e as medidas adotadas para reverter ou mitigar os efeitos do prejuízo.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">7. TRANSFERÊNCIA INTERNACIONAL (Art. 33 da LGPD)</h2>
            <p className="text-sm text-muted-foreground">
              A transferência internacional de dados pessoais somente é realizada para países ou organismos internacionais que proporcionem grau de proteção de dados pessoais adequado ao previsto na LGPD, ou mediante:<br /><br />
              <strong>a)</strong> Cláusulas contratuais específicas aprovadas pela ANPD;<br />
              <strong>b)</strong> Cláusulas-padrão contratuais nos termos da regulamentação;<br />
              <strong>c)</strong> Consentimento específico e em destaque do titular, com informação prévia sobre o caráter internacional da operação.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">8. RELATÓRIO DE IMPACTO (Art. 38 da LGPD)</h2>
            <p className="text-sm text-muted-foreground">
              A Plataforma mantém Relatório de Impacto à Proteção de Dados Pessoais (RIPD) atualizado, contendo a descrição dos processos de tratamento de dados pessoais que podem gerar riscos às liberdades civis e aos direitos fundamentais, bem como medidas, salvaguardas e mecanismos de mitigação de risco, conforme determinação da ANPD.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">9. ENCARREGADO DE PROTEÇÃO DE DADOS — DPO (Art. 41 da LGPD)</h2>
            <p className="text-sm text-muted-foreground">
              Em conformidade com o Art. 41 da LGPD, a Plataforma designa Encarregado pelo Tratamento de Dados Pessoais (Data Protection Officer – DPO), cujas atribuições incluem:<br /><br />
              <strong>I.</strong> Aceitar reclamações e comunicações dos titulares, prestar esclarecimentos e adotar providências;<br />
              <strong>II.</strong> Receber comunicações da ANPD e adotar providências;<br />
              <strong>III.</strong> Orientar os funcionários e os contratados da entidade a respeito das práticas a serem tomadas em relação à proteção de dados pessoais;<br />
              <strong>IV.</strong> Executar as demais atribuições determinadas pelo controlador ou estabelecidas em normas complementares.<br /><br />
              <strong>Contato do DPO:</strong> <a href="mailto:dpo@praefectus.com.br" className="text-primary hover:underline">dpo@praefectus.com.br</a>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">10. COOKIES E TECNOLOGIAS DE RASTREAMENTO</h2>
            <p className="text-sm text-muted-foreground">
              A Plataforma utiliza cookies e tecnologias similares nos termos do <strong>Art. 7º, §4º da Lei nº 12.965/2014</strong> (Marco Civil da Internet) e em conformidade com a LGPD:<br /><br />
              <strong>a) Cookies Essenciais:</strong> necessários ao funcionamento básico da Plataforma, incluindo autenticação e segurança de sessão. Não requerem consentimento.<br /><br />
              <strong>b) Cookies Analíticos:</strong> utilizados para coleta de dados estatísticos agregados e anônimos sobre o uso da Plataforma, visando melhoria da experiência. Sujeitos ao consentimento do titular.<br /><br />
              O USUÁRIO poderá gerenciar suas preferências de cookies a qualquer momento nas configurações do navegador ou através dos mecanismos disponibilizados pela Plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">11. RETENÇÃO E ELIMINAÇÃO DE DADOS (Art. 15 e 16 da LGPD)</h2>
            <p className="text-sm text-muted-foreground">
              11.1. Os dados pessoais serão mantidos durante o período estritamente necessário para o cumprimento das finalidades que motivaram sua coleta, incluindo o período de vigência contratual.<br /><br />
              11.2. O término do tratamento de dados pessoais ocorrerá nas seguintes hipóteses (Art. 15):<br />
              <strong>I.</strong> Verificação de que a finalidade foi alcançada ou que os dados deixaram de ser necessários;<br />
              <strong>II.</strong> Fim do período de tratamento;<br />
              <strong>III.</strong> Comunicação do titular, inclusive no exercício de seu direito de revogação do consentimento;<br />
              <strong>IV.</strong> Determinação da ANPD.<br /><br />
              11.3. Após o encerramento da conta, os dados serão eliminados no prazo de <strong>30 (trinta) dias</strong>, ressalvada a conservação para (Art. 16):<br />
              <strong>I.</strong> Cumprimento de obrigação legal ou regulatória pelo controlador;<br />
              <strong>II.</strong> Estudo por órgão de pesquisa, garantida a anonimização;<br />
              <strong>III.</strong> Transferência a terceiro, respeitados os requisitos legais;<br />
              <strong>IV.</strong> Uso exclusivo do controlador, anonimizados os dados.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">12. LEGISLAÇÃO APLICÁVEL</h2>
            <p className="text-sm text-muted-foreground">
              Este documento está fundamentado nas seguintes normas do ordenamento jurídico brasileiro:<br /><br />
              • <strong>Lei nº 13.709/2018</strong> — Lei Geral de Proteção de Dados Pessoais (LGPD)<br />
              • <strong>Lei nº 12.965/2014</strong> — Marco Civil da Internet<br />
              • <strong>Decreto nº 8.771/2016</strong> — Regulamentação do Marco Civil da Internet<br />
              • <strong>Lei nº 8.078/1990</strong> — Código de Defesa do Consumidor<br />
              • <strong>Lei nº 14.133/2021</strong> — Nova Lei de Licitações e Contratos Administrativos<br />
              • <strong>Constituição Federal de 1988</strong>, Art. 5º, incisos X, XII e LXXIX — Direitos fundamentais à intimidade, sigilo de dados e proteção de dados pessoais<br />
              • Regulamentações e resoluções da <strong>ANPD</strong> (Autoridade Nacional de Proteção de Dados)
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">13. FORO</h2>
            <p className="text-sm text-muted-foreground">
              Fica eleito o foro da Comarca de Belém, Estado do Pará, para dirimir quaisquer controvérsias oriundas deste documento, com renúncia expressa a qualquer outro, por mais privilegiado que seja, nos termos do <strong>Art. 63 do Código de Processo Civil (Lei nº 13.105/2015)</strong>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
