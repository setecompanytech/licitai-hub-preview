import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Scale } from 'lucide-react';
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
          <Scale className="w-6 h-6 text-muted-foreground" />
          <h1 className="text-3xl font-bold tracking-tight">Termos de Uso</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-8">Última atualização: 02 de abril de 2026</p>

        <div className="prose prose-sm max-w-none text-foreground space-y-8 leading-relaxed">

          {/* 1 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">1. ACEITE DOS TERMOS</h2>
            <p className="text-sm text-muted-foreground">
              1.1. Os presentes Termos de Uso ("Termos") regulam as condições de acesso e utilização da plataforma <strong>PRAEFECTUS</strong> ("Plataforma"), de propriedade e operação da <strong>PRAEFECTUS DADOS E CORPORATIVO LTDA</strong> ("CONTRATADA"), inscrita no CNPJ sob o nº [inserir CNPJ], com sede em [inserir endereço completo].<br /><br />

              1.2. Ao realizar o cadastro na Plataforma, o USUÁRIO manifesta, de forma livre, informada e inequívoca, sua concordância integral com os presentes Termos e com a <a href="/politica-privacidade" className="text-primary hover:underline">Política de Privacidade</a>, constituindo aceite eletrônico vinculante nos termos do <strong>Art. 107 do Código Civil (Lei nº 10.406/2002)</strong> e do <strong>Art. 7º, §8º, do Marco Civil da Internet (Lei nº 12.965/2014)</strong>.<br /><br />

              1.3. Caso o USUÁRIO não concorde com quaisquer disposições destes Termos, deverá abster-se de utilizar a Plataforma.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">2. OBJETO</h2>
            <p className="text-sm text-muted-foreground">
              2.1. A Plataforma constitui um sistema de gestão inteligente de licitações públicas, fornecido sob o modelo <strong>Software as a Service (SaaS)</strong>, que utiliza inteligência artificial para auxiliar empresas fornecedoras em todo o ciclo do processo licitatório.<br /><br />

              2.2. As funcionalidades incluem, de forma não exaustiva: monitoramento de editais em portais públicos, elaboração de propostas comerciais, motor de precificação, pesquisa de preços, apoio jurídico e contábil, gestão de contratos, módulo financeiro, robô de lances automatizado e CRM integrado.<br /><br />

              2.3. A Plataforma possui natureza de <strong>ferramenta de inteligência e apoio à decisão</strong> para fornecedores (licitantes). As análises, documentos e sugestões gerados por inteligência artificial possuem caráter <strong>meramente orientativo e auxiliar</strong>, não substituindo o parecer de profissionais especializados (advogados, contadores, engenheiros) nem configurando prestação de serviço profissional regulamentado.<br /><br />

              2.4. A CONTRATADA <strong>não garante</strong> resultados em processos licitatórios, sendo o USUÁRIO o exclusivo responsável pelas decisões tomadas com base nas informações e funcionalidades disponibilizadas pela Plataforma.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">3. CADASTRO E RESPONSABILIDADE</h2>
            <p className="text-sm text-muted-foreground">
              3.1. A utilização da Plataforma é restrita a pessoas físicas maiores de 18 (dezoito) anos, plenamente capazes nos termos dos <strong>Arts. 3º e 4º do Código Civil</strong>, ou a pessoas jurídicas regularmente constituídas conforme a legislação brasileira, representadas por pessoa física devidamente autorizada.<br /><br />

              3.2. <strong>Veracidade dos dados:</strong> O USUÁRIO compromete-se a fornecer informações verdadeiras, precisas, atuais e completas no momento do cadastro e a mantê-las atualizadas durante toda a vigência da relação contratual, em observância ao princípio da qualidade dos dados previsto no <strong>Art. 6º, V, da LGPD</strong>. A CONTRATADA reserva-se o direito de suspender contas cujas informações cadastrais sejam comprovadamente falsas ou incompletas.<br /><br />

              3.3. <strong>Confidencialidade de credenciais:</strong> O USUÁRIO é exclusivamente responsável pela guarda, sigilo e uso adequado de suas credenciais de acesso (e-mail e senha). Qualquer operação realizada com as credenciais do USUÁRIO será de sua inteira responsabilidade, devendo comunicar imediatamente à CONTRATADA qualquer uso não autorizado ou suspeita de violação de segurança.<br /><br />

              3.4. O certificado digital (e-CNPJ/A1), quando cadastrado pelo USUÁRIO, será processado exclusivamente em memória volátil para execução das funcionalidades contratadas, sem armazenamento permanente, em conformidade com a <strong>Medida Provisória nº 2.200-2/2001</strong> (ICP-Brasil).
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">4. USO DA PLATAFORMA</h2>
            <p className="text-sm text-muted-foreground">
              4.1. <strong>Uso lícito:</strong> O USUÁRIO obriga-se a utilizar a Plataforma exclusivamente para finalidades lícitas, em conformidade com a legislação vigente, com os presentes Termos e com os princípios da boa-fé e da função social do contrato, previstos nos <strong>Arts. 421 e 422 do Código Civil</strong>.<br /><br />

              4.2. <strong>Vedação de uso indevido:</strong> É expressamente vedado ao USUÁRIO:<br /><br />

              a) Utilizar a Plataforma para fins ilícitos, fraudulentos ou que atentem contra direitos de terceiros, incluindo, sem limitação, práticas de conluio (<em>bid rigging</em>) em processos licitatórios, nos termos da <strong>Lei nº 12.846/2013</strong> (Lei Anticorrupção);<br /><br />

              b) Reproduzir, distribuir, sublicenciar ou explorar comercialmente o conteúdo, as funcionalidades ou os resultados da Plataforma sem autorização prévia e expressa da CONTRATADA;<br /><br />

              c) Compartilhar credenciais de acesso com terceiros não autorizados ou permitir o uso da conta por número de usuários superior ao contratado no plano vigente;<br /><br />

              d) Transmitir conteúdo que contenha vírus, malware, código malicioso ou qualquer elemento que possa comprometer a integridade, a segurança ou o funcionamento da Plataforma;<br /><br />

              e) Realizar coleta automatizada de dados (<em>scraping</em>) ou sobrecarregar intencionalmente os servidores da Plataforma.<br /><br />

              4.3. <strong>Vedação de engenharia reversa:</strong> É terminantemente proibido ao USUÁRIO realizar engenharia reversa, descompilação, desmontagem, tradução, adaptação ou qualquer tentativa de derivar o código-fonte da Plataforma, no todo ou em parte, nos termos do <strong>Art. 6º da Lei nº 9.609/1998</strong> (Lei de Software).
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">5. PROPRIEDADE INTELECTUAL</h2>
            <p className="text-sm text-muted-foreground">
              5.1. <strong>Titularidade do software:</strong> Todos os direitos de propriedade intelectual sobre a Plataforma, incluindo, sem limitação, código-fonte, arquitetura, design, marcas, logotipos, textos, algoritmos de inteligência artificial, bases de dados e demais elementos, são de titularidade exclusiva da CONTRATADA, protegidos pela <strong>Lei nº 9.609/1998</strong> (Lei de Software), pela <strong>Lei nº 9.610/1998</strong> (Lei de Direitos Autorais) e pela <strong>Lei nº 9.279/1996</strong> (Lei de Propriedade Industrial).<br /><br />

              5.2. <strong>Licença de uso não exclusiva:</strong> Mediante a contratação de um plano de assinatura, a CONTRATADA concede ao USUÁRIO uma licença de uso não exclusiva, intransferível, revogável e limitada ao prazo da assinatura vigente, exclusivamente para acesso e utilização das funcionalidades da Plataforma conforme o plano contratado. Esta licença não implica cessão ou transferência de quaisquer direitos de propriedade intelectual.<br /><br />

              5.3. <strong>Conteúdo do USUÁRIO:</strong> Os documentos, propostas, planilhas e demais conteúdos inseridos ou gerados pelo USUÁRIO por meio da Plataforma permanecem de propriedade do USUÁRIO. A CONTRATADA detém licença limitada e temporária para processamento técnico, exclusivamente para a prestação do serviço contratado.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">6. PLANOS, COBRANÇA E PAGAMENTO</h2>
            <p className="text-sm text-muted-foreground">
              6.1. <strong>Assinatura:</strong> O acesso às funcionalidades da Plataforma é condicionado à contratação de um dos planos de assinatura disponíveis (Básico, Profissional, Enterprise Start, Enterprise Pro ou Enterprise Max), conforme as condições, funcionalidades e limites vigentes no momento da contratação. A Plataforma poderá oferecer período de teste gratuito, nas condições anunciadas no momento do cadastro.<br /><br />

              6.2. <strong>Ciclos de cobrança:</strong> Os planos são oferecidos nos ciclos mensal, trimestral, semestral e anual, com descontos progressivos de 10%, 15% e 20% para ciclos trimestrais, semestrais e anuais, respectivamente. Os valores são cobrados antecipadamente, no início de cada ciclo.<br /><br />

              6.3. <strong>Alteração de valores:</strong> A CONTRATADA reserva-se o direito de reajustar os valores dos planos, mediante comunicação prévia com antecedência mínima de <strong>30 (trinta) dias</strong>. O reajuste será aplicado ao próximo ciclo de cobrança, assegurado ao USUÁRIO o direito de cancelar a assinatura antes da aplicação do novo valor.<br /><br />

              6.4. <strong>Cancelamento:</strong> O USUÁRIO poderá cancelar sua assinatura a qualquer tempo, sem multa ou penalidade. O cancelamento terá efeito ao final do ciclo de cobrança vigente, permanecendo o acesso às funcionalidades até o término do período já pago. Não haverá reembolso proporcional de valores pagos referentes ao ciclo em curso, salvo nos casos previstos no <strong>Art. 49 do Código de Defesa do Consumidor (Lei nº 8.078/1990)</strong> — direito de arrependimento no prazo de 7 (sete) dias contados da contratação, quando aplicável.<br /><br />

              6.5. <strong>Inadimplência:</strong> Em caso de inadimplência, a CONTRATADA poderá suspender o acesso do USUÁRIO às funcionalidades da Plataforma após <strong>5 (cinco) dias</strong> do vencimento, mediante notificação prévia por e-mail. A suspensão não implica rescisão contratual nem eliminação dos dados do USUÁRIO, que serão mantidos pelo prazo de <strong>90 (noventa) dias</strong> contados da suspensão, período no qual o USUÁRIO poderá regularizar sua situação e restabelecer o acesso. Após esse prazo, a conta poderá ser encerrada e os dados eliminados, observados os prazos legais de retenção.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">7. LIMITAÇÃO DE RESPONSABILIDADE</h2>
            <p className="text-sm text-muted-foreground">
              7.1. <strong>Indisponibilidade temporária:</strong> A CONTRATADA não será responsabilizada por indisponibilidades temporárias da Plataforma decorrentes de manutenções programadas (previamente comunicadas), atualizações de sistema, caso fortuito ou força maior, nos termos do <strong>Art. 393 do Código Civil</strong>. A CONTRATADA envidará esforços razoáveis para manter a disponibilidade do serviço e comunicar interrupções programadas com antecedência.<br /><br />

              7.2. <strong>Falhas de terceiros:</strong> A CONTRATADA não será responsabilizada por falhas, indisponibilidades ou alterações em serviços de terceiros que afetem o funcionamento da Plataforma, incluindo, sem limitação: portais de compras governamentais (ComprasGov, PNCP, portais estaduais e municipais), provedores de infraestrutura em nuvem, serviços de processamento de pagamento e provedores de comunicação.<br /><br />

              7.3. <strong>Decisões do USUÁRIO:</strong> A CONTRATADA não será responsabilizada por quaisquer danos, perdas ou prejuízos decorrentes de decisões tomadas pelo USUÁRIO com base nas análises, sugestões, documentos ou informações geradas pela Plataforma, incluindo resultados de processos licitatórios. O USUÁRIO reconhece que a Plataforma é uma ferramenta de apoio à decisão e que a responsabilidade final sobre qualquer ação ou omissão é exclusivamente sua.<br /><br />

              7.4. <strong>Limite de responsabilidade:</strong> Sem prejuízo das disposições anteriores e ressalvadas as hipóteses de dolo ou culpa grave, a responsabilidade total da CONTRATADA perante o USUÁRIO, por quaisquer danos diretos comprovados, será limitada ao valor total pago pelo USUÁRIO nos <strong>12 (doze) meses</strong> imediatamente anteriores ao evento que deu origem ao dano. Esta limitação não se aplica às hipóteses de responsabilidade que não admitam limitação por força de lei.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">8. OBRIGAÇÕES DO USUÁRIO</h2>
            <p className="text-sm text-muted-foreground">
              Sem prejuízo das demais obrigações previstas nestes Termos, o USUÁRIO obriga-se a:<br /><br />

              a) Utilizar a Plataforma de boa-fé, em conformidade com a legislação vigente, com estes Termos e com a <a href="/politica-privacidade" className="text-primary hover:underline">Política de Privacidade</a>;<br /><br />

              b) Manter seus dados cadastrais atualizados e comunicar quaisquer alterações relevantes;<br /><br />

              c) Zelar pela confidencialidade de suas credenciais de acesso e notificar a CONTRATADA imediatamente em caso de uso não autorizado;<br /><br />

              d) Não utilizar a Plataforma para violar direitos de terceiros, incluindo direitos de propriedade intelectual, privacidade e proteção de dados;<br /><br />

              e) Responsabilizar-se pela veracidade, legalidade e adequação dos documentos, informações e dados inseridos na Plataforma;<br /><br />

              f) Observar os limites de uso do plano contratado, incluindo número de CNPJs, usuários e sessões simultâneas;<br /><br />

              g) Efetuar o pagamento pontual dos valores relativos ao plano contratado.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">9. OBRIGAÇÕES DA PLATAFORMA</h2>
            <p className="text-sm text-muted-foreground">
              A CONTRATADA obriga-se a:<br /><br />

              a) Disponibilizar a Plataforma e suas funcionalidades conforme o plano contratado pelo USUÁRIO, envidando esforços razoáveis para manter a disponibilidade e a qualidade do serviço;<br /><br />

              b) Adotar medidas técnicas e administrativas adequadas para proteger os dados pessoais do USUÁRIO contra acessos não autorizados e situações acidentais ou ilícitas, nos termos do <strong>Art. 46 da LGPD</strong>;<br /><br />

              c) Comunicar ao USUÁRIO, com antecedência razoável, quaisquer alterações relevantes nas funcionalidades, nos Termos de Uso ou na Política de Privacidade;<br /><br />

              d) Disponibilizar canais de suporte técnico ao USUÁRIO, conforme o plano contratado;<br /><br />

              e) Comunicar ao USUÁRIO e à ANPD a ocorrência de incidentes de segurança que possam acarretar risco ou dano relevante, nos termos do <strong>Art. 48 da LGPD</strong>;<br /><br />

              f) Não utilizar os dados e conteúdos do USUÁRIO para finalidades diversas da prestação do serviço contratado, salvo quando expressamente autorizado ou quando necessário para cumprimento de obrigação legal.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">10. PROTEÇÃO DE DADOS PESSOAIS</h2>
            <p className="text-sm text-muted-foreground">
              10.1. O tratamento de dados pessoais realizado pela CONTRATADA observa integralmente a <strong>Lei nº 13.709/2018</strong> (LGPD), conforme detalhado na <a href="/politica-privacidade" className="text-primary hover:underline">Política de Privacidade</a>, que integra os presentes Termos para todos os fins de direito.<br /><br />

              10.2. A <a href="/politica-privacidade" className="text-primary hover:underline">Política de Privacidade</a> descreve as categorias de dados coletados, as finalidades e bases legais do tratamento, os direitos do titular, as medidas de segurança adotadas, os critérios de compartilhamento e retenção de dados, bem como os dados de contato do Encarregado de Proteção de Dados (DPO).<br /><br />

              10.3. O USUÁRIO reconhece que a utilização da Plataforma implica o tratamento de seus dados pessoais nas formas e finalidades descritas na Política de Privacidade.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">11. SUSPENSÃO E RESCISÃO</h2>
            <p className="text-sm text-muted-foreground">
              11.1. <strong>Suspensão por violação:</strong> A CONTRATADA poderá suspender, imediata e unilateralmente, o acesso do USUÁRIO à Plataforma nas seguintes hipóteses:<br /><br />

              a) Violação de quaisquer disposições dos presentes Termos;<br />
              b) Prática de atos ilícitos ou fraudulentos por meio da Plataforma;<br />
              c) Utilização da Plataforma de forma que comprometa a segurança, a estabilidade ou a integridade do sistema;<br />
              d) Inadimplência, após o decurso do prazo previsto na Cláusula 6.5.<br /><br />

              11.2. <strong>Rescisão pelo USUÁRIO:</strong> O USUÁRIO poderá rescindir o contrato a qualquer tempo, mediante solicitação de cancelamento da assinatura, nos termos da Cláusula 6.4.<br /><br />

              11.3. <strong>Rescisão pela CONTRATADA:</strong> A CONTRATADA poderá rescindir o contrato, mediante notificação prévia de <strong>30 (trinta) dias</strong>, em caso de descontinuação da Plataforma ou por decisão estratégica, assegurado ao USUÁRIO o direito à portabilidade e à eliminação de seus dados, nos termos da LGPD.<br /><br />

              11.4. <strong>Efeitos da rescisão:</strong> Independentemente da causa, a rescisão contratual assegurará ao USUÁRIO: (i) o acesso aos seus dados até o término do período já pago; (ii) o direito de exportar seus dados no prazo de <strong>30 (trinta) dias</strong> após a rescisão; e (iii) a eliminação dos dados pessoais após o decurso dos prazos legais de retenção, nos termos do Art. 16 da LGPD.
            </p>
          </section>

          {/* 12 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">12. DISPOSIÇÕES GERAIS</h2>
            <p className="text-sm text-muted-foreground">
              12.1. <strong>Modificações dos Termos:</strong> A CONTRATADA reserva-se o direito de modificar os presentes Termos a qualquer tempo, mediante notificação ao USUÁRIO com antecedência mínima de <strong>30 (trinta) dias</strong>, por meio de comunicação na Plataforma ou por e-mail. A continuidade de uso da Plataforma após a publicação das alterações constituirá aceitação dos novos termos.<br /><br />

              12.2. <strong>Independência das cláusulas:</strong> A nulidade ou invalidade de qualquer cláusula destes Termos não afetará a validade e a eficácia das demais disposições, que permanecerão em pleno vigor.<br /><br />

              12.3. <strong>Tolerância:</strong> A eventual tolerância da CONTRATADA em relação ao descumprimento de quaisquer cláusulas pelo USUÁRIO não constituirá renúncia ao direito de exigir seu cumprimento, nos termos do <strong>Art. 838 do Código Civil</strong>.<br /><br />

              12.4. <strong>Cessão:</strong> O USUÁRIO não poderá ceder ou transferir os direitos e obrigações decorrentes destes Termos a terceiros sem o consentimento prévio e por escrito da CONTRATADA.
            </p>
          </section>

          {/* 13 */}
          <section>
            <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">13. FORO E LEGISLAÇÃO APLICÁVEL</h2>
            <p className="text-sm text-muted-foreground">
              13.1. Os presentes Termos são regidos e interpretados de acordo com as leis da República Federativa do Brasil, em especial:<br /><br />

              • <strong>Lei nº 10.406/2002</strong> – Código Civil Brasileiro<br />
              • <strong>Lei nº 12.965/2014</strong> – Marco Civil da Internet<br />
              • <strong>Lei nº 13.709/2018</strong> – Lei Geral de Proteção de Dados (LGPD)<br />
              • <strong>Lei nº 8.078/1990</strong> – Código de Defesa do Consumidor, quando aplicável<br />
              • <strong>Lei nº 9.609/1998</strong> – Lei de Software<br />
              • <strong>Lei nº 9.610/1998</strong> – Lei de Direitos Autorais<br />
              • <strong>Lei nº 9.279/1996</strong> – Lei de Propriedade Industrial<br /><br />

              13.2. Fica eleito o foro da <strong>Comarca de Belém, Estado do Pará</strong>, sede da CONTRATADA, para dirimir quaisquer controvérsias oriundas dos presentes Termos, com renúncia expressa a qualquer outro, por mais privilegiado que seja, nos termos do <strong>Art. 63 do Código de Processo Civil (Lei nº 13.105/2015)</strong>.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
