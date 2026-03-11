import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PraefectusLogo from '@/components/shared/PraefectusLogo';

export default function TermosDeUso() {
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
          <Scale className="w-6 h-6 text-accent" />
          <h1 className="text-3xl font-bold tracking-tight">Termos de Uso</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-8">Última atualização: 02 de março de 2026</p>

        <div className="prose prose-sm max-w-none text-foreground space-y-6 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">1. OBJETO</h2>
            <p className="text-sm text-muted-foreground">
               Os presentes Termos de Uso regulam as condições de acesso e utilização da plataforma <strong>PRAEFECTUS</strong> ("Plataforma"), de propriedade e operação da <strong>PRAEFECTUS DADOS E CORPORATIVO LTDA</strong> ("Empresa"), um sistema de gestão inteligente de licitações públicas que utiliza inteligência artificial para auxiliar empresas no processo licitatório, nos termos da <strong>Lei nº 14.133/2021</strong> (Nova Lei de Licitações e Contratos Administrativos).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">2. ACEITAÇÃO DOS TERMOS</h2>
            <p className="text-sm text-muted-foreground">
              Ao realizar o cadastro e utilizar a Plataforma, o USUÁRIO declara ter lido, compreendido e aceito integralmente os presentes Termos de Uso e a Política de Privacidade, nos termos do <strong>Art. 7º, I, da Lei nº 13.709/2018</strong> (Lei Geral de Proteção de Dados – LGPD), manifestando consentimento livre, informado e inequívoco para o tratamento de seus dados pessoais nas finalidades aqui descritas.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">3. CAPACIDADE JURÍDICA</h2>
            <p className="text-sm text-muted-foreground">
              A utilização da Plataforma é restrita a pessoas físicas maiores de 18 (dezoito) anos, plenamente capazes nos termos dos <strong>Arts. 3º e 4º do Código Civil Brasileiro (Lei nº 10.406/2002)</strong>, ou a pessoas jurídicas regularmente constituídas conforme a legislação brasileira.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">4. CADASTRO E DADOS DO USUÁRIO</h2>
            <p className="text-sm text-muted-foreground">
              4.1. O USUÁRIO compromete-se a fornecer informações verdadeiras, precisas, atuais e completas no momento do cadastro, conforme exigido pelo <strong>Art. 6º, V, da LGPD</strong> (princípio da qualidade dos dados).<br /><br />
              4.2. O USUÁRIO é exclusivamente responsável pela guarda e sigilo de suas credenciais de acesso (e-mail e senha), respondendo por qualquer atividade realizada em sua conta.<br /><br />
              4.3. O certificado digital (e-CNPJ/A1), quando cadastrado, será utilizado exclusivamente para funcionalidades da Plataforma, em conformidade com a <strong>Medida Provisória nº 2.200-2/2001</strong> que instituiu a Infraestrutura de Chaves Públicas Brasileira (ICP-Brasil).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">5. FUNCIONALIDADES E LIMITAÇÕES</h2>
            <p className="text-sm text-muted-foreground">
              5.1. A Plataforma oferece ferramentas de inteligência artificial para análise de editais, elaboração de propostas comerciais, pesquisa de preços, monitoramento de licitações e apoio jurídico, em conformidade com a <strong>Lei nº 14.133/2021</strong>.<br /><br />
              5.2. As análises, documentos e sugestões gerados por inteligência artificial possuem caráter <strong>meramente orientativo e auxiliar</strong>, não substituindo o parecer de profissionais especializados (advogados, contadores, engenheiros).<br /><br />
              5.3. A Plataforma <strong>não garante</strong> resultados em processos licitatórios, sendo o USUÁRIO exclusivamente responsável pelas decisões tomadas com base nas informações fornecidas pelo sistema.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">6. PROPRIEDADE INTELECTUAL</h2>
            <p className="text-sm text-muted-foreground">
              6.1. Todos os direitos de propriedade intelectual sobre a Plataforma, incluindo código-fonte, design, marcas, logotipos, textos, gráficos e demais elementos, são protegidos pela <strong>Lei nº 9.610/1998</strong> (Lei de Direitos Autorais) e pela <strong>Lei nº 9.279/1996</strong> (Lei de Propriedade Industrial).<br /><br />
              6.2. Os documentos e conteúdos gerados pelo USUÁRIO através da Plataforma são de propriedade do USUÁRIO, cabendo à Plataforma licença limitada para processamento técnico.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">7. RESPONSABILIDADES DO USUÁRIO</h2>
            <p className="text-sm text-muted-foreground">
              O USUÁRIO compromete-se a:<br /><br />
              a) Utilizar a Plataforma em conformidade com a legislação vigente, a moral e os bons costumes;<br />
              b) Não utilizar a Plataforma para fins ilícitos, fraudulentos ou que atentem contra direitos de terceiros;<br />
              c) Não reproduzir, distribuir ou explorar comercialmente o conteúdo da Plataforma sem autorização prévia e expressa;<br />
              d) Manter atualizados seus dados cadastrais;<br />
              e) Comunicar imediatamente qualquer uso não autorizado de sua conta.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">8. LIMITAÇÃO DE RESPONSABILIDADE</h2>
            <p className="text-sm text-muted-foreground">
              8.1. A Plataforma não se responsabiliza por danos diretos, indiretos, incidentais, consequenciais ou especiais decorrentes do uso ou da impossibilidade de uso do serviço, nos limites da legislação aplicável.<br /><br />
              8.2. A Plataforma não se responsabiliza por indisponibilidades temporárias decorrentes de manutenção, falhas técnicas, caso fortuito ou força maior, nos termos do <strong>Art. 393 do Código Civil</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">9. PERÍODO DE TESTE GRATUITO</h2>
            <p className="text-sm text-muted-foreground">
              9.1. A Plataforma oferece período de teste gratuito de 15 (quinze) dias, conforme as condições vigentes no momento do cadastro.<br /><br />
              9.2. Após o período de teste, o acesso às funcionalidades será condicionado à contratação de um dos planos disponíveis, conforme o <strong>Código de Defesa do Consumidor (Lei nº 8.078/1990)</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">10. RESCISÃO E CANCELAMENTO</h2>
            <p className="text-sm text-muted-foreground">
              10.1. O USUÁRIO poderá solicitar o cancelamento de sua conta a qualquer momento, garantindo-se o direito à portabilidade e exclusão de seus dados pessoais, nos termos dos <strong>Arts. 18 e 19 da LGPD</strong>.<br /><br />
              10.2. A Plataforma poderá suspender ou encerrar a conta de USUÁRIOS que violarem estes Termos de Uso, mediante notificação prévia, salvo em casos de urgência.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">11. MODIFICAÇÕES DOS TERMOS</h2>
            <p className="text-sm text-muted-foreground">
              A Plataforma reserva-se o direito de modificar estes Termos a qualquer momento, notificando os USUÁRIOS com antecedência mínima de 30 (trinta) dias. O uso continuado da Plataforma após a notificação implicará aceitação tácita das alterações.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">12. FORO E LEGISLAÇÃO APLICÁVEL</h2>
            <p className="text-sm text-muted-foreground">
              Os presentes Termos serão regidos e interpretados de acordo com as leis da República Federativa do Brasil. Fica eleito o foro da Comarca de Belém, Estado do Pará, para dirimir quaisquer controvérsias oriundas deste instrumento, com renúncia expressa a qualquer outro, por mais privilegiado que seja, nos termos do <strong>Art. 63 do Código de Processo Civil (Lei nº 13.105/2015)</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">13. BASE LEGAL</h2>
            <p className="text-sm text-muted-foreground">
              Os presentes Termos de Uso estão fundamentados nas seguintes normas do ordenamento jurídico brasileiro:<br /><br />
              • <strong>Lei nº 13.709/2018</strong> – Lei Geral de Proteção de Dados (LGPD)<br />
              • <strong>Lei nº 14.133/2021</strong> – Nova Lei de Licitações e Contratos Administrativos<br />
              • <strong>Lei nº 10.406/2002</strong> – Código Civil Brasileiro<br />
              • <strong>Lei nº 8.078/1990</strong> – Código de Defesa do Consumidor<br />
              • <strong>Lei nº 12.965/2014</strong> – Marco Civil da Internet<br />
              • <strong>Lei nº 9.610/1998</strong> – Lei de Direitos Autorais<br />
              • <strong>Lei nº 9.279/1996</strong> – Lei de Propriedade Industrial<br />
              • <strong>Medida Provisória nº 2.200-2/2001</strong> – ICP-Brasil<br />
              • <strong>Lei nº 13.105/2015</strong> – Código de Processo Civil
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
