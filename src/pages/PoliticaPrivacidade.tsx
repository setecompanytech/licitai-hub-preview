import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PoliticaPrivacidade() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> <Zap className="w-5 h-5 text-accent" /> <span className="font-bold">Licit<span className="text-accent">IA</span></span>
          </button>
          <Button size="sm" onClick={() => navigate('/auth')}>Acessar Sistema</Button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-6 h-6 text-accent" />
          <h1 className="text-3xl font-bold tracking-tight">Política de Privacidade</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-8">Última atualização: 02 de março de 2026</p>

        <div className="prose prose-sm max-w-none text-foreground space-y-6 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">1. INTRODUÇÃO</h2>
            <p className="text-sm text-muted-foreground">
              A presente Política de Privacidade descreve como a plataforma <strong>LicitIA</strong> ("Controlador") coleta, utiliza, armazena, compartilha e protege os dados pessoais dos USUÁRIOS, em total conformidade com a <strong>Lei nº 13.709/2018</strong> (Lei Geral de Proteção de Dados Pessoais – LGPD) e demais normas aplicáveis do ordenamento jurídico brasileiro.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">2. DADOS PESSOAIS COLETADOS</h2>
            <p className="text-sm text-muted-foreground">
              2.1. <strong>Dados fornecidos pelo USUÁRIO:</strong> nome completo, e-mail, telefone celular, telefone empresarial, cargo, CNPJ, estado de atuação (UF), e informações de perfil profissional.<br /><br />
              2.2. <strong>Dados de navegação:</strong> endereço IP, tipo de navegador, páginas acessadas, tempo de permanência e dados de cookies, nos termos do <strong>Art. 7º, §4º do Marco Civil da Internet (Lei nº 12.965/2014)</strong>.<br /><br />
              2.3. <strong>Dados de utilização:</strong> documentos carregados, propostas geradas, pesquisas de preço realizadas e interações com ferramentas de inteligência artificial.<br /><br />
              2.4. <strong>Dados sensíveis:</strong> certificados digitais (e-CNPJ/A1) são processados exclusivamente para as funcionalidades da Plataforma e <strong>não são armazenados</strong>, em conformidade com o <strong>Art. 11 da LGPD</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">3. FINALIDADE DO TRATAMENTO</h2>
            <p className="text-sm text-muted-foreground">
              Os dados pessoais são tratados para as seguintes finalidades, conforme <strong>Art. 7º da LGPD</strong>:<br /><br />
              a) <strong>Execução do contrato</strong> (Art. 7º, V): prestação dos serviços contratados, incluindo análise de editais, elaboração de propostas e monitoramento de licitações;<br />
              b) <strong>Consentimento</strong> (Art. 7º, I): envio de comunicações, boletins e materiais informativos;<br />
              c) <strong>Legítimo interesse</strong> (Art. 7º, IX): melhoria dos serviços, análises estatísticas e prevenção a fraudes;<br />
              d) <strong>Cumprimento de obrigação legal</strong> (Art. 7º, II): atendimento a determinações de autoridades competentes e obrigações fiscais.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">4. COMPARTILHAMENTO DE DADOS</h2>
            <p className="text-sm text-muted-foreground">
              4.1. Os dados pessoais poderão ser compartilhados com:<br /><br />
              a) <strong>Provedores de infraestrutura</strong>: serviços de hospedagem, armazenamento em nuvem e processamento de dados, mediante cláusulas contratuais de proteção adequadas;<br />
              b) <strong>Processadores de pagamento</strong>: exclusivamente para fins de cobrança e gestão de assinaturas;<br />
              c) <strong>Autoridades públicas</strong>: quando exigido por lei ou determinação judicial.<br /><br />
              4.2. A Plataforma <strong>não comercializa</strong> dados pessoais de seus USUÁRIOS a terceiros, em nenhuma hipótese.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">5. SEGURANÇA DOS DADOS</h2>
            <p className="text-sm text-muted-foreground">
              5.1. A Plataforma adota medidas técnicas e administrativas adequadas para proteger os dados pessoais contra acessos não autorizados, destruição, perda, alteração ou tratamento inadequado, nos termos do <strong>Art. 46 da LGPD</strong>.<br /><br />
              5.2. As medidas incluem: criptografia de dados em trânsito e em repouso, controle de acesso baseado em papéis (RBAC), políticas de segurança em nível de linha (RLS), autenticação multifator e monitoramento contínuo.<br /><br />
              5.3. Em caso de incidente de segurança que possa acarretar risco ou dano relevante aos titulares, a Plataforma comunicará à Autoridade Nacional de Proteção de Dados (ANPD) e aos titulares afetados, conforme <strong>Art. 48 da LGPD</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">6. DIREITOS DO TITULAR</h2>
            <p className="text-sm text-muted-foreground">
              Nos termos do <strong>Art. 18 da LGPD</strong>, o USUÁRIO titular dos dados tem direito a:<br /><br />
              a) <strong>Confirmação</strong> da existência de tratamento;<br />
              b) <strong>Acesso</strong> aos dados pessoais;<br />
              c) <strong>Correção</strong> de dados incompletos, inexatos ou desatualizados;<br />
              d) <strong>Anonimização, bloqueio ou eliminação</strong> de dados desnecessários ou excessivos;<br />
              e) <strong>Portabilidade</strong> dos dados a outro fornecedor de serviço;<br />
              f) <strong>Eliminação</strong> dos dados pessoais tratados com consentimento;<br />
              g) <strong>Informação</strong> sobre compartilhamento de dados com entidades públicas e privadas;<br />
              h) <strong>Revogação do consentimento</strong> a qualquer momento, mediante requisição expressa.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">7. RETENÇÃO DE DADOS</h2>
            <p className="text-sm text-muted-foreground">
              7.1. Os dados pessoais serão mantidos durante o período de vigência da relação contratual e pelo prazo necessário ao cumprimento de obrigações legais, conforme <strong>Art. 16 da LGPD</strong>.<br /><br />
              7.2. Após o encerramento da conta, os dados serão eliminados no prazo máximo de 30 (trinta) dias, exceto aqueles cuja manutenção seja necessária para cumprimento de obrigação legal ou regulatória.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">8. COOKIES E TECNOLOGIAS DE RASTREAMENTO</h2>
            <p className="text-sm text-muted-foreground">
              A Plataforma utiliza cookies essenciais para o funcionamento do sistema e cookies analíticos para melhoria da experiência do USUÁRIO, em conformidade com o <strong>Art. 7º, §4º da Lei nº 12.965/2014</strong> (Marco Civil da Internet). O USUÁRIO poderá gerenciar suas preferências de cookies nas configurações do navegador.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">9. TRANSFERÊNCIA INTERNACIONAL DE DADOS</h2>
            <p className="text-sm text-muted-foreground">
              Os dados poderão ser transferidos e armazenados em servidores localizados fora do Brasil, exclusivamente em países que proporcionem grau de proteção adequado ou mediante adoção de garantias previstas no <strong>Art. 33 da LGPD</strong>, incluindo cláusulas contratuais padrão aprovadas pela ANPD.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">10. ENCARREGADO DE PROTEÇÃO DE DADOS (DPO)</h2>
            <p className="text-sm text-muted-foreground">
              O USUÁRIO poderá contatar o Encarregado de Proteção de Dados para exercer seus direitos ou esclarecer dúvidas sobre o tratamento de dados pessoais, conforme <strong>Art. 41 da LGPD</strong>, através dos canais de suporte disponíveis na Plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">11. BASE LEGAL</h2>
            <p className="text-sm text-muted-foreground">
              Esta Política de Privacidade está fundamentada nas seguintes normas:<br /><br />
              • <strong>Lei nº 13.709/2018</strong> – Lei Geral de Proteção de Dados (LGPD)<br />
              • <strong>Lei nº 12.965/2014</strong> – Marco Civil da Internet<br />
              • <strong>Decreto nº 8.771/2016</strong> – Regulamentação do Marco Civil da Internet<br />
              • <strong>Lei nº 8.078/1990</strong> – Código de Defesa do Consumidor<br />
              • <strong>Constituição Federal de 1988</strong>, Art. 5º, X e XII – Direitos fundamentais à intimidade e ao sigilo de dados
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">12. FORO</h2>
            <p className="text-sm text-muted-foreground">
              Fica eleito o foro da Comarca de Belém, Estado do Pará, para dirimir quaisquer controvérsias oriundas desta Política de Privacidade, nos termos do <strong>Art. 63 do Código de Processo Civil (Lei nº 13.105/2015)</strong>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
