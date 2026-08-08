import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PraefectusLogo from '@/components/shared/PraefectusLogo';

export default function PoliticaPrivacidade() {
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
          <Shield className="w-6 h-6 text-muted-foreground" />
          <h1 className="text-3xl font-bold tracking-tight">Política de Privacidade</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-8">Última atualização: 02 de abril de 2026</p>

        <div className="prose prose-sm max-w-none text-foreground space-y-8 leading-relaxed">

          {/* 1 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">1. IDENTIFICAÇÃO DO CONTROLADOR</h2>
            <p className="text-sm text-muted-foreground">
              O tratamento de dados pessoais descrito nesta Política é realizado por:<br /><br />
              <strong>Razão Social:</strong> PRAEFECTUS DADOS E CORPORATIVO LTDA<br />
              <strong>CNPJ:</strong> [inserir CNPJ]<br />
              <strong>Endereço:</strong> [inserir endereço completo]<br />
              <strong>E-mail de contato:</strong> <a href="mailto:contato@praefectus.com.br" className="text-primary hover:underline">contato@praefectus.com.br</a><br /><br />
              A PRAEFECTUS é a <strong>Controladora</strong> dos dados pessoais tratados por meio da plataforma <strong>PRAEFECTUS</strong> ("Plataforma"), nos termos do <strong>Art. 5º, VI, da Lei nº 13.709/2018</strong> (Lei Geral de Proteção de Dados Pessoais – LGPD).
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">2. DEFINIÇÕES LEGAIS</h2>
            <p className="text-sm text-muted-foreground">
              Para os fins desta Política, aplicam-se as definições previstas no <strong>Art. 5º da LGPD</strong>:<br /><br />
              a) <strong>Dado Pessoal:</strong> informação relacionada a pessoa natural identificada ou identificável (Art. 5º, I);<br /><br />
              b) <strong>Dado Pessoal Sensível:</strong> dado pessoal sobre origem racial ou étnica, convicção religiosa, opinião política, filiação sindical, dado referente à saúde ou à vida sexual, dado genético ou biométrico, quando vinculado a uma pessoa natural (Art. 5º, II);<br /><br />
              c) <strong>Titular:</strong> pessoa natural a quem se referem os dados pessoais objeto de tratamento (Art. 5º, V);<br /><br />
              d) <strong>Tratamento:</strong> toda operação realizada com dados pessoais, como coleta, produção, recepção, classificação, utilização, acesso, reprodução, transmissão, distribuição, processamento, arquivamento, armazenamento, eliminação, avaliação, controle, modificação, comunicação, transferência, difusão ou extração (Art. 5º, X);<br /><br />
              e) <strong>Controlador:</strong> pessoa natural ou jurídica, de direito público ou privado, a quem competem as decisões referentes ao tratamento de dados pessoais (Art. 5º, VI);<br /><br />
              f) <strong>Operador:</strong> pessoa natural ou jurídica, de direito público ou privado, que realiza o tratamento de dados pessoais em nome do controlador (Art. 5º, VII);<br /><br />
              g) <strong>Encarregado (DPO):</strong> pessoa indicada pelo controlador para atuar como canal de comunicação entre o controlador, os titulares dos dados e a Autoridade Nacional de Proteção de Dados – ANPD (Art. 5º, VIII).
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">3. DADOS PESSOAIS COLETADOS</h2>
            <p className="text-sm text-muted-foreground">
              A Plataforma coleta as seguintes categorias de dados pessoais, conforme a finalidade e a base legal aplicável:<br /><br />

              <strong>3.1. Dados Cadastrais</strong><br />
              Nome completo, endereço de e-mail, telefone celular, telefone empresarial, cargo ou função, CNPJ da empresa representada, unidade federativa (UF) de atuação e informações de perfil profissional. Esses dados são fornecidos diretamente pelo TITULAR no momento do cadastro ou da atualização de seu perfil.<br /><br />

              <strong>3.2. Dados de Acesso</strong><br />
              Endereço IP, tipo e versão do navegador, sistema operacional, data e horário de acesso, páginas visitadas, tempo de permanência e dados de geolocalização aproximada derivados do endereço IP. A coleta desses dados está amparada no <strong>Art. 15 da Lei nº 12.965/2014</strong> (Marco Civil da Internet) e no <strong>Art. 13 do Decreto nº 8.771/2016</strong>.<br /><br />

              <strong>3.3. Dados de Uso da Plataforma</strong><br />
              Documentos carregados na Plataforma (editais, propostas, certidões e demonstrativos contábeis), pesquisas de preço realizadas, interações com ferramentas de inteligência artificial, configurações de monitoramento de editais, dados de propostas geradas e informações de licitações cadastradas. Certificados digitais (e-CNPJ/A1) são processados exclusivamente em memória volátil para execução das funcionalidades contratadas, <strong>sem armazenamento permanente</strong>, em conformidade com o <strong>Art. 11 da LGPD</strong>.<br /><br />

              <strong>3.4. Dados de Comunicação</strong><br />
              Mensagens enviadas por meio do chat de suporte, solicitações de atendimento, conteúdo de e-mails trocados com a equipe de suporte e registros de interações no módulo de CRM integrado (WhatsApp Business), quando habilitado pelo TITULAR.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">4. FINALIDADE DO TRATAMENTO</h2>
            <p className="text-sm text-muted-foreground">
              Os dados pessoais são tratados para as seguintes finalidades específicas:<br /><br />

              a) <strong>Prestação do serviço SaaS:</strong> viabilizar o acesso, a personalização e a operação integral da Plataforma, incluindo monitoramento de editais, elaboração de propostas, precificação, gestão de contratos e demais funcionalidades contratadas;<br /><br />

              b) <strong>Execução contratual:</strong> gerenciar a relação contratual entre a PRAEFECTUS e o TITULAR, incluindo faturamento, gestão de assinaturas, suporte técnico e comunicações operacionais (Art. 7º, V, da LGPD);<br /><br />

              c) <strong>Comunicação com USUÁRIOS:</strong> envio de boletins informativos, alertas de licitações, notificações de sistema e comunicações relativas a atualizações da Plataforma, mediante consentimento prévio quando não vinculadas à execução contratual (Art. 7º, I, da LGPD);<br /><br />

              d) <strong>Segurança da Plataforma:</strong> prevenção e detecção de fraudes, proteção contra acessos não autorizados, monitoramento de atividades suspeitas e manutenção da integridade do ambiente digital (Art. 7º, IX, da LGPD);<br /><br />

              e) <strong>Cumprimento de obrigação legal ou regulatória:</strong> atendimento a determinações de autoridades competentes, obrigações fiscais, contábeis e regulatórias aplicáveis (Art. 7º, II, da LGPD);<br /><br />

              f) <strong>Melhoria contínua:</strong> análises estatísticas agregadas e anonimizadas para aprimoramento de funcionalidades, desenvolvimento de novos recursos e aperfeiçoamento da experiência do TITULAR (Art. 7º, IX, da LGPD).
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">5. BASE LEGAL PARA O TRATAMENTO</h2>
            <p className="text-sm text-muted-foreground">
              O tratamento de dados pessoais pela Plataforma fundamenta-se nas seguintes bases legais, conforme o <strong>Art. 7º da LGPD</strong>:<br /><br />

              a) <strong>Execução de contrato ou de procedimentos preliminares</strong> (Art. 7º, V): aplicável à prestação dos serviços contratados, ao gerenciamento da assinatura e ao suporte técnico;<br /><br />

              b) <strong>Cumprimento de obrigação legal ou regulatória</strong> (Art. 7º, II): aplicável à retenção de registros de acesso pelo prazo de 6 (seis) meses, conforme <strong>Art. 15 da Lei nº 12.965/2014</strong>, bem como ao atendimento de obrigações fiscais e determinações judiciais;<br /><br />

              c) <strong>Legítimo interesse do controlador</strong> (Art. 7º, IX): aplicável à prevenção de fraudes, à segurança da Plataforma e à geração de análises estatísticas agregadas, sempre observado o teste de proporcionalidade e a legítima expectativa do TITULAR, nos termos do <strong>Art. 10 da LGPD</strong>;<br /><br />

              d) <strong>Consentimento</strong> (Art. 7º, I): aplicável ao envio de comunicações promocionais, boletins informativos não vinculados à execução contratual e à utilização de cookies analíticos não essenciais. O consentimento pode ser revogado a qualquer tempo, sem prejuízo da licitude do tratamento realizado anteriormente, conforme <strong>Art. 8º, §5º, da LGPD</strong>.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">6. COMPARTILHAMENTO DE DADOS</h2>
            <p className="text-sm text-muted-foreground">
              A PRAEFECTUS poderá compartilhar dados pessoais dos TITULARES nas seguintes hipóteses, sempre em conformidade com o <strong>Art. 7º da LGPD</strong> e mediante instrumentos contratuais que assegurem proteção equivalente:<br /><br />

              a) <strong>Operadores de tecnologia:</strong> provedores de infraestrutura em nuvem, serviços de hospedagem, armazenamento e processamento de dados, que atuam como <strong>Operadores</strong> nos termos do Art. 5º, VII, da LGPD, vinculados por cláusulas contratuais específicas de proteção de dados;<br /><br />

              b) <strong>Serviços de e-mail e comunicação:</strong> plataformas de envio de e-mails transacionais e informativos, utilizadas exclusivamente para comunicações autorizadas pelo TITULAR ou necessárias à execução contratual;<br /><br />

              c) <strong>Processadores de pagamento:</strong> instituições financeiras e plataformas de cobrança, para fins estritamente relacionados ao faturamento e à gestão de assinaturas;<br /><br />

              d) <strong>Autoridades públicas:</strong> quando exigido por lei, regulamento, determinação judicial ou requisição de autoridade competente, nos termos do Art. 7º, II, da LGPD.<br /><br />

              A PRAEFECTUS <strong>não comercializa, vende, aluga ou cede</strong> dados pessoais de seus TITULARES a terceiros para finalidades distintas das aqui descritas, em nenhuma hipótese.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">7. RETENÇÃO DE DADOS</h2>
            <p className="text-sm text-muted-foreground">
              7.1. Os dados pessoais serão retidos durante o período necessário ao cumprimento das finalidades descritas nesta Política, observados os seguintes critérios:<br /><br />

              a) <strong>Vigência contratual:</strong> os dados serão mantidos durante todo o período de vigência da relação contratual entre o TITULAR e a PRAEFECTUS;<br /><br />

              b) <strong>Obrigação legal:</strong> os registros de acesso a aplicações de internet serão armazenados pelo prazo mínimo de <strong>6 (seis) meses</strong>, conforme <strong>Art. 15 da Lei nº 12.965/2014</strong>. Dados fiscais e contábeis serão mantidos pelos prazos previstos na legislação tributária aplicável;<br /><br />

              c) <strong>Exercício regular de direitos:</strong> os dados poderão ser mantidos pelo prazo necessário ao exercício regular de direitos em processo judicial, administrativo ou arbitral, nos termos do Art. 16, II, da LGPD.<br /><br />

              7.2. Após o encerramento da conta e o decurso dos prazos legais aplicáveis, os dados pessoais serão eliminados ou anonimizados no prazo máximo de <strong>30 (trinta) dias</strong>, salvo quando sua manutenção for necessária para cumprimento de obrigação legal ou regulatória (Art. 16 da LGPD).
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">8. DIREITOS DO TITULAR</h2>
            <p className="text-sm text-muted-foreground">
              O TITULAR dos dados pessoais poderá exercer, a qualquer tempo, os direitos previstos no <strong>Art. 18 da LGPD</strong>, mediante requisição dirigida ao Encarregado de Proteção de Dados (DPO), pelo canal indicado na Seção 12 desta Política:<br /><br />

              a) <strong>Confirmação</strong> da existência de tratamento de dados pessoais;<br /><br />
              b) <strong>Acesso</strong> aos dados pessoais tratados pelo Controlador;<br /><br />
              c) <strong>Correção</strong> de dados incompletos, inexatos ou desatualizados;<br /><br />
              d) <strong>Anonimização, bloqueio ou eliminação</strong> de dados desnecessários, excessivos ou tratados em desconformidade com a LGPD;<br /><br />
              e) <strong>Portabilidade</strong> dos dados a outro fornecedor de serviço ou produto, mediante requisição expressa e observada a regulamentação da ANPD;<br /><br />
              f) <strong>Eliminação</strong> dos dados pessoais tratados com base no consentimento, ressalvadas as hipóteses de conservação previstas no Art. 16 da LGPD;<br /><br />
              g) <strong>Informação</strong> sobre as entidades públicas e privadas com as quais o Controlador compartilhou dados;<br /><br />
              h) <strong>Informação</strong> sobre a possibilidade de não fornecer consentimento e sobre as consequências da negativa;<br /><br />
              i) <strong>Revogação do consentimento</strong> a qualquer momento, mediante manifestação expressa, nos termos do Art. 8º, §5º, da LGPD.<br /><br />

              As requisições serão respondidas no prazo de <strong>15 (quinze) dias</strong>, contados da data do recebimento, em formato simplificado, ou no prazo de <strong>até 15 (quinze) dias</strong> para declaração completa, conforme Art. 19 da LGPD. O TITULAR poderá também apresentar reclamação perante a <strong>Autoridade Nacional de Proteção de Dados (ANPD)</strong>.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">9. SEGURANÇA DA INFORMAÇÃO</h2>
            <p className="text-sm text-muted-foreground">
              9.1. A PRAEFECTUS adota medidas técnicas e administrativas aptas a proteger os dados pessoais de acessos não autorizados e de situações acidentais ou ilícitas de destruição, perda, alteração, comunicação ou difusão, nos termos do <strong>Art. 46 da LGPD</strong>.<br /><br />

              9.2. As medidas de segurança implementadas incluem, de forma não exaustiva: criptografia de dados em trânsito e em repouso, controle de acesso baseado em papéis (RBAC), políticas de segurança em nível de linha (RLS), autenticação multifator, monitoramento contínuo de acessos e revisões periódicas de segurança.<br /><br />

              9.3. A PRAEFECTUS <strong>não garante segurança absoluta</strong>, considerando que nenhum sistema de transmissão ou armazenamento eletrônico é integralmente imune a vulnerabilidades. Entretanto, o Controlador compromete-se a adotar os padrões de segurança razoáveis e proporcionais aos riscos envolvidos no tratamento.<br /><br />

              9.4. Em caso de incidente de segurança que possa acarretar risco ou dano relevante aos TITULARES, a PRAEFECTUS comunicará à <strong>Autoridade Nacional de Proteção de Dados (ANPD)</strong> e aos TITULARES afetados, em prazo razoável, conforme <strong>Art. 48 da LGPD</strong>, indicando: a natureza dos dados afetados, os riscos relacionados ao incidente, as medidas técnicas e de segurança adotadas e as medidas de reversão ou mitigação dos efeitos do incidente.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">10. TRANSFERÊNCIA INTERNACIONAL DE DADOS</h2>
            <p className="text-sm text-muted-foreground">
              10.1. Em razão da utilização de provedores de infraestrutura em nuvem, os dados pessoais poderão ser transferidos e armazenados em servidores localizados fora do território brasileiro.<br /><br />

              10.2. A transferência internacional de dados será realizada exclusivamente para países ou organismos internacionais que proporcionem grau de proteção de dados pessoais adequado ao previsto na LGPD, ou mediante a adoção de garantias previstas no <strong>Art. 33 da LGPD</strong>, incluindo:<br /><br />

              a) Cláusulas contratuais padrão aprovadas pela ANPD;<br />
              b) Normas corporativas globais, quando aplicáveis;<br />
              c) Selos, certificados e códigos de conduta regularmente emitidos.<br /><br />

              10.3. O TITULAR poderá solicitar informações sobre os mecanismos de transferência utilizados, por meio do canal de contato do Encarregado (Seção 12).
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">11. COOKIES E TECNOLOGIAS DE RASTREAMENTO</h2>
            <p className="text-sm text-muted-foreground">
              11.1. A Plataforma utiliza cookies e tecnologias similares para otimizar a experiência do TITULAR, conforme as seguintes categorias:<br /><br />

              a) <strong>Cookies essenciais:</strong> necessários ao funcionamento básico da Plataforma, incluindo autenticação, gerenciamento de sessão e preferências de segurança. Sua utilização é fundamentada no legítimo interesse do Controlador e na execução contratual, não sendo passível de desativação sem prejuízo ao uso da Plataforma;<br /><br />

              b) <strong>Cookies analíticos:</strong> utilizados para coleta de dados estatísticos sobre o uso da Plataforma, incluindo páginas visitadas, tempo de navegação e interações. Sua ativação depende do <strong>consentimento prévio</strong> do TITULAR, conforme Art. 7º, I, da LGPD;<br /><br />

              c) <strong>Cookies de marketing:</strong> quando habilitados, permitem o envio de comunicações direcionadas e a mensuração da eficácia de campanhas. Sua ativação depende do <strong>consentimento expresso</strong> do TITULAR.<br /><br />

              11.2. O TITULAR poderá gerenciar suas preferências de cookies por meio do banner de consentimento exibido no primeiro acesso à Plataforma, ou a qualquer momento pelas configurações do navegador. A desativação de cookies analíticos ou de marketing não afeta o funcionamento das funcionalidades essenciais.<br /><br />

              11.3. A Plataforma <strong>não carrega</strong> scripts de rastreamento em páginas de autenticação e recuperação de senha, em observância ao princípio da minimização previsto no <strong>Art. 6º, III, da LGPD</strong>.<br /><br />

              11.4. Para informações detalhadas sobre os cookies utilizados, consulte a <a href="/politica-cookies" className="text-primary hover:underline">Política de Cookies</a>.
            </p>
          </section>

          {/* 12 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">12. CANAL DO ENCARREGADO DE PROTEÇÃO DE DADOS (DPO)</h2>
            <p className="text-sm text-muted-foreground">
              Nos termos do <strong>Art. 41 da LGPD</strong>, a PRAEFECTUS designou um Encarregado de Proteção de Dados (Data Protection Officer – DPO), responsável por:<br /><br />

              a) Aceitar reclamações e comunicações dos TITULARES, prestar esclarecimentos e adotar providências;<br />
              b) Receber comunicações da Autoridade Nacional de Proteção de Dados (ANPD) e adotar providências;<br />
              c) Orientar os funcionários e contratados da entidade a respeito das práticas a serem adotadas em relação à proteção de dados pessoais.<br /><br />

              <strong>Encarregado (DPO):</strong> Rafael<br />
              <strong>E-mail:</strong> <a href="mailto:dpo@praefectus.com.br" className="text-primary hover:underline">dpo@praefectus.com.br</a><br /><br />

              As comunicações dirigidas ao Encarregado serão respondidas no prazo previsto em lei.
            </p>
          </section>

          {/* 13 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">13. ATUALIZAÇÕES DESTA POLÍTICA</h2>
            <p className="text-sm text-muted-foreground">
              13.1. A PRAEFECTUS reserva-se o direito de alterar esta Política de Privacidade a qualquer tempo, para adequação a novas exigências legais, regulatórias ou operacionais.<br /><br />

              13.2. As alterações serão comunicadas ao TITULAR por meio de notificação na Plataforma ou por e-mail, com antecedência razoável. A data da última atualização será indicada no topo deste documento.<br /><br />

              13.3. A continuidade de uso da Plataforma após a publicação das alterações constituirá aceitação tácita dos novos termos, sem prejuízo do direito do TITULAR de revogar o consentimento ou solicitar a exclusão de seus dados.
            </p>
          </section>

          {/* Base Legal */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">14. LEGISLAÇÃO APLICÁVEL E FORO</h2>
            <p className="text-sm text-muted-foreground">
              14.1. Esta Política de Privacidade é regida pelas seguintes normas do ordenamento jurídico brasileiro:<br /><br />

              • <strong>Lei nº 13.709/2018</strong> – Lei Geral de Proteção de Dados Pessoais (LGPD)<br />
              • <strong>Lei nº 12.965/2014</strong> – Marco Civil da Internet<br />
              • <strong>Decreto nº 8.771/2016</strong> – Regulamentação do Marco Civil da Internet<br />
              • <strong>Lei nº 8.078/1990</strong> – Código de Defesa do Consumidor, quando aplicável<br />
              • <strong>Constituição Federal de 1988</strong>, Art. 5º, X e XII – Direitos fundamentais à intimidade, vida privada e sigilo de dados<br /><br />

              14.2. Fica eleito o foro da <strong>Comarca de Belém, Estado do Pará</strong>, para dirimir quaisquer controvérsias oriundas desta Política de Privacidade, com renúncia expressa a qualquer outro, por mais privilegiado que seja, nos termos do <strong>Art. 63 do Código de Processo Civil (Lei nº 13.105/2015)</strong>.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
