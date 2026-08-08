import { ArrowLeft, FileText, Shield, Globe, Server, Lock, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import PraefectusLogo from '@/components/shared/PraefectusLogo';

export default function DpaPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <PraefectusLogo size="md" />
          <div className="flex-1" />
          <FileText className="w-5 h-5 text-muted-foreground" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10 prose prose-sm dark:prose-invert max-w-none">
        <h1 className="text-3xl font-bold mb-2">Acordo de Processamento de Dados (DPA)</h1>
        <p className="text-muted-foreground text-sm mb-8">
          Data Processing Agreement — Última atualização: Abril 2026
        </p>

        <div className="bg-muted border border-border rounded-xl p-5 mb-8">
          <p className="text-sm text-foreground">
            Este Acordo de Processamento de Dados ("DPA") é celebrado entre a <strong>PRAEFECTUS DADOS E CORPORATIVO LTDA</strong> ("Operadora") e o cliente contratante ("Controlador") como parte integrante dos Termos de Uso da plataforma PRAEFECTUS, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
          </p>
        </div>

        {/* 1. Definições */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <h2 className="text-xl font-bold m-0">1. Definições</h2>
          </div>
          <ul className="space-y-2">
            <li><strong>Dados Pessoais:</strong> Qualquer informação relacionada a pessoa natural identificada ou identificável, conforme Art. 5º, I da LGPD.</li>
            <li><strong>Controlador:</strong> Pessoa natural ou jurídica que utiliza a plataforma PRAEFECTUS e determina as finalidades do tratamento de dados.</li>
            <li><strong>Operadora:</strong> PRAEFECTUS DADOS E CORPORATIVO LTDA, que realiza o tratamento de dados em nome do Controlador.</li>
            <li><strong>Suboperador:</strong> Terceiro contratado pela Operadora para auxiliar no tratamento de dados.</li>
            <li><strong>Tratamento:</strong> Toda operação realizada com dados pessoais conforme Art. 5º, X da LGPD.</li>
            <li><strong>Incidente de Segurança:</strong> Qualquer evento adverso que comprometa a confidencialidade, integridade ou disponibilidade de dados pessoais.</li>
          </ul>
        </section>

        {/* 2. Objeto */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <h2 className="text-xl font-bold m-0">2. Objeto e Finalidade do Tratamento</h2>
          </div>
          <p>A Operadora tratará dados pessoais exclusivamente para as seguintes finalidades:</p>
          <ul className="space-y-1">
            <li>Operação e manutenção da plataforma PRAEFECTUS de gestão de licitações;</li>
            <li>Monitoramento de editais e processos licitatórios;</li>
            <li>Geração de análises, relatórios e precificação;</li>
            <li>Comunicações transacionais (alertas, notificações, boletins);</li>
            <li>Suporte técnico e atendimento ao cliente;</li>
            <li>Cumprimento de obrigações legais e regulatórias.</li>
          </ul>
        </section>

        {/* 3. Categorias de Dados */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <UserCheck className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <h2 className="text-xl font-bold m-0">3. Categorias de Dados Tratados</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4">Categoria</th>
                  <th className="text-left py-2 pr-4">Exemplos</th>
                  <th className="text-left py-2">Base Legal (LGPD)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-medium">Dados cadastrais</td>
                  <td className="py-2 pr-4">Nome, e-mail, telefone, cargo</td>
                  <td className="py-2">Art. 7º, V (execução de contrato)</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-medium">Dados empresariais</td>
                  <td className="py-2 pr-4">CNPJ, razão social, endereço, CNAE</td>
                  <td className="py-2">Art. 7º, V (execução de contrato)</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-medium">Dados de uso</td>
                  <td className="py-2 pr-4">Logs de acesso, IPs, ações na plataforma</td>
                  <td className="py-2">Art. 7º, IX (legítimo interesse)</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-medium">Dados financeiros</td>
                  <td className="py-2 pr-4">Dados de pagamento (via Stripe)</td>
                  <td className="py-2">Art. 7º, V (execução de contrato)</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium">Documentos</td>
                  <td className="py-2 pr-4">Editais, propostas, certidões (uploads)</td>
                  <td className="py-2">Art. 7º, I (consentimento)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 4. Suboperadores */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <h2 className="text-xl font-bold m-0">4. Suboperadores Autorizados</h2>
          </div>
          <p>O Controlador autoriza a Operadora a utilizar os seguintes suboperadores:</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4">Suboperador</th>
                  <th className="text-left py-2 pr-4">Finalidade</th>
                  <th className="text-left py-2">Localização</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-medium">Supabase Inc.</td>
                  <td className="py-2 pr-4">Banco de dados, autenticação, armazenamento</td>
                  <td className="py-2">EUA (AWS us-east-1)</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-medium">Cloudflare Inc.</td>
                  <td className="py-2 pr-4">CDN, WAF, proteção DDoS, DNS</td>
                  <td className="py-2">Global (edge nodes)</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-medium">Stripe Inc.</td>
                  <td className="py-2 pr-4">Processamento de pagamentos</td>
                  <td className="py-2">EUA / Irlanda</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-medium">Google LLC</td>
                  <td className="py-2 pr-4">Modelos de IA (Gemini), Analytics</td>
                  <td className="py-2">EUA</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium">OpenAI Inc.</td>
                  <td className="py-2 pr-4">Modelos de IA (GPT)</td>
                  <td className="py-2">EUA</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Transferências internacionais são realizadas com base no Art. 33, II da LGPD (cláusulas contratuais padrão) e na adequação das políticas de privacidade dos suboperadores.
          </p>
        </section>

        {/* 5. Medidas de Segurança */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <h2 className="text-xl font-bold m-0">5. Medidas Técnicas e Organizacionais</h2>
          </div>
          <p>A Operadora implementa as seguintes medidas de segurança:</p>
          <ul className="space-y-1">
            <li><strong>Criptografia:</strong> TLS 1.3 em trânsito; AES-256-GCM para dados em repouso (credenciais e certificados);</li>
            <li><strong>Controle de acesso:</strong> RBAC (Role-Based Access Control) com isolamento multi-tenant via Row Level Security (RLS);</li>
            <li><strong>Autenticação:</strong> Suporte a MFA/2FA via TOTP; senhas validadas contra banco de vazamentos (HIBP);</li>
            <li><strong>Auditoria:</strong> Trilha de auditoria com hash encadeado (chained hash) para integridade criptográfica;</li>
            <li><strong>Proteção de rede:</strong> WAF Cloudflare, proteção DDoS, HSTS com preload;</li>
            <li><strong>Backup:</strong> Backups automatizados com verificação de integridade;</li>
            <li><strong>Monitoramento:</strong> Health checks automatizados, logs de Edge Functions, alertas de segurança;</li>
            <li><strong>Separação de dados sensíveis:</strong> Views seguras (security_invoker) para ocultar PII do frontend.</li>
          </ul>
        </section>

        {/* 6. Incidentes */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-5 h-5 text-destructive flex-shrink-0" />
            <h2 className="text-xl font-bold m-0">6. Notificação de Incidentes</h2>
          </div>
          <p>Em caso de incidente de segurança envolvendo dados pessoais, a Operadora se compromete a:</p>
          <ol className="space-y-1">
            <li>Notificar o Controlador em até <strong>72 horas</strong> após a confirmação do incidente;</li>
            <li>Fornecer relatório detalhado contendo: natureza dos dados afetados, número de titulares impactados, medidas de contenção adotadas e plano de remediação;</li>
            <li>Cooperar com a Autoridade Nacional de Proteção de Dados (ANPD), conforme Art. 48 da LGPD;</li>
            <li>Implementar medidas corretivas para prevenir recorrência.</li>
          </ol>
        </section>

        {/* 7. Direitos dos Titulares */}
        <section className="mb-8">
          <h2 className="text-xl font-bold">7. Direitos dos Titulares (Art. 18 da LGPD)</h2>
          <p>A Operadora auxiliará o Controlador no atendimento às solicitações dos titulares, incluindo:</p>
          <ul className="space-y-1">
            <li>Confirmação de existência de tratamento;</li>
            <li>Acesso aos dados pessoais;</li>
            <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
            <li>Anonimização, bloqueio ou eliminação de dados desnecessários;</li>
            <li>Portabilidade dos dados;</li>
            <li>Eliminação dos dados tratados com consentimento;</li>
            <li>Revogação do consentimento.</li>
          </ul>
          <p className="text-sm">
            Solicitações podem ser feitas através da plataforma em <strong>Configurações → Segurança → Meus Dados (LGPD)</strong> ou pelo e-mail{' '}
            <a href="mailto:dpo@praefectus.com.br" className="text-accent">dpo@praefectus.com.br</a>.
          </p>
        </section>

        {/* 8. Retenção */}
        <section className="mb-8">
          <h2 className="text-xl font-bold">8. Retenção e Eliminação de Dados</h2>
          <ul className="space-y-1">
            <li>Dados pessoais serão mantidos durante a vigência do contrato e pelo prazo legal obrigatório;</li>
            <li>Após o término do contrato ou solicitação de exclusão, os dados serão eliminados em até <strong>30 dias</strong>, exceto quando houver obrigação legal de retenção;</li>
            <li>Logs de auditoria são mantidos por <strong>5 anos</strong> para fins de conformidade com a Lei de Licitações (Lei nº 14.133/2021);</li>
            <li>Backups são eliminados dentro do ciclo de rotação (máximo 90 dias).</li>
          </ul>
        </section>

        {/* 9. Vigência */}
        <section className="mb-8">
          <h2 className="text-xl font-bold">9. Vigência</h2>
          <p>
            Este DPA entra em vigor na data de aceitação dos Termos de Uso e permanece vigente enquanto a Operadora tratar dados pessoais em nome do Controlador. As obrigações de confidencialidade e segurança sobrevivem ao término deste acordo.
          </p>
        </section>

        {/* 10. Contato */}
        <section className="mb-8">
          <h2 className="text-xl font-bold">10. Encarregado de Proteção de Dados (DPO)</h2>
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-sm mb-1"><strong>PRAEFECTUS DADOS E CORPORATIVO LTDA</strong></p>
            <p className="text-sm text-muted-foreground">
              Encarregado: <a href="mailto:dpo@praefectus.com.br" className="text-accent">dpo@praefectus.com.br</a>
            </p>
            <p className="text-sm text-muted-foreground">
              Compliance: <a href="mailto:compliance@praefectus.com.br" className="text-accent">compliance@praefectus.com.br</a>
            </p>
          </div>
        </section>

        {/* 11. Foro */}
        <section className="mb-8">
          <h2 className="text-xl font-bold">11. Disposições Gerais</h2>
          <ul className="space-y-1">
            <li>Este DPA prevalece sobre quaisquer disposições contraditórias nos Termos de Uso;</li>
            <li>Alterações neste DPA serão comunicadas com <strong>30 dias</strong> de antecedência;</li>
            <li>Fica eleito o foro da Comarca de <strong>Belém/PA</strong> para dirimir quaisquer controvérsias.</li>
          </ul>
        </section>

        <div className="border-t border-border pt-6 mt-10 text-center">
          <p className="text-xs text-muted-foreground">
            PRAEFECTUS DADOS E CORPORATIVO LTDA — CNPJ: XX.XXX.XXX/0001-XX<br />
            Documento válido a partir de Abril de 2026.
          </p>
        </div>
      </main>
    </div>
  );
}
